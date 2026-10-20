// === js/worklets/lib/m68k.js ===
// =========================================================
// MOTOROLA 68000 INTERPRETER (Integer-Befehlssatz, ohne Zyklen/Exceptions)  —  v1.5.0
// ---------------------------------------------------------
// Führt den ORIGINAL-Replay-Code einer Amiga-Musikdatei aus (unkomprimierte Hippel-Dateien mit 68k-Player vor den
// Daten) und meldet jeden Zugriff auf die Custom-Chips ($DFF000..$DFFFFF) und die CIAs über Callbacks.
// Reiner ES-Modul-Code ohne Browser- oder Node-Abhängigkeit (läuft im AudioWorklet).
//
// ZERO-ALLOCATION: step()/call() erzeugen keine Objekte (Fehlerfälle ausgenommen).
//
// Bewusst NICHT implementiert (wirft einen Fehler mit PC/Opcode): Line-A/F, TRAP, RTE/STOP/RESET, BCD-Befehle,
// Address-/Bus-Errors, Interrupts. Ungerade Wort-/Langwortzugriffe werden stillschweigend ausgeführt.
// =========================================================

const MASK = [0xFF, 0xFFFF, 0xFFFFFFFF];
const MSB = [0x80, 0x8000, 0x80000000];

export class M68000 {
    constructor(memSize = 0x100000) {
        this.mem = new Uint8Array(memSize);
        this.memMask = memSize - 1;
        this.d = new Int32Array(8);
        this.a = new Int32Array(8);
        this.pc = 0;
        this.x = 0; this.n = 0; this.z = 0; this.v = 0; this.c = 0;
        this.sr_sys = 0x2000;                       // Supervisor-Bit, Interrupt-Maske 0
        this.instructions = 0;
        this.eaAddr = 0; this.eaReg = -1; this.eaIsAn = false;
        this.onCustomWrite = null;                  // (addr, size, value)
        this.onCustomRead = null;                   // (addr, size) -> value
        this.onUnmappedRead = null;
        this.vhpos = 0;
        this.watchAddr = -1;                        // optionaler Schreib-Watch: onWatch(size, value) bei Schreibzugriff auf diese Adresse
        this.onWatch = null;
    }

    // ------------------------------------------------------------------ Speicher
    read(addr, size) {
        addr &= 0xFFFFFF;
        if (addr >= 0xDFF000 && addr < 0xE00000) return this.onCustomRead ? (this.onCustomRead(addr, size) & MASK[size]) >>> 0 : 0;
        if (addr >= 0xBF0000 && addr < 0xC00000) return this.onCustomRead ? (this.onCustomRead(addr, size) & MASK[size]) >>> 0 : 0;
        const m = this.mem, mm = this.memMask;
        if (size === 0) return m[addr & mm];
        if (size === 1) return (m[addr & mm] << 8) | m[(addr + 1) & mm];
        return (((m[addr & mm] << 24) | (m[(addr + 1) & mm] << 16) | (m[(addr + 2) & mm] << 8) | m[(addr + 3) & mm]) >>> 0);
    }

    write(addr, size, val) {
        addr &= 0xFFFFFF;
        if (addr >= 0xDFF000 && addr < 0xE00000) { if (this.onCustomWrite) this.onCustomWrite(addr, size, (val & MASK[size]) >>> 0); return; }
        if (addr >= 0xBF0000 && addr < 0xC00000) { if (this.onCustomWrite) this.onCustomWrite(addr, size, (val & MASK[size]) >>> 0); return; }
        if (addr === this.watchAddr && this.onWatch !== null) this.onWatch(size, val);
        const m = this.mem, mm = this.memMask;
        if (size === 0) { m[addr & mm] = val; return; }
        if (size === 1) { m[addr & mm] = val >> 8; m[(addr + 1) & mm] = val; return; }
        m[addr & mm] = val >>> 24; m[(addr + 1) & mm] = val >>> 16; m[(addr + 2) & mm] = val >>> 8; m[(addr + 3) & mm] = val;
    }

    fetchW() { const w = this.read(this.pc, 1); this.pc = (this.pc + 2) & 0xFFFFFF; return w; }
    fetchL() { const h = this.fetchW(), l = this.fetchW(); return ((h << 16) | l) >>> 0; }

    // ------------------------------------------------------------------ Hilfen
    static sext(v, size) { return size === 0 ? (v << 24) >> 24 : size === 1 ? (v << 16) >> 16 : v | 0; }
    get ccr() { return (this.x << 4) | (this.n << 3) | (this.z << 2) | (this.v << 1) | this.c; }
    set ccr(v) { this.x = (v >> 4) & 1; this.n = (v >> 3) & 1; this.z = (v >> 2) & 1; this.v = (v >> 1) & 1; this.c = v & 1; }
    get sr() { return this.sr_sys | this.ccr; }
    set sr(v) { this.sr_sys = v & 0xFF00; this.ccr = v & 0xFF; }

    cond(cc) {
        switch (cc) {
            case 0: return true;
            case 1: return false;
            case 2: return !this.c && !this.z;
            case 3: return !!(this.c | this.z);
            case 4: return !this.c;
            case 5: return !!this.c;
            case 6: return !this.z;
            case 7: return !!this.z;
            case 8: return !this.v;
            case 9: return !!this.v;
            case 10: return !this.n;
            case 11: return !!this.n;
            case 12: return this.n === this.v;
            case 13: return this.n !== this.v;
            case 14: return !this.z && this.n === this.v;
            default: return !!this.z || this.n !== this.v;
        }
    }

    push(size, val) { this.a[7] -= (1 << size); this.write(this.a[7], size, val); }
    pop(size) { const v = this.read(this.a[7], size); this.a[7] += (1 << size); return v; }

    setNZ(res, size) { this.n = (res & MSB[size]) ? 1 : 0; this.z = ((res & MASK[size]) >>> 0) === 0 ? 1 : 0; }

    // ------------------------------------------------------------------ Effective Address
    /** Berechnet die EA (Seiteneffekte von (An)+ / -(An) genau einmal). Setzt eaAddr bzw. eaReg/eaIsAn. */
    ea(mode, reg, size) {
        this.eaReg = -1; this.eaIsAn = false;
        switch (mode) {
            case 0: this.eaReg = reg; return;
            case 1: this.eaReg = reg; this.eaIsAn = true; return;
            case 2: this.eaAddr = this.a[reg] >>> 0; return;
            case 3: {
                this.eaAddr = this.a[reg] >>> 0;
                this.a[reg] += (reg === 7 && size === 0) ? 2 : (1 << size);
                return;
            }
            case 4: {
                this.a[reg] -= (reg === 7 && size === 0) ? 2 : (1 << size);
                this.eaAddr = this.a[reg] >>> 0; return;
            }
            case 5: { const d = (this.fetchW() << 16) >> 16; this.eaAddr = (this.a[reg] + d) >>> 0; return; }
            case 6: { this.eaAddr = this.indexed(this.a[reg]); return; }
            default:
                switch (reg) {
                    case 0: this.eaAddr = ((this.fetchW() << 16) >> 16) >>> 0; return;
                    case 1: this.eaAddr = this.fetchL(); return;
                    case 2: { const base = this.pc; const d = (this.fetchW() << 16) >> 16; this.eaAddr = (base + d) >>> 0; return; }
                    case 3: { const base = this.pc; this.eaAddr = this.indexed(base); return; }
                    case 4: {                                                      // #imm: Wert wird direkt gelesen
                        if (size === 2) this.eaAddr = this.pc, this.pc += 4;
                        else this.eaAddr = this.pc + (size === 0 ? 1 : 0), this.pc += 2;
                        this.eaReg = -2; return;
                    }
                }
                throw new Error('ungültiger EA-Modus ' + mode + '/' + reg + ' @' + this.pc.toString(16));
        }
    }

    indexed(base) {
        const ext = this.fetchW();
        const xn = (ext >> 12) & 7, isA = (ext & 0x8000) !== 0, isLong = (ext & 0x0800) !== 0;
        let idx = isA ? this.a[xn] : this.d[xn];
        if (!isLong) idx = (idx << 16) >> 16;
        const disp = (ext << 24) >> 24;
        return (base + disp + idx) >>> 0;                                  // PC-Basis = Adresse des Erweiterungsworts
    }

    readEA(size) {
        if (this.eaReg >= 0) return ((this.eaIsAn ? this.a[this.eaReg] : this.d[this.eaReg]) & MASK[size]) >>> 0;
        return this.read(this.eaAddr, size);
    }
    writeEA(size, val) {
        if (this.eaReg >= 0) {
            const r = this.eaReg;
            if (this.eaIsAn) { this.a[r] = size === 1 ? (val << 16) >> 16 : val | 0; return; }
            if (size === 2) this.d[r] = val | 0;
            else this.d[r] = (this.d[r] & ~MASK[size]) | (val & MASK[size]);
            return;
        }
        this.write(this.eaAddr, size, val);
    }

    // ------------------------------------------------------------------ ALU
    add(src, dst, size, withX = false, setX = true) {
        const m = MASK[size], carryIn = withX ? this.x : 0;
        const sum = (src >>> 0) + (dst >>> 0) + carryIn, res = (sum & m) >>> 0;
        const c = sum > m ? 1 : 0;
        this.v = (((src ^ res) & (dst ^ res) & MSB[size]) !== 0) ? 1 : 0;
        this.c = c; if (setX) this.x = c;
        this.n = (res & MSB[size]) ? 1 : 0;
        if (withX) { if (res !== 0) this.z = 0; } else this.z = res === 0 ? 1 : 0;
        return res;
    }
    sub(src, dst, size, withX = false, setX = true) {
        const m = MASK[size], borrow = withX ? this.x : 0;
        const diff = (dst >>> 0) - (src >>> 0) - borrow, res = (diff & m) >>> 0;
        const c = diff < 0 ? 1 : 0;
        this.v = (((src ^ dst) & (res ^ dst) & MSB[size]) !== 0) ? 1 : 0;
        this.c = c; if (setX) this.x = c;
        this.n = (res & MSB[size]) ? 1 : 0;
        if (withX) { if (res !== 0) this.z = 0; } else this.z = res === 0 ? 1 : 0;
        return res;
    }
    logic(res, size) { this.setNZ(res, size); this.v = 0; this.c = 0; return (res & MASK[size]) >>> 0; }

    shift(kind, left, val, count, size) {
        const m = MASK[size], bits = 8 << size, ms = MSB[size];
        val = (val & m) >>> 0;
        let c = 0, v = 0, res = val;
        if (count === 0) {
            this.c = kind === 4 ? this.x : 0; this.v = 0;                          // ROXx: C = X, sonst C = 0
            this.setNZ(res, size); return res;
        }
        for (let i = 0; i < count; i++) {
            if (left) {
                c = (res & ms) ? 1 : 0;
                switch (kind) {
                    case 0: res = (res << 1) >>> 0; { const nm = (res & ms) ? 1 : 0; if (nm !== c) v = 1; } break;   // ASL
                    case 1: res = (res << 1) >>> 0; break;                                                          // LSL
                    case 2: res = ((res << 1) | c) >>> 0; break;                                                    // ROL
                    case 4: { const xo = this.x; this.x = c; res = ((res << 1) | xo) >>> 0; c = this.x; break; }     // ROXL
                }
            } else {
                c = res & 1;
                switch (kind) {
                    case 0: res = ((res >>> 1) | (res & ms)) >>> 0; break;                                          // ASR
                    case 1: res = res >>> 1; break;                                                                 // LSR
                    case 2: res = ((res >>> 1) | (c ? ms : 0)) >>> 0; break;                                        // ROR
                    case 4: { const xo = this.x; this.x = c; res = ((res >>> 1) | (xo ? ms : 0)) >>> 0; c = this.x; break; } // ROXR
                }
            }
            res = (res & m) >>> 0;
        }
        this.c = c; this.v = v;
        if (kind !== 2) { if (kind === 4) this.x = c; else this.x = c; }
        if (kind === 2 || kind === 3) { /* ROL/ROR: X unverändert */ }
        this.setNZ(res, size);
        return res;
    }

    // ------------------------------------------------------------------ Ausführung
    /** Führt Code ab `addr` aus, bis ein RTS den Stack auf den Ausgangswert zurückführt. */
    call(addr, maxInstr = 5_000_000) {
        const sentinel = 0xFFFFF0, startSp = this.a[7];
        this.push(2, sentinel);
        this.pc = addr;
        const limit = this.instructions + maxInstr;
        while (this.pc !== sentinel) {
            this.step();
            if (this.instructions > limit) throw new Error('Instruktionslimit überschritten bei PC=$' + this.pc.toString(16));
        }
        if (this.a[7] !== startSp) throw new Error('Stack nach RTS nicht ausgeglichen: ' + (this.a[7] - startSp));
    }

    step() {
        const startPc = this.pc;
        const op = this.fetchW();
        this.instructions++;
        this.opPc = startPc;
        const hi = op >> 12;
        switch (hi) {
            case 0x0: return this.group0(op);
            case 0x1: return this.move(op, 0);
            case 0x2: return this.move(op, 2);
            case 0x3: return this.move(op, 1);
            case 0x4: return this.group4(op);
            case 0x5: return this.group5(op);
            case 0x6: return this.branch(op);
            case 0x7: { const v = (op << 24) >> 24; this.d[(op >> 9) & 7] = v; this.setNZ(v >>> 0, 2); this.v = 0; this.c = 0; return; }
            case 0x8: return this.groupOr(op);
            case 0x9: return this.groupSub(op);
            case 0xB: return this.groupCmpEor(op);
            case 0xC: return this.groupAnd(op);
            case 0xD: return this.groupAdd(op);
            case 0xE: return this.groupShift(op);
            default: throw new Error('Line-A/F-Opcode $' + op.toString(16) + ' @$' + startPc.toString(16));
        }
    }

    unimpl(op) { throw new Error('nicht implementierter Opcode $' + op.toString(16).padStart(4, '0') + ' @$' + this.opPc.toString(16)); }

    // ---- MOVE / MOVEA
    move(op, sizeSel) {
        const size = sizeSel;                                   // 0 = Byte (0x1), 2 = Long (0x2), 1 = Wort (0x3)
        this.ea((op >> 3) & 7, op & 7, size);
        const src = this.readEA(size);
        const dmode = (op >> 6) & 7, dreg = (op >> 9) & 7;
        if (dmode === 1) { this.a[dreg] = size === 1 ? (src << 16) >> 16 : src | 0; return; }          // MOVEA
        this.ea(dmode, dreg, size);
        this.writeEA(size, src);
        this.setNZ(src, size); this.v = 0; this.c = 0;
    }

    // ---- Gruppe 0: Immediate, Bit-Operationen
    group0(op) {
        if (op & 0x0100) {                                       // dynamische Bit-Ops oder MOVEP
            const mode = (op >> 3) & 7, reg = op & 7;
            if (mode === 1) this.unimpl(op);                      // MOVEP
            return this.bitOp(op, this.d[(op >> 9) & 7], (op >> 6) & 3);
        }
        const sel = (op >> 9) & 7, size = (op >> 6) & 3;
        if (sel === 4) {                                         // statische Bit-Ops: #bit
            const bit = this.fetchW() & 0xFF;
            return this.bitOp(op, bit, size);
        }
        if (size === 3) this.unimpl(op);
        const mode = (op >> 3) & 7, reg = op & 7;
        // ORI/ANDI/EORI nach CCR/SR
        if (mode === 7 && reg === 4 && (sel === 0 || sel === 1 || sel === 5)) {
            const imm = this.fetchW();
            if (size === 0) {
                const cur = this.ccr, v = imm & 0xFF;
                this.ccr = sel === 0 ? (cur | v) : sel === 1 ? (cur & v) : (cur ^ v);
            } else {
                const cur = this.sr;
                this.sr = sel === 0 ? (cur | imm) : sel === 1 ? (cur & imm) : (cur ^ imm);
            }
            return;
        }
        let imm;
        if (size === 2) imm = this.fetchL(); else imm = this.fetchW() & MASK[size];
        this.ea(mode, reg, size);
        const dst = this.readEA(size);
        switch (sel) {
            case 0: this.writeEA(size, this.logic((dst | imm) >>> 0, size)); break;                // ORI
            case 1: this.writeEA(size, this.logic((dst & imm) >>> 0, size)); break;                // ANDI
            case 2: this.writeEA(size, this.sub(imm, dst, size)); break;                            // SUBI
            case 3: this.writeEA(size, this.add(imm, dst, size)); break;                            // ADDI
            case 5: this.writeEA(size, this.logic((dst ^ imm) >>> 0, size)); break;                // EORI
            case 6: this.sub(imm, dst, size, false, false); break;                                  // CMPI
            default: this.unimpl(op);
        }
    }

    bitOp(op, bitNum, _size) {
        const mode = (op >> 3) & 7, reg = op & 7, kind = (op >> 6) & 3;
        if (mode === 0) {
            const bit = bitNum & 31, old = (this.d[reg] >>> bit) & 1;
            this.z = old ? 0 : 1;
            if (kind === 1) this.d[reg] ^= (1 << bit);
            else if (kind === 2) this.d[reg] &= ~(1 << bit);
            else if (kind === 3) this.d[reg] |= (1 << bit);
            return;
        }
        this.ea(mode, reg, 0);
        const val = this.readEA(0), bit = bitNum & 7, old = (val >> bit) & 1;
        this.z = old ? 0 : 1;
        if (kind === 0) return;
        let nv = val;
        if (kind === 1) nv = val ^ (1 << bit); else if (kind === 2) nv = val & ~(1 << bit); else nv = val | (1 << bit);
        this.writeEA(0, nv & 0xFF);
    }

    // ---- Gruppe 4
    group4(op) {
        const mode = (op >> 3) & 7, reg = op & 7;
        if ((op & 0x01C0) === 0x01C0) {                          // LEA
            this.ea(mode, reg, 2);
            this.a[(op >> 9) & 7] = this.eaAddr | 0; return;
        }
        if ((op & 0x01C0) === 0x0180) {                          // CHK (Wort)
            this.ea(mode, reg, 1);
            const bound = (this.readEA(1) << 16) >> 16, dn = (this.d[(op >> 9) & 7] << 16) >> 16;
            if (dn < 0 || dn > bound) this.unimpl(op);
            return;
        }
        const hi = (op >> 8) & 0xF, size = (op >> 6) & 3;
        switch (hi) {
            case 0x0: case 0x2: case 0x4: case 0x6: {            // NEGX / CLR / NEG / NOT  bzw. MOVE from SR / to CCR / to SR
                if (size === 3) {
                    this.ea(mode, reg, 1);
                    if (hi === 0x0) this.writeEA(1, this.sr);                          // MOVE from SR
                    else if (hi === 0x4) this.ccr = this.readEA(1) & 0xFF;             // MOVE to CCR
                    else if (hi === 0x6) this.sr = this.readEA(1);                     // MOVE to SR
                    else this.unimpl(op);
                    return;
                }
                this.ea(mode, reg, size);
                if (hi === 0x2) { this.writeEA(size, 0); this.n = 0; this.z = 1; this.v = 0; this.c = 0; return; }   // CLR
                const v = this.readEA(size);
                if (hi === 0x4) { this.writeEA(size, this.sub(v, 0, size)); return; }                                  // NEG
                if (hi === 0x6) { this.writeEA(size, this.logic((~v) >>> 0, size)); return; }                         // NOT
                this.writeEA(size, this.sub(v, 0, size, true));                                                        // NEGX
                return;
            }
            case 0x8: {                                           // NBCD, SWAP, PEA, EXT, MOVEM reg->mem
                if (size === 0) this.unimpl(op);
                if (size === 1) {
                    if (mode === 0) { const v = this.d[reg]; const r = ((v << 16) | (v >>> 16)) | 0; this.d[reg] = r; this.setNZ(r >>> 0, 2); this.v = 0; this.c = 0; return; }   // SWAP
                    this.ea(mode, reg, 2); this.push(2, this.eaAddr); return;                                                                                              // PEA
                }
                if (mode === 0) {                                  // EXT: opmode 010 = EXT.W (Byte->Wort), 011 = EXT.L (Wort->Lang)
                    if (size === 2) { const r = (this.d[reg] << 24) >> 24; this.d[reg] = (this.d[reg] & 0xFFFF0000) | (r & 0xFFFF); this.setNZ(r & 0xFFFF, 1); }
                    else { const r = (this.d[reg] << 16) >> 16; this.d[reg] = r; this.setNZ(r >>> 0, 2); }
                    this.v = 0; this.c = 0; return;
                }
                return this.movem(op, true);
            }
            case 0xA: {                                           // TST / TAS
                if (size === 3) {
                    this.ea(mode, reg, 0); const v = this.readEA(0);
                    this.setNZ(v, 0); this.v = 0; this.c = 0; this.writeEA(0, v | 0x80); return;
                }
                this.ea(mode, reg, size); const v = this.readEA(size); this.setNZ(v, size); this.v = 0; this.c = 0; return;
            }
            case 0xC: if (size >= 2) return this.movem(op, false); this.unimpl(op); return;
            case 0xE: return this.group4E(op);
            default: this.unimpl(op);
        }
    }

    movem(op, toMem) {
        const size = (op & 0x0040) ? 2 : 1;
        const mask = this.fetchW();
        const mode = (op >> 3) & 7, reg = op & 7;
        const w = 1 << size;
        if (toMem) {
            if (mode === 4) {                                      // -(An): Maske umgekehrt, A7..D0
                let addr = this.a[reg];
                for (let i = 0; i < 16; i++) {
                    if (mask & (1 << i)) {                        // Bit 0 = A7 ... Bit 15 = D0
                        const r = 15 - i;
                        const val = r < 8 ? this.d[r] : this.a[r - 8];
                        addr -= w; this.write(addr, size, val);
                    }
                }
                this.a[reg] = addr; return;
            }
            this.ea(mode, reg, size); let addr = this.eaAddr;
            for (let i = 0; i < 16; i++) if (mask & (1 << i)) { const val = i < 8 ? this.d[i] : this.a[i - 8]; this.write(addr, size, val); addr += w; }
            return;
        }
        let addr;
        if (mode === 3) addr = this.a[reg] >>> 0; else { this.ea(mode, reg, size); addr = this.eaAddr; }
        for (let i = 0; i < 16; i++) {
            if (mask & (1 << i)) {
                let val = this.read(addr, size); if (size === 1) val = (val << 16) >> 16; else val |= 0;
                if (i < 8) this.d[i] = val; else this.a[i - 8] = val;
                addr += w;
            }
        }
        if (mode === 3) this.a[reg] = addr;
    }

    group4E(op) {
        if ((op & 0xFFF0) === 0x4E40) this.unimpl(op);              // TRAP
        switch (op) {
            case 0x4E71: return;                                     // NOP
            case 0x4E75: this.pc = this.pop(2) & 0xFFFFFF; return;   // RTS
            case 0x4E77: this.ccr = this.pop(1) & 0xFF; this.pc = this.pop(2) & 0xFFFFFF; return;   // RTR
        }
        if ((op & 0xFFF8) === 0x4E50) {                              // LINK
            const r = op & 7, d = (this.fetchW() << 16) >> 16;
            this.push(2, this.a[r]); this.a[r] = this.a[7]; this.a[7] += d; return;
        }
        if ((op & 0xFFF8) === 0x4E58) { const r = op & 7; this.a[7] = this.a[r]; this.a[r] = this.pop(2) | 0; return; }  // UNLK
        if ((op & 0xFFC0) === 0x4E80) { this.ea((op >> 3) & 7, op & 7, 2); const t = this.eaAddr; this.push(2, this.pc); this.pc = t; return; }   // JSR
        if ((op & 0xFFC0) === 0x4EC0) { this.ea((op >> 3) & 7, op & 7, 2); this.pc = this.eaAddr; return; }                                     // JMP
        this.unimpl(op);
    }

    // ---- ADDQ / SUBQ / Scc / DBcc
    group5(op) {
        const size = (op >> 6) & 3, mode = (op >> 3) & 7, reg = op & 7;
        if (size === 3) {
            const cc = (op >> 8) & 0xF;
            if (mode === 1) {                                        // DBcc
                const base = this.pc, disp = (this.fetchW() << 16) >> 16;
                if (!this.cond(cc)) {
                    const w = ((this.d[reg] & 0xFFFF) - 1) & 0xFFFF;
                    this.d[reg] = (this.d[reg] & 0xFFFF0000) | w;
                    if (w !== 0xFFFF) this.pc = (base + disp) & 0xFFFFFF;
                }
                return;
            }
            this.ea(mode, reg, 0); this.writeEA(0, this.cond(cc) ? 0xFF : 0); return;     // Scc
        }
        let q = (op >> 9) & 7; if (q === 0) q = 8;
        const isSub = (op & 0x0100) !== 0;
        this.ea(mode, reg, size);
        if (this.eaIsAn) { this.a[reg] += isSub ? -q : q; return; }                          // keine Flags bei An
        const dst = this.readEA(size);
        this.writeEA(size, isSub ? this.sub(q, dst, size) : this.add(q, dst, size));
    }

    // ---- Bcc / BRA / BSR
    branch(op) {
        const cc = (op >> 8) & 0xF;
        const base = this.pc;
        let disp = (op << 24) >> 24;
        if ((op & 0xFF) === 0) disp = (this.fetchW() << 16) >> 16;
        else if ((op & 0xFF) === 0xFF) disp = this.fetchL() | 0;
        if (cc === 1) { this.push(2, this.pc); this.pc = (base + disp) & 0xFFFFFF; return; }                 // BSR
        if (this.cond(cc)) this.pc = (base + disp) & 0xFFFFFF;                                                   // BRA/Bcc (cc 0 = true)
    }

    // ---- OR / DIVU / DIVS
    groupOr(op) {
        const size = (op >> 6) & 3, mode = (op >> 3) & 7, reg = op & 7, dn = (op >> 9) & 7;
        if (size === 3) { return this.divide(op, (op & 0x0100) !== 0); }
        if (size === 0 && (op & 0x0100) && (mode === 0 || mode === 1)) this.unimpl(op);   // SBCD
        this.ea(mode, reg, size);
        if (op & 0x0100) { const r = this.logic((this.readEA(size) | this.d[dn]) >>> 0, size); this.writeEA(size, r); }
        else { const r = this.logic((this.readEA(size) | this.d[dn]) >>> 0, size); this.d[dn] = (size === 2) ? r | 0 : (this.d[dn] & ~MASK[size]) | r; }
    }

    divide(op, signed) {
        const dn = (op >> 9) & 7;
        this.ea((op >> 3) & 7, op & 7, 1);
        const sraw = this.readEA(1);
        if (sraw === 0) throw new Error('Division durch 0 @$' + this.opPc.toString(16));
        const dividend = this.d[dn];
        if (signed) {
            const dv = (sraw << 16) >> 16, q = Math.trunc(dividend / dv), r = dividend % dv;
            if (q > 32767 || q < -32768) { this.v = 1; this.c = 0; return; }
            this.d[dn] = ((r & 0xFFFF) << 16) | (q & 0xFFFF); this.n = (q & 0x8000) ? 1 : 0; this.z = (q & 0xFFFF) === 0 ? 1 : 0;
        } else {
            const du = dividend >>> 0, q = Math.floor(du / sraw), r = du % sraw;
            if (q > 0xFFFF) { this.v = 1; this.c = 0; return; }
            this.d[dn] = ((r << 16) | q) | 0; this.n = (q & 0x8000) ? 1 : 0; this.z = q === 0 ? 1 : 0;
        }
        this.v = 0; this.c = 0;
    }

    // ---- SUB / SUBA / SUBX
    groupSub(op) { this.addSub(op, true); }
    groupAdd(op) { this.addSub(op, false); }
    addSub(op, isSub) {
        const size = (op >> 6) & 3, mode = (op >> 3) & 7, reg = op & 7, dn = (op >> 9) & 7;
        if (size === 3) {                                          // SUBA / ADDA
            const sz = (op & 0x0100) ? 2 : 1;
            this.ea(mode, reg, sz);
            let src = this.readEA(sz); if (sz === 1) src = (src << 16) >> 16; else src |= 0;
            this.a[dn] += isSub ? -src : src; return;
        }
        if ((op & 0x0100) && (mode === 0 || mode === 1)) {        // ADDX / SUBX
            let s, dst, set;
            if (mode === 0) { s = this.d[reg] & MASK[size]; dst = this.d[dn] & MASK[size]; set = (r) => { this.d[dn] = size === 2 ? r | 0 : (this.d[dn] & ~MASK[size]) | r; }; }
            else {
                this.a[reg] -= (1 << size); const sa = this.a[reg] >>> 0; this.a[dn] -= (1 << size); const da = this.a[dn] >>> 0;
                s = this.read(sa, size); dst = this.read(da, size); set = (r) => this.write(da, size, r);
            }
            const r = isSub ? this.sub(s >>> 0, dst >>> 0, size, true) : this.add(s >>> 0, dst >>> 0, size, true); set(r); return;
        }
        this.ea(mode, reg, size);
        const ea = this.readEA(size), dreg = (this.d[dn] & MASK[size]) >>> 0;
        if (op & 0x0100) { this.writeEA(size, isSub ? this.sub(dreg, ea, size) : this.add(dreg, ea, size)); }
        else { const r = isSub ? this.sub(ea, dreg, size) : this.add(ea, dreg, size); this.d[dn] = size === 2 ? r | 0 : (this.d[dn] & ~MASK[size]) | r; }
    }

    // ---- CMP / CMPA / CMPM / EOR
    groupCmpEor(op) {
        const size = (op >> 6) & 3, mode = (op >> 3) & 7, reg = op & 7, dn = (op >> 9) & 7;
        if (size === 3) {                                          // CMPA
            const sz = (op & 0x0100) ? 2 : 1;
            this.ea(mode, reg, sz);
            let src = this.readEA(sz); if (sz === 1) src = (src << 16) >> 16; else src |= 0;
            this.sub(src >>> 0, this.a[dn] >>> 0, 2, false, false); return;
        }
        if (op & 0x0100) {
            if (mode === 1) {                                      // CMPM (Ay)+,(Ax)+
                this.ea(3, reg, size); const s = this.read(this.eaAddr, size);
                this.ea(3, dn, size); const d = this.read(this.eaAddr, size);
                this.sub(s, d, size, false, false); return;
            }
            this.ea(mode, reg, size);                              // EOR Dn,<ea>
            const r = this.logic((this.readEA(size) ^ this.d[dn]) >>> 0, size); this.writeEA(size, r); return;
        }
        this.ea(mode, reg, size);                                  // CMP <ea>,Dn
        this.sub(this.readEA(size), (this.d[dn] & MASK[size]) >>> 0, size, false, false);
    }

    // ---- AND / MULU / MULS / EXG
    groupAnd(op) {
        const size = (op >> 6) & 3, mode = (op >> 3) & 7, reg = op & 7, dn = (op >> 9) & 7;
        if (size === 3) {                                          // MULU / MULS
            this.ea(mode, reg, 1);
            const s = this.readEA(1);
            let r;
            if (op & 0x0100) r = Math.imul((s << 16) >> 16, (this.d[dn] << 16) >> 16); else r = Math.imul(s, this.d[dn] & 0xFFFF);
            this.d[dn] = r; this.setNZ(r >>> 0, 2); this.v = 0; this.c = 0; return;
        }
        if ((op & 0x0100) && size === 0 && (mode === 0 || mode === 1)) this.unimpl(op);       // ABCD
        if ((op & 0x0100) && (mode === 0 || mode === 1) && size >= 1) {                       // EXG
            const opm = (op >> 3) & 0x1F;
            if (opm === 8) { const t = this.d[dn]; this.d[dn] = this.d[reg]; this.d[reg] = t; return; }
            if (opm === 9) { const t = this.a[dn]; this.a[dn] = this.a[reg]; this.a[reg] = t; return; }
            if (opm === 17) { const t = this.d[dn]; this.d[dn] = this.a[reg]; this.a[reg] = t; return; }
            this.unimpl(op);
        }
        this.ea(mode, reg, size);
        if (op & 0x0100) { const r = this.logic((this.readEA(size) & this.d[dn]) >>> 0, size); this.writeEA(size, r); }
        else { const r = this.logic((this.readEA(size) & this.d[dn]) >>> 0, size); this.d[dn] = size === 2 ? r | 0 : (this.d[dn] & ~MASK[size]) | r; }
    }

    // ---- Schiebe-/Rotationsbefehle
    groupShift(op) {
        const size = (op >> 6) & 3, left = (op & 0x0100) !== 0;
        if (size === 3) {                                          // Speicher-Variante: ein Bit, Wort
            const kind = (op >> 9) & 3;
            const map = [0, 1, 4, 2];                              // ASx, LSx, ROXx, ROx
            this.ea((op >> 3) & 7, op & 7, 1);
            const v = this.readEA(1);
            this.writeEA(1, this.shift(map[kind], left, v, 1, 1));
            return;
        }
        const kindSel = (op >> 3) & 3, reg = op & 7;
        const map = [0, 1, 4, 2];
        const kind = map[kindSel];
        const cnt = (op & 0x20) ? (this.d[(op >> 9) & 7] & 63) : (((op >> 9) & 7) || 8);
        const val = this.d[reg] & MASK[size];
        const r = this.shift(kind, left, val >>> 0, cnt, size);
        this.d[reg] = size === 2 ? r | 0 : (this.d[reg] & ~MASK[size]) | r;
    }
}
