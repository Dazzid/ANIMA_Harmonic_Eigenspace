// ============================================================================
// CHORD MEMORY GRID - 8x8 Storage System
// ============================================================================
// © 2025 David Dalmazzo.All Rights Reserved.

// This code and associated research materials are proprietary and confidential.This work is part of the ANIMA MSCA Postdoctoral Fellowship(Project ID: 101203318) funded by the European Union's Horizon Europe program.
// Usage Terms:

// Academic Citation: Permitted with proper attribution to the author and project
// Non - Commercial Research: Contact for collaboration inquiries
// Commercial Use: Strictly prohibited without explicit written permission
// Code Distribution: Not permitted without authorization
// Unauthorized copying, distribution, modification, or commercial use of this software, algorithms, or associated methods is strictly prohibited.

// Attribution

// When referencing this work in academic publications, please cite:

// Dalmazzo, D. (2025).ANIMA Harmonic Eigenspace: 4D Psychoacoustic
// Dissonance Visualization for Microtonal Harmony.MSCA Project 101203318.
// ============================================================================
// Standalone p5.js visualization on the right side of screen
let gridSketch;
let gridToggleBtn;
let gridMuteBtn;
let selectedChordForStorage = null;
let gridMuted = false; // Grid mute state
// Panel drag state (dragging the Chord Memory by its header — see setupGridDrag)
let gridDragging = false;
let gridDragOffset = { x: 0, y: 0 };
// p5.js sketch in instance mode
const createGridSketch = (p) => {
    let chordGrid;
    // Gated by the active scene (see EigenspaceScene.activateComponents). This p5
    // instance's mousePressed fires on any window press, so without this gate the
    // chord-memory cells stay clickable while another scene is shown on top.
    let eventsEnabled = true;
    p.setup = function () {
        // Create canvas for grid
        canvasWidth = 500;
        canvasHeight = 520;
        const canvas = p.createCanvas(canvasWidth, canvasHeight);
        canvas.parent('grid-container');
        // Initialize grid
        chordGrid = new ChordMemoryGrid(p);
        console.log('Grid sketch initialized');
    };
    p.draw = function () {
        p.clear(); // Transparent background
        if (chordGrid) {
            chordGrid.updateHover(p);
            chordGrid.draw(p);
        }
    };
    p.mousePressed = function () {
        if (!eventsEnabled) return;
        if (chordGrid && chordGrid.handleClick(p)) {
            return false; // Prevent default
        }
    };
    // Scene gating hooks (mirrors colorbar-slider.js) — called by EigenspaceScene.
    p.enableEvents = function () { eventsEnabled = true; };
    p.disableEvents = function () { eventsEnabled = false; };
    // ChordMemoryGrid class
    class ChordMemoryGrid {
        constructor(p5Instance) {
            this.p = p5Instance;
            this.gridSize = 8; // 8x8 grid
            this.cellSize = 50; // 50x50 pixels
            this.cellPadding = 2; // Space between cells
            this.cornerRadius = 5; // Rounded corners
            this.visible = true; // Visible by default when grid is shown
            // Calculate total dimensions
            this.totalWidth = (this.cellSize + this.cellPadding) * this.gridSize;
            this.totalHeight = (this.cellSize + this.cellPadding) * this.gridSize;
            // Position within canvas (centered)
            this.x = (canvasWidth - this.totalWidth) / 2;
            this.y = 50; // Below title
            // Top-right control buttons (close + mute). Close sits in the corner;
            // mute sits immediately to its left.
            this.buttonSize = 24;
            this.buttonGap = 6;
            this.closeButtonSize = this.buttonSize;
            this.closeButtonX = this.x + this.totalWidth - this.closeButtonSize + 5;
            this.closeButtonY = this.y - 35;
            this.closeButtonHovered = false;
            this.muteButtonSize = this.buttonSize;
            this.muteButtonX = this.closeButtonX - this.buttonGap - this.muteButtonSize;
            this.muteButtonY = this.y - 35;
            this.muteButtonHovered = false;
            // Storage: 8x8 array of chord objects
            this.storage = Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(null));
            // UI state
            this.hoveredCell = { row: -1, col: -1 };
            this.waitingForCell = false;
            // Cell currently held down via Launchpad pad. drawCell() treats it
            // exactly like the user is clicking with the mouse.
            this._lpPressed = null;
            // Colors
            this.emptyColor = [50, 50, 50];
            this.filledColor = [0, 111, 229];
            this.hoverColor = [0, 150, 255];
            this.waitingColor = [255, 183, 0];
            this.textColor = [255, 255, 255];
            this.isClicked = [255, 160, 0];
            this.clicked = false;
            console.log('ChordMemoryGrid initialized');
        }
        draw(p) {
            p.push();
            // Draw background panel
            p.fill(20, 20, 20, 200);
            p.noStroke();
            p.rect(this.x - 10, this.y - 40, this.totalWidth + 20, this.totalHeight + 50, 10);
            // Draw title
            p.fill(255);
            p.textAlign(p.CENTER);
            p.textSize(14);
            p.textFont('Source Code Pro');
            p.text('Chord Memory', this.x + this.totalWidth / 2, this.y - 20);

            // Draw close + mute buttons at top-right corner
            this.drawMuteButton(p);
            this.drawCloseButton(p);

            // Draw grid cells
            for (let row = 0; row < this.gridSize; row++) {
                for (let col = 0; col < this.gridSize; col++) {
                    this.drawCell(p, row, col);
                }
            }
            // Draw instruction text when waiting for cell selection
            p.fill(255);
            p.textAlign(p.CENTER);
            p.textSize(11);
            p.message = "";
            if (this.waitingForCell) {
                p.message = 'Click a cell to store chord';
            } else {
                p.message = 'Clean a cell with shift + click';
            }
            p.text(p.message, this.x + this.totalWidth / 2, this.y + this.totalHeight + 20);
            p.pop();

            // Cursor affordance: show a move cursor over the draggable header.
            p.cursor(this.isTitleBarHit(p.mouseX, p.mouseY) ? 'move' : p.ARROW);
        }

        drawMuteButton(p) {
            // Check if mouse is over mute button
            const mouseDist = p.dist(p.mouseX, p.mouseY, this.muteButtonX + this.muteButtonSize / 2, this.muteButtonY + this.muteButtonSize / 2);
            this.muteButtonHovered = mouseDist < this.muteButtonSize / 2;
            
            // Button background
            if (gridMuted) {
                p.fill(0, 0, 50, this.muteButtonHovered ? 255 : 200);
            } else {
                p.fill(50, 50, 50, this.muteButtonHovered ? 220 : 180);
            }
            p.stroke(255, 255, 255, this.muteButtonHovered ? 100 : 20);
            p.strokeWeight(1);
            p.rect(this.muteButtonX, this.muteButtonY, this.muteButtonSize, this.muteButtonSize, 4);
            
            // Speaker icon
            p.fill(255);
            p.noStroke();
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(12);
            p.text(gridMuted ? '🔇' : '🔊', this.muteButtonX + this.muteButtonSize / 2, this.muteButtonY + this.muteButtonSize / 2);
        }

        drawCloseButton(p) {
            const cx = this.closeButtonX + this.closeButtonSize / 2;
            const cy = this.closeButtonY + this.closeButtonSize / 2;

            // Hover hit-test (circular, matching the mute button)
            const mouseDist = p.dist(p.mouseX, p.mouseY, cx, cy);
            this.closeButtonHovered = mouseDist < this.closeButtonSize / 2;

            // Button background — reddish on hover so it reads as "close"
            if (this.closeButtonHovered) {
                p.fill(229, 57, 53, 230);
            } else {
                p.fill(50, 50, 50, 180);
            }
            p.stroke(255, 255, 255, this.closeButtonHovered ? 100 : 20);
            p.strokeWeight(1);
            p.rect(this.closeButtonX, this.closeButtonY, this.closeButtonSize, this.closeButtonSize, 4);

            // X glyph (drawn with lines — crisper than a text character)
            const r = 5;
            p.stroke(255);
            p.strokeWeight(2);
            p.line(cx - r, cy - r, cx + r, cy + r);
            p.line(cx - r, cy + r, cx + r, cy - r);
        }

        drawCell(p, row, col) {
            const x = this.x + col * (this.cellSize + this.cellPadding);
            const y = this.y + row * (this.cellSize + this.cellPadding);
            const isHovered = (this.hoveredCell.row === row && this.hoveredCell.col === col);
            const isLPPressed = !!(this._lpPressed && this._lpPressed.row === row && this._lpPressed.col === col);
            const chord = this.storage[row][col];
            const isFilled = chord !== null;
            // Choose color
            let fillColor;
            if ((this.clicked && isHovered) || isLPPressed) {
                fillColor = this.isClicked;
            } else if (this.waitingForCell && isHovered) {
                fillColor = this.waitingColor;
            } else if (isHovered) {
                fillColor = this.hoverColor;
            } else if (isFilled && chord.cellColor) {
                // Use stored chord color
                fillColor = chord.cellColor;
            } else if (isFilled) {
                fillColor = this.filledColor;
            } else {
                fillColor = this.emptyColor;
            }
            // Draw cell background
            p.fill(fillColor);
            p.noStroke();
            p.rect(x, y, this.cellSize, this.cellSize, this.cornerRadius);
            // Draw chord label if filled
            if (isFilled) {
                // Calculate brightness and choose text color for contrast
                let textColor = this.textColor; // Default white
                if (Array.isArray(fillColor) && fillColor.length >= 3) {
                    // Calculate relative luminance (perceived brightness)
                    const r = fillColor[0] / 255;
                    const g = fillColor[1] / 255;
                    const b = fillColor[2] / 255;
                    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                    // Use black text for bright backgrounds, white for dark
                    textColor = brightness > 0.5 ? [0, 0, 0] : [255, 255, 255];
                }
                
                p.fill(textColor);
                p.textAlign(p.CENTER, p.CENTER);
                p.textFont('Source Code Pro');
                
                // Display root note on top. Prefer the real 53-TET name (resolver
                // loaded by eigenspace.js); fall back to the 12-TET approximation.
                const rootHz = chord.root || 220.0;
                const rootNote = (typeof window.freqToNoteName53 === 'function' && window.freqToNoteName53(rootHz))
                    || this.frequencyToNoteName(rootHz);
                p.textSize(11);
                p.text(rootNote, x + this.cellSize / 2, y + this.cellSize / 2 - 8);
                
                // Display chord quality below (chord name or node number)
                // No chord name → show nothing on the quality line (e.g. a single
                // note has no chord quality). Only the root note shows on top.
                let quality;
                if (chord.chordName) {
                    quality = chord.chordName;
                } else if (chord.nodeNumber !== undefined && chord.nodeNumber !== null) {
                    quality = `#${chord.nodeNumber}`;
                } else {
                    quality = '';
                }
                p.textSize(11);
                if (quality) p.text(quality, x + this.cellSize / 2, y + this.cellSize / 2 + 8);
            }
            // Draw border on hover
            if (isHovered) {
                p.stroke(255, 255, 255, 150);
                p.strokeWeight(1);
                p.noFill();
                p.rect(x, y, this.cellSize, this.cellSize, this.cornerRadius);
            }
        }
        updateHover(p) {
            // Check if mouse is over grid area
            if (p.mouseX >= this.x && p.mouseX <= this.x + this.totalWidth &&
                p.mouseY >= this.y && p.mouseY <= this.y + this.totalHeight) {
                const col = Math.floor((p.mouseX - this.x) / (this.cellSize + this.cellPadding));
                const row = Math.floor((p.mouseY - this.y) / (this.cellSize + this.cellPadding));
                if (mouseIsPressed) {
                    this.clicked = true;
                } else {
                    this.clicked = false;
                }
                if (row >= 0 && row < this.gridSize && col >= 0 && col < this.gridSize) {
                    this.hoveredCell = { row, col };
                } else {
                    this.hoveredCell = { row: -1, col: -1 };
                }
            } else {
                this.hoveredCell = { row: -1, col: -1 };
            }
        }
        
        frequencyToNoteName(frequency) {
            // Convert frequency to note name using equal temperament
            // A4 = 440 Hz is the reference
            const A4 = 440.0;
            const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            
            // Calculate semitones from A4
            const semitones = 12 * Math.log2(frequency / A4);
            const noteIndex = Math.round(semitones) + 9; // +9 because A is the 10th note (index 9)
            const octave = Math.floor(noteIndex / 12) + 4;
            const note = noteNames[((noteIndex % 12) + 12) % 12];
            
            return `${note}${octave}`;
        }
        
        // Hit-test the draggable header strip (where the "Chord Memory" title
        // sits, above the cells). Coords are canvas-local = container-local since
        // the canvas fills the container. The close + mute buttons live in this
        // strip, so they are excluded to stay clickable. Used by the panel-drag
        // listeners in setupGridDrag().
        isTitleBarHit(mx, my) {
            const inHeaderY = my >= (this.y - 40) && my <= (this.y - 2);
            const inHeaderX = mx >= (this.x - 10) && mx <= (this.x + this.totalWidth + 10);
            if (!inHeaderY || !inHeaderX) return false;
            const pad = 3;
            const overClose = mx >= this.closeButtonX - pad && mx <= this.closeButtonX + this.closeButtonSize + pad &&
                              my >= this.closeButtonY - pad && my <= this.closeButtonY + this.closeButtonSize + pad;
            const overMute = mx >= this.muteButtonX - pad && mx <= this.muteButtonX + this.muteButtonSize + pad &&
                             my >= this.muteButtonY - pad && my <= this.muteButtonY + this.muteButtonSize + pad;
            return !(overClose || overMute);
        }
        handleClick(p) {
            // Check if close button was clicked
            if (this.closeButtonHovered) {
                hideChordGrid();
                return true;
            }

            // Check if mute button was clicked
            if (this.muteButtonHovered) {
                gridMuted = !gridMuted;
                console.log(`Grid mute: ${gridMuted}`);
                return true;
            }
            
            if (this.hoveredCell.row === -1 || this.hoveredCell.col === -1) return false;
            const row = this.hoveredCell.row;
            const col = this.hoveredCell.col;
            // Check if Shift key is pressed
            const isShiftPressed = p.keyIsDown(p.SHIFT);
            // Case 1: Shift+Click to clear cell
            if (isShiftPressed) {
                const chord = this.storage[row][col];
                if (chord) {
                    this.clearCell(row, col);
                    console.log(`Cell [${row}][${col}] cleared`);
                    return true;
                }
                return false;
            }
            // Case 2: Recalling existing chord (takes priority over storage)
            const chord = this.storage[row][col];
            if (chord) {
                this.recallChord(row, col);
                console.log(`Chord recalled from [${row}][${col}]`);
                return true;
            }
            // Case 3: Storing a new chord (only in empty cells)
            if (this.waitingForCell && selectedChordForStorage) {
                this.storeChord(row, col, selectedChordForStorage);
                // Clear selection but keep lastClickedChord so x2 buttons can still update it
                this.waitingForCell = false;
                selectedChordForStorage = null;
                console.log(`Chord stored at [${row}][${col}]`);
                return true;
            }
            return false;
        }
        storeChord(row, col, chordData) {
            console.log('storeChord called with chordData:', chordData);
            
            // Capture current doubling flags (x2 buttons state)
            const doublingFlags = typeof window.getDoublingFlags === 'function' ?
                window.getDoublingFlags() : { R: false, α: false, β: false, γ: false };
            
            this.storage[row][col] = {
                root: chordData.root,
                alpha: chordData.alpha,
                beta: chordData.beta,
                gamma: chordData.gamma,
                frequencies: [...chordData.frequencies],
                nodeNumber: chordData.nodeNumber,
                chordName: chordData.chordName || null,
                cellColor: chordData.cellColor || null,
                tetSystem: chordData.tetSystem || null,
                doublingFlags: { ...doublingFlags },
                // Which scene this chord was captured from. Recall plays it through
                // the ACTIVE scene's synth regardless; this is for provenance and
                // future scene-specific reconstruction.
                sourceScene: (chordData.sourceScene !== undefined && chordData.sourceScene !== null)
                    ? chordData.sourceScene
                    : (typeof currentScene !== 'undefined' ? currentScene : null),
                timestamp: Date.now()
            };
            console.log(`Stored chord at [${row}][${col}] with doubling:`, this.storage[row][col]);
            if (window.launchpadHandler) window.launchpadHandler.refreshLeds();
        }
        recallChord(row, col) {
            const chord = this.storage[row][col];
            if (!chord) return;
            if (window.launchpadHandler) window.launchpadHandler.refreshLeds();
            console.log(`Recalling chord from [${row}][${col}]:`, chord);

            // Scene-aware recall. Chord Memory is app-wide, but EigenSpace is the
            // only scene that can reconstruct the full visualization (it needs the
            // alpha/beta/gamma ratios). In any other scene — or for a chord that
            // lacks EigenSpace ratios — we just play the stored absolute
            // frequencies through the active scene's synth ("play here, stay put").
            const activeScene = (window.ANIMA && typeof window.ANIMA.getCurrentScene === 'function')
                ? window.ANIMA.getCurrentScene()
                : (typeof currentScene !== 'undefined' ? currentScene : null);
            const eigenScene = (window.ANIMA && window.ANIMA.Scenes)
                ? window.ANIMA.Scenes.EIGENSPACE : 0;
            const canReconstructEigen = (activeScene === eigenScene) && (chord.alpha != null);

            if (!canReconstructEigen) {
                // Generic path: audition the frequencies in the current scene.
                if (typeof window.playChordFrequencies === 'function') {
                    window.playChordFrequencies(chord.frequencies);
                }
                // Make this the working chord so it can be re-stored / transformed.
                window.lastClickedChord = {
                    root: chord.root,
                    frequencies: Array.isArray(chord.frequencies) ? [...chord.frequencies] : [],
                    chordName: chord.chordName ?? null,
                    cellColor: chord.cellColor ?? null,
                    sourceScene: chord.sourceScene ?? null
                };
                return;
            }

            // Reproduce the chord using existing project APIs (visualization + audio + mappings)
            try {
                // Update visualization root and chord ratios
                if (typeof setRootVisualization === 'function') {
                    setRootVisualization(chord.root);
                }
                if (typeof setChordVisualization === 'function') {
                    setChordVisualization(chord.alpha, chord.beta, chord.gamma, chord.root);
                }
                
                // Restore doubling flags (x2 button states) if stored
                if (chord.doublingFlags && typeof window.setDoublingFlags === 'function') {
                    window.setDoublingFlags(chord.doublingFlags);
                    console.log('Restored doubling flags:', chord.doublingFlags);
                }
                
                // CRITICAL: ALWAYS play the chord to trigger keyboard remapping
                // The playChord function handles the keyboard mapping internally
                // We control audio separately via mute flag
                const originalMuteState = window.audioMuted || false;
                
                if (gridMuted) {
                    // Temporarily mute audio system while still calling playChord
                    // This ensures keyboard remapping happens without sound
                    window.audioMuted = true;
                    console.log('Grid muted - remapping keyboard without audio');
                }
                
                // Call playChord which handles keyboard remapping
                if (typeof playChord === 'function') {
                    playChord(chord.alpha, chord.beta, chord.gamma, chord.root);
                } else if (typeof window.playChord === 'function') {
                    window.playChord(chord.alpha, chord.beta, chord.gamma, chord.root);
                }

                // Restore original audio mute state
                if (gridMuted) {
                    window.audioMuted = originalMuteState;
                }

                // Declare this stored chord as the new reference for x2 transforms.
                // Without this, currentBaseFreq + lastClickedChord still point at the
                // last Eigenspace click and x2 would transform that chord instead.
                if (typeof currentBaseFreq !== 'undefined') {
                    currentBaseFreq = chord.root;
                }
                window.lastClickedChord = {
                    root: chord.root,
                    alpha: chord.alpha,
                    beta: chord.beta,
                    gamma: chord.gamma,
                    frequencies: Array.isArray(chord.frequencies) ? [...chord.frequencies] : [
                        chord.root,
                        chord.root * chord.alpha,
                        chord.root * chord.beta,
                        chord.root * chord.gamma
                    ],
                    nodeNumber: chord.nodeNumber ?? null,
                    chordName: chord.chordName ?? null,
                    cellColor: chord.cellColor ?? null,
                    tetSystem: chord.tetSystem ?? null
                };

            } catch (e) {
                console.warn('recallChord: failed to reproduce stored chord', e);
            }
        }
        prepareToStore(chordData) {
            selectedChordForStorage = chordData;
            this.waitingForCell = true;
            console.log('Ready to store chord. Click a grid cell.');
        }
        updateSelectedChord(chordData) {
            // Enable waiting mode and update the chord for storage
            selectedChordForStorage = chordData;
            this.waitingForCell = true;
            console.log('Updated chord for storage with new x2 settings - ready to store');
        }
        cancelStorage() {
            selectedChordForStorage = null;
            this.waitingForCell = false;
        }
        clearCell(row, col) {
            if (row >= 0 && row < this.gridSize && col >= 0 && col < this.gridSize) {
                this.storage[row][col] = null;
                console.log(`Cleared cell [${row}][${col}]`);
                if (window.launchpadHandler) window.launchpadHandler.refreshLeds();
            }
        }
        clearAll() {
            for (let row = 0; row < this.gridSize; row++) {
                for (let col = 0; col < this.gridSize; col++) {
                    this.storage[row][col] = null;
                }
            }
            console.log('All cells cleared');
            if (window.launchpadHandler) window.launchpadHandler.refreshLeds();
        }
        setLPPress(row, col) {
            this._lpPressed = { row, col };
        }
        clearLPPress(row, col) {
            if (this._lpPressed && this._lpPressed.row === row && this._lpPressed.col === col) {
                this._lpPressed = null;
            }
        }

        // RGB (0-255) of the cell's underlying color. The Launchpad handler
        // overlays its own press highlight on top.
        getCellRGB(row, col) {
            if (row < 0 || row >= this.gridSize || col < 0 || col >= this.gridSize) {
                return [0, 0, 0];
            }
            const chord = this.storage[row][col];
            if (chord) {
                if (chord.cellColor) return chord.cellColor;      // node color from visualization
                return this.filledColor;                          // default blue
            }
            return this.emptyColor;
        }
        exportData() {
            return {
                gridSize: this.gridSize,
                storage: this.storage.map(row => row.map(cell => cell ? { ...cell } : null))
            };
        }
        importData(data) {
            if (data.gridSize === this.gridSize) {
                this.storage = data.storage.map(row => row.map(cell => cell ? { ...cell } : null));
                console.log('Grid data imported');
            } else {
                console.error('Grid size mismatch');
            }
        }
    }
    // Store reference to grid for external access
    p.getGrid = function () {
        return chordGrid;
    };
};
// ============================================================================
// UI SETUP
// ============================================================================
function setupGridContainer() {
    // Create container div for grid canvas
    const container = document.createElement('div');
    container.id = 'grid-container';
    container.style.cssText = `
        position: fixed;
        top: 50%;
        right: 220px;
        transform: translateY(-50%);
        /* Above Modal Studio's surface (#modalstudio-app z-index:1000) so the
           panel floats in every scene, but below the menu (~10048) so the menu
           stays clickable. The grid is an app-wide overlay, not scene-scoped. */
        z-index: 9000;
        display: none;
        transition: right 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    `;
    document.body.appendChild(container);
    // Eagerly create the sketch so external surfaces (Launchpad) can query
    // storage/state before the user has opened the panel.
    if (!gridSketch) {
        gridSketch = new p5(createGridSketch, 'grid-container');
        // Panel starts hidden: pause the draw loop and ignore mouse events until
        // it is shown. Lifecycle is governed by panel visibility (scene-independent).
        if (typeof gridSketch.noLoop === 'function') gridSketch.noLoop();
        if (typeof gridSketch.disableEvents === 'function') gridSketch.disableEvents();
    }
    console.log('Grid container created');
}
function setupGridToggleButton() {
    gridToggleBtn = document.createElement('button');
    gridToggleBtn.id = 'grid-toggle';
    gridToggleBtn.textContent = 'Chord Grid';
    gridToggleBtn.addEventListener('click', () => {
        const container = document.getElementById('grid-container');
        if (container.style.display === 'none') {
            // Show grid
            container.style.display = 'block';
            
            // Initialize p5 sketch if not already done
            if (!gridSketch) {
                gridSketch = new p5(createGridSketch, 'grid-container');
            }
            // Resume the draw loop + accept mouse events now that the panel is shown.
            if (typeof gridSketch.loop === 'function') gridSketch.loop();
            if (typeof gridSketch.enableEvents === 'function') gridSketch.enableEvents();
            // If a chord was clicked previously, prepare it for storage now that the grid is visible.
            // This allows the workflow: click node -> open grid (toggle) -> x2 adjustments -> click cell to store.
            setTimeout(() => {
                try {
                    if (gridSketch && gridSketch.getGrid && window.lastClickedChord) {
                        const grid = gridSketch.getGrid();
                        grid.prepareToStore(window.lastClickedChord);
                        // DON'T clear lastClickedChord - allow x2 buttons to update it
                    }
                } catch (e) {
                    console.warn('Failed to prepare last clicked chord for storage on grid open', e);
                }
            }, 120);
            gridToggleBtn.textContent = 'Hide Grid';
        } else {
            // Hide grid
            hideChordGrid();
        }
    });
    document.body.appendChild(gridToggleBtn);
    console.log('Grid toggle button created');
}

// Hide the Chord Memory grid. Shared by the toggle button's hide branch and the
// in-canvas close (X) button so the toggle label — which the menu reads to show
// the "Memory: Chord Grid" active state — always stays in sync.
function hideChordGrid() {
    const container = document.getElementById('grid-container');
    if (container) container.style.display = 'none';
    if (gridToggleBtn) gridToggleBtn.textContent = 'Chord Grid';
    // Pause the draw loop + ignore mouse events while hidden (scene-independent).
    if (gridSketch) {
        if (typeof gridSketch.noLoop === 'function') gridSketch.noLoop();
        if (typeof gridSketch.disableEvents === 'function') gridSketch.disableEvents();
    }
}

// Toggle the Chord Memory grid. Delegates to the toggle button so the full
// show/hide logic (p5 init, prepare-last-chord, label sync) runs in one place.
// Exposed for the Shift+M shortcut (key_map.js) and any other caller.
window.toggleChordGrid = function () {
    if (gridToggleBtn) gridToggleBtn.click();
};

function setupGridMuteButton() {
    // Mute button is now drawn directly in the canvas - no HTML element needed
    console.log('Grid mute button (canvas-based) ready');
}

// Make the Chord Memory panel draggable by its header — mirrors the Scale
// Editor's title-bar drag, but moves the fixed #grid-container div (the panel is
// its own p5 instance, not part of the main canvas). Position is clamped to the
// viewport so the panel can't be dragged off-screen.
function setupGridDrag() {
    const getContainer = () => document.getElementById('grid-container');

    document.addEventListener('mousedown', (e) => {
        const container = getContainer();
        if (!container || container.style.display === 'none') return;
        if (!gridSketch || !gridSketch.getGrid) return;
        const rect = container.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) return;
        const grid = gridSketch.getGrid();
        if (!grid || typeof grid.isTitleBarHit !== 'function' || !grid.isTitleBarHit(localX, localY)) return;

        // Begin dragging. Switch the CSS-centered panel to explicit left/top so we
        // can move it freely (drop the right/transform centering used at rest).
        gridDragging = true;
        container.style.left = rect.left + 'px';
        container.style.top = rect.top + 'px';
        container.style.right = 'auto';
        container.style.transform = 'none';
        gridDragOffset.x = localX;
        gridDragOffset.y = localY;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!gridDragging) return;
        const container = getContainer();
        if (!container) return;
        const w = container.offsetWidth;
        const h = container.offsetHeight;
        let left = e.clientX - gridDragOffset.x;
        let top = e.clientY - gridDragOffset.y;
        // Clamp within the viewport so the panel never overpasses the canvas limits.
        left = Math.max(0, Math.min(left, window.innerWidth - w));
        top = Math.max(0, Math.min(top, window.innerHeight - h));
        container.style.left = left + 'px';
        container.style.top = top + 'px';
        e.preventDefault();
    });

    document.addEventListener('mouseup', () => { gridDragging = false; });

    console.log('Grid drag (header) ready');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupGridContainer();
        setupGridToggleButton();
        setupGridMuteButton();
        setupGridDrag();
    });
} else {
    setupGridContainer();
    setupGridToggleButton();
    setupGridMuteButton();
}
// ============================================================================
// GLOBAL API
// ============================================================================
window.prepareChordForStorage = function (nodeData) {
    // Show grid if hidden
    const container = document.getElementById('grid-container');
    if (container.style.display === 'none') {
        container.style.display = 'block';
        if (!gridSketch) {
            gridSketch = new p5(createGridSketch, 'grid-container');
        }
        if (typeof gridSketch.loop === 'function') gridSketch.loop();
        if (typeof gridSketch.enableEvents === 'function') gridSketch.enableEvents();
        gridToggleBtn.textContent = 'Hide Grid';
    }
    // Wait for sketch to initialize
    setTimeout(() => {
        if (gridSketch && gridSketch.getGrid) {
            const grid = gridSketch.getGrid();
            grid.prepareToStore({
                root: nodeData.root || 220.0,
                alpha: nodeData.alpha,
                beta: nodeData.beta,
                gamma: nodeData.gamma,
                frequencies: nodeData.frequencies || [
                    nodeData.root || 220.0,
                    (nodeData.root || 220.0) * nodeData.alpha,
                    (nodeData.root || 220.0) * nodeData.beta,
                    (nodeData.root || 220.0) * nodeData.gamma
                ],
                nodeNumber: nodeData.nodeNumber,
                chordName: nodeData.chordName || null,
                cellColor: nodeData.cellColor || null,
                tetSystem: nodeData.tetSystem || null
            });
        }
    }, 100);
};
window.playStoredChord = function (row, col) {
    if (gridSketch && gridSketch.getGrid) {
        const grid = gridSketch.getGrid();
        const chord = grid.storage[row][col];
        if (chord) {
            grid.recallChord(row, col);
        }
    }
};
// Cancel pending storage (if user wants to abort before clicking a cell)
window.cancelChordStorage = function () {
    if (gridSketch && gridSketch.getGrid) {
        const grid = gridSketch.getGrid();
        if (typeof grid.cancelStorage === 'function') {
            grid.cancelStorage();
            console.log('Chord storage canceled');
        }
    }
};
// Update the selected chord when x2 buttons are clicked
window.updateGridSelectedChord = function (chordData) {
    if (gridSketch && gridSketch.getGrid) {
        const grid = gridSketch.getGrid();
        if (typeof grid.updateSelectedChord === 'function') {
            grid.updateSelectedChord(chordData);
        }
    }
    // Also update lastClickedChord for consistency
    window.lastClickedChord = chordData;
};

console.log('Chord Memory Grid module loaded');