// === js/visuals/dse/universal/void-element.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: UNIVERSAL VOID PLACEHOLDER
// Acts as a transparent, zero-CPU placeholder for any layer.
// Used to clear specific layers (background, floor, foreground).
// =========================================================

export class VoidElement {
    constructor() {}

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        // Absolut 0% CPU-Last. Das Element ist vollkommen transparent.
    }
}