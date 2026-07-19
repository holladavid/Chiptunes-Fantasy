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
        this.cia1Icr = 0; // Interrupt Control Register (Read-to-Clear)
        this.cia1IrqMask = 0; // Interrupt Enable Register
        
        this.cia1TimerB = 0xFFFF;
        this.cia1TimerBLatch = 0xFFFF;
        this.cia1CtrlB = 0;

        this.irqPending = false;
        this.nmiPending = false;
        this.irqAccepted = false;
        this.nmiAccepted = false;

        // --- PHASE 1: PHYSIKALISCHE RDY-LEITUNG ---
        this.rdy = true; // True = CPU läuft, False = CPU angehalten (Bus gesperrt)
        this.isBadLine = false;

        // TOD-Clock
        this.todTenths = 0;
        this.todSec = 0;
        this.todMin = 0;
        this.todHour = 1; // 1 AM
        this.todLatchTenths = 0;
        this.todLatchSec = 0;
        this.todLatchMin = 0;
        this.todLatchHour = 1;
        this.todLatched = false;
        this.todHalted = false;
        this.todCycleCounter = 19705;

        // --- PHASE 8: CIA-2 (NMI SUB-SYSTEM FÜR DIGIDRUMS) ---
        this.cia2TimerA = 0xFFFF;
        this.cia2TimerALatch = 0xFFFF;
        this.cia2CtrlA = 0;
        this.cia2Icr = 0;
        this.cia2IrqMask = 0;
        
        this.cia2TimerB = 0xFFFF;
        this.cia2TimerBLatch = 0xFFFF;
        this.cia2CtrlB = 0;
    }

    reset(loadAddr, prgCode) {
        this.ram.fill(0);
        
        // C64 Memory Management Unit (MMU) Default State
        this.ram[0x0000] = 0x2F; 
        this.ram[0x0001] = 0x37; 
        
        // --- 1. ZUERST DAS PHANTOM KERNAL AUFBAUEN ---
        // Eigene Host-Idle Schleife für unseren Emulator (sicher abgekoppelt vom C64 KERNAL)
        this.ram[0xEFFF] = 0x4C; this.ram[0xF000] = 0xFF; this.ram[0xF001] = 0xEF; // JMP $EFFF
        
        // Authentischer KERNAL IRQ Exit ($EA31) und NMI Exit ($FE56)
        const returnHandler = [ 0x68, 0xA8, 0x68, 0xAA, 0x68, 0x40 ]; // PLA, TAY, PLA, TAX, PLA, RTI
        for (let i = 0; i < returnHandler.length; i++) {
            this.ram[0xEA31 + i] = returnHandler[i]; // Wichtig: Wizball springt hierhin!
            this.ram[0xEA81 + i] = returnHandler[i]; 
            this.ram[0xFE56 + i] = returnHandler[i]; 
        }
        
        this.ram[0x0314] = 0x31; this.ram[0x0315] = 0xEA; 
        this.ram[0x0316] = 0x81; this.ram[0x0317] = 0xEA; 
        this.ram[0x0318] = 0x56; this.ram[0x0319] = 0xFE; 

        this.ram[0xFFFE] = 0x48; this.ram[0xFFFF] = 0xFF; 
        this.ram[0xFFFA] = 0x60; this.ram[0xFFFB] = 0xFF; 

        const irqEntry = [
            0x48, 0x8A, 0x48, 0x98, 0x48, // PHA, TXA, PHA, TYA, PHA
            0xBA, 0xBD, 0x04, 0x01,       // TSX, LDA $0104,X
            0x29, 0x10, 0xF0, 0x03,       // AND #$10, BEQ +3
            0x6C, 0x16, 0x03,             // JMP ($0316) -> BRK Vector
            0x6C, 0x14, 0x03              // JMP ($0314) -> IRQ Vector
        ];
        for (let i = 0; i < irqEntry.length; i++) this.ram[0xFF48 + i] = irqEntry[i];

        const nmiEntry = [
            0x48, 0x8A, 0x48, 0x98, 0x48, // PHA, TXA, PHA, TYA, PHA
            0x6C, 0x18, 0x03              // JMP ($0318) -> NMI Vector
        ];
        for (let i = 0; i < nmiEntry.length; i++) this.ram[0xFF60 + i] = nmiEntry[i];
        
        // --- 2. DANACH DEN PRG-CODE LADEN (kann die Vektoren nun überschreiben!) ---
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
        
        this.cia2TimerA = 0xFFFF;
        this.cia2TimerALatch = 0xFFFF;
        this.cia2CtrlA = 0;
        this.cia2Icr = 0;
        this.cia2IrqMask = 0;
        
        this.cia2TimerB = 0xFFFF;
        this.cia2TimerBLatch = 0xFFFF;
        this.cia2CtrlB = 0;

        this.irqPending = false;
        this.nmiPending = false;
        this.irqAccepted = false;
        this.nmiAccepted = false;
        
        // NMI Edge Detection State
        this.prevNmiLine = false;

        this.rdy = true;
        this.isBadLine = false;

        this.todTenths = 0;
        this.todSec = 0;
        this.todMin = 0;
        this.todHour = 1;
        this.todLatchTenths = 0;
        this.todLatchSec = 0;
        this.todLatchMin = 0;
        this.todLatchHour = 1;
        this.todLatched = false;
        this.todHalted = false;
        this.todCycleCounter = 19705;
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
        
        let p0001 = this.ram[0x0001] & 0x07;
        let ioEnabled = (p0001 === 5 || p0001 === 6 || p0001 === 7);
        if (!ioEnabled) return this.ram[addr];

        if (addr === 0xD011) {
            let val = this.ram[0xD011] & 0x7F;
            if (this.rasterCounter > 255) val |= 0x80;
            return val;
        }
        if (addr === 0xD012) return this.rasterCounter & 0xFF;
        if (addr === 0xD019) return this.ram[0xD019] | 0x70; 
        
        if (addr === 0xDC04) return this.cia1TimerA & 0xFF;
        if (addr === 0xDC05) return (this.cia1TimerA >> 8) & 0xFF;
        
        if (addr >= 0xDC08 && addr <= 0xDC0B) {
            if (addr === 0xDC0B) {
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
                this.todLatched = false; 
                return val;
            }
        }

        if (addr === 0xDC0D) {
            let anyEnabled = (this.cia1Icr & this.cia1IrqMask & 0x1F) !== 0;
            let val = this.cia1Icr & 0x1F;
            if (anyEnabled) val |= 0x80; 
            this.cia1Icr = 0; 
            // FIX: Methode hieß im alten Code noch fälschlicherweise updateIrq()
            this.updateIrqState(); 
            return val;
        }
        if (addr === 0xDC0E) return this.cia1CtrlA;
        if (addr === 0xDC0F) return this.cia1CtrlB;
        
        if (addr >= 0xDD00 && addr <= 0xDD0F) {
            if (addr === 0xDD04) return this.cia2TimerA & 0xFF;
            if (addr === 0xDD05) return (this.cia2TimerA >> 8) & 0xFF;
            if (addr === 0xDD06) return this.cia2TimerB & 0xFF;
            if (addr === 0xDD07) return (this.cia2TimerB >> 8) & 0xFF;
            if (addr === 0xDD0D) {
                let anyEnabled = (this.cia2Icr & this.cia2IrqMask & 0x1F) !== 0;
                let val = this.cia2Icr & 0x1F;
                if (anyEnabled) val |= 0x80; 
                this.cia2Icr = 0; 
                // FIX: Methode korrigiert!
                this.updateIrqState(); 
                return val;
            }
            if (addr === 0xDD0E) return this.cia2CtrlA;
            if (addr === 0xDD0F) return this.cia2CtrlB;
            return this.ram[addr]; 
        }
        
        if (addr === 0xD41B) return this.sid.voices[2].waveOut8Bit || 0;
        if (addr === 0xD41C) return this.sid.voices[2].env8Bit || 0;

        return this.ram[addr];
    }

    write(addr, val) {
        this.ram[addr] = val;
        if (addr < 0xD000 || addr > 0xDFFF) return;
        
        let p0001 = this.ram[0x0001] & 0x07;
        let ioEnabled = (p0001 === 5 || p0001 === 6 || p0001 === 7);
        if (!ioEnabled) return;
        
        if (addr >= 0xD400 && addr <= 0xD41C) {
            this.sid.writeReg(addr - 0xD400, val);
        } else if (addr === 0xD011) {
            this.ram[0xD011] = val; 
            this.rasterIrqTarget = (this.rasterIrqTarget & 0xFF) | ((val & 0x80) << 1);
        } else if (addr === 0xD012) {
            this.rasterIrqTarget = (this.rasterIrqTarget & 0x100) | val;
        } else if (addr === 0xD019) {
            this.ram[0xD019] &= ~(val & 0x0F); 
            // FIX: Methode korrigiert!
            this.updateIrqState();
        } else if (addr === 0xD01A) {
            this.ram[0xD01A] = val & 0x0F;
            // FIX: Methode korrigiert!
            this.updateIrqState();
        }
        else if (addr === 0xDC04) {
            this.cia1TimerALatch = (this.cia1TimerALatch & 0xFF00) | val;
            if ((this.cia1CtrlA & 0x01) === 0) this.cia1TimerA = (this.cia1TimerA & 0xFF00) | val;
        } else if (addr === 0xDC05) {
            this.cia1TimerALatch = (this.cia1TimerALatch & 0x00FF) | (val << 8);
            if ((this.cia1CtrlA & 0x01) === 0) this.cia1TimerA = (this.cia1TimerA & 0x00FF) | (val << 8);
        } else if (addr === 0xDC06) {
            this.cia1TimerBLatch = (this.cia1TimerBLatch & 0xFF00) | val;
            if ((this.cia1CtrlB & 0x01) === 0) this.cia1TimerB = (this.cia1TimerB & 0xFF00) | val;
        } else if (addr === 0xDC07) {
            this.cia1TimerBLatch = (this.cia1TimerBLatch & 0x00FF) | (val << 8);
            if ((this.cia1CtrlB & 0x01) === 0) this.cia1TimerB = (this.cia1TimerB & 0x00FF) | (val << 8);
        } else if (addr === 0xDC08) {
            this.todTenths = val & 0x0F;
            this.todHalted = false; 
            this.todLatched = false;
        } else if (addr === 0xDC09) {
            this.todSec = val & 0x7F;
        } else if (addr === 0xDC0A) {
            this.todMin = val & 0x7F;
        } else if (addr === 0xDC0B) {
            this.todHour = val & 0xFF;
            this.todHalted = true;  
        } else if (addr === 0xDC0D) {
            let bit7 = (val & 0x80) !== 0;
            let maskBits = val & 0x1F;
            if (bit7) {
                this.cia1IrqMask |= maskBits;  
            } else {
                this.cia1IrqMask &= ~maskBits; 
            }
            // FIX: Methode korrigiert!
            this.updateIrqState();
        } else if (addr === 0xDC0E) {
            this.cia1CtrlA = val;
            if (val & 0x10) this.cia1TimerA = this.cia1TimerALatch === 0 ? 0xFFFF : this.cia1TimerALatch; 
        } else if (addr === 0xDC0F) {
            this.cia1CtrlB = val; 
            if (val & 0x10) this.cia1TimerB = this.cia1TimerBLatch === 0 ? 0xFFFF : this.cia1TimerBLatch;
        }
        else if (addr >= 0xDD00 && addr <= 0xDD0F) {
            if (addr === 0xDD04) {
                this.cia2TimerALatch = (this.cia2TimerALatch & 0xFF00) | val;
                if ((this.cia2CtrlA & 0x01) === 0) this.cia2TimerA = (this.cia2TimerA & 0xFF00) | val;
            } else if (addr === 0xDD05) {
                this.cia2TimerALatch = (this.cia2TimerALatch & 0x00FF) | (val << 8);
                if ((this.cia2CtrlA & 0x01) === 0) this.cia2TimerA = (this.cia2TimerA & 0x00FF) | (val << 8);
            } else if (addr === 0xDD06) {
                this.cia2TimerBLatch = (this.cia2TimerBLatch & 0xFF00) | val;
                if ((this.cia2CtrlB & 0x01) === 0) this.cia2TimerB = (this.cia2TimerB & 0xFF00) | val;
            } else if (addr === 0xDD07) {
                this.cia2TimerBLatch = (this.cia2TimerBLatch & 0x00FF) | (val << 8);
                if ((this.cia2CtrlB & 0x01) === 0) this.cia2TimerB = (this.cia2TimerB & 0x00FF) | (val << 8);
            } else if (addr === 0xDD0D) {
                let bit7 = (val & 0x80) !== 0;
                let maskBits = val & 0x1F;
                if (bit7) this.cia2IrqMask |= maskBits;
                else this.cia2IrqMask &= ~maskBits;
                // FIX: Methode korrigiert!
                this.updateIrqState();
            } else if (addr === 0xDD0E) {
                this.cia2CtrlA = val;
                if (val & 0x10) this.cia2TimerA = this.cia2TimerALatch === 0 ? 0xFFFF : this.cia2TimerALatch;
            } else if (addr === 0xDD0F) {
                this.cia2CtrlB = val;
                if (val & 0x10) this.cia2TimerB = this.cia2TimerBLatch === 0 ? 0xFFFF : this.cia2TimerBLatch;
            }
            return;
        }
    }

updateIrqState(cycleIndex = 0, totalCycles = 1) {
        let vicIrq = (this.ram[0xD019] & this.ram[0xD01A] & 0x0F) !== 0;
        let ciaIrq = (this.cia1Icr & this.cia1IrqMask & 0x1F) !== 0;
        let cia2Nmi = (this.cia2Icr & this.cia2IrqMask & 0x1F) !== 0;
        
        this.irqPending = vicIrq || ciaIrq;
        
        // --- NMI EDGE DETECTION (Behebt Arkanoid NMI Loop Crash!) ---
        if (cia2Nmi && !this.prevNmiLine) {
            this.nmiPending = true;
        }
        this.prevNmiLine = cia2Nmi;

        if (vicIrq) this.ram[0xD019] |= 0x80;
        else this.ram[0xD019] &= 0x7F;

        if (ciaIrq) this.cia1Icr |= 0x80;
        else this.cia1Icr &= 0x7F;

        if (cia2Nmi) this.cia2Icr |= 0x80;
        else this.cia2Icr &= 0x7F;

        if (this.irqPending) {
            if (cycleIndex <= totalCycles - 3) this.irqAccepted = (this.p & 0x04) === 0;
        }
        if (this.nmiPending) {
            if (cycleIndex <= totalCycles - 3) this.nmiAccepted = true;
        }
    }

    triggerHardwareNmi() {
        this.nmiPending = false; // Wir haben die Flanke konsumiert!
        this.push(this.pc >> 8);
        this.push(this.pc & 0xFF);
        this.push((this.p & 0xEF) | 0x20);
        this.p |= 0x04;
        this.pc = this.read(0xFFFA) | (this.read(0xFFFB) << 8);
    }

    // =========================================================
    // THE HARDWARE CLOCK MANAGER
    // Taktung von CIA-Timer A & B, Raster und Badline-Evaluation
    // =========================================================
    clockHardware(cycles) {
        // --- PHASE 3: INTERRUPT LATENCY BINDING ---
        // War ein IRQ/NMI bereits vor Beginn dieser Instruktion aktiv,
        // wird er jetzt uneingeschränkt für das Ende dieser Instruktion akzeptiert.
        if (this.irqPending) {
            this.irqAccepted = (this.p & 0x04) === 0;
        }
        if (this.nmiPending) {
            this.nmiAccepted = true;
        }

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
                    this.updateIrqState(i, cycles); // Übergibt den Zyklus-Index

                    // --- SCHRITT 2: TIMER B KASKADIERUNGS-MODUS ---
                    if ((this.cia1CtrlB & 0x01) && ((this.cia1CtrlB & 0x60) === 0x40)) {
                        this.cia1TimerB--;
                        if (this.cia1TimerB < 0) {
                            timerBUnderflowTriggered = true;
                        }
                    }
                }
            }

            // --- PHASE 8: CIA-2 (NMI) CLOCKING ---
            let cia2TimerBUnderflow = false;

            if (this.cia2CtrlA & 0x01) { 
                this.cia2TimerA--;
                if (this.cia2TimerA < 0) {
                    this.cia2Icr |= 0x01; // Timer A underflow NMI flag
                    this.cia2TimerA = this.cia2TimerALatch === 0 ? 0xFFFF : this.cia2TimerALatch;
                    
                    if (this.cia2CtrlA & 0x08) this.cia2CtrlA &= ~0x01; 
                    this.updateIrqState(i, cycles);

                    // CIA-2 Timer B Cascaded Mode
                    if ((this.cia2CtrlB & 0x01) && ((this.cia2CtrlB & 0x60) === 0x40)) {
                        this.cia2TimerB--;
                        if (this.cia2TimerB < 0) cia2TimerBUnderflow = true;
                    }
                }
            }

            // CIA-2 Timer B System-Clock Mode
            if ((this.cia2CtrlB & 0x01) && ((this.cia2CtrlB & 0x60) === 0x00)) {
                this.cia2TimerB--;
                if (this.cia2TimerB < 0) cia2TimerBUnderflow = true;
            }

            if (cia2TimerBUnderflow) {
                this.cia2Icr |= 0x02; 
                this.cia2TimerB = this.cia2TimerBLatch === 0 ? 0xFFFF : this.cia2TimerBLatch;
                if (this.cia2CtrlB & 0x08) this.cia2CtrlB &= ~0x01; 
                this.updateIrqState(i, cycles);
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
                this.updateIrqState(i, cycles);
            }

            // --- SCHRITT 5: CIA TOD CLOCK ---
            this.todCycleCounter--;
            if (this.todCycleCounter <= 0) {
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

            // --- SCHRITT 6: RDY-LEITUNG FÜR CPU-HALT (Cycle 12 bis 51) ---
            if (this.isBadLine && this.rasterCycles >= 12 && this.rasterCycles < 52) {
                this.rdy = false;
            } else {
                this.rdy = true;
            }
            
            // Raster IRQ triggert in Cycle 0 der Ziel-Linie
            if (this.rasterCycles === 0 && this.rasterCounter === this.rasterIrqTarget) {
                this.ram[0xD019] |= 0x01; 
                this.updateIrqState(i, cycles);
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

        // --- PHASE 1: RDY-LEITUNG ---
        // Wenn der VIC-II den Bus blockiert, steht die CPU für diesen Zyklus still.
        if (!this.rdy) {
            return 1; 
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

            if (high === 0x60 || high === 0x70) { 
                if(op!==0x60&&op!==0x68&&op!==0x6A&&op!==0x78&&op!==0x70) { 
                    if (this.p & 0x08) { // Decimal Mode (BCD) aktiv
                        let AL, A, result_dec;
                        A = this.a;
                        result_dec = A + val + (this.p & 0x01);
                        
                        // Addition der Low-Nibbles
                        AL = (A & 0x0F) + (val & 0x0F) + (this.p & 0x01);
                        if (AL >= 0x0A) {
                            AL = ((AL + 0x06) & 0x0F) + 0x10;
                        }
                        A = (A & 0xF0) + (val & 0xF0) + AL;
                        
                        // NMOS setzt Sign (N) und Overflow (V) anhand des binären Ergebnisses
                        if (A & 0x80) this.p |= 128; else this.p &= ~128;
                        if ((this.a ^ A) & (val ^ A) & 0x80) this.p |= 64; else this.p &= ~64;
                        
                        // BCD-Kompensation für High-Nibble
                        if (A >= 0x1A0) {
                            A += 0x60;
                        }
                        
                        // Carry wird anhand des Decimal-Ergebnisses berechnet
                        let carryLimit = (this.p & 0x01) ? 0x199 : 0x19F;
                        if (result_dec > carryLimit) this.p |= 1; else this.p &= ~1;
                        
                        // Z-Flag wird auf Basis des BINÄREN Zwischenergebnisses gesetzt!
                        if (result_dec & 0xFF) this.p &= ~2; else this.p |= 2;
                        
                        this.a = A & 0xFF;
                    } else { // Standard Binary Mode
                        let carry = this.p & 1; 
                        let sum = this.a + val + carry; 
                        let overflow = ((this.a ^ sum) & (val ^ sum) & 0x80) !== 0; 
                        if (sum > 255) this.p |= 1; else this.p &= ~1; 
                        if (overflow) this.p |= 64; else this.p &= ~64; 
                        this.a = sum & 0xFF; 
                        this.setNZ(this.a); 
                    }
                    return cycles; 
                } 
            }

            if (high === 0xE0 || high === 0xF0) { 
                if(op!==0xE0&&op!==0xE4&&op!==0xE8&&op!==0xEA&&op!==0xEC&&op!==0xF8&&op!==0xF0) { 
                    if (this.p & 0x08) { // Decimal Mode (BCD) aktiv
                        let result_dec, A, AL, B, C;
                        A = this.a;
                        C = this.p & 0x01;
                        B = val;
                        let val_inv = val ^ 0xFF;
                        result_dec = A + val_inv + C;
                        
                        // Flags (C, V, N, Z) werden beim NMOS-SBC binär berechnet
                        if (result_dec > 0xFF) this.p |= 1; else this.p &= ~1;
                        if ((this.a ^ result_dec) & (val_inv ^ result_dec) & 0x80) this.p |= 64; else this.p &= ~64;
                        this.setNZ(result_dec & 0xFF);
                        
                        // BCD-Kompensation (NMOS Sequence 3)
                        AL = (A & 0x0F) - (B & 0x0F) + C - 1;
                        if (AL < 0) {
                            AL = ((AL - 0x06) & 0x0F) - 0x10;
                        }
                        A = (A & 0xF0) - (B & 0xF0) + AL;
                        if (A < 0) {
                            A = A - 0x60;
                        }
                        this.a = A & 0xFF;
                    } else { // Standard Binary Mode
                        let val_inv = val ^ 0xFF; 
                        let carry = this.p & 1; 
                        let sum = this.a + val_inv + carry; 
                        let overflow = ((this.a ^ sum) & (val_inv ^ sum) & 0x80) !== 0; 
                        if (sum > 255) this.p |= 1; else this.p &= ~1; 
                        if (overflow) this.p |= 64; else this.p &= ~64; 
                        this.a = sum & 0xFF; 
                        this.setNZ(this.a); 
                    }
                    return cycles; 
                } 
            }

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