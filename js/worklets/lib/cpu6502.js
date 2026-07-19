// === js/worklets/lib/cpu6502.js ===
// =========================================================
// 6502 CPU EMULATOR & C64 I/O INTERCEPTOR
// High-Performance Zero-Allocation Edition
// Phase 11: VIC-II Badlines & Cycle Stealing (Step 1)
// =========================================================

export class CPU6502 {
    constructor(sid) {
        this.ram = new Uint8Array(65536);
        this.sid = sid;
        
        // CPU Registers
        this.a = 0; this.x = 0; this.y = 0;
        this.sp = 0xFF; this.pc = 0;
        this.p = 0x24; // I-Flag set
        
        // Hardware Timers & IRQ State
        this.cyclesPerLine = 63; // PAL Standard
        this.rasterCounter = 0;
        this.rasterCycles = 0;
        this.rasterIrqTarget = 0;
        
        this.cia1TimerA = 0xFFFF;
        this.cia1TimerALatch = 0xFFFF;
        this.cia1CtrlA = 0;
        this.cia1Icr = 0;
        this.cia1IrqMask = 0;
        
        this.irqPending = false;
        this.nmiPending = false;

        // --- SCHRITT 1: VIC-II BADLINE TIMING ---
        this.cpuStall = 0;       // Verbleibende Halte-Zyklen für die CPU
        this.isBadLine = false;  // Flag für die aktuelle Zeile

        // --- SCHRITT 2: CIA TIMER B ---
        this.cia1TimerB = 0xFFFF;
        this.cia1TimerBLatch = 0xFFFF;
        this.cia1CtrlB = 0;

        // --- SCHRITT 3: IRQ-LATENZ & ANERKENNUNG ---
        this.irqAccepted = false;
        this.nmiAccepted = false;

        // --- SCHRITT 5: CIA TOD CLOCK ---
        this.todTenths = 0;
        this.todSec = 0;
        this.todMin = 0;
        this.todHour = 1; // Startet standardmäßig bei 1 AM (BCD)
        
        this.todLatchTenths = 0;
        this.todLatchSec = 0;
        this.todLatchMin = 0;
        this.todLatchHour = 1;
        this.todLatched = false;
        this.todHalted = false;
        
        this.todCycleCounter = 19705; // Standard 50Hz (PAL)
    }

    reset(loadAddr, prgCode) {
        this.ram.fill(0);
        
        // --- THE PHANTOM KERNAL ROM ---
        // $EA31: Die Idle-Schleife der CPU (JMP $EA31)
        this.ram[0xEA31] = 0x4C; this.ram[0xEA32] = 0x31; this.ram[0xEA33] = 0xEA;
        
        // $EA81: Die Rettungsleine (RTI)
        this.ram[0xEA81] = 0x40; 
        
        // Default-Vektoren für RAM-Hooks zeigen auf RTI
        this.ram[0x0314] = 0x81; this.ram[0x0315] = 0xEA; 
        this.ram[0x0318] = 0x81; this.ram[0x0319] = 0xEA; 

        // ROM Hardware Vectors
        this.ram[0xFFFE] = 0x48; this.ram[0xFFFF] = 0xFF; // Hardware IRQ -> $FF48
        this.ram[0xFFFA] = 0x58; this.ram[0xFFFB] = 0xFF; // Hardware NMI -> $FF58

        // $FF48: JMP ($0314) -> Leitet den IRQ in den Player (oder auf RTI)
        this.ram[0xFF48] = 0x6C; this.ram[0xFF49] = 0x14; this.ram[0xFF4A] = 0x03;
        // $FF58: JMP ($0318) -> Leitet den NMI ab
        this.ram[0xFF58] = 0x6C; this.ram[0xFF59] = 0x18; this.ram[0xFF5A] = 0x03;
        
        for (let i = 0; i < prgCode.length; i++) {
            this.ram[loadAddr + i] = prgCode[i];
        }
        
        this.a = 0; this.x = 0; this.y = 0;
        this.sp = 0xFF; 
        this.p = 0x24; 
        
        this.rasterCounter = 0;
        this.rasterCycles = 0;
        this.rasterIrqTarget = 0;
        
        this.cia1TimerA = 0xFFFF;
        this.cia1TimerALatch = 0xFFFF;
        this.cia1CtrlA = 0;
        this.cia1Icr = 0;
        this.cia1IrqMask = 0;
        
        this.irqPending = false;
        this.nmiPending = false;

        // --- SCHRITT 1: VIC-II BADLINE TIMING ---
        this.cpuStall = 0;
        this.isBadLine = false;

        // --- SCHRITT 2: CIA TIMER B ---
        this.cia1TimerB = 0xFFFF;
        this.cia1TimerBLatch = 0xFFFF;
        this.cia1CtrlB = 0;

        // --- SCHRITT 3: IRQ-LATENZ & ANERKENNUNG ---
        this.irqAccepted = false;
        this.nmiAccepted = false;

        // --- SCHRITT 5: CIA TOD CLOCK ---
        this.todTenths = 0;
        this.todSec = 0;
        this.todMin = 0;
        this.todHour = 1; // Startet standardmäßig bei 1 AM (BCD)
        
        this.todLatchTenths = 0;
        this.todLatchSec = 0;
        this.todLatchMin = 0;
        this.todLatchHour = 1;
        this.todLatched = false;
        this.todHalted = false;
        
        this.todCycleCounter = 19705; // Standard 50Hz (PAL)
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
        if (addr < 0xD000) {
            if (addr === 0x0001) return this.ram[0x0001];
            return this.ram[addr];
        }
        if (addr > 0xDFFF) return this.ram[addr];
        
        // VIC-II
        if (addr === 0xD011) {
            let val = this.ram[0xD011] & 0x7F;
            if (this.rasterCounter > 255) val |= 0x80;
            return val;
        }
        if (addr === 0xD012) return this.rasterCounter & 0xFF;
        if (addr === 0xD019) return this.ram[0xD019] | 0x70; 
        
        // --- SCHRITT 5: CIA TOD CLOCK (Latching-Freezer) ---
        if (addr >= 0xDC08 && addr <= 0xDC0B) {
            if (addr === 0xDC0B) {
                // Das Lesen der Stunden friert die Zeitanzeige ein
                if (!this.todLatched) {
                    this.todLatchTenths = this.todTenths;
                    this.todLatchSec = this.todSec;
                    this.todLatchMin = this.todMin;
                    this.todLatchHour = this.todHour;
                    this.todLatched = true;
                }
                return this.todLatchHour;
            }
            if (addr === 0xDC0A) return this.todLatched ? this.todLatchMin : this.todMin;
            if (addr === 0xDC09) return this.todLatched ? this.todLatchSec : this.todSec;
            if (addr === 0xDC08) {
                let val = this.todLatched ? this.todLatchTenths : this.todTenths;
                this.todLatched = false; // Das Lesen der Zehntelsekunden hebt den Freeze auf
                return val;
            }
        }  

        // CIA-1 
        if (addr === 0xDC04) return this.cia1TimerA & 0xFF;
        if (addr === 0xDC05) return (this.cia1TimerA >> 8) & 0xFF;
        // --- SCHRITT 2: CIA TIMER B ---
        if (addr === 0xDC06) return this.cia1TimerB & 0xFF;
        if (addr === 0xDC07) return (this.cia1TimerB >> 8) & 0xFF;
        if (addr === 0xDC0D) {
            let val = this.cia1Icr;
            this.cia1Icr = 0; // Read-to-clear!
            this.updateIrq();
            return val;
        }
        if (addr === 0xDC0E) return this.cia1CtrlA;
        if (addr === 0xDC0F) return this.cia1CtrlB;
        
        if (addr === 0xD41B) return this.sid.voices[2].waveOut8Bit || 0;
        if (addr === 0xD41C) return this.sid.voices[2].env8Bit || 0;

        return this.ram[addr];
    }

    write(addr, val) {
        this.ram[addr] = val;
        if (addr < 0xD000 || addr > 0xDFFF) return;
        
        // --- I/O REGISTER INTERCEPTION ($D000 - $DFFF) ---
        if (addr >= 0xD400 && addr <= 0xD41C) {
            this.sid.writeReg(addr - 0xD400, val);
        } else if (addr === 0xD011) {
            this.ram[0xD011] = val; // Wert muss gespeichert werden für Bit 0-6!
            this.rasterIrqTarget = (this.rasterIrqTarget & 0xFF) | ((val & 0x80) << 1);
        } else if (addr === 0xD012) {
            this.rasterIrqTarget = (this.rasterIrqTarget & 0x100) | val;
        } else if (addr === 0xD019) {
            this.ram[0xD019] &= ~(val & 0x0F); // Write 1 clears bit
            this.updateIrq();
        } else if (addr === 0xD01A) {
            this.ram[0xD01A] = val & 0x0F;
            this.updateIrq();
        }

        // CIA-1
        else if (addr === 0xDC04) {
            this.cia1TimerALatch = (this.cia1TimerALatch & 0xFF00) | val;
            if ((this.cia1CtrlA & 0x01) === 0) this.cia1TimerA = (this.cia1TimerA & 0xFF00) | val;
        } else if (addr === 0xDC05) {
            this.cia1TimerALatch = (this.cia1TimerALatch & 0x00FF) | (val << 8);
            if ((this.cia1CtrlA & 0x01) === 0) this.cia1TimerA = (this.cia1TimerA & 0x00FF) | (val << 8);
        }
        // --- SCHRITT 5: CIA TOD CLOCK (Einstell-Halt) ---
        else if (addr === 0xDC08) {
            this.todTenths = val & 0x0F;
            this.todHalted = false; // Das Schreiben der Zehntelsekunden startet die Uhr wieder
            this.todLatched = false;
        } else if (addr === 0xDC09) {
            this.todSec = val & 0x7F;
        } else if (addr === 0xDC0A) {
            this.todMin = val & 0x7F;
        } else if (addr === 0xDC0B) {
            this.todHour = val & 0xFF;
            this.todHalted = true;  // Das Schreiben der Stunden hält die Uhr an
        }
        // --- SCHRITT 2: CIA TIMER B ---
        else if (addr === 0xDC06) {
            this.cia1TimerBLatch = (this.cia1TimerBLatch & 0xFF00) | val;
            if ((this.cia1CtrlB & 0x01) === 0) this.cia1TimerB = (this.cia1TimerB & 0xFF00) | val;
        } else if (addr === 0xDC07) {
            this.cia1TimerBLatch = (this.cia1TimerBLatch & 0x00FF) | (val << 8);
            if ((this.cia1CtrlB & 0x01) === 0) this.cia1TimerB = (this.cia1TimerB & 0x00FF) | (val << 8);
        }
        else if (addr === 0xDC0D) {
            if (val & 0x80) this.cia1IrqMask |= (val & 0x7F);
            else this.cia1IrqMask &= ~(val & 0x7F);
            this.updateIrq();
        } else if (addr === 0xDC0E) {
            this.cia1CtrlA = val;
            if (val & 0x10) this.cia1TimerA = this.cia1TimerALatch === 0 ? 0xFFFF : this.cia1TimerALatch; 
        }
        // --- SCHRITT 2: CIA TIMER B ---
        else if (addr === 0xDC0F) {
            this.cia1CtrlB = val;
            if (val & 0x10) this.cia1TimerB = this.cia1TimerBLatch === 0 ? 0xFFFF : this.cia1TimerBLatch;
        }
    }

    updateIrq() {
        let vicIrq = (this.ram[0xD019] & this.ram[0xD01A] & 0x0F) !== 0;
        let ciaIrq = (this.cia1Icr & this.cia1IrqMask & 0x1F) !== 0;
        
        if (vicIrq) this.ram[0xD019] |= 0x80;
        else this.ram[0xD019] &= 0x7F;

        if (ciaIrq) this.cia1Icr |= 0x80;
        else this.cia1Icr &= 0x7F;

        this.irqPending = vicIrq || ciaIrq;
    }

    // =========================================================
    // THE HARDWARE CLOCK MANAGER
    // Taktung von CIA-Timer A & B, Raster und Badline-Evaluation
    // =========================================================
clockHardware(cycles) {
        for (let i = 0; i < cycles; i++) {
            let timerBUnderflowTriggered = false;

            // --- 1. CIA Timer A (Cycle-Exact) ---
            if (this.cia1CtrlA & 0x01) { 
                this.cia1TimerA--;
                if (this.cia1TimerA < 0) {
                    this.cia1Icr |= 0x01; // Timer A underflow flag
                    this.cia1TimerA = this.cia1TimerALatch === 0 ? 0xFFFF : this.cia1TimerALatch;
                    
                    if (this.cia1CtrlA & 0x08) { // One-shot stop
                        this.cia1CtrlA &= ~0x01; 
                    }
                    this.updateIrq();

                    // --- SCHRITT 2: TIMER B KASKADIERUNGS-MODUS ---
                    if ((this.cia1CtrlB & 0x01) && ((this.cia1CtrlB & 0x60) === 0x40)) {
                        this.cia1TimerB--;
                        if (this.cia1TimerB < 0) {
                            timerBUnderflowTriggered = true;
                        }
                    }
                }
            }

            // --- 2. CIA Timer B SYSTEM-CLOCK MODUS ---
            if ((this.cia1CtrlB & 0x01) && ((this.cia1CtrlB & 0x60) === 0x00)) {
                this.cia1TimerB--;
                if (this.cia1TimerB < 0) {
                    timerBUnderflowTriggered = true;
                }
            }

            // --- SCHRITT 2: TIMER B UNTERLAUF VERARBEITEN ---
            if (timerBUnderflowTriggered) {
                this.cia1Icr |= 0x02; 
                this.cia1TimerB = this.cia1TimerBLatch === 0 ? 0xFFFF : this.cia1TimerBLatch;
                if (this.cia1CtrlB & 0x08) { 
                    this.cia1CtrlB &= ~0x01; 
                }
                this.updateIrq();
            }

            // --- SCHRITT 5: CIA TOD CLOCK ---
            this.todCycleCounter--;
            if (this.todCycleCounter <= 0) {
                // Bit 7 von CRA ($DC0E) bestimmt die Netzfrequenz: 1 = 50 Hz, 0 = 60 Hz
                let is50Hz = (this.cia1CtrlA & 0x80) !== 0;
                this.todCycleCounter += is50Hz ? 19705 : 16421;
                this.incrementTod();
            }

            // --- 3. VIC-II Raster Line (Cycle-Exact) ---            
            this.rasterCycles++;
            if (this.rasterCycles >= this.cyclesPerLine) {
                this.rasterCycles = 0;
                this.rasterCounter++;
                if (this.rasterCounter >= 312) this.rasterCounter = 0; 

                // Sync Bit 7 von D011
                if (this.rasterCounter > 255) this.ram[0xD011] |= 0x80;
                else this.ram[0xD011] &= 0x7F;
            }
            
            // --- SCHRITT 1: BADLINE EVALUATION (Cycle 0) ---
            if (this.rasterCycles === 0) {
                let yscroll = this.ram[0xD011] & 0x07;
                let displayEnabled = (this.ram[0xD011] & 0x10) !== 0;
                this.isBadLine = displayEnabled && 
                                 (this.rasterCounter >= 0x30 && this.rasterCounter <= 0xF7) && 
                                 ((this.rasterCounter & 0x07) === yscroll);
            }

            // --- SCHRITT 1: CYCLE STEALING (Cycle 12) ---
            if (this.rasterCycles === 12 && this.isBadLine) {
                this.cpuStall = 40;
            }
            
            // Raster IRQ triggert in Cycle 0 der Ziel-Linie
            if (this.rasterCycles === 0 && this.rasterCounter === this.rasterIrqTarget) {
                this.ram[0xD019] |= 0x01; 
                this.updateIrq();
            }
        }
    }

    triggerHardwareIrq() {
        this.push(this.pc >> 8);
        this.push(this.pc & 0xFF);
        this.push((this.p & 0xEF) | 0x20); // B-Flag 0, Bit 5 1
        this.p |= 0x04; // Set I flag
        this.pc = this.read(0xFFFE) | (this.read(0xFFFF) << 8);
    }

    triggerHardwareNmi() {
        this.push(this.pc >> 8);
        this.push(this.pc & 0xFF);
        this.push((this.p & 0xEF) | 0x20);
        this.p |= 0x04;
        this.pc = this.read(0xFFFA) | (this.read(0xFFFB) << 8);
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
        if (this.nmiPending) {
            this.nmiPending = false;
            this.triggerHardwareNmi();
            return 7;
        }
        if (this.irqPending && (this.p & 0x04) === 0) {
            this.triggerHardwareIrq();
            return 7;
        }

        let op = this.read(this.pc++);
        let cycles = 2; 

        switch (op) {
            case 0x00: { // BRK
                this.pc = (this.pc + 1) & 0xFFFF;
                this.push(this.pc >> 8);
                this.push(this.pc & 0xFF);
                this.push(this.p | 0x10); // B-flag set
                this.p |= 0x04; // Set I flag
                this.pc = this.read(0xFFFE) | (this.read(0xFFFF) << 8);
                cycles = 7;
            } break;

            case 0xEA: cycles = 2; break; // NOP
            case 0xA9: this.a = this.read(this.pc++); this.setNZ(this.a); cycles = 2; break; // LDA imm
            case 0xA5: this.a = this.read(this.zp()); this.setNZ(this.a); cycles = 3; break; // LDA zp
            case 0xB5: this.a = this.read(this.zpX()); this.setNZ(this.a); cycles = 4; break; // LDA zp,X
            case 0xAD: this.a = this.read(this.abs()); this.setNZ(this.a); cycles = 4; break; // LDA abs
            case 0xBD: { // LDA abs,X
                let addr = this.abs();
                let addrX = (addr + this.x) & 0xFFFF;
                if (this.pageCrossed(addr, addrX)) {
                    this.read((addr & 0xFF00) | (addrX & 0x00FF)); // Dummy Read auf Zwischenadresse
                }
                this.a = this.read(addrX);
                this.setNZ(this.a);
                cycles = 4 + (this.pageCrossed(addr, addrX) ? 1 : 0);
            } break; 

            case 0xB9: { // LDA abs,Y
                let addr = this.abs();
                let addrY = (addr + this.y) & 0xFFFF;
                if (this.pageCrossed(addr, addrY)) {
                    this.read((addr & 0xFF00) | (addrY & 0x00FF)); // Dummy Read
                }
                this.a = this.read(addrY);
                this.setNZ(this.a);
                cycles = 4 + (this.pageCrossed(addr, addrY) ? 1 : 0);
            } break; 
            case 0xA1: this.a = this.read(this.indX()); this.setNZ(this.a); cycles = 6; break; // LDA (zp,X)
            case 0xB1: { // LDA (zp),Y
                let z = this.zp();
                let addr = this.read(z) | (this.read((z+1)&0xFF) << 8);
                let addrY = (addr + this.y) & 0xFFFF;
                if (this.pageCrossed(addr, addrY)) {
                    this.read((addr & 0xFF00) | (addrY & 0x00FF)); // Dummy Read
                }
                this.a = this.read(addrY);
                this.setNZ(this.a);
                cycles = 5 + (this.pageCrossed(addr, addrY) ? 1 : 0);
            } break; 
            case 0xA2: this.x = this.read(this.pc++); this.setNZ(this.x); cycles = 2; break; // LDX imm
            case 0xA6: this.x = this.read(this.zp()); this.setNZ(this.x); cycles = 3; break; // LDX zp
            case 0xB6: this.x = this.read(this.zpY()); this.setNZ(this.x); cycles = 4; break; // LDX zp,Y
            case 0xAE: this.x = this.read(this.abs()); this.setNZ(this.x); cycles = 4; break; // LDX abs
            case 0xBE: { // LDX abs,Y
                let addr = this.abs();
                let addrY = (addr + this.y) & 0xFFFF;
                if (this.pageCrossed(addr, addrY)) {
                    this.read((addr & 0xFF00) | (addrY & 0x00FF)); // Dummy Read
                }
                this.x = this.read(addrY);
                this.setNZ(this.x);
                cycles = 4 + (this.pageCrossed(addr, addrY) ? 1 : 0);
            } break; 

            case 0xA0: this.y = this.read(this.pc++); this.setNZ(this.y); cycles = 2; break; // LDY imm
            case 0xA4: this.y = this.read(this.zp()); this.setNZ(this.y); cycles = 3; break; // LDY zp
            case 0xB4: this.y = this.read(this.zpX()); this.setNZ(this.y); cycles = 4; break; // LDY zp,X
            case 0xAC: this.y = this.read(this.abs()); this.setNZ(this.y); cycles = 4; break; // LDY abs
            case 0xBC: { // LDY abs,X
                let addr = this.abs();
                let addrX = (addr + this.x) & 0xFFFF;
                if (this.pageCrossed(addr, addrX)) {
                    this.read((addr & 0xFF00) | (addrX & 0x00FF)); // Dummy Read
                }
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

            case 0xE6: { // INC zp
                let z = this.zp(); 
                let v = this.read(z); 
                this.write(z, v); // Dummy Write (alter Wert)
                v = (v + 1) & 0xFF; 
                this.write(z, v); // Real Write (neuer Wert)
                this.setNZ(v); 
                cycles = 5; 
            } break; 
            case 0xF6: { // INC zp,X
                let z = this.zpX(); 
                let v = this.read(z); 
                this.write(z, v); 
                v = (v + 1) & 0xFF; 
                this.write(z, v); 
                this.setNZ(v); 
                cycles = 6; 
            } break; 
            case 0xEE: { // INC abs
                let a = this.abs(); 
                let v = this.read(a); 
                this.write(a, v); 
                v = (v + 1) & 0xFF; 
                this.write(a, v); 
                this.setNZ(v); 
                cycles = 6; 
            } break; 
            case 0xFE: { // INC abs,X
                let a = this.absX(); 
                let v = this.read(a); 
                this.write(a, v); 
                v = (v + 1) & 0xFF; 
                this.write(a, v); 
                this.setNZ(v); 
                cycles = 7; 
            } break; 

            case 0xC6: { // DEC zp
                let z = this.zp(); 
                let v = this.read(z); 
                this.write(z, v); 
                v = (v - 1) & 0xFF; 
                this.write(z, v); 
                this.setNZ(v); 
                cycles = 5; 
            } break; 
            case 0xD6: { // DEC zp,X
                let z = this.zpX(); 
                let v = this.read(z); 
                this.write(z, v); 
                v = (v - 1) & 0xFF; 
                this.write(z, v); 
                this.setNZ(v); 
                cycles = 6; 
            } break; 
            case 0xCE: { // DEC abs
                let a = this.abs(); 
                let v = this.read(a); 
                this.write(a, v); 
                v = (v - 1) & 0xFF; 
                this.write(a, v); 
                this.setNZ(v); 
                cycles = 6; 
            } break; 
            case 0xDE: { // DEC abs,X
                let a = this.absX(); 
                let v = this.read(a); 
                this.write(a, v); 
                v = (v - 1) & 0xFF; 
                this.write(a, v); 
                this.setNZ(v); 
                cycles = 7; 
            } break;

            case 0x20: { let target = this.abs(); this.push((this.pc - 1) >> 8); this.push((this.pc - 1) & 0xFF); this.pc = target; cycles = 6; } break; // JSR
            case 0x4C: this.pc = this.abs(); cycles = 3; break; // JMP abs
            case 0x6C: { let ptr = this.abs(); let low = this.read(ptr); let high = this.read((ptr & 0xFF00) | ((ptr + 1) & 0x00FF)); this.pc = low | (high << 8); cycles = 5; } break; // JMP (ind)
            case 0x60: { let low = this.pop(); let high = this.pop(); this.pc = (low | (high << 8)) + 1; cycles = 6; } break; // RTS
            case 0x40: { // RTI
                this.p = (this.pop() & 0xEF) | 0x20; 
                let low = this.pop(); 
                let high = this.pop(); 
                this.pc = low | (high << 8); 
                cycles = 6; 
            } break; 

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

            case 0x06: { // ASL zp
                let z = this.zp(); 
                let v = this.read(z); 
                this.write(z, v); 
                if (v & 128) this.p |= 1; else this.p &= ~1; 
                v = (v << 1) & 0xFF; 
                this.write(z, v); 
                this.setNZ(v); 
                cycles = 5; 
            } break; 
            
            case 0x46: { // LSR zp
                let z = this.zp(); 
                let v = this.read(z); 
                this.write(z, v); 
                if (v & 1) this.p |= 1; else this.p &= ~1; 
                v = (v >> 1) & 0x7F; 
                this.write(z, v); 
                this.setNZ(v); 
                cycles = 5; 
            } break; 
            
            case 0x26: { // ROL zp
                let z = this.zp(); 
                let v = this.read(z); 
                this.write(z, v); 
                let c = this.p & 1; 
                if (v & 128) this.p |= 1; else this.p &= ~1; 
                v = ((v << 1) & 0xFF) | c; 
                this.write(z, v); 
                this.setNZ(v); 
                cycles = 5; 
            } break; 
            
            case 0x66: { // ROR zp
                let z = this.zp(); 
                let v = this.read(z); 
                this.write(z, v); 
                let c = this.p & 1; 
                if (v & 1) this.p |= 1; else this.p &= ~1; 
                v = (v >> 1) | (c << 7); 
                this.write(z, v); 
                this.setNZ(v); 
                cycles = 5; 
            } break; 
            
            case 0x16: { // ASL zp,X
                let z = this.zpX(); 
                let v = this.read(z); 
                this.write(z, v); 
                if (v & 128) this.p |= 1; else this.p &= ~1; 
                v = (v << 1) & 0xFF; 
                this.write(z, v); 
                this.setNZ(v); 
                cycles = 6; 
            } break; 

            case 0x56: { // LSR zp,X
                let z = this.zpX(); 
                let v = this.read(z); 
                this.write(z, v); 
                if (v & 1) this.p |= 1; else this.p &= ~1; 
                v = (v >> 1) & 0x7F; 
                this.write(z, v); 
                this.setNZ(v); 
                cycles = 6; 
            } break; 
            
            case 0x36: { // ROL zp,X
                let z = this.zpX(); 
                let v = this.read(z); 
                this.write(z, v); 
                let c = this.p & 1; 
                if (v & 128) this.p |= 1; else this.p &= ~1; 
                v = ((v << 1) & 0xFF) | c; 
                this.write(z, v); 
                this.setNZ(v); 
                cycles = 6; 
            } break; 
                        
            case 0x76: { // ROR zp,X
                let z = this.zpX(); 
                let v = this.read(z); 
                this.write(z, v); 
                let c = this.p & 1; 
                if (v & 1) this.p |= 1; else this.p &= ~1; 
                v = (v >> 1) | (c << 7); 
                this.write(z, v); 
                this.setNZ(v); 
                cycles = 6; 
            } break; 

            case 0x0E: { // ASL abs
                let a = this.abs(); 
                let v = this.read(a); 
                this.write(a, v); 
                if (v & 128) this.p |= 1; else this.p &= ~1; 
                v = (v << 1) & 0xFF; 
                this.write(a, v); 
                this.setNZ(v); 
                cycles = 6; 
            } break; 
            
            case 0x4E: { // LSR abs
                let a = this.abs(); 
                let v = this.read(a); 
                this.write(a, v); 
                if (v & 1) this.p |= 1; else this.p &= ~1; 
                v = (v >> 1) & 0x7F; 
                this.write(a, v); 
                this.setNZ(v); 
                cycles = 6; 
            } break; 
            
            case 0x2E: { // ROL abs
                let a = this.abs(); 
                let v = this.read(a); 
                this.write(a, v); 
                let c = this.p & 1; 
                if (v & 128) this.p |= 1; else this.p &= ~1; 
                v = ((v << 1) & 0xFF) | c; 
                this.write(a, v); 
                this.setNZ(v); 
                cycles = 6; 
            } break; 
            
            case 0x6E: { // ROR abs
                let a = this.abs(); 
                let v = this.read(a); 
                this.write(a, v); 
                let c = this.p & 1; 
                if (v & 1) this.p |= 1; else this.p &= ~1; 
                v = (v >> 1) | (c << 7); 
                this.write(a, v); 
                this.setNZ(v); 
                cycles = 6; 
            } break; 
            
            case 0x1E: { // ASL abs,X
                let a = this.absX(); 
                let v = this.read(a); 
                this.write(a, v); 
                if (v & 128) this.p |= 1; else this.p &= ~1; 
                v = (v << 1) & 0xFF; 
                this.write(a, v); 
                this.setNZ(v); 
                cycles = 7; 
            } break;
            
            case 0x5E: { // LSR abs,X
                let a = this.absX(); 
                let v = this.read(a); 
                this.write(a, v); 
                if (v & 1) this.p |= 1; else this.p &= ~1; 
                v = (v >> 1) & 0x7F; 
                this.write(a, v); 
                this.setNZ(v); 
                cycles = 7; 
            } break;
            
            case 0x3E: { // ROL abs,X
                let a = this.absX(); 
                let v = this.read(a); 
                this.write(a, v); 
                let c = this.p & 1; 
                if (v & 128) this.p |= 1; else this.p &= ~1; 
                v = ((v << 1) & 0xFF) | c; 
                this.write(a, v); 
                this.setNZ(v); 
                cycles = 7; 
            } break;
            
            case 0x7E: { // ROR abs,X
                let a = this.absX(); 
                let v = this.read(a); 
                this.write(a, v); 
                let c = this.p & 1; 
                if (v & 1) this.p |= 1; else this.p &= ~1; 
                v = (v >> 1) | (c << 7); 
                this.write(a, v); 
                this.setNZ(v); 
                cycles = 7; 
            } break;

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

        switch (op) {
            case 0x69: case 0xE9: case 0x29: case 0x09:
            case 0x49: case 0xC9: case 0xE0: case 0xC0:
                val = this.read(this.pc++);
                cycles = 2;
                break;

            case 0x65: case 0xE5: case 0x25: case 0x05:
            case 0x45: case 0xC5: case 0xE4: case 0xC4:
            case 0x24:
                val = this.read(this.zp());
                cycles = 3;
                break;

            case 0x75: case 0xF5: case 0x35: case 0x15:
            case 0x55: case 0xD5:
                val = this.read(this.zpX());
                cycles = 4;
                break;

            case 0x6D: case 0xED: case 0x2D: case 0x0D:
            case 0x4D: case 0xCD: case 0xEC: case 0xCC:
            case 0x2C:
                val = this.read(this.abs());
                cycles = 4;
                break;

            // Absolute, X (cycles = 4 + page cross)
            case 0x7D: case 0xFD: case 0x3D: case 0x1D:
            case 0x5D: case 0xDD: {
                let addr = this.abs();
                let addrX = (addr + this.x) & 0xFFFF;
                if (this.pageCrossed(addr, addrX)) {
                    this.read((addr & 0xFF00) | (addrX & 0x00FF)); // Dummy Read
                }
                val = this.read(addrX);
                cycles = 4 + (this.pageCrossed(addr, addrX) ? 1 : 0);
                break;
            }

            // Absolute, Y (cycles = 4 + page cross)
            case 0x79: case 0xF9: case 0x39: case 0x19:
            case 0x59: case 0xD9: {
                let addr = this.abs();
                let addrY = (addr + this.y) & 0xFFFF;
                if (this.pageCrossed(addr, addrY)) {
                    this.read((addr & 0xFF00) | (addrY & 0x00FF)); // Dummy Read
                }
                val = this.read(addrY);
                cycles = 4 + (this.pageCrossed(addr, addrY) ? 1 : 0);
                break;
            }

            case 0x61: case 0xE1: case 0x21: case 0x01:
            case 0x41: case 0xC1:
                val = this.read(this.indX());
                cycles = 6;
                break;

            // Indirect Indexed Y (cycles = 5 + page cross)
            case 0x71: case 0xF1: case 0x31: case 0x11:
            case 0x51: case 0xD1: {
                let z = this.zp();
                let addr = this.read(z) | (this.read((z+1)&0xFF) << 8);
                let addrY = (addr + this.y) & 0xFFFF;
                if (this.pageCrossed(addr, addrY)) {
                    this.read((addr & 0xFF00) | (addrY & 0x00FF)); // Dummy Read
                }
                val = this.read(addrY);
                cycles = 5 + (this.pageCrossed(addr, addrY) ? 1 : 0);
                break;
            }

            default:
                setVal = false;
                break;
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

    // --- SCHRITT 5: BCD ARITHMETIK HILFSMETHODEN ---
    addBcd(val, add) {
        let low = (val & 0x0F) + add;
        let high = (val >> 4);
        if (low >= 10) {
            low -= 10;
            high++;
        }
        return (high << 4) | low;
    }

    incrementTod() {
        if (this.todHalted) return;

        this.todTenths++;
        if (this.todTenths > 9) {
            this.todTenths = 0;
            
            this.todSec = this.addBcd(this.todSec, 1);
            if (this.todSec >= 0x60) {
                this.todSec = 0;
                
                this.todMin = this.addBcd(this.todMin, 1);
                if (this.todMin >= 0x60) {
                    this.todMin = 0;
                    
                    let hBcd = this.todHour & 0x7F;
                    let pm = this.todHour & 0x80;
                    hBcd = this.addBcd(hBcd, 1);
                    if (hBcd > 0x12) {
                        hBcd = 1;
                    }
                    if (hBcd === 0x12) {
                        pm ^= 0x80; // Toggle AM/PM Flag bei 12 Uhr
                    }
                    this.todHour = hBcd | pm;
                }
            }
        }
    }
}