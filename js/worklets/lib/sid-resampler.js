// SID-specific defaults for the shared band-limited polyphase resampler.
import { PolyphaseResampler } from './polyphase-resampler.js';

export class SidResampler extends PolyphaseResampler {
    constructor(inputRate, outputRate, options = {}) {
        super(inputRate, outputRate, options);
    }
}
