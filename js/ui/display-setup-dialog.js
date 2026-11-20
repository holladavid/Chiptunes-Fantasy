// === js/ui/display-setup-dialog.js ===
// =========================================================
// CRT SHADOW MASK & PHOSPHOR OSCILLOSCOPE CALIBRATION DECK
// Responsives Hardware-Setup-Panel mit Live-Vorschau für
// Desktop, Widescreen, Fullscreen sowie Mobile Hoch-/Querformat.
// =========================================================

import { displaySettings, SYSTEM_CRT_PRESETS } from '../visuals/display-settings.js';

const CRT_PRESET_OPTIONS = Object.freeze([
    { id: 'default', label: 'FACTORY' },
    { id: 'auto', label: 'AUTO SYS' },
    { id: 'rgb', label: '1084S RGB' },
    { id: 'composite', label: '1702 COMP' },
    { id: 'grille', label: 'TRINITRON' },
    { id: 'delta', label: 'DELTA' }
]);

const CRT_PRESET_LABELS = Object.freeze({
    default: 'FACTORY',
    rgb: '1084S RGB',
    composite: '1702 COMP',
    grille: 'TRINITRON',
    delta: 'DELTA',
    custom: 'CUSTOM'
});

const CRT_ENUM_GROUPS = Object.freeze([
    {
        key: 'maskType',
        label: 'MASK',
        options: [
            { value: 'slot', label: 'SLOT' },
            { value: 'delta', label: 'DELTA' },
            { value: 'grille', label: 'GRILLE' }
        ]
    },
    {
        key: 'scanlineRows',
        label: 'SCAN',
        numeric: true,
        options: [
            { value: '1', label: '1X' },
            { value: '2', label: '2X' }
        ]
    },
    {
        key: 'quality',
        label: 'GPU',
        options: [
            { value: 'low', label: 'LOW' },
            { value: 'medium', label: 'MED' },
            { value: 'high', label: 'HIGH' }
        ]
    }
]);

const CRT_SLIDER_SPECS = Object.freeze([
    { key: 'pitch', label: 'MASK PITCH', min: 2, max: 8, step: 0.5, format: v => `${v.toFixed(1)} px` },
    { key: 'maskStrength', label: 'MASK DEPTH', min: 0, max: 1.3, step: 0.05, format: v => `${Math.round(v * 100)}%` },
    { key: 'scanlineStrength', label: 'SCANLINES', min: 0, max: 1, step: 0.05, format: v => `${Math.round(v * 100)}%` },
    { key: 'beamBlur', label: 'BEAM BLUR', min: 0, max: 1, step: 0.05, format: v => `${v.toFixed(2)} px` },
    { key: 'halation', label: 'HALATION', min: 0, max: 0.5, step: 0.02, format: v => `${Math.round(v * 100)}%`, requiresHighQuality: true },
    { key: 'convergence', label: 'R/B DRIFT', min: 0, max: 4, step: 0.1, format: v => `${v.toFixed(1)} px` },
    { key: 'curvature', label: 'TUBE CURVE', min: 0, max: 0.056, step: 0.002, format: v => (v <= 0.0005 ? 'FLAT' : `${(v * 100).toFixed(1)}%`) },
    { key: 'vignette', label: 'VIGNETTE', min: 0, max: 0.8, step: 0.02, format: v => `${Math.round(v * 100)}%` },
    { key: 'contrast', label: 'CONTRAST', min: 0.75, max: 1.75, step: 0.05, format: v => `${v.toFixed(2)}x` }
]);

const OSC_ENUM_GROUPS = Object.freeze([
    {
        key: 'beamMode',
        label: 'BEAM FX',
        options: [
            { value: 'sparks', label: 'SPARKS' },
            { value: 'spot', label: 'SPOT' },
            { value: 'off', label: 'OFF' }
        ]
    },
    {
        key: 'triggerMode',
        label: 'TRIGGER',
        options: [
            { value: 'auto', label: 'AUTO' },
            { value: 'free', label: 'FREE' }
        ]
    },
    {
        key: 'phosphorTint',
        label: 'PHOSPHOR',
        options: [
            { value: 'system', label: 'SYS' },
            { value: 'p31', label: 'P31' },
            { value: 'p11', label: 'P11' },
            { value: 'amber', label: 'AMBER' }
        ]
    }
]);

const OSC_SLIDER_SPECS = Object.freeze([
    { key: 'gain', label: 'V/DIV GAIN', min: 0.5, max: 2.5, step: 0.02, format: v => `${v.toFixed(2)}x` },
    { key: 'timeWindowMs', label: 'TIMEBASE', min: 8, max: 36, step: 1, format: v => `${Math.round(v)} ms` },
    { key: 'persistence', label: 'PERSISTENCE', min: 0, max: 1, step: 0.05, format: v => `${Math.round(v * 100)}%` },
    { key: 'bloom', label: 'PHOSPHOR GLOW', min: 0, max: 1, step: 0.02, format: v => `${Math.round(v * 100)}%` },
    { key: 'graticule', label: 'GRATICULE', min: 0, max: 1, step: 0.05, format: v => (v <= 0.005 ? 'OFF' : `${Math.round(v * 100)}%`) }
]);

function createElement(tag, className, textContent) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent !== undefined) el.textContent = textContent;
    return el;
}

export class DisplaySetupDialog {
    constructor(options = {}) {
        this.root = options.root || document.getElementById('display-setup-dialog');
        this.triggerButton = options.triggerButton || document.getElementById('btn-display-setup');
        this.visualZone = options.visualZone || document.getElementById('visual-zone');
        this.playbackBar = options.playbackBar || document.getElementById('playback-bar');
        this.getSystem = typeof options.getSystem === 'function' ? options.getSystem : () => 'c64';
        this.isVisualFullscreen = typeof options.isVisualFullscreen === 'function' ? options.isVisualFullscreen : () => false;
        this.onOpenChange = typeof options.onOpenChange === 'function' ? options.onOpenChange : null;

        this.openFlag = false;
        this.activeTab = 'crt';
        this.returnFocusEl = null;

        this.crtPresetButtons = [];
        this.crtEnumButtons = [];
        this.crtSliderEntries = [];
        this.oscEnumButtons = [];
        this.oscSliderEntries = [];

        if (!this.root) return;

        this.buildDOM();
        this.bindEvents();
        this.unsubscribe = displaySettings.subscribe(state => this.sync(state));
        this.sync();
    }

    buildDOM() {
        this.root.innerHTML = '';

        // --- Header ---
        const header = createElement('div', 'setup-deck-header');
        const titleGroup = createElement('div', 'setup-title-group');
        const title = createElement('h2', 'setup-deck-title', '> CRT & SCOPE CALIBRATION');
        title.id = 'display-setup-title';
        this.crtBadge = createElement('span', 'setup-status-badge', '[ WEBGL CRT ]');
        this.crtBadge.id = 'setup-crt-badge';
        titleGroup.append(title, this.crtBadge);

        const headerActions = createElement('div', 'setup-header-actions');
        this.resetBtn = createElement('button', 'setup-action-btn', '[ RESET ]');
        this.resetBtn.type = 'button';
        this.resetBtn.id = 'setup-btn-reset';
        this.resetBtn.title = 'Alle CRT- und Oszi-Werte auf Werkseinstellung zurücksetzen';

        this.closeBtn = createElement('button', 'setup-action-btn setup-close-btn', '[ CLOSE ]');
        this.closeBtn.type = 'button';
        this.closeBtn.id = 'setup-btn-close';
        this.closeBtn.setAttribute('aria-label', 'Einstellungsdialog schließen');

        headerActions.append(this.resetBtn, this.closeBtn);
        header.append(titleGroup, headerActions);

        // --- Tab Bar (Mobile & schmale Fenster) ---
        const tabBar = createElement('div', 'setup-tab-bar');
        tabBar.setAttribute('role', 'tablist');
        tabBar.setAttribute('aria-label', 'Kalibrierungsbereich wählen');

        this.tabButtons = {
            crt: this.createTabButton('crt', '[ CRT MASK ]', 'setup-section-crt'),
            osc: this.createTabButton('osc', '[ OSCILLOSCOPE ]', 'setup-section-osc')
        };
        tabBar.append(this.tabButtons.crt, this.tabButtons.osc);

        // --- Body ---
        const body = createElement('div', 'setup-deck-body');
        const crtSection = this.buildCrtSection();
        const oscSection = this.buildOscSection();
        body.append(crtSection, oscSection);

        this.root.append(header, tabBar, body);
        this.setActiveTab(this.activeTab);
    }

    createTabButton(tabId, label, controlsId) {
        const btn = createElement('button', 'setup-tab-btn', label);
        btn.type = 'button';
        btn.id = `setup-tab-${tabId}`;
        btn.dataset.setupTab = tabId;
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-controls', controlsId);
        btn.setAttribute('aria-selected', String(tabId === this.activeTab));
        btn.addEventListener('click', () => this.setActiveTab(tabId));
        return btn;
    }

    buildCrtSection() {
        const section = createElement('section', 'setup-section setup-section-crt');
        section.id = 'setup-section-crt';
        section.setAttribute('aria-labelledby', 'setup-heading-crt');
        this.crtSection = section;

        const headingRow = createElement('div', 'setup-section-head');
        const heading = createElement('h3', 'setup-section-heading', '> CRT SHADOW MASK');
        heading.id = 'setup-heading-crt';
        this.presetIndicator = createElement('span', 'setup-preset-indicator', 'FACTORY');
        headingRow.append(heading, this.presetIndicator);

        this.fallbackNote = createElement(
            'p',
            'setup-fallback-note hidden',
            'WebGL CRT-Shader nicht aktiv – CSS-Fallback läuft. Oszilloskop-Regler sind voll aktiv.'
        );

        // Monitor Presets
        const presetBlock = createElement('div', 'setup-control-block');
        const presetLabel = createElement('span', 'setup-group-label', 'MONITOR PRESET');
        const presetRow = createElement('div', 'setup-preset-row');
        for (const preset of CRT_PRESET_OPTIONS) {
            const btn = createElement('button', 'setup-chip-btn', preset.label);
            btn.type = 'button';
            btn.dataset.crtPreset = preset.id;
            btn.setAttribute('aria-pressed', 'false');
            btn.addEventListener('click', () => {
                displaySettings.setCrtPreset(preset.id, this.getSystem());
            });
            this.crtPresetButtons.push(btn);
            presetRow.appendChild(btn);
        }
        presetBlock.append(presetLabel, presetRow);

        // Segmented Hardware Switches
        const segmentedGrid = createElement('div', 'setup-segmented-grid');
        for (const group of CRT_ENUM_GROUPS) {
            const groupEl = createElement('div', 'setup-segment-group');
            const lbl = createElement('span', 'setup-group-label', group.label);
            const row = createElement('div', 'setup-segment-row');
            for (const opt of group.options) {
                const btn = createElement('button', 'setup-seg-btn', opt.label);
                btn.type = 'button';
                btn.dataset.crtKey = group.key;
                btn.dataset.crtValue = opt.value;
                btn.setAttribute('aria-pressed', 'false');
                btn.addEventListener('click', () => {
                    const value = group.numeric ? Number(opt.value) : opt.value;
                    displaySettings.updateCrt({ [group.key]: value }, this.getSystem());
                });
                this.crtEnumButtons.push(btn);
                row.appendChild(btn);
            }
            groupEl.append(lbl, row);
            segmentedGrid.appendChild(groupEl);
        }

        // Sliders
        const slidersGrid = createElement('div', 'setup-sliders-grid setup-sliders-crt');
        for (const spec of CRT_SLIDER_SPECS) {
            const entry = this.createSliderField('crt', spec, value => {
                displaySettings.updateCrt({ [spec.key]: value }, this.getSystem());
            });
            this.crtSliderEntries.push(entry);
            slidersGrid.appendChild(entry.field);
        }

        section.append(headingRow, this.fallbackNote, presetBlock, segmentedGrid, slidersGrid);
        return section;
    }

    buildOscSection() {
        const section = createElement('section', 'setup-section setup-section-osc');
        section.id = 'setup-section-osc';
        section.setAttribute('aria-labelledby', 'setup-heading-osc');
        this.oscSection = section;

        const headingRow = createElement('div', 'setup-section-head');
        const heading = createElement('h3', 'setup-section-heading', '> PHOSPHOR OSCILLOSCOPE');
        heading.id = 'setup-heading-osc';
        const scopeBadge = createElement('span', 'setup-preset-indicator', 'P31/P11');
        headingRow.append(heading, scopeBadge);

        // Segmented Hardware Switches
        const segmentedGrid = createElement('div', 'setup-segmented-grid');
        for (const group of OSC_ENUM_GROUPS) {
            const groupEl = createElement('div', 'setup-segment-group');
            const lbl = createElement('span', 'setup-group-label', group.label);
            const row = createElement('div', 'setup-segment-row');
            for (const opt of group.options) {
                const btn = createElement('button', 'setup-seg-btn', opt.label);
                btn.type = 'button';
                btn.dataset.oscKey = group.key;
                btn.dataset.oscValue = opt.value;
                btn.setAttribute('aria-pressed', 'false');
                btn.addEventListener('click', () => {
                    displaySettings.updateOsc({ [group.key]: opt.value });
                });
                this.oscEnumButtons.push(btn);
                row.appendChild(btn);
            }
            groupEl.append(lbl, row);
            segmentedGrid.appendChild(groupEl);
        }

        // Sliders
        const slidersGrid = createElement('div', 'setup-sliders-grid setup-sliders-osc');
        for (const spec of OSC_SLIDER_SPECS) {
            const entry = this.createSliderField('osc', spec, value => {
                displaySettings.updateOsc({ [spec.key]: value });
            });
            this.oscSliderEntries.push(entry);
            slidersGrid.appendChild(entry.field);
        }

        section.append(headingRow, segmentedGrid, slidersGrid);
        return section;
    }

    createSliderField(prefix, spec, onInput) {
        const field = createElement('div', 'setup-slider-field');
        const inputId = `setup-${prefix}-${spec.key}`;

        const metaRow = createElement('div', 'setup-slider-meta');
        const label = createElement('label', 'setup-slider-label', spec.label);
        label.htmlFor = inputId;
        const readout = createElement('span', 'setup-slider-value', '');
        metaRow.append(label, readout);

        const inputWrap = createElement('div', 'setup-slider-track-wrap');
        const input = createElement('input', 'setup-slider-input');
        input.type = 'range';
        input.id = inputId;
        input.min = String(spec.min);
        input.max = String(spec.max);
        input.step = String(spec.step);
        input.addEventListener('input', () => {
            const parsed = Number.parseFloat(input.value);
            if (Number.isFinite(parsed)) onInput(parsed);
        });

        inputWrap.appendChild(input);
        field.append(metaRow, inputWrap);

        return { spec, field, input, readout };
    }

    bindEvents() {
        this.triggerButton?.addEventListener('click', () => this.toggle());
        this.closeBtn?.addEventListener('click', () => this.close());
        this.resetBtn?.addEventListener('click', () => displaySettings.resetAll());

        this.handleWindowResize = () => {
            if (this.openFlag) this.updateDesktopBounds();
        };
        window.addEventListener('resize', this.handleWindowResize);

        if (typeof ResizeObserver === 'function' && this.playbackBar) {
            this.layoutObserver = new ResizeObserver(() => {
                if (this.openFlag) this.updateDesktopBounds();
            });
            this.layoutObserver.observe(this.playbackBar);
            if (this.visualZone) this.layoutObserver.observe(this.visualZone);
        }
    }

    setActiveTab(tabId) {
        this.activeTab = tabId === 'osc' ? 'osc' : 'crt';
        const isCrt = this.activeTab === 'crt';

        this.tabButtons.crt?.classList.toggle('active', isCrt);
        this.tabButtons.crt?.setAttribute('aria-selected', String(isCrt));
        this.tabButtons.osc?.classList.toggle('active', !isCrt);
        this.tabButtons.osc?.setAttribute('aria-selected', String(!isCrt));

        this.crtSection?.classList.toggle('is-active-tab', isCrt);
        this.oscSection?.classList.toggle('is-active-tab', !isCrt);
    }

    isOpen() {
        return this.openFlag;
    }

    open() {
        if (!this.root || this.openFlag) return;
        this.returnFocusEl = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : this.triggerButton;
        this.openFlag = true;

        document.body.classList.add('setup-open');
        this.updateHostMount();
        this.root.classList.remove('hidden');
        this.root.setAttribute('aria-hidden', 'false');
        this.triggerButton?.setAttribute('aria-expanded', 'true');
        this.sync();

        requestAnimationFrame(() => {
            if (!this.openFlag) return;
            this.updateDesktopBounds();
            this.closeBtn?.focus({ preventScroll: true });
        });
        this.onOpenChange?.(true);
    }

    close({ restoreFocus = true } = {}) {
        if (!this.root || !this.openFlag) return;
        this.openFlag = false;

        document.body.classList.remove('setup-open');
        this.root.classList.add('hidden');
        this.root.setAttribute('aria-hidden', 'true');
        this.triggerButton?.setAttribute('aria-expanded', 'false');

        if (this.root.parentElement !== document.body) {
            document.body.appendChild(this.root);
        }
        this.root.classList.remove('in-stage-fullscreen');

        if (restoreFocus) {
            const target = (this.returnFocusEl?.isConnected && this.returnFocusEl.getClientRects().length > 0)
                ? this.returnFocusEl
                : this.triggerButton;
            target?.focus({ preventScroll: true });
        }
        this.returnFocusEl = null;
        this.onOpenChange?.(false);
    }

    toggle() {
        if (this.openFlag) this.close();
        else this.open();
    }

    handleViewportChange() {
        if (!this.openFlag) return;
        this.updateHostMount();
        this.sync();
    }

    updateHostMount() {
        if (!this.root) return;
        const fullscreen = Boolean(this.isVisualFullscreen());
        const targetParent = (fullscreen && this.visualZone) ? this.visualZone : document.body;

        if (this.root.parentElement !== targetParent) {
            const focusedChild = this.root.contains(document.activeElement)
                ? document.activeElement
                : null;
            targetParent.appendChild(this.root);
            if (focusedChild instanceof HTMLElement) {
                focusedChild.focus({ preventScroll: true });
            }
        }

        this.root.classList.toggle('in-stage-fullscreen', fullscreen);
        this.updateDesktopBounds();
    }

    updateDesktopBounds() {
        if (!this.root || !this.openFlag || this.isVisualFullscreen()) return;
        const anchor = this.playbackBar || this.visualZone;
        if (!anchor) return;
        const rect = anchor.getBoundingClientRect();
        if (rect.height <= 0) return;

        const minDeckHeight = 250;
        const maxTop = Math.max(120, window.innerHeight - minDeckHeight);
        const top = Math.min(maxTop, Math.max(0, Math.round(rect.bottom + 8)));
        this.root.style.setProperty('--setup-deck-top', `${top}px`);
    }

    sync(state = displaySettings.getState()) {
        if (!this.root) return;
        const system = this.getSystem();
        const effectiveCrt = displaySettings.getEffectiveCrt(system);
        const effectiveOsc = displaySettings.getEffectiveOsc();
        const crtAvailable = Boolean(state.crtAvailable);

        if (this.crtBadge) {
            if (!crtAvailable) {
                this.crtBadge.textContent = '[ CSS FALLBACK ]';
                this.crtBadge.dataset.status = 'fallback';
            } else if (effectiveCrt.quality !== 'high') {
                this.crtBadge.textContent = `[ WEBGL · ${effectiveCrt.quality.toUpperCase()} ]`;
                this.crtBadge.dataset.status = 'ready';
            } else {
                this.crtBadge.textContent = '[ WEBGL CRT ]';
                this.crtBadge.dataset.status = 'ready';
            }
        }

        if (this.fallbackNote) {
            this.fallbackNote.classList.toggle('hidden', crtAvailable);
        }

        if (this.presetIndicator) {
            if (state.crtPreset === 'auto') {
                const sysTarget = SYSTEM_CRT_PRESETS[system] || 'rgb';
                this.presetIndicator.textContent = `AUTO (${system.toUpperCase()} · ${CRT_PRESET_LABELS[sysTarget]})`;
            } else {
                this.presetIndicator.textContent = CRT_PRESET_LABELS[state.crtPreset] || 'CUSTOM';
            }
        }

        for (const btn of this.crtPresetButtons) {
            const isActive = btn.dataset.crtPreset === state.crtPreset;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
            btn.disabled = !crtAvailable;
        }

        for (const btn of this.crtEnumButtons) {
            const key = btn.dataset.crtKey;
            const currentVal = String(effectiveCrt[key]);
            const isActive = btn.dataset.crtValue === currentVal;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
            btn.disabled = !crtAvailable;
        }

        for (const entry of this.crtSliderEntries) {
            const { spec, field, input, readout } = entry;
            const val = effectiveCrt[spec.key];
            if (Math.abs(Number.parseFloat(input.value) - val) > 1e-6) {
                input.value = String(val);
            }
            const qualityBlocked = Boolean(spec.requiresHighQuality && effectiveCrt.quality !== 'high');
            const disabled = !crtAvailable || qualityBlocked;
            input.disabled = disabled;
            field.classList.toggle('is-disabled', disabled);
            readout.textContent = (crtAvailable && qualityBlocked) ? 'HIGH ONLY' : spec.format(val);
        }

        for (const btn of this.oscEnumButtons) {
            const key = btn.dataset.oscKey;
            const isActive = btn.dataset.oscValue === String(effectiveOsc[key]);
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
        }

        for (const entry of this.oscSliderEntries) {
            const { spec, input, readout } = entry;
            const val = effectiveOsc[spec.key];
            if (Math.abs(Number.parseFloat(input.value) - val) > 1e-6) {
                input.value = String(val);
            }
            readout.textContent = spec.format(val);
        }
    }

    dispose() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        window.removeEventListener('resize', this.handleWindowResize);
        this.layoutObserver?.disconnect();
        this.close({ restoreFocus: false });
    }
}