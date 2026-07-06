# 📦 Chiptunes Fantasy - Release Workflow

This document outlines the standard operating procedure (SOP) for preparing and publishing a new release (or beta milestone) for the Chiptunes Fantasy repository on GitHub.

## 1. Version Bumping
Before committing the final release branch, update the user-facing version numbers:
*   **Boot Screen:** Open `index.html` and update the `<p class="boot-header">` (e.g., `**** CHIPTUNES FANTASY V1.2.0-BETA.2 ****`).
*   *(Optional but recommended)* Update the version tag in the `README.md` header.

## 2. Update Documentation
Ensure the `README.md` accurately reflects the current state of the architecture:
*   Add short summaries for new visual Demo-Scene-Elements (DSEs).
*   Document any fundamental changes to the AudioWorklet DSP pipelines (e.g., Anti-Aliasing upgrades, Filter routing).
*   Keep the core hardware factsheets condensed and punchy.

## 3. GitHub Pull Request (PR) Format
When merging the `dev` branch into `main`, format the PR description to provide a clear technical audit trail.
*   **Title:** `feat: vX.X.X Release Title`
*   **Description Blocks:**
    *   **🏗️ Architectural Changes:** Changes to the `SceneDJ`, Registry, or State Machine.
    *   **✨ New Features & Visuals:** New DSEs, UI tweaks, or CSS styling.
    *   **🐛 Audio & DSP Fixes:** Worklet optimizations, memory-leak patches, or playback logic fixes.

## 4. GitHub Release Notes
Create a new Tag (e.g., `v1.2.0-beta.2`) and draft the release notes. These should be end-user friendly but retain the signature "nerdy" charm of the project.
*   **Highlights:** Bullet points of what the user can *see* and *hear*.
*   **Under the Hood:** Explanations of DSP magic, zero-allocation optimizations, and API usage (e.g., Screen Wake Lock).
*   **How to test:** A quick tip on which track showcases the new features best.

## 5. Final Commit
Always use the conventional commit format for the release trigger:
`chore(release): prepare vX.X.X release documentation and bump version`