// === js/visuals/dse/universal/void-floor.js ===
// =========================================================
// DEMO-SCENE-ELEMENT: VOID FLOOR (PLACEHOLDER)
// Strictly does nothing. Serves as a zero-CPU placeholder 
// for the floor layer to let background scenarios shine.
// =========================================================

export class VoidFloor {
    constructor() {}

    resize(width, height) {}

    render(ctx, width, height, t, state, stateTime, metrics) {
        // Absolut 0% CPU-Last. Das Element ist vollkommen transparent.
    }
}