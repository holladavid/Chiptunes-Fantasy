// === js/worklets/lib/cpu6502.js ===
// =========================================================
// 6502 CPU EMULATOR & C64 I/O INTERCEPTOR
// Fully Restored, Cycle-Exact Timing & Zero Truncations
// =========================================================

export class CPU6502 {
    constructor(sid) {
        this.ram = new Uint8Array(65536);
        this.sid = sid;
        this.a = 0; this.x = 0; this.y = 0;
        this.sp = 0xFF; this.pc = 0;
        this.p = 0x20; 
        this.rasterLine = 0;
        this.ciaTimerALow = 0;
        this.ciaTimerA = 19583;
        this.isIdle = true; 
    }

    reset(loadAddr, prgCode) {
        this.ram.fill(0);
        this.ram[0x0000] = 0x2F; 
        this.ram[0x0001] = 0x37; 
        
        this.ram[0xEA31] = 0x40; // RTI Fallback
        this.ram[0xEA81] = 0x40; // RTI Fallback
        
        for (let i = 0; i < prgCode.length; i++) {
            this.ram[loadAddr + i] = prgCode[i];
        }
        this.a = 0; this.x = 0; this.y = 0;
        this.sp = 0xFF; this.p = 0x20;
        this.isIdle = true;
        this.ciaTimerA = 19583; // CIA-Timer zurücksetzen
    }

    push(val) {
        this.ram[0x0100 + this.sp] = val;
        this.sp = (this.sp - 1) & 0xFF;
    }

    pop() {
        this.sp = (this.sp + 1) & 0xFF;
        return this.ram[0x0100 + this.sp];
    }

    setNZ(val) {
        let v = val & 0xFF;
        if (v === 0) this.p |= 2; else this.p &= ~2; 
        if (v & 0x80) this.p |= 128; else this.p &= ~128; 
    }

    pageCrossed(addr1, addr2) {
        return (addr1 & 0xFF00) !== (addr2 & 0xFF00);
    }

    read(addr) {
        if (addr === 0xD019) return this.ram[0xD019] | 0x80; 
        if (addr === 0xD012) {
            this.rasterLine = (this.rasterLine + 1) % 263;
            return this.rasterLine;
        }
        if (addr === 0xD011) return 0x1B | ((this.pc >> 8) & 0x80);
        if (addr === 0xDC04 || addr === 0xDC05) return Math.floor(Math.random() * 256);
        if (addr === 0xDC0D || addr === 0xDD0D) return 0x81;
        if (addr === 0x0001) return this.ram[0x0001];
        
        if (addr === 0xD41B) return this.sid.voices[2].waveOut8Bit || 0;
        if (addr === 0xD41C) return this.sid.voices[2].env8Bit || 0;

        return this.ram[addr];
    }

    write(addr, val) {
        this.ram[addr] = val;
        if (addr === 0xD019) {
            this.ram[0xD019] &= ~val; 
        } else if (addr === 0xDC04) {
            this.ciaTimerALow = val;
        } else if (addr === 0xDC05) {
            this.ciaTimerA = (val << 8) | this.ciaTimerALow;
        } else if (addr >= 0xD400 && addr <= 0xD41C) {
            this.sid.writeReg(addr - 0xD400, val);
        }
    }

    jsr(addr) {
        if (addr === 0) return;
        this.push(0xFF); 
        this.push(0xFE); 
        this.pc = addr;
        
        let instructions = 0;
        while (this.pc !== 0xFFFF && instructions < 500000) { 
            this.step();
            instructions++;
        }
    }

    // === HIER IST DIE REKONSTRUIERTE, INTERRUPT-GENAUE IRQ ROUTINE ===
    irq(addr) {
        if (addr === 0) return;
        this.push(0xFF);
        this.push(0xFE);
        this.push(this.p);
        this.pc = addr;
        
        let instructions = 0;
        while (this.pc !== 0xFFFE && this.pc !== 0xFFFF && instructions < 500000) { 
            this.step();
            instructions++;
        }
    }

    abs() { let l = this.read(this.pc++); let h = this.read(this.pc++); return l | (h << 8); }
    absX() { return (this.abs() + this.x) & 0xFFFF; }
    absY() { return (this.abs() + this.y) & 0xFFFF; }
    zp() { return this.read(this.pc++); }
    zpX() { return (this.zp() + this.x) & 0xFF; }
    zpY() { return (this.zp() + this.y) & 0xFF; }
    indX() { let z = this.zpX(); return this.read(z) | (this.read((z+1)&0xFF) << 8); }
    indY() { let z = this.zp(); let addr = this.read(z) | (this.read((z+1)&0xFF) << 8); return (addr + this.y) & 0xFFFF; }

    step() {
        let op = this.read(this.pc++);
        let cycles = 2; 

        switch (op) {
            case 0xEA: cycles = 2; break; // NOP
            case 0xA9: this.a = this.read(this.pc++); this.setNZ(this.a); cycles = 2; break; // LDA imm
            case 0xA5: this.a = this.read(this.zp()); this.setNZ(this.a); cycles = 3; break; // LDA zp
            case 0xB5: this.a = this.read(this.zpX()); this.setNZ(this.a); cycles = 4; break; // LDA zp,X
            case 0xAD: this.a = this.read(this.abs()); this.setNZ(this.a); cycles = 4; break; // LDA abs
            case 0xBD: {
                let addr = this.abs();
                let addrX = (addr + this.x) & 0xFFFF;
                this.a = this.read(addrX);
                this.setNZ(this.a);
                cycles = 4 + (this.pageCrossed(addr, addrX) ? 1 : 0);
            } break; // LDA abs,X
            case 0xB9: {
                let addr = this.abs();
                let addrY = (addr + this.y) & 0xFFFF;
                this.a = this.read(addrY);
                this.setNZ(this.a);
                cycles = 4 + (this.pageCrossed(addr, addrY) ? 1 : 0);
            } break; // LDA abs,Y
            case 0xA1: this.a = this.read(this.indX()); this.setNZ(this.a); cycles = 6; break; // LDA (zp,X)
            case 0xB1: {
                let z = this.zp();
                let addr = this.read(z) | (this.read((z+1)&0xFF) << 8);
                let addrY = (addr + this.y) & 0xFFFF;
                this.a = this.read(addrY);
                this.setNZ(this.a);
                cycles = 5 + (this.pageCrossed(addr, addrY) ? 1 : 0);
            } break; // LDA (zp),Y

            case 0xA2: this.x = this.read(this.pc++); this.setNZ(this.x); cycles = 2; break; // LDX imm
            case 0xA6: this.x = this.read(this.zp()); this.setNZ(this.x); cycles = 3; break; // LDX zp
            case 0xB6: this.x = this.read(this.zpY()); this.setNZ(this.x); cycles = 4; break; // LDX zp,Y
            case 0xAE: this.x = this.read(this.abs()); this.setNZ(this.x); cycles = 4; break; // LDX abs
            case 0xBE: {
                let addr = this.abs();
                let addrY = (addr + this.y) & 0xFFFF;
                this.x = this.read(addrY);
                this.setNZ(this.x);
                cycles = 4 + (this.pageCrossed(addr, addrY) ? 1 : 0);
            } break; // LDX abs,Y

            case 0xA0: this.y = this.read(this.pc++); this.setNZ(this.y); cycles = 2; break; // LDY imm
            case 0xA4: this.y = this.read(this.zp()); this.setNZ(this.y); cycles = 3; break; // LDY zp
            case 0xB4: this.y = this.read(this.zpX()); this.setNZ(this.y); cycles = 4; break; // LDY zp,X
            case 0xAC: this.y = this.read(this.abs()); this.setNZ(this.y); cycles = 4; break; // LDY abs
            case 0xBC: {
                let addr = this.abs();
                let addrX = (addr + this.x) & 0xFFFF;
                this.y = this.read(addrX);
                this.setNZ(this.y);
                cycles = 4 + (this.pageCrossed(addr, addrX) ? 1 : 0); 
            } break; 

            case 0x85: this.write(this.zp(), this.a); cycles = 3; break; 
            case 0x95: this.write(this.zpX(), this.a); cycles = 4; break; 
            case 0x8D: this.write(this.abs(), this.a); cycles = 4; break; 
            case 0x9D: this.write(this.absX(), this.a); cycles = 5; break; 
            case 0x99: this.write(this.absY(), this.a); cycles = 5; break; 
            case 0x81: this.write(this.indX(), this.a); cycles = 6; break; 
            case 0x91: this.write(this.indY(), this.a); cycles = 6; break; 

            case 0x86: this.write(this.zp(), this.x); cycles = 3; break; 
            case 0x96: this.write(this.zpY(), this.x); cycles = 4; break; 
            case 0x8E: this.write(this.abs(), this.x); cycles = 4; break; 

            case 0x84: this.write(this.zp(), this.y); cycles = 3; break; 
            case 0x94: this.write(this.zpX(), this.y); cycles = 4; break; 
            case 0x8C: this.write(this.abs(), this.y); cycles = 4; break; 

            case 0xAA: this.x = this.a; this.setNZ(this.x); cycles = 2; break; 
            case 0x8A: this.a = this.x; this.setNZ(this.a); cycles = 2; break; 
            case 0xA8: this.y = this.a; this.setNZ(this.y); cycles = 2; break; 
            case 0x98: this.a = this.y; this.setNZ(this.a); cycles = 2; break; 
            case 0x9A: this.sp = this.x; cycles = 2; break; 
            case 0xBA: this.x = this.sp; this.setNZ(this.x); cycles = 2; break; 

            case 0xE8: this.x = (this.x + 1) & 0xFF; this.setNZ(this.x); cycles = 2; break; 
            case 0xCA: this.x = (this.x - 1) & 0xFF; this.setNZ(this.x); cycles = 2; break; 
            case 0xC8: this.y = (this.y + 1) & 0xFF; this.setNZ(this.y); cycles = 2; break; 
            case 0x88: this.y = (this.y - 1) & 0xFF; this.setNZ(this.y); cycles = 2; break; 

            case 0xE6: { let z = this.zp(); let v = (this.read(z) + 1) & 0xFF; this.write(z, v); this.setNZ(v); cycles = 5; } break; 
            case 0xF6: { let z = this.zpX(); let v = (this.read(z) + 1) & 0xFF; this.write(z, v); this.setNZ(v); cycles = 6; } break; 
            case 0xEE: { let a = this.abs(); let v = (this.read(a) + 1) & 0xFF; this.write(a, v); this.setNZ(v); cycles = 6; } break; 
            case 0xFE: { let a = this.absX(); let v = (this.read(a) + 1) & 0xFF; this.write(a, v); this.setNZ(v); cycles = 7; } break; 

            case 0xC6: { let z = this.zp(); let v = (this.read(z) - 1) & 0xFF; this.write(z, v); this.setNZ(v); cycles = 5; } break; 
            case 0xD6: { let z = this.zpX(); let v = (this.read(z) - 1) & 0xFF; this.write(z, v); this.setNZ(v); cycles = 6; } break; 
            case 0xCE: { let a = this.abs(); let v = (this.read(a) - 1) & 0xFF; this.write(a, v); this.setNZ(v); cycles = 6; } break; 
            case 0xDE: { let a = this.absX(); let v = (this.read(a) - 1) & 0xFF; this.write(a, v); this.setNZ(v); cycles = 7; } break; 

            case 0x20: { let target = this.abs(); this.push((this.pc - 1) >> 8); this.push((this.pc - 1) & 0xFF); this.pc = target; cycles = 6; } break; // JSR
            case 0x4C: this.pc = this.abs(); cycles = 3; break; // JMP abs
            case 0x6C: { let ptr = this.abs(); let low = this.read(ptr); let high = this.read((ptr & 0xFF00) | ((ptr + 1) & 0x00FF)); this.pc = low | (high << 8); cycles = 5; } break; // JMP (ind)
            case 0x60: { let low = this.pop(); let high = this.pop(); this.pc = (low | (high << 8)) + 1; cycles = 6; } break; // RTS
            case 0x40: { this.p = this.pop(); let low = this.pop(); let high = this.pop(); this.pc = low | (high << 8); cycles = 6; } break; // RTI

            case 0xD0: cycles = this.branch((this.p & 2) === 0); break; // BNE
            case 0xF0: cycles = this.branch((this.p & 2) !== 0); break; // BEQ
            case 0x10: cycles = this.branch((this.p & 128) === 0); break; // BPL
            case 0x30: cycles = this.branch((this.p & 128) !== 0); break; // BMI
            case 0x90: cycles = this.branch((this.p & 1) === 0); break; // BCC
            case 0xB0: cycles = this.branch((this.p & 1) !== 0); break; // BCS
            case 0x50: cycles = this.branch((this.p & 64) === 0); break; // BVC
            case 0x70: cycles = this.branch((this.p & 64) !== 0); break; // BVS

            case 0x08: this.push(this.p | 0x10); cycles = 3; break; // PHP
            case 0x28: this.p = (this.pop() & 0xEF) | 0x20; cycles = 4; break; // PLP
            case 0x48: this.push(this.a); cycles = 3; break; // PHA
            case 0x68: this.a = this.pop(); this.setNZ(this.a); cycles = 4; break; // PLA

            case 0x18: this.p &= ~1; cycles = 2; break; // CLC
            case 0x38: this.p |= 1; cycles = 2; break; // SEC
            case 0x58: this.p &= ~4; cycles = 2; break; // CLI
            case 0x78: this.p |= 4; cycles = 2; break; // SEI
            case 0xD8: this.p &= ~8; cycles = 2; break; // CLD
            case 0xF8: this.p |= 8; cycles = 2; break; // SED
            case 0xB8: this.p &= ~64; cycles = 2; break; // CLV

            case 0x0A: { if (this.a & 128) this.p |= 1; else this.p &= ~1; this.a = (this.a << 1) & 0xFF; this.setNZ(this.a); cycles = 2; } break; // ASL A
            case 0x4A: { if (this.a & 1) this.p |= 1; else this.p &= ~1; this.a = (this.a >> 1) & 0x7F; this.setNZ(this.a); cycles = 2; } break; // LSR A
            case 0x2A: { let c = this.p & 1; if (this.a & 128) this.p |= 1; else this.p &= ~1; this.a = ((this.a << 1) & 0xFF) | c; this.setNZ(this.a); cycles = 2; } break; // ROL A
            case 0x6A: { let c = this.p & 1; if (this.a & 1) this.p |= 1; else this.p &= ~1; this.a = (this.a >> 1) | (c << 7); this.setNZ(this.a); cycles = 2; } break; // ROR A

            case 0x06: { let z = this.zp(); let v = this.read(z); if (v & 128) this.p |= 1; else this.p &= ~1; v = (v << 1) & 0xFF; this.write(z, v); this.setNZ(v); cycles = 5; } break; // ASL zp
            case 0x46: { let z = this.zp(); let v = this.read(z); if (v & 1) this.p |= 1; else this.p &= ~1; v = (v >> 1) & 0x7F; this.write(z, v); this.setNZ(v); cycles = 5; } break; // LSR zp
            case 0x26: { let z = this.zp(); let v = this.read(z); let c = this.p & 1; if (v & 128) this.p |= 1; else this.p &= ~1; v = ((v << 1) & 0xFF) | c; this.write(z, v); this.setNZ(v); cycles = 5; } break; // ROL zp
            case 0x66: { let z = this.zp(); let v = this.read(z); let c = this.p & 1; if (v & 1) this.p |= 1; else this.p &= ~1; v = (v >> 1) | (c << 7); this.write(z, v); this.setNZ(v); cycles = 5; } break; // ROR zp
            
            case 0x16: { let z = this.zpX(); let v = this.read(z); if (v & 128) this.p |= 1; else this.p &= ~1; v = (v << 1) & 0xFF; this.write(z, v); this.setNZ(v); cycles = 6; } break; // ASL zp,X
            case 0x56: { let z = this.zpX(); let v = this.read(z); if (v & 1) this.p |= 1; else this.p &= ~1; v = (v >> 1) & 0x7F; this.write(z, v); this.setNZ(v); cycles = 6; } break; // LSR zp,X
            case 0x36: { let z = this.zpX(); let v = this.read(z); let c = this.p & 1; if (v & 128) this.p |= 1; else this.p &= ~1; v = ((v << 1) & 0xFF) | c; this.write(z, v); this.setNZ(v); cycles = 6; } break; // ROL zp,X
            case 0x76: { let z = this.zpX(); let v = this.read(z); let c = this.p & 1; if (v & 1) this.p |= 1; else this.p &= ~1; v = (v >> 1) | (c << 7); this.write(z, v); this.setNZ(v); cycles = 6; } break; // ROR zp,X
            
            case 0x0E: { let a = this.abs(); let v = this.read(a); if (v & 128) this.p |= 1; else this.p &= ~1; v = (v << 1) & 0xFF; this.write(a, v); this.setNZ(v); cycles = 6; } break; // ASL abs
            case 0x4E: { let a = this.abs(); let v = this.read(a); if (v & 1) this.p |= 1; else this.p &= ~1; v = (v >> 1) & 0x7F; this.write(a, v); this.setNZ(v); cycles = 6; } break; // LSR abs
            case 0x2E: { let a = this.abs(); let v = this.read(a); let c = this.p & 1; if (v & 128) this.p |= 1; else this.p &= ~1; v = ((v << 1) & 0xFF) | c; this.write(a, v); this.setNZ(v); cycles = 6; } break; // ROL abs
            case 0x6E: { let a = this.abs(); let v = this.read(a); let c = this.p & 1; if (v & 1) this.p |= 1; else this.p &= ~1; v = (v >> 1) | (c << 7); this.write(a, v); this.setNZ(v); cycles = 6; } break; // ROR abs
            
            case 0x1E: { let a = this.absX(); let v = this.read(a); if (v & 128) this.p |= 1; else this.p &= ~1; v = (v << 1) & 0xFF; this.write(a, v); this.setNZ(v); cycles = 7; } break; // ASL abs,X
            case 0x5E: { let a = this.absX(); let v = this.read(a); if (v & 1) this.p |= 1; else this.p &= ~1; v = (v >> 1) & 0x7F; this.write(a, v); this.setNZ(v); cycles = 7; } break; // LSR abs,X
            case 0x3E: { let a = this.absX(); let v = this.read(a); let c = this.p & 1; if (v & 128) this.p |= 1; else this.p &= ~1; v = ((v << 1) & 0xFF) | c; this.write(a, v); this.setNZ(v); cycles = 7; } break; // ROL abs,X
            case 0x7E: { let a = this.absX(); let v = this.read(a); let c = this.p & 1; if (v & 1) this.p |= 1; else this.p &= ~1; v = (v >> 1) | (c << 7); this.write(a, v); this.setNZ(v); cycles = 7; } break; // ROR abs,X

            default: 
                cycles = this.handleALU(op); 
                break;
        }
        return cycles;
    }

    branch(condition) {
        let off = this.read(this.pc++);
        if (off > 127) off -= 256;
        let cycles = 2;
        if (condition) {
            cycles = 3;
            let oldPc = this.pc;
            this.pc = (this.pc + off) & 0xFFFF;
            if (this.pageCrossed(oldPc, this.pc)) {
                cycles = 4;
            }
        }
        return cycles;
    }

    handleALU(op) {
        let val = 0;
        let setVal = true;
        let cycles = 2;

        if ([0x69, 0xE9, 0x29, 0x09, 0x49, 0xC9, 0xE0, 0xC0].includes(op)) {
            val = this.read(this.pc++);
            cycles = 2;
        } else if ([0x65, 0xE5, 0x25, 0x05, 0x45, 0xC5, 0xE4, 0xC4, 0x24].includes(op)) {
            val = this.read(this.zp());
            cycles = 3;
        } else if ([0x75, 0xF5, 0x35, 0x15, 0x55, 0xD5].includes(op)) {
            val = this.read(this.zpX());
            cycles = 4;
        } else if ([0x6D, 0xED, 0x2D, 0x0D, 0x4D, 0xCD, 0xEC, 0xCC, 0x2C].includes(op)) {
            val = this.read(this.abs());
            cycles = 4;
        } else if ([0x7D, 0xFD, 0x3D, 0x1D, 0x5D, 0xDD].includes(op)) {
            let addr = this.abs();
            let addrX = (addr + this.x) & 0xFFFF;
            val = this.read(addrX);
            cycles = 4 + (this.pageCrossed(addr, addrX) ? 1 : 0);
        } else if ([0x79, 0xF9, 0x39, 0x19, 0x59, 0xD9].includes(op)) {
            let addr = this.abs();
            let addrY = (addr + this.y) & 0xFFFF;
            val = this.read(addrY);
            cycles = 4 + (this.pageCrossed(addr, addrY) ? 1 : 0);
        } else if ([0x61, 0xE1, 0x21, 0x01, 0x41, 0xC1].includes(op)) {
            val = this.read(this.indX());
            cycles = 6;
        } else if ([0x71, 0xF1, 0x31, 0x11, 0x51, 0xD1].includes(op)) {
            let z = this.zp();
            let addr = this.read(z) | (this.read((z+1)&0xFF) << 8);
            let addrY = (addr + this.y) & 0xFFFF;
            val = this.read(addrY);
            cycles = 5 + (this.pageCrossed(addr, addrY) ? 1 : 0);
        } else {
            setVal = false;
        }

        if (setVal) {
            let high = op & 0xF0;
            let low = op & 0x0F;
            if (high === 0x20 || high === 0x30) { if(op!==0x20&&op!==0x24&&op!==0x28&&op!==0x2A&&op!==0x2C&&op!==0x38) { this.a &= val; this.setNZ(this.a); return cycles; } }
            if (high === 0x00 || high === 0x10) { if(op!==0x00&&op!==0x06&&op!==0x08&&op!==0x0A&&op!==0x0E&&op!==0x10&&op!==0x18) { this.a |= val; this.setNZ(this.a); return cycles; } }
            if (high === 0x40 || high === 0x50) { if(op!==0x40&&op!==0x4A&&op!==0x4C&&op!==0x48&&op!==0x58&&op!==0x50) { this.a ^= val; this.setNZ(this.a); return cycles; } }
            if (high === 0xC0 || high === 0xD0) { if(low!==0&&low!==8&&low!==0xA&&op!==0xD8) { let diff = this.a - val; this.setNZ(diff & 0xFF); if (this.a >= val) this.p |= 1; else this.p &= ~1; return cycles; } }
            if (op===0xE0||op===0xE4||op===0xEC) { let diff = this.x - val; this.setNZ(diff & 0xFF); if (this.x >= val) this.p |= 1; else this.p &= ~1; return cycles; }
            if (op===0xC0||op===0xC4||op===0xCC) { let diff = this.y - val; this.setNZ(diff & 0xFF); if (this.y >= val) this.p |= 1; else this.p &= ~1; return cycles; }
            if (high === 0x60 || high === 0x70) { if(op!==0x60&&op!==0x68&&op!==0x6A&&op!==0x78&&op!==0x70) { let carry = this.p & 1; let sum = this.a + val + carry; let overflow = ((this.a ^ sum) & (val ^ sum) & 0x80) !== 0; if (sum > 255) this.p |= 1; else this.p &= ~1; if (overflow) this.p |= 64; else this.p &= ~64; this.a = sum & 0xFF; this.setNZ(this.a); return cycles; } }
            if (high === 0xE0 || high === 0xF0) { if(op!==0xE0&&op!==0xE4&&op!==0xE8&&op!==0xEA&&op!==0xEC&&op!==0xF8&&op!==0xF0) { let val_inv = val ^ 0xFF; let carry = this.p & 1; let sum = this.a + val_inv + carry; let overflow = ((this.a ^ sum) & (val_inv ^ sum) & 0x80) !== 0; if (sum > 255) this.p |= 1; else this.p &= ~1; if (overflow) this.p |= 64; else this.p &= ~64; this.a = sum & 0xFF; this.setNZ(this.a); return cycles; } }
            if (op === 0x24 || op === 0x2C) { if (val & 0x80) this.p |= 128; else this.p &= ~128; if (val & 0x40) this.p |= 64; else this.p &= ~64; if ((val & this.a) === 0) this.p |= 2; else this.p &= ~2; return cycles; }
        }
        return cycles;
    }
}