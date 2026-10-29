// === js/worklets/lib/cpu6502.js ===
// =========================================================
// 6502 CPU EMULATOR & C64 I/O INTERCEPTOR
// High-Performance Zero-Allocation Edition (v1.5.0)
// - Sub-Cycle Instruction Write Pipelining + 6510 RMW Dummy-Writes
// - Re-Entrant KERNAL Play-IRQ Dispatcher ($FFD0) for Galway Foreground Digis
// - Isolated PlaySID Extended Trap ((addr & 0x1F) >= 0x1D) & Volume Restore
// - PlaySID 3.6x Amiga-Paula Divider, Loop Support & $D47D Nibble Order
// - Physical 6502 NMI Falling-Edge Pin Latching
// =========================================================

export class CPU6502 {
    constructor(sid) {
        this.ram = new Uint8Array(65536);
        this.kernalRom = new Uint8Array(8192); 
        this.sid = sid;
        
        this.a = 0; this.x = 0; this.y = 0;
        this.sp = 0xFF; this.pc = 0;
        this.p = 0x24; 
        
        this.cyclesPerLine = 63; 
        this.rasterCounter = 0;
        this.rasterCycles = 0;
        this.rasterIrqTarget = 0;
        
        this.cia1TimerA = 19705; 
        this.cia1TimerALatch = 19705;
        this.cia1CtrlA = 0x01;
        this.cia1Icr = 0;
        this.cia1IrqMask = 0x00;
        this.cia1InterruptActive = false;
        this.cia1InterruptDelay = 0;
        this.cia1TimerAUnderflowed = false;
        this.cia1TimerAPulse = false;
        this.cia1TimerAStartDelay = 0;
        this.cia1TimerALoadPending = false;
        this.cia1TimerAReloadSkip = false;

        this.cia1TimerB = 0xFFFF;
        this.cia1TimerBLatch = 0xFFFF;
        this.cia1CtrlB = 0;
        this.cia1TimerBStartDelay = 0;
        this.cia1TimerBLoadPending = false;
        this.cia1TimerBReloadSkip = false;

        this.cia2TimerA = 0xFFFF;
        this.cia2TimerALatch = 0xFFFF;
        this.cia2CtrlA = 0x00;
        this.cia2Icr = 0; this.cia2IrqMask = 0x00;
        this.cia2InterruptActive = false;
        this.cia2InterruptDelay = 0;
        this.cia2TimerAPulse = false;
        this.cia2TimerAStartDelay = 0;
        this.cia2TimerALoadPending = false;
        this.cia2TimerAReloadSkip = false;

        this.cia2TimerB = 0xFFFF;
        this.cia2TimerBLatch = 0xFFFF;
        this.cia2CtrlB = 0x00;
        this.cia2TimerBStartDelay = 0;
        this.cia2TimerBLoadPending = false;
        this.cia2TimerBReloadSkip = false;

        this.irqPending = false;
        this.nmiPending = false;
        this.irqAccepted = false;
        this.nmiAccepted = false;
        this.nmiLineState = false; 

        this.rdy = true; 
        this.isBadLine = false;

        this.todTenths = 0; this.todSec = 0; this.todMin = 0; this.todHour = 1; 
        this.todLatchTenths = 0; this.todLatchSec = 0; this.todLatchMin = 0; this.todLatchHour = 1;
        this.todLatched = false; this.todHalted = false; this.todCycleCounter = 19705;

        this.defaultIrqLo = 0x31; 
        this.defaultIrqHi = 0xEA; 
        this.prgOverlapsKernalStub = false;

        this.psidSampleActive = false;
        this.psidSamplePtr = 0;
        this.psidSampleEnd = 0;
        this.psidSampleRepPtr = 0;
        this.psidSampleLoop = false;
        this.psidNibblePhase = 0;
        this.psidNibbleOrder = 0;
        this.psidSampleStep = 0;
        this.psidSampleCycleCounter = 252;
        this.psidSamplePeriod = 252;
        this.cpuLastD418 = 0x0F;

        this.hasDummyWrite = false;
        this.dummyWriteAddr = 0;
        this.dummyWriteVal = 0;

        this.hasPendingWrite = false;
        this.pendingWriteAddr = 0;
        this.pendingWriteVal = 0;

        this.hasPendingIcrRead = false;
        this.pendingIcrReadAddr = 0;
        this.pendingIcrReadTarget = 0;
    }

    reset(loadAddr, prgCode, initAddr = 0, playAddr = 0) {
        this.ram.fill(0);
        this.kernalRom.fill(0);
        
        this.cpuLastD418 = 0x0F;
        this.ram[0xD418] = 0x0F;
        if (this.sid) {
            this.sid.writeReg(24, 0x0F);
        }
        
        this.psidSampleActive = false;
        this.psidSamplePtr = 0;
        this.psidSampleEnd = 0;
        this.psidSampleRepPtr = 0;
        this.psidSampleLoop = false;
        this.psidNibblePhase = 0;
        this.psidNibbleOrder = 0;
        this.psidSampleStep = 0;
        this.psidSamplePeriod = 252;
        this.psidSampleCycleCounter = 252;

        this.hasDummyWrite = false;
        this.dummyWriteAddr = 0;
        this.dummyWriteVal = 0;

        this.hasPendingWrite = false;
        this.pendingWriteAddr = 0;
        this.pendingWriteVal = 0;

        this.hasPendingIcrRead = false;
        this.pendingIcrReadAddr = 0;
        this.pendingIcrReadTarget = 0;

        for (let i = 0; i < prgCode.length; i++) {
            this.ram[loadAddr + i] = prgCode[i];
        }

        let p0001 = 0x37; 
        let prgEnd = loadAddr + prgCode.length;
        
        let overlapsKernal = (loadAddr < 0x10000 && prgEnd > 0xE000) || 
                             (initAddr >= 0xE000 && initAddr < 0x10000) ||
                             (playAddr >= 0xE000 && playAddr < 0x10000);
        
        this.prgOverlapsKernalStub = (loadAddr <= 0xFFE3 && prgEnd > 0xFFD0);

        if (overlapsKernal) {
            p0001 &= ~2; 
        }
        
        this.ram[0x0000] = 0x2F; 
        this.ram[0x0001] = p0001; 

        const playLo = playAddr & 0xFF;
        const playHi = (playAddr >> 8) & 0xFF;
        const reentrantPlayStub = [
            0x48, 0x8A, 0x48, 0x98, 0x48,
            0x20, playLo, playHi,
            0x68, 0xA8, 0x68, 0xAA, 0x68, 0x40
        ];
        for (let i = 0; i < reentrantPlayStub.length; i++) {
            this.kernalRom[0x1FD0 + i] = reentrantPlayStub[i];
            if (!this.prgOverlapsKernalStub) {
                this.ram[0xFFD0 + i] = reentrantPlayStub[i];
            }
        }

        const idleStub = [0x58, 0x4C, 0xE0, 0xFF];
        for (let i = 0; i < idleStub.length; i++) {
            this.kernalRom[0x1FE0 + i] = idleStub[i];
            if (!this.prgOverlapsKernalStub) {
                this.ram[0xFFE0 + i] = idleStub[i];
            }
        }
        
        const safeIrqReturn = [0xAD, 0x0D, 0xDC, 0x68, 0xA8, 0x68, 0xAA, 0x68, 0x40];
        for (let i = 0; i < safeIrqReturn.length; i++) {
            this.ram[0x0220 + i] = safeIrqReturn[i]; 
            this.kernalRom[0x0A31 + i] = safeIrqReturn[i]; 
        }

        const safeIrqExit = [0xAD, 0x0D, 0xDC, 0x68, 0xA8, 0x68, 0xAA, 0x68, 0x40];
        for (let i = 0; i < safeIrqExit.length; i++) {
            this.kernalRom[0x0A7E + i] = safeIrqExit[i];
        }

        const safeNmiReturn = [0xAD, 0x0D, 0xDD, 0x68, 0xA8, 0x68, 0xAA, 0x68, 0x40];
        for (let i = 0; i < safeNmiReturn.length; i++) {
            this.ram[0x0240 + i] = safeNmiReturn[i];
            this.kernalRom[0x0A88 + i] = safeNmiReturn[i];
        }
        
        let defaultIrq = overlapsKernal ? 0x0220 : 0xEA31;
        let defaultNmi = overlapsKernal ? 0x0240 : 0xEA88;

        this.defaultIrqLo = defaultIrq & 0xFF;
        this.defaultIrqHi = (defaultIrq >> 8) & 0xFF;

        this.ram[0x0314] = this.defaultIrqLo; this.ram[0x0315] = this.defaultIrqHi; 
        this.ram[0x0316] = this.defaultIrqLo; this.ram[0x0317] = this.defaultIrqHi; 
        this.ram[0x0318] = defaultNmi & 0xFF; this.ram[0x0319] = (defaultNmi >> 8) & 0xFF; 

        this.kernalRom[0x1FFE] = 0x48; this.kernalRom[0x1FFF] = 0xFF; 
        this.kernalRom[0x1FFA] = 0x60; this.kernalRom[0x1FFB] = 0xFF; 

        const irqEntry = [0x48, 0x8A, 0x48, 0x98, 0x48, 0xBA, 0xBD, 0x04, 0x01, 0x29, 0x10, 0xF0, 0x03, 0x6C, 0x16, 0x03, 0x6C, 0x14, 0x03];
        for (let i = 0; i < irqEntry.length; i++) {
            this.kernalRom[0x1F48 + i] = irqEntry[i];
        }

        const nmiEntry = [0x6C, 0x18, 0x03]; 
        for (let i = 0; i < nmiEntry.length; i++) {
            this.kernalRom[0x1F60 + i] = nmiEntry[i];
        }

        this.a = 0; this.x = 0; this.y = 0;
        this.sp = 0xFF; 
        this.p = 0x24; 
        
        this.rasterCounter = 0;
        this.rasterCycles = 0;
        this.rasterIrqTarget = 0;
        
        this.cia1TimerA = 19705; this.cia1TimerALatch = 19705;
        this.cia1CtrlA = 0x01;
        this.cia1Icr = 0; this.cia1IrqMask = 0x00;
        this.cia1InterruptActive = false;
        this.cia1InterruptDelay = 0;
        this.cia1TimerAUnderflowed = false;
        this.cia1TimerAPulse = false;
        this.cia1TimerAStartDelay = 0;
        this.cia1TimerALoadPending = false;
        this.cia1TimerAReloadSkip = false;

        this.cia1TimerB = 0xFFFF; this.cia1TimerBLatch = 0xFFFF;
        this.cia1CtrlB = 0;
        this.cia1TimerBStartDelay = 0;
        this.cia1TimerBLoadPending = false;
        this.cia1TimerBReloadSkip = false;

        this.cia2TimerA = 0xFFFF; this.cia2TimerALatch = 0xFFFF;
        this.cia2CtrlA = 0x00;
        this.cia2Icr = 0; this.cia2IrqMask = 0x00;
        this.cia2InterruptActive = false;
        this.cia2InterruptDelay = 0;
        this.cia2TimerAPulse = false;
        this.cia2TimerAStartDelay = 0;
        this.cia2TimerALoadPending = false;
        this.cia2TimerAReloadSkip = false;

        this.cia2TimerB = 0xFFFF; this.cia2TimerBLatch = 0xFFFF;
        this.cia2CtrlB = 0x00;
        this.cia2TimerBStartDelay = 0;
        this.cia2TimerBLoadPending = false;
        this.cia2TimerBReloadSkip = false;

        this.irqPending = false;
        this.nmiPending = false;
        this.irqAccepted = false;
        this.nmiAccepted = false;
        this.nmiLineState = false;

        this.rdy = true;
        this.isBadLine = false;

        this.todTenths = 0; this.todSec = 0; this.todMin = 0; this.todHour = 1;
        this.todLatchTenths = 0; this.todLatchSec = 0; this.todLatchMin = 0; this.todLatchHour = 1;
        this.todLatched = false; this.todHalted = false; this.todCycleCounter = 19705;
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

        let p0001 = this.ram[0x0001] & 0x07;

        if (addr >= 0xE000) {
            if (addr >= 0xFFD0 && addr <= 0xFFE3 && !this.prgOverlapsKernalStub) {
                return this.kernalRom[addr - 0xE000];
            }
            let kernalEnabled = (p0001 & 2) !== 0; 
            if (kernalEnabled) {
                return this.kernalRom[addr - 0xE000];
            }
            return this.ram[addr]; 
        }

        let ioEnabled = (p0001 & 4) !== 0 && (p0001 & 3) !== 0;
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
        if (addr === 0xDC06) return this.cia1TimerB & 0xFF;
        if (addr === 0xDC07) return (this.cia1TimerB >> 8) & 0xFF;
        
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
            let val = this.cia1Icr & 0x1F;
            if (this.cia1InterruptActive) val |= 0x80;
            this.hasPendingIcrRead = true;
            this.pendingIcrReadAddr = addr;
            return val;
        }
        if (addr === 0xDC0E) return this.cia1CtrlA & 0xEF; 
        if (addr === 0xDC0F) return this.cia1CtrlB & 0xEF;
        
        if (addr >= 0xDD00 && addr <= 0xDD0F) {
            if (addr === 0xDD04) return this.cia2TimerA & 0xFF;
            if (addr === 0xDD05) return (this.cia2TimerA >> 8) & 0xFF;
            if (addr === 0xDD06) return this.cia2TimerB & 0xFF;
            if (addr === 0xDD07) return (this.cia2TimerB >> 8) & 0xFF;
            if (addr === 0xDD0D) {
                let val = this.cia2Icr & 0x1F;
                if (this.cia2InterruptActive) val |= 0x80;
                this.hasPendingIcrRead = true;
                this.pendingIcrReadAddr = addr;
                return val;
            }
            if (addr === 0xDD0E) return this.cia2CtrlA & 0xEF; 
            if (addr === 0xDD0F) return this.cia2CtrlB & 0xEF;
            return this.ram[addr]; 
        }
        
        if (addr >= 0xD400 && addr <= 0xD7FF) {
            let reg = addr & 0x1F;
            if (reg === 27) return Math.floor(this.sid.voices[2].waveOut8Bit) || 0; 
            if (reg === 28) return Math.floor(this.sid.voices[2].env8Bit) || 0;     
            if (reg === 25 || reg === 26) return 0xFF;                              
            return this.ram[addr];                                                  
        }

        return this.ram[addr];
    }

    stageWrite(addr, val) {
        this.ram[addr] = val; 
        this.hasPendingWrite = true;
        this.pendingWriteAddr = addr;
        this.pendingWriteVal = val;
    }

    stageRmwWrite(addr, oldVal, newVal) {
        this.ram[addr] = newVal;
        this.hasDummyWrite = true;
        this.dummyWriteAddr = addr;
        this.dummyWriteVal = oldVal;

        this.hasPendingWrite = true;
        this.pendingWriteAddr = addr;
        this.pendingWriteVal = newVal;
    }

    commitDummyWrite() {
        if (!this.hasDummyWrite) return;
        this.hasDummyWrite = false;
        this.writeHardware(this.dummyWriteAddr, this.dummyWriteVal);
    }

    commitPendingWrite() {
        if (!this.hasPendingWrite) return;
        this.hasPendingWrite = false;
        this.writeHardware(this.pendingWriteAddr, this.pendingWriteVal);
    }

    commitPendingIcrRead() {
        if (!this.hasPendingIcrRead) return;
        this.hasPendingIcrRead = false;
        let value;
        if (this.pendingIcrReadAddr === 0xDC0D) {
            value = this.cia1Icr & 0x1F;
            if (this.cia1InterruptActive) value |= 0x80;
            this.cia1Icr = 0;
            this.cia1InterruptActive = false;
            this.cia1InterruptDelay = 0;
        } else {
            value = this.cia2Icr & 0x1F;
            if (this.cia2InterruptActive) value |= 0x80;
            this.cia2Icr = 0;
            this.cia2InterruptActive = false;
            this.cia2InterruptDelay = 0;
        }
        if (this.pendingIcrReadTarget === 1) {
            this.a = value;
            this.setNZ(value);
        }
        this.pendingIcrReadTarget = 0;
        this.updateIrqState();
    }

    write(addr, val) {
        this.ram[addr] = val;
        this.writeHardware(addr, val);
    }

    writeHardware(addr, val) {
        if (addr < 0xD000 || addr > 0xDFFF) return;

        // --- PSID EXTENDED SAMPLE TRAP INTERCEPTOR ($D41D..$D47F, Offsets $1D..$1F only!) ---
        if (addr >= 0xD41D && addr <= 0xD47F && (addr & 0x1F) >= 0x1D) {
            this.ram[addr] = val;
            if (addr === 0xD45F) {
                this.psidSampleStep = val;
            } else if (addr === 0xD47D) {
                this.psidNibbleOrder = val;
            } else if (addr === 0xD43F) {
                this.psidSampleLoop = (val !== 0 && val !== 0xFF);
            } else if (addr === 0xD45D || addr === 0xD45E) {
                let pLo = this.ram[0xD45D];
                let pHi = this.ram[0xD45E] & 0x0F;
                let rawPeriod = pLo | (pHi << 8);
                let period = rawPeriod >= 280 
                    ? Math.round(rawPeriod * 985248 / 3546895) 
                    : rawPeriod;
                this.psidSamplePeriod = period >= 16 ? period : 252;
            } else if (addr === 0xD41D) {
                if (val === 0xFE || val === 0x01 || val === 0x81 || val === 0xFD) {
                    let startLo = this.ram[0xD41E];
                    let startHi = this.ram[0xD41F];
                    let endLo = this.ram[0xD43D];
                    let endHi = this.ram[0xD43E];
                    let repLo = this.ram[0xD47E];
                    let repHi = this.ram[0xD47F];

                    this.psidSamplePtr = startLo | (startHi << 8);
                    this.psidSampleEnd = (endLo === 0 && endHi !== 0) ? (endHi << 8) : (endLo | (endHi << 8));
                    let repAddr = repLo | (repHi << 8);
                    this.psidSampleRepPtr = (repAddr > 0) ? repAddr : this.psidSamplePtr;
                    this.psidSampleLoop = (val === 0xFD) || (this.ram[0xD43F] !== 0 && this.ram[0xD43F] !== 0xFF);

                    let pLo = this.ram[0xD45D];
                    let pHi = this.ram[0xD45E] & 0x0F;
                    let rawPeriod = pLo | (pHi << 8);
                    let period = rawPeriod >= 280 
                        ? Math.round(rawPeriod * 985248 / 3546895) 
                        : rawPeriod;
                    this.psidSamplePeriod = period >= 16 ? period : 252;

                    this.psidSampleStep = this.ram[0xD45F];
                    this.psidNibbleOrder = this.ram[0xD47D];
                    this.psidNibblePhase = 0;
                    this.psidSampleCycleCounter = 1;
                    this.psidSampleActive = true;
                } else if (val === 0x00 || val === 0xFF) {
                    if (this.psidSampleActive) {
                        this.psidSampleActive = false;
                        this.sid.writeReg(24, this.cpuLastD418);
                    }
                }
            }
            return;
        }

        let p0001 = this.ram[0x0001] & 0x07;
        let ioEnabled = (p0001 & 4) !== 0 && (p0001 & 3) !== 0;
        if (!ioEnabled) return;
        
        if (addr >= 0xD400 && addr <= 0xD7FF) {
            let reg = addr & 0x1F; 
            if (reg < 29) {
                if (reg === 24) {
                    this.cpuLastD418 = val;
                    if (this.psidSampleActive) {
                        val = (val & 0xF0) | (this.sid.regs[24] & 0x0F);
                    }
                }
                this.sid.writeReg(reg, val);
            }
        } else if (addr === 0xD011) {
            this.ram[0xD011] = val; 
            this.rasterIrqTarget = (this.rasterIrqTarget & 0xFF) | ((val & 0x80) << 1);
        } else if (addr === 0xD012) {
            this.rasterIrqTarget = (this.rasterIrqTarget & 0x100) | val;
        } else if (addr === 0xD019) {
            this.ram[0xD019] &= ~(val & 0x0F); 
            this.updateIrqState();
        } else if (addr === 0xD01A) {
            this.ram[0xD01A] = val & 0x0F;
            this.updateIrqState();
        }
        
        else if (addr === 0xDC04) {
            this.cia1TimerALatch = (this.cia1TimerALatch & 0xFF00) | val;
        } else if (addr === 0xDC05) {
            this.cia1TimerALatch = (this.cia1TimerALatch & 0x00FF) | (val << 8);
            if ((this.cia1CtrlA & 0x01) === 0) this.cia1TimerA = this.cia1TimerALatch;
        } else if (addr === 0xDC06) {
            this.cia1TimerBLatch = (this.cia1TimerBLatch & 0xFF00) | val;
        } else if (addr === 0xDC07) {
            this.cia1TimerBLatch = (this.cia1TimerBLatch & 0x00FF) | (val << 8);
            if ((this.cia1CtrlB & 0x01) === 0) this.cia1TimerB = this.cia1TimerBLatch;
        } else if (addr === 0xDC0D) {
            let bit7 = (val & 0x80) !== 0;
            let maskBits = val & 0x1F;
            if (bit7) this.cia1IrqMask |= maskBits;
            else this.cia1IrqMask &= ~maskBits;
            this.updateIrqState();
        } else if (addr === 0xDC0E) {
            if ((val & 0x01) !== 0 && (this.cia1CtrlA & 0x01) === 0) {
                this.cia1TimerAStartDelay = 2;
            }
            this.cia1CtrlA = val & 0xEF;
            if (val & 0x10) this.cia1TimerALoadPending = true;
        } else if (addr === 0xDC0F) {
            if ((val & 0x01) !== 0 && (this.cia1CtrlB & 0x01) === 0) {
                this.cia1TimerBStartDelay = 2;
            }
            this.cia1CtrlB = val & 0xEF;
            if (val & 0x10) this.cia1TimerBLoadPending = true;
        }
        
        else if (addr >= 0xDD00 && addr <= 0xDD0F) {
            if (addr === 0xDD04) {
                this.cia2TimerALatch = (this.cia2TimerALatch & 0xFF00) | val;
            } else if (addr === 0xDD05) {
                this.cia2TimerALatch = (this.cia2TimerALatch & 0x00FF) | (val << 8);
                if ((this.cia2CtrlA & 0x01) === 0) this.cia2TimerA = this.cia2TimerALatch;
            } else if (addr === 0xDD06) {
                this.cia2TimerBLatch = (this.cia2TimerBLatch & 0xFF00) | val;
            } else if (addr === 0xDD07) {
                this.cia2TimerBLatch = (this.cia2TimerBLatch & 0x00FF) | (val << 8);
                if ((this.cia2CtrlB & 0x01) === 0) this.cia2TimerB = this.cia2TimerBLatch;
            } else if (addr === 0xDD0D) {
                let bit7 = (val & 0x80) !== 0;
                let maskBits = val & 0x1F;
                if (bit7) this.cia2IrqMask |= maskBits;
                else this.cia2IrqMask &= ~maskBits;
                this.updateIrqState();
            } else if (addr === 0xDD0E) {
                if ((val & 0x01) !== 0 && (this.cia2CtrlA & 0x01) === 0) {
                    this.cia2TimerAStartDelay = 2;
                }
                this.cia2CtrlA = val & 0xEF;
                if (val & 0x10) this.cia2TimerALoadPending = true;
            } else if (addr === 0xDD0F) {
                if ((val & 0x01) !== 0 && (this.cia2CtrlB & 0x01) === 0) {
                    this.cia2TimerBStartDelay = 2;
                }
                this.cia2CtrlB = val & 0xEF;
                if (val & 0x10) this.cia2TimerBLoadPending = true;
            }
            return;
        }
    }

    updateIrqState() {
        const vicIrq = (this.ram[0xD019] & this.ram[0xD01A] & 0x0F) !== 0;
        const cia1Condition = (this.cia1Icr & this.cia1IrqMask & 0x1F) !== 0;
        const cia2Condition = (this.cia2Icr & this.cia2IrqMask & 0x1F) !== 0;

        if (cia1Condition && !this.cia1InterruptActive && this.cia1InterruptDelay === 0) {
            this.cia1InterruptDelay = 1;
        } else if (!cia1Condition && !this.cia1InterruptActive) {
            this.cia1InterruptDelay = 0;
        }
        if (cia2Condition && !this.cia2InterruptActive && this.cia2InterruptDelay === 0) {
            this.cia2InterruptDelay = 1;
        } else if (!cia2Condition && !this.cia2InterruptActive) {
            this.cia2InterruptDelay = 0;
        }

        this.irqPending = vicIrq || this.cia1InterruptActive;
        if (this.cia2InterruptActive && !this.nmiLineState) this.nmiPending = true;
        this.nmiLineState = this.cia2InterruptActive;

        if (vicIrq) this.ram[0xD019] |= 0x80;
        else this.ram[0xD019] &= 0x7F;
        if (this.cia1InterruptActive) this.cia1Icr |= 0x80;
        else this.cia1Icr &= 0x7F;
        if (this.cia2InterruptActive) this.cia2Icr |= 0x80;
        else this.cia2Icr &= 0x7F;
    }

    clockInterruptDelays() {
        if (this.cia1InterruptDelay > 0) {
            this.cia1InterruptDelay--;
            if (this.cia1InterruptDelay === 0 &&
                (this.cia1Icr & this.cia1IrqMask & 0x1F) !== 0) {
                this.cia1InterruptActive = true;
            }
        }
        if (this.cia2InterruptDelay > 0) {
            this.cia2InterruptDelay--;
            if (this.cia2InterruptDelay === 0 &&
                (this.cia2Icr & this.cia2IrqMask & 0x1F) !== 0) {
                this.cia2InterruptActive = true;
            }
        }
        this.updateIrqState();
    }

    pollInterrupts() {
        this.irqAccepted = this.irqPending && (this.p & 0x04) === 0;
        this.nmiAccepted = this.nmiPending;
    }

    canAdvanceCycle(cyclesRemaining) {
        if (this.rdy) return true;
        if (cyclesRemaining === 2 && this.hasDummyWrite) return true;
        return cyclesRemaining === 1 && this.hasPendingWrite;
    }

    commitWritesForCycle(cyclesRemaining) {
        if (cyclesRemaining === 1 && this.hasDummyWrite) this.commitDummyWrite();
        if (cyclesRemaining === 0) {
            if (this.hasPendingWrite) this.commitPendingWrite();
            this.commitPendingIcrRead();
        }
    }

    beginInstruction() {
        this.pollInterrupts();
        const cyclesRemaining = this.step() - 1;
        this.commitWritesForCycle(cyclesRemaining);
        return cyclesRemaining;
    }

    advanceCycle(cyclesRemaining) {
        const nextRemaining = cyclesRemaining - 1;
        this.commitWritesForCycle(nextRemaining);
        return nextRemaining;
    }

    triggerHardwareNmi() {
        this.nmiPending = false; 
        this.push(this.pc >> 8);
        this.push(this.pc & 0xFF);
        this.push((this.p & 0xEF) | 0x20); 
        this.p |= 0x04;
        this.pc = this.read(0xFFFA) | (this.read(0xFFFB) << 8);
    }

    clockHardware(cycles) {
        for (let i = 0; i < cycles; i++) {
            
            if (this.psidSampleActive) {
                this.psidSampleCycleCounter--;
                if (this.psidSampleCycleCounter <= 0) {
                    this.psidSampleCycleCounter += this.psidSamplePeriod; 
                    this.streamPsidSampleNibble();
                }
            }

            this.clockInterruptDelays();

            const cia1PulseLastCycle = this.cia1TimerAPulse;
            this.cia1TimerAPulse = false;
            let timerBUnderflowTriggered = false;

            const cia1ALoaded = this.cia1TimerALoadPending;
            if (cia1ALoaded) {
                this.cia1TimerA = this.cia1TimerALatch;
                this.cia1TimerALoadPending = false;
                this.cia1TimerAReloadSkip = true;
            }
            if (this.cia1TimerAStartDelay > 0) this.cia1TimerAStartDelay--;
            if ((this.cia1CtrlA & 0x01) && this.cia1TimerAStartDelay === 0 && !cia1ALoaded) {
                if (this.cia1TimerAReloadSkip) {
                    this.cia1TimerAReloadSkip = false;
                } else {
                    this.cia1TimerA--;
                    if (this.cia1TimerA <= 0) {
                        this.cia1Icr |= 0x01;
                        this.cia1TimerA = this.cia1TimerALatch;
                        this.cia1TimerAReloadSkip = true;
                        this.cia1TimerAUnderflowed = true;
                        this.cia1TimerAPulse = true;
                        if (this.cia1CtrlA & 0x08) this.cia1CtrlA &= ~0x01;
                        this.updateIrqState();
                    }
                }
            }

            const cia1BLoaded = this.cia1TimerBLoadPending;
            if (cia1BLoaded) {
                this.cia1TimerB = this.cia1TimerBLatch;
                this.cia1TimerBLoadPending = false;
                this.cia1TimerBReloadSkip = true;
            }
            if (this.cia1TimerBStartDelay > 0) this.cia1TimerBStartDelay--;
            const cia1BPhi2 = (this.cia1CtrlB & 0x60) === 0x00;
            const cia1BCascade = (this.cia1CtrlB & 0x60) === 0x40;
            const cia1BClock = (this.cia1CtrlB & 0x01) !== 0 &&
                this.cia1TimerBStartDelay === 0 && !cia1BLoaded &&
                (cia1BPhi2 || (cia1BCascade && cia1PulseLastCycle));
            if (cia1BClock) {
                if (this.cia1TimerBReloadSkip) {
                    this.cia1TimerBReloadSkip = false;
                } else {
                    this.cia1TimerB--;
                    timerBUnderflowTriggered = cia1BPhi2
                        ? this.cia1TimerB <= 0
                        : this.cia1TimerB < 0;
                }
            }
            if (timerBUnderflowTriggered) {
                this.cia1Icr |= 0x02;
                this.cia1TimerB = this.cia1TimerBLatch;
                this.cia1TimerBReloadSkip = true;
                if (this.cia1CtrlB & 0x08) this.cia1CtrlB &= ~0x01;
                this.updateIrqState();
            }

            const cia2PulseLastCycle = this.cia2TimerAPulse;
            this.cia2TimerAPulse = false;
            let cia2TimerBUnderflow = false;

            const cia2ALoaded = this.cia2TimerALoadPending;
            if (cia2ALoaded) {
                this.cia2TimerA = this.cia2TimerALatch;
                this.cia2TimerALoadPending = false;
                this.cia2TimerAReloadSkip = true;
            }
            if (this.cia2TimerAStartDelay > 0) this.cia2TimerAStartDelay--;
            if ((this.cia2CtrlA & 0x01) && this.cia2TimerAStartDelay === 0 && !cia2ALoaded) {
                if (this.cia2TimerAReloadSkip) {
                    this.cia2TimerAReloadSkip = false;
                } else {
                    this.cia2TimerA--;
                    if (this.cia2TimerA <= 0) {
                        this.cia2Icr |= 0x01;
                        this.cia2TimerA = this.cia2TimerALatch;
                        this.cia2TimerAReloadSkip = true;
                        this.cia2TimerAPulse = true;
                        if (this.cia2CtrlA & 0x08) this.cia2CtrlA &= ~0x01;
                        this.updateIrqState();
                    }
                }
            }

            const cia2BLoaded = this.cia2TimerBLoadPending;
            if (cia2BLoaded) {
                this.cia2TimerB = this.cia2TimerBLatch;
                this.cia2TimerBLoadPending = false;
                this.cia2TimerBReloadSkip = true;
            }
            if (this.cia2TimerBStartDelay > 0) this.cia2TimerBStartDelay--;
            const cia2BPhi2 = (this.cia2CtrlB & 0x60) === 0x00;
            const cia2BCascade = (this.cia2CtrlB & 0x60) === 0x40;
            const cia2BClock = (this.cia2CtrlB & 0x01) !== 0 &&
                this.cia2TimerBStartDelay === 0 && !cia2BLoaded &&
                (cia2BPhi2 || (cia2BCascade && cia2PulseLastCycle));
            if (cia2BClock) {
                if (this.cia2TimerBReloadSkip) {
                    this.cia2TimerBReloadSkip = false;
                } else {
                    this.cia2TimerB--;
                    cia2TimerBUnderflow = cia2BPhi2
                        ? this.cia2TimerB <= 0
                        : this.cia2TimerB < 0;
                }
            }
            if (cia2TimerBUnderflow) {
                this.cia2Icr |= 0x02;
                this.cia2TimerB = this.cia2TimerBLatch;
                this.cia2TimerBReloadSkip = true;
                if (this.cia2CtrlB & 0x08) this.cia2CtrlB &= ~0x01;
                this.updateIrqState();
            }

            this.todCycleCounter--;
            if (this.todCycleCounter <= 0) {
                let is50Hz = (this.cia1CtrlA & 0x80) !== 0;
                this.todCycleCounter += is50Hz ? 19705 : 16421;
                this.incrementTod();
            }

            this.rasterCycles++;
            if (this.rasterCycles >= this.cyclesPerLine) {
                this.rasterCycles = 0;
                this.rasterCounter++;
                if (this.rasterCounter >= 312) this.rasterCounter = 0; 

                if (this.rasterCounter > 255) this.ram[0xD011] |= 0x80;
                else this.ram[0xD011] &= 0x7F;
            }
            
            if (this.rasterCycles === 0) {
                let yscroll = this.ram[0xD011] & 0x07;
                let displayEnabled = (this.ram[0xD011] & 0x10) !== 0;
                this.isBadLine = displayEnabled && 
                                 (this.rasterCounter >= 0x30 && this.rasterCounter <= 0xF7) && 
                                 ((this.rasterCounter & 0x07) === yscroll);
            }

            if (this.isBadLine && this.rasterCycles >= 12 && this.rasterCycles < 52) {
                this.rdy = false;
            } else {
                this.rdy = true;
            }
            
            if (this.rasterCycles === 0 && this.rasterCounter === this.rasterIrqTarget) {
                this.ram[0xD019] |= 0x01; 
                this.updateIrqState();
            }
        }
    }

    triggerHardwareIrq() {
        this.push(this.pc >> 8);
        this.push(this.pc & 0xFF);
        this.push((this.p & 0xEF) | 0x20); 
        this.p |= 0x04; 
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

    adcInternal(val) {
        if (this.p & 0x08) { 
            let AL, A, result_dec;
            A = this.a;
            result_dec = A + val + (this.p & 0x01);
            AL = (A & 0x0F) + (val & 0x0F) + (this.p & 0x01);
            if (AL >= 0x0A) AL = ((AL + 0x06) & 0x0F) + 0x10;
            A = (A & 0xF0) + (val & 0xF0) + AL;
            if (A & 0x80) this.p |= 128; else this.p &= ~128;
            if ((this.a ^ A) & (val ^ A) & 0x80) this.p |= 64; else this.p &= ~64;
            if (A >= 0x1A0) A += 0x60;
            let carryLimit = (this.p & 0x01) ? 0x199 : 0x19F;
            if (result_dec > carryLimit) this.p |= 1; else this.p &= ~1;
            if (result_dec & 0xFF) this.p &= ~2; else this.p |= 2;
            this.a = A & 0xFF;
        } else { 
            let carry = this.p & 1; 
            let sum = this.a + val + carry; 
            let overflow = ((this.a ^ sum) & (val ^ sum) & 0x80) !== 0; 
            if (sum > 255) this.p |= 1; else this.p &= ~1; 
            if (overflow) this.p |= 64; else this.p &= ~64; 
            this.a = sum & 0xFF; 
            this.setNZ(this.a); 
        }
    }

    sbcInternal(val) {
        if (this.p & 0x08) { 
            let result_dec, A, AL, B, C;
            A = this.a;
            C = this.p & 0x01;
            B = val;
            let val_inv = val ^ 0xFF;
            result_dec = A + val_inv + C;
            
            if (result_dec > 0xFF) this.p |= 1; else this.p &= ~1;
            if ((this.a ^ result_dec) & (val_inv ^ result_dec) & 0x80) this.p |= 64; else this.p &= ~64;
            this.setNZ(result_dec & 0xFF);
            
            AL = (A & 0x0F) - (B & 0x0F) + C - 1;
            if (AL < 0) AL = ((AL - 0x06) & 0x0F) - 0x10;
            A = (A & 0xF0) - (B & 0xF0) + AL;
            if (A < 0) A = A - 0x60;
            this.a = A & 0xFF;
        } else { 
            let val_inv = val ^ 0xFF; 
            let carry = this.p & 1; 
            let sum = this.a + val_inv + carry; 
            let overflow = ((this.a ^ sum) & (val_inv ^ sum) & 0x80) !== 0; 
            if (sum > 255) this.p |= 1; else this.p &= ~1; 
            if (overflow) this.p |= 64; else this.p &= ~64; 
            this.a = sum & 0xFF; 
            this.setNZ(this.a); 
        }
    }

    step() {
        if (!this.rdy) return 1; 

        let op = this.read(this.pc++);
        let cycles = 2;

        switch (op) {
            case 0x00: {
                this.pc = (this.pc + 1) & 0xFFFF;
                this.push(this.pc >> 8);
                this.push(this.pc & 0xFF);
                this.push(this.p | 0x10); 
                this.p |= 0x04; 
                this.pc = this.read(0xFFFE) | (this.read(0xFFFF) << 8);
                cycles = 7;
            } break;

            case 0xEA: cycles = 2; break; 
            case 0x1A: case 0x3A: case 0x5A: case 0x7A: case 0xDA: case 0xFA: cycles = 2; break; 
            case 0x04: case 0x14: case 0x34: case 0x44: case 0x54: case 0x64: case 0x74:
            case 0x80: case 0x82: case 0x89: case 0xC2: case 0xE2:
                this.pc++; cycles = 3; break; 
            case 0x0C:
                this.pc += 2; cycles = 4; break; 
            case 0x1C: case 0x3C: case 0x5C: case 0x7C: case 0xDC: case 0xFC: {
                let addr = this.abs();
                let addrX = (addr + this.x) & 0xFFFF;
                cycles = 4 + (this.pageCrossed(addr, addrX) ? 1 : 0);
            } break; 

            case 0xA9: this.a = this.read(this.pc++); this.setNZ(this.a); cycles = 2; break; 
            case 0xA5: this.a = this.read(this.zp()); this.setNZ(this.a); cycles = 3; break; 
            case 0xB5: this.a = this.read(this.zpX()); this.setNZ(this.a); cycles = 4; break; 
            case 0xAD: {
                const addr = this.abs();
                this.a = this.read(addr);
                if (this.hasPendingIcrRead) this.pendingIcrReadTarget = 1;
                this.setNZ(this.a);
                cycles = 4;
            } break;
            case 0xBD: { 
                let addr = this.abs();
                let addrX = (addr + this.x) & 0xFFFF;
                if (this.pageCrossed(addr, addrX)) this.read((addr & 0xFF00) | (addrX & 0x00FF)); 
                this.a = this.read(addrX);
                this.setNZ(this.a);
                cycles = 4 + (this.pageCrossed(addr, addrX) ? 1 : 0);
            } break; 

            case 0xB9: { 
                let addr = this.abs();
                let addrY = (addr + this.y) & 0xFFFF;
                if (this.pageCrossed(addr, addrY)) this.read((addr & 0xFF00) | (addrY & 0x00FF)); 
                this.a = this.read(addrY);
                this.setNZ(this.a);
                cycles = 4 + (this.pageCrossed(addr, addrY) ? 1 : 0);
            } break; 
            case 0xA1: this.a = this.read(this.indX()); this.setNZ(this.a); cycles = 6; break; 
            case 0xB1: { 
                let z = this.zp();
                let addr = this.read(z) | (this.read((z+1)&0xFF) << 8);
                let addrY = (addr + this.y) & 0xFFFF;
                if (this.pageCrossed(addr, addrY)) this.read((addr & 0xFF00) | (addrY & 0x00FF)); 
                this.a = this.read(addrY);
                this.setNZ(this.a);
                cycles = 5 + (this.pageCrossed(addr, addrY) ? 1 : 0);
            } break; 
            case 0xA2: this.x = this.read(this.pc++); this.setNZ(this.x); cycles = 2; break; 
            case 0xA6: this.x = this.read(this.zp()); this.setNZ(this.x); cycles = 3; break; 
            case 0xB6: this.x = this.read(this.zpY()); this.setNZ(this.x); cycles = 4; break; 
            case 0xAE: this.x = this.read(this.abs()); this.setNZ(this.x); cycles = 4; break; 
            case 0xBE: { 
                let addr = this.abs();
                let addrY = (addr + this.y) & 0xFFFF;
                if (this.pageCrossed(addr, addrY)) this.read((addr & 0xFF00) | (addrY & 0x00FF)); 
                this.x = this.read(addrY);
                this.setNZ(this.x);
                cycles = 4 + (this.pageCrossed(addr, addrY) ? 1 : 0);
            } break; 

            case 0xA0: this.y = this.read(this.pc++); this.setNZ(this.y); cycles = 2; break; 
            case 0xA4: this.y = this.read(this.zp()); this.setNZ(this.y); cycles = 3; break; 
            case 0xB4: this.y = this.read(this.zpX()); this.setNZ(this.y); cycles = 4; break; 
            case 0xAC: this.y = this.read(this.abs()); this.setNZ(this.y); cycles = 4; break; 
            case 0xBC: { 
                let addr = this.abs();
                let addrX = (addr + this.x) & 0xFFFF;
                if (this.pageCrossed(addr, addrX)) this.read((addr & 0xFF00) | (addrX & 0x00FF)); 
                this.y = this.read(addrX);
                this.setNZ(this.y);
                cycles = 4 + (this.pageCrossed(addr, addrX) ? 1 : 0); 
            } break;

            case 0x85: this.stageWrite(this.zp(), this.a); cycles = 3; break; 
            case 0x95: this.stageWrite(this.zpX(), this.a); cycles = 4; break; 
            case 0x8D: this.stageWrite(this.abs(), this.a); cycles = 4; break; 
            case 0x9D: this.stageWrite(this.absX(), this.a); cycles = 5; break; 
            case 0x99: this.stageWrite(this.absY(), this.a); cycles = 5; break; 
            case 0x81: this.stageWrite(this.indX(), this.a); cycles = 6; break; 
            case 0x91: this.stageWrite(this.indY(), this.a); cycles = 6; break; 

            case 0x86: this.stageWrite(this.zp(), this.x); cycles = 3; break; 
            case 0x96: this.stageWrite(this.zpY(), this.x); cycles = 4; break; 
            case 0x8E: this.stageWrite(this.abs(), this.x); cycles = 4; break; 

            case 0x84: this.stageWrite(this.zp(), this.y); cycles = 3; break; 
            case 0x94: this.stageWrite(this.zpX(), this.y); cycles = 4; break; 
            case 0x8C: this.stageWrite(this.abs(), this.y); cycles = 4; break; 

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

            case 0xE6: { let z = this.zp(); let oldV = this.read(z); let v = (oldV + 1) & 0xFF; this.setNZ(v); this.stageRmwWrite(z, oldV, v); cycles = 5; } break; 
            case 0xF6: { let z = this.zpX(); let oldV = this.read(z); let v = (oldV + 1) & 0xFF; this.setNZ(v); this.stageRmwWrite(z, oldV, v); cycles = 6; } break; 
            case 0xEE: { let a = this.abs(); let oldV = this.read(a); let v = (oldV + 1) & 0xFF; this.setNZ(v); this.stageRmwWrite(a, oldV, v); cycles = 6; } break; 
            case 0xFE: { let a = this.absX(); let oldV = this.read(a); let v = (oldV + 1) & 0xFF; this.setNZ(v); this.stageRmwWrite(a, oldV, v); cycles = 7; } break; 

            case 0xC6: { let z = this.zp(); let oldV = this.read(z); let v = (oldV - 1) & 0xFF; this.setNZ(v); this.stageRmwWrite(z, oldV, v); cycles = 5; } break; 
            case 0xD6: { let z = this.zpX(); let oldV = this.read(z); let v = (oldV - 1) & 0xFF; this.setNZ(v); this.stageRmwWrite(z, oldV, v); cycles = 6; } break; 
            case 0xCE: { let a = this.abs(); let oldV = this.read(a); let v = (oldV - 1) & 0xFF; this.setNZ(v); this.stageRmwWrite(a, oldV, v); cycles = 6; } break; 
            case 0xDE: { let a = this.absX(); let oldV = this.read(a); let v = (oldV - 1) & 0xFF; this.setNZ(v); this.stageRmwWrite(a, oldV, v); cycles = 7; } break;

            case 0xA7: { let val = this.read(this.zp()); this.a = val; this.x = val; this.setNZ(val); cycles = 3; } break;
            case 0xB7: { let val = this.read(this.zpY()); this.a = val; this.x = val; this.setNZ(val); cycles = 4; } break;
            case 0xAF: { let val = this.read(this.abs()); this.a = val; this.x = val; this.setNZ(val); cycles = 4; } break;
            case 0xBF: { 
                let addr = this.abs(); let addrY = (addr + this.y) & 0xFFFF;
                if (this.pageCrossed(addr, addrY)) this.read((addr & 0xFF00) | (addrY & 0x00FF));
                let val = this.read(addrY); this.a = val; this.x = val; this.setNZ(val);
                cycles = 4 + (this.pageCrossed(addr, addrY) ? 1 : 0);
            } break;

            case 0x87: { this.stageWrite(this.zp(), this.a & this.x); cycles = 3; } break;
            case 0x97: { this.stageWrite(this.zpY(), this.a & this.x); cycles = 4; } break;
            case 0x8F: { this.stageWrite(this.abs(), this.a & this.x); cycles = 4; } break;

            case 0xC7: { let z = this.zp(); let oldV = this.read(z); let v = (oldV - 1) & 0xFF; let diff = this.a - v; this.setNZ(diff & 0xFF); if (this.a >= v) this.p |= 1; else this.p &= ~1; this.stageRmwWrite(z, oldV, v); cycles = 5; } break;
            case 0xD7: { let z = this.zpX(); let oldV = this.read(z); let v = (oldV - 1) & 0xFF; let diff = this.a - v; this.setNZ(diff & 0xFF); if (this.a >= v) this.p |= 1; else this.p &= ~1; this.stageRmwWrite(z, oldV, v); cycles = 6; } break;
            case 0xCF: { let a = this.abs(); let oldV = this.read(a); let v = (oldV - 1) & 0xFF; let diff = this.a - v; this.setNZ(diff & 0xFF); if (this.a >= v) this.p |= 1; else this.p &= ~1; this.stageRmwWrite(a, oldV, v); cycles = 6; } break;
            case 0xDF: { let a = this.absX(); let oldV = this.read(a); let v = (oldV - 1) & 0xFF; let diff = this.a - v; this.setNZ(diff & 0xFF); if (this.a >= v) this.p |= 1; else this.p &= ~1; this.stageRmwWrite(a, oldV, v); cycles = 7; } break;
            case 0xDB: { let a = this.absY(); let oldV = this.read(a); let v = (oldV - 1) & 0xFF; let diff = this.a - v; this.setNZ(diff & 0xFF); if (this.a >= v) this.p |= 1; else this.p &= ~1; this.stageRmwWrite(a, oldV, v); cycles = 7; } break;

            case 0xE7: { let z = this.zp(); let oldV = this.read(z); let v = (oldV + 1) & 0xFF; this.sbcInternal(v); this.stageRmwWrite(z, oldV, v); cycles = 5; } break;
            case 0xF7: { let z = this.zpX(); let oldV = this.read(z); let v = (oldV + 1) & 0xFF; this.sbcInternal(v); this.stageRmwWrite(z, oldV, v); cycles = 6; } break;
            case 0xEF: { let a = this.abs(); let oldV = this.read(a); let v = (oldV + 1) & 0xFF; this.sbcInternal(v); this.stageRmwWrite(a, oldV, v); cycles = 6; } break;
            case 0xFF: { let a = this.absX(); let oldV = this.read(a); let v = (oldV + 1) & 0xFF; this.sbcInternal(v); this.stageRmwWrite(a, oldV, v); cycles = 7; } break;
            case 0xFB: { let a = this.absY(); let oldV = this.read(a); let v = (oldV + 1) & 0xFF; this.sbcInternal(v); this.stageRmwWrite(a, oldV, v); cycles = 7; } break;

            case 0x07: { let z = this.zp(); let oldV = this.read(z); if (oldV & 128) this.p |= 1; else this.p &= ~1; let v = (oldV << 1) & 0xFF; this.a |= v; this.setNZ(this.a); this.stageRmwWrite(z, oldV, v); cycles = 5; } break; 
            case 0x17: { let z = this.zpX(); let oldV = this.read(z); if (oldV & 128) this.p |= 1; else this.p &= ~1; let v = (oldV << 1) & 0xFF; this.a |= v; this.setNZ(this.a); this.stageRmwWrite(z, oldV, v); cycles = 6; } break; 
            case 0x0F: { let a = this.abs(); let oldV = this.read(a); if (oldV & 128) this.p |= 1; else this.p &= ~1; let v = (oldV << 1) & 0xFF; this.a |= v; this.setNZ(this.a); this.stageRmwWrite(a, oldV, v); cycles = 6; } break; 
            case 0x1F: { let a = this.absX(); let oldV = this.read(a); if (oldV & 128) this.p |= 1; else this.p &= ~1; let v = (oldV << 1) & 0xFF; this.a |= v; this.setNZ(this.a); this.stageRmwWrite(a, oldV, v); cycles = 7; } break; 

            case 0x27: { let z = this.zp(); let oldV = this.read(z); let c = this.p & 1; if (oldV & 128) this.p |= 1; else this.p &= ~1; let v = ((oldV << 1) & 0xFF) | c; this.a &= v; this.setNZ(this.a); this.stageRmwWrite(z, oldV, v); cycles = 5; } break; 
            case 0x37: { let z = this.zpX(); let oldV = this.read(z); let c = this.p & 1; if (oldV & 128) this.p |= 1; else this.p &= ~1; let v = ((oldV << 1) & 0xFF) | c; this.a &= v; this.setNZ(this.a); this.stageRmwWrite(z, oldV, v); cycles = 6; } break; 
            case 0x2F: { let a = this.abs(); let oldV = this.read(a); let c = this.p & 1; if (oldV & 128) this.p |= 1; else this.p &= ~1; let v = ((oldV << 1) & 0xFF) | c; this.a &= v; this.setNZ(this.a); this.stageRmwWrite(a, oldV, v); cycles = 6; } break; 
            case 0x3F: { let a = this.absX(); let oldV = this.read(a); let c = this.p & 1; if (oldV & 128) this.p |= 1; else this.p &= ~1; let v = ((oldV << 1) & 0xFF) | c; this.a &= v; this.setNZ(this.a); this.stageRmwWrite(a, oldV, v); cycles = 7; } break; 

            case 0x47: { let z = this.zp(); let oldV = this.read(z); if (oldV & 1) this.p |= 1; else this.p &= ~1; let v = (oldV >> 1) & 0x7F; this.a ^= v; this.setNZ(this.a); this.stageRmwWrite(z, oldV, v); cycles = 5; } break; 
            case 0x57: { let z = this.zpX(); let oldV = this.read(z); if (oldV & 1) this.p |= 1; else this.p &= ~1; let v = (oldV >> 1) & 0x7F; this.a ^= v; this.setNZ(this.a); this.stageRmwWrite(z, oldV, v); cycles = 6; } break; 
            case 0x4F: { let a = this.abs(); let oldV = this.read(a); if (oldV & 1) this.p |= 1; else this.p &= ~1; let v = (oldV >> 1) & 0x7F; this.a ^= v; this.setNZ(this.a); this.stageRmwWrite(a, oldV, v); cycles = 6; } break; 
            case 0x5F: { let a = this.absX(); let oldV = this.read(a); if (oldV & 1) this.p |= 1; else this.p &= ~1; let v = (oldV >> 1) & 0x7F; this.a ^= v; this.setNZ(this.a); this.stageRmwWrite(a, oldV, v); cycles = 7; } break; 

            case 0x67: { let z = this.zp(); let oldV = this.read(z); let c = this.p & 1; if (oldV & 1) this.p |= 1; else this.p &= ~1; let v = (oldV >> 1) | (c << 7); this.adcInternal(v); this.stageRmwWrite(z, oldV, v); cycles = 5; } break; 
            case 0x77: { let z = this.zpX(); let oldV = this.read(z); let c = this.p & 1; if (oldV & 1) this.p |= 1; else this.p &= ~1; let v = (oldV >> 1) | (c << 7); this.adcInternal(v); this.stageRmwWrite(z, oldV, v); cycles = 6; } break; 
            case 0x6F: { let a = this.abs(); let oldV = this.read(a); let c = this.p & 1; if (oldV & 1) this.p |= 1; else this.p &= ~1; let v = (oldV >> 1) | (c << 7); this.adcInternal(v); this.stageRmwWrite(a, oldV, v); cycles = 6; } break; 
            case 0x7F: { let a = this.absX(); let oldV = this.read(a); let c = this.p & 1; if (oldV & 1) this.p |= 1; else this.p &= ~1; let v = (oldV >> 1) | (c << 7); this.adcInternal(v); this.stageRmwWrite(a, oldV, v); cycles = 7; } break; 

            case 0x0B: case 0x2B: { this.a &= this.read(this.pc++); this.setNZ(this.a); if (this.a & 0x80) this.p |= 1; else this.p &= ~1; cycles = 2; } break; 
            case 0x4B: { this.a &= this.read(this.pc++); if (this.a & 1) this.p |= 1; else this.p &= ~1; this.a >>= 1; this.setNZ(this.a); cycles = 2; } break; 
            case 0x6B: { this.a &= this.read(this.pc++); let c = (this.p & 1) << 7; if (this.a & 1) this.p |= 1; else this.p &= ~1; this.a = (this.a >> 1) | c; this.setNZ(this.a); cycles = 2; } break; 
            case 0xCB: { let val = this.read(this.pc++); let res = (this.a & this.x) - val; if ((this.a & this.x) >= val) this.p |= 1; else this.p &= ~1; this.x = res & 0xFF; this.setNZ(this.x); cycles = 2; } break; 
            case 0xEB: { this.sbcInternal(this.read(this.pc++)); cycles = 2; } break; 

            case 0x20: { let target = this.abs(); this.push((this.pc - 1) >> 8); this.push((this.pc - 1) & 0xFF); this.pc = target; cycles = 6; } break; 
            case 0x4C: this.pc = this.abs(); cycles = 3; break; 
            case 0x6C: { let ptr = this.abs(); let low = this.read(ptr); let high = this.read((ptr & 0xFF00) | ((ptr + 1) & 0x00FF)); this.pc = low | (high << 8); cycles = 5; } break; 
            case 0x60: { let low = this.pop(); let high = this.pop(); this.pc = (low | (high << 8)) + 1; cycles = 6; } break; 
            case 0x40: {
                // RTI performs a dummy read at PC. On a real C64, JMP $DD0C
                // therefore reads $DD0D during RTI and acknowledges CIA2 NMIs.
                this.read(this.pc);
                this.p = (this.pop() & 0xEF) | 0x20;
                let low = this.pop();
                let high = this.pop();
                this.pc = low | (high << 8);
                cycles = 6;
            } break;

            case 0xD0: cycles = this.branch((this.p & 2) === 0); break; 
            case 0xF0: cycles = this.branch((this.p & 2) !== 0); break; 
            case 0x10: cycles = this.branch((this.p & 128) === 0); break; 
            case 0x30: cycles = this.branch((this.p & 128) !== 0); break; 
            case 0x90: cycles = this.branch((this.p & 1) === 0); break; 
            case 0xB0: cycles = this.branch((this.p & 1) !== 0); break; 
            case 0x50: cycles = this.branch((this.p & 64) === 0); break; 
            case 0x70: cycles = this.branch((this.p & 64) !== 0); break; 

            case 0x08: this.push(this.p | 0x10); cycles = 3; break; 
            case 0x28: this.p = (this.pop() & 0xEF) | 0x20; cycles = 4; break; 
            case 0x48: this.push(this.a); cycles = 3; break; 
            case 0x68: this.a = this.pop(); this.setNZ(this.a); cycles = 4; break; 

            case 0x18: this.p &= ~1; cycles = 2; break; 
            case 0x38: this.p |= 1; cycles = 2; break; 
            case 0x58: this.p &= ~4; cycles = 2; break; 
            case 0x78: this.p |= 4; cycles = 2; break; 
            case 0xD8: this.p &= ~8; cycles = 2; break; 
            case 0xF8: this.p |= 8; cycles = 2; break; 
            case 0xB8: this.p &= ~64; cycles = 2; break; 

            case 0x0A: { if (this.a & 128) this.p |= 1; else this.p &= ~1; this.a = (this.a << 1) & 0xFF; this.setNZ(this.a); cycles = 2; } break; 
            case 0x4A: { if (this.a & 1) this.p |= 1; else this.p &= ~1; this.a = (this.a >> 1) & 0x7F; this.setNZ(this.a); cycles = 2; } break; 
            case 0x2A: { let c = this.p & 1; if (this.a & 128) this.p |= 1; else this.p &= ~1; this.a = ((this.a << 1) & 0xFF) | c; this.setNZ(this.a); cycles = 2; } break; 
            case 0x6A: { let c = this.p & 1; if (this.a & 1) this.p |= 1; else this.p &= ~1; this.a = (this.a >> 1) | (c << 7); this.setNZ(this.a); cycles = 2; } break; 

            case 0x06: { let z = this.zp(); let oldV = this.read(z); if (oldV & 128) this.p |= 1; else this.p &= ~1; let v = (oldV << 1) & 0xFF; this.setNZ(v); this.stageRmwWrite(z, oldV, v); cycles = 5; } break; 
            case 0x46: { let z = this.zp(); let oldV = this.read(z); if (oldV & 1) this.p |= 1; else this.p &= ~1; let v = (oldV >> 1) & 0x7F; this.setNZ(v); this.stageRmwWrite(z, oldV, v); cycles = 5; } break; 
            case 0x26: { let z = this.zp(); let oldV = this.read(z); let c = this.p & 1; if (oldV & 128) this.p |= 1; else this.p &= ~1; let v = ((oldV << 1) & 0xFF) | c; this.setNZ(v); this.stageRmwWrite(z, oldV, v); cycles = 5; } break; 
            case 0x66: { let z = this.zp(); let oldV = this.read(z); let c = this.p & 1; if (oldV & 1) this.p |= 1; else this.p &= ~1; let v = (oldV >> 1) | (c << 7); this.setNZ(v); this.stageRmwWrite(z, oldV, v); cycles = 5; } break; 
            
            case 0x16: { let z = this.zpX(); let oldV = this.read(z); if (oldV & 128) this.p |= 1; else this.p &= ~1; let v = (oldV << 1) & 0xFF; this.setNZ(v); this.stageRmwWrite(z, oldV, v); cycles = 6; } break; 
            case 0x56: { let z = this.zpX(); let oldV = this.read(z); if (oldV & 1) this.p |= 1; else this.p &= ~1; let v = (oldV >> 1) & 0x7F; this.setNZ(v); this.stageRmwWrite(z, oldV, v); cycles = 6; } break; 
            case 0x36: { let z = this.zpX(); let oldV = this.read(z); let c = this.p & 1; if (oldV & 128) this.p |= 1; else this.p &= ~1; let v = ((oldV << 1) & 0xFF) | c; this.setNZ(v); this.stageRmwWrite(z, oldV, v); cycles = 6; } break; 
            case 0x76: { let z = this.zpX(); let oldV = this.read(z); let c = this.p & 1; if (oldV & 1) this.p |= 1; else this.p &= ~1; let v = (oldV >> 1) | (c << 7); this.setNZ(v); this.stageRmwWrite(z, oldV, v); cycles = 6; } break; 
            
            case 0x0E: { let a = this.abs(); let oldV = this.read(a); if (oldV & 128) this.p |= 1; else this.p &= ~1; let v = (oldV << 1) & 0xFF; this.setNZ(v); this.stageRmwWrite(a, oldV, v); cycles = 6; } break; 
            case 0x4E: { let a = this.abs(); let oldV = this.read(a); if (oldV & 1) this.p |= 1; else this.p &= ~1; let v = (oldV >> 1) & 0x7F; this.setNZ(v); this.stageRmwWrite(a, oldV, v); cycles = 6; } break; 
            case 0x2E: { let a = this.abs(); let oldV = this.read(a); let c = this.p & 1; if (oldV & 128) this.p |= 1; else this.p &= ~1; let v = ((oldV << 1) & 0xFF) | c; this.setNZ(v); this.stageRmwWrite(a, oldV, v); cycles = 6; } break; 
            case 0x6E: { let a = this.abs(); let oldV = this.read(a); let c = this.p & 1; if (oldV & 1) this.p |= 1; else this.p &= ~1; let v = (oldV >> 1) | (c << 7); this.setNZ(v); this.stageRmwWrite(a, oldV, v); cycles = 6; } break; 
            
            case 0x1E: { let a = this.absX(); let oldV = this.read(a); if (oldV & 128) this.p |= 1; else this.p &= ~1; let v = (oldV << 1) & 0xFF; this.setNZ(v); this.stageRmwWrite(a, oldV, v); cycles = 7; } break;
            case 0x5E: { let a = this.absX(); let oldV = this.read(a); if (oldV & 1) this.p |= 1; else this.p &= ~1; let v = (oldV >> 1) & 0x7F; this.setNZ(v); this.stageRmwWrite(a, oldV, v); cycles = 7; } break;
            case 0x3E: { let a = this.absX(); let oldV = this.read(a); let c = this.p & 1; if (oldV & 128) this.p |= 1; else this.p &= ~1; let v = ((oldV << 1) & 0xFF) | c; this.setNZ(v); this.stageRmwWrite(a, oldV, v); cycles = 7; } break;
            case 0x7E: { let a = this.absX(); let oldV = this.read(a); let c = this.p & 1; if (oldV & 1) this.p |= 1; else this.p &= ~1; let v = (oldV >> 1) | (c << 7); this.setNZ(v); this.stageRmwWrite(a, oldV, v); cycles = 7; } break;

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

            case 0x7D: case 0xFD: case 0x3D: case 0x1D:
            case 0x5D: case 0xDD: {
                let addr = this.abs();
                let addrX = (addr + this.x) & 0xFFFF;
                if (this.pageCrossed(addr, addrX)) {
                    this.read((addr & 0xFF00) | (addrX & 0x00FF)); 
                }
                val = this.read(addrX);
                cycles = 4 + (this.pageCrossed(addr, addrX) ? 1 : 0);
                break;
            }

            case 0x79: case 0xF9: case 0x39: case 0x19:
            case 0x59: case 0xD9: {
                let addr = this.abs();
                let addrY = (addr + this.y) & 0xFFFF;
                if (this.pageCrossed(addr, addrY)) {
                    this.read((addr & 0xFF00) | (addrY & 0x00FF)); 
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

            case 0x71: case 0xF1: case 0x31: case 0x11:
            case 0x51: case 0xD1: {
                let z = this.zp();
                let addr = this.read(z) | (this.read((z+1)&0xFF) << 8);
                let addrY = (addr + this.y) & 0xFFFF;
                if (this.pageCrossed(addr, addrY)) {
                    this.read((addr & 0xFF00) | (addrY & 0x00FF)); 
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
            if (high === 0xC0 || high === 0xD0) { if(low!==0&&low!==4&&low!==8&&low!==0xA&&low!==0xC&&op!==0xD8) { let diff = this.a - val; this.setNZ(diff & 0xFF); if (this.a >= val) this.p |= 1; else this.p &= ~1; return cycles; } }
            if (op===0xE0||op===0xE4||op===0xEC) { let diff = this.x - val; this.setNZ(diff & 0xFF); if (this.x >= val) this.p |= 1; else this.p &= ~1; return cycles; }
            if (op===0xC0||op===0xC4||op===0xCC) { let diff = this.y - val; this.setNZ(diff & 0xFF); if (this.y >= val) this.p |= 1; else this.p &= ~1; return cycles; }

            if (high === 0x60 || high === 0x70) { 
                if(op!==0x60&&op!==0x68&&op!==0x6A&&op!==0x78&&op!==0x70) { 
                    this.adcInternal(val);
                    return cycles; 
                } 
            }

            if (high === 0xE0 || high === 0xF0) { 
                if(op!==0xE0&&op!==0xE4&&op!==0xE8&&op!==0xEA&&op!==0xEC&&op!==0xF8&&op!==0xF0) { 
                    this.sbcInternal(val);
                    return cycles; 
                } 
            }

            if (op === 0x24 || op === 0x2C) { if (val & 0x80) this.p |= 128; else this.p &= ~128; if (val & 0x40) this.p |= 64; else this.p &= ~64; if ((val & this.a) === 0) this.p |= 2; else this.p &= ~2; return cycles; }
        }
        return cycles;
    }

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
                        pm ^= 0x80; 
                    }
                    this.todHour = hBcd | pm;
                }
            }
        }
    }

    streamPsidSampleNibble() {
        if (!this.psidSampleActive) return;
        if (this.psidSamplePtr < this.psidSampleEnd && this.psidSamplePtr < 65536) {
            let byteVal = this.ram[this.psidSamplePtr];
            let filterMode = this.cpuLastD418 & 0xF0;

            if (this.psidSampleStep === 0) {
                let highFirst = (this.psidNibbleOrder === 0);
                let nibble;
                if (this.psidNibblePhase === 0) {
                    nibble = highFirst ? ((byteVal >> 4) & 0x0F) : (byteVal & 0x0F);
                    this.psidNibblePhase = 1;
                } else {
                    nibble = highFirst ? (byteVal & 0x0F) : ((byteVal >> 4) & 0x0F);
                    this.psidNibblePhase = 0;
                    this.psidSamplePtr++;
                }
                this.sid.writeReg(24, filterMode | nibble);
            } else {
                let nibble = byteVal & 0x0F;
                this.sid.writeReg(24, filterMode | nibble);

                this.psidNibblePhase = 0;
                this.psidSamplePtr += this.psidSampleStep;
            }

            if (this.psidSamplePtr >= this.psidSampleEnd) {
                if (this.psidSampleLoop && this.psidSampleRepPtr < this.psidSampleEnd) {
                    this.psidSamplePtr = this.psidSampleRepPtr;
                    this.psidNibblePhase = 0;
                } else {
                    this.psidSampleActive = false;
                    this.sid.writeReg(24, this.cpuLastD418);
                }
            }
        } else {
            this.psidSampleActive = false;
            this.sid.writeReg(24, this.cpuLastD418);
        }
    }
}
