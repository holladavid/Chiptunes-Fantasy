// Unabhaengige Paula-Register Senke fuer den Original-HIP-68k-Player.
// Die Codeausfuehrung nutzt denselben M68000-Interpreter, die Registerdekodierung
// ist bewusst von HipVirtualMachine getrennt.
import { M68000 } from '../../js/worklets/lib/m68k.js';

const HIP_BASE = 0x20000;
const MAX_INSTRUCTIONS = 400000;
const signed16 = (bytes, offset) => (((bytes[offset] << 8) | bytes[offset + 1]) << 16) >> 16;

function entryPoint(bytes, offset) {
    if (bytes[offset] !== 0x60 || bytes[offset + 1] !== 0) {
        throw new Error('HIP-Oracle: BRA.W-Einsprung fehlt');
    }
    return offset + 2 + signed16(bytes, offset + 2);
}

export function createRunner(bytes) {
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    const cpu = new M68000(0x80000);
    const initAddress = HIP_BASE + entryPoint(bytes, 0);
    const playAddress = HIP_BASE + entryPoint(bytes, 4);
    const st = {
        lc: new Int32Array(4),
        len: new Int32Array(4),
        per: new Int32Array(4),
        vol: new Int32Array(4),
        dmacon: 0x0200
    };
    let rasterPosition = 0;

    function wordWrite(address, value) {
        value &= 0xFFFF;
        if (address >= 0xDFF0A0 && address < 0xDFF0E0) {
            const channel = (address - 0xDFF0A0) >> 4;
            switch (address & 0x0F) {
                case 0:
                    st.lc[channel] = ((value & 0x1F) << 16) | (st.lc[channel] & 0xFFFF);
                    break;
                case 2:
                    st.lc[channel] = (st.lc[channel] & 0x1F0000) | (value & 0xFFFE);
                    break;
                case 4: st.len[channel] = value; break;
                case 6: st.per[channel] = value; break;
                case 8: st.vol[channel] = value & 0x7F; break;
                default: break;
            }
            return;
        }
        if (address === 0xDFF096) {
            st.dmacon = (value & 0x8000)
                ? (st.dmacon | (value & 0x7FFF))
                : (st.dmacon & ~(value & 0x7FFF));
        }
    }

    function customWrite(address, size, value) {
        if (size === 2) {
            wordWrite(address, value >>> 16);
            wordWrite(address + 2, value);
        } else if (size === 1) {
            wordWrite(address, value);
        } else {
            wordWrite(address & ~1, value);
        }
    }

    function customRead(address, size) {
        let value = 0;
        const wordAddress = address & ~1;
        if (wordAddress === 0xDFF006 || wordAddress === 0xDFF004) {
            rasterPosition = (rasterPosition + 0x100) & 0xFFFF;
            value = rasterPosition;
        } else if (wordAddress === 0xDFF01E) {
            value = 0xFFFF;
        } else if (wordAddress === 0xDFF002) {
            value = st.dmacon;
        }
        if (size === 0) return (address & 1) ? (value & 0xFF) : (value >> 8);
        return value;
    }

    cpu.onCustomWrite = customWrite;
    cpu.onCustomRead = customRead;

    return {
        st,
        init(song = 1) {
            cpu.mem.fill(0);
            cpu.mem.set(bytes, HIP_BASE);
            cpu.d.fill(0);
            cpu.a.fill(0);
            cpu.a[7] = HIP_BASE - 0x100;
            cpu.x = cpu.n = cpu.z = cpu.v = cpu.c = 0;
            st.lc.fill(0);
            st.len.fill(0);
            st.per.fill(0);
            st.vol.fill(0);
            st.dmacon = 0x0200;
            rasterPosition = 0;
            cpu.d[0] = song;
            cpu.call(initAddress, MAX_INSTRUCTIONS);
        },
        play() {
            cpu.call(playAddress, MAX_INSTRUCTIONS);
        }
    };
}
