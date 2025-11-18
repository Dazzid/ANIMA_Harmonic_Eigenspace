// ============================================================================
// CHORD MEMORY GRID - 8x8 Storage System
// ============================================================================
// Standalone p5.js visualization on the right side of screen
let gridSketch;
let gridToggleBtn;
let gridMuteBtn;
let selectedChordForStorage = null;
let gridMuted = false; // Grid mute state
// p5.js sketch in instance mode
const createGridSketch = (p) => {
    let chordGrid;
    p.setup = function () {
        // Create canvas for grid
        canvasWidth = 500;
        canvasHeight = 500;
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
        if (chordGrid && chordGrid.handleClick(p)) {
            return false; // Prevent default
        }
    };
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
            // Mute button dimensions and position (top-right corner of grid panel)
            this.muteButtonSize = 24;
            this.muteButtonX = this.x + this.totalWidth - this.muteButtonSize + 5;
            this.muteButtonY = this.y - 35;
            this.muteButtonHovered = false;
            // Storage: 8x8 array of chord objects
            this.storage = Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(null));
            // UI state
            this.hoveredCell = { row: -1, col: -1 };
            this.waitingForCell = false;
            // Colors
            this.emptyColor = [40, 40, 40];
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

            // Draw mute button at top-right corner
            this.drawMuteButton(p);
            
            // Draw grid cells
            for (let row = 0; row < this.gridSize; row++) {
                for (let col = 0; col < this.gridSize; col++) {
                    this.drawCell(p, row, col);
                }
            }
            // Draw instruction text when waiting for cell selection
            if (this.waitingForCell) {
                p.fill(255);
                p.textAlign(p.CENTER);
                p.textSize(10);
                p.text('Click a cell to store chord', this.x + this.totalWidth / 2, this.y + this.totalHeight + 15);
            }
            p.pop();
        }
        
        drawMuteButton(p) {
            // Check if mouse is over mute button
            const mouseDist = p.dist(p.mouseX, p.mouseY, this.muteButtonX + this.muteButtonSize / 2, this.muteButtonY + this.muteButtonSize / 2);
            this.muteButtonHovered = mouseDist < this.muteButtonSize / 2;
            
            // Button background
            if (gridMuted) {
                p.fill(255, 100, 50, this.muteButtonHovered ? 255 : 200);
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
        
        drawCell(p, row, col) {
            const x = this.x + col * (this.cellSize + this.cellPadding);
            const y = this.y + row * (this.cellSize + this.cellPadding);
            const isHovered = (this.hoveredCell.row === row && this.hoveredCell.col === col);
            const chord = this.storage[row][col];
            const isFilled = chord !== null;
            // Choose color
            let fillColor;
            if (this.clicked && isHovered) {
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
                
                // Display root note on top
                const rootHz = chord.root || 220.0;
                const rootNote = this.frequencyToNoteName(rootHz);
                p.textSize(11);
                p.text(rootNote, x + this.cellSize / 2, y + this.cellSize / 2 - 8);
                
                // Display chord quality below (chord name or node number)
                let quality;
                if (chord.chordName) {
                    quality = chord.chordName;
                } else if (chord.nodeNumber !== undefined && chord.nodeNumber !== null) {
                    quality = `#${chord.nodeNumber}`;
                } else {
                    quality = `${row},${col}`;
                }
                p.textSize(11);
                p.text(quality, x + this.cellSize / 2, y + this.cellSize / 2 + 8);
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
        
        handleClick(p) {
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
                timestamp: Date.now()
            };
            console.log(`Stored chord at [${row}][${col}] with doubling:`, this.storage[row][col]);
        }
        recallChord(row, col) {
            const chord = this.storage[row][col];
            if (!chord) return;
            console.log(`Recalling chord from [${row}][${col}]:`, chord);
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
                
            } catch (e) {
                console.warn('recallChord: failed to reproduce stored chord', e);
            }
        }
        prepareToStore(chordData) {
            selectedChordForStorage = chordData;
            this.waitingForCell = true;
            console.log('Ready to store chord. Click a grid cell.');
        }
        cancelStorage() {
            selectedChordForStorage = null;
            this.waitingForCell = false;
        }
        clearCell(row, col) {
            if (row >= 0 && row < this.gridSize && col >= 0 && col < this.gridSize) {
                this.storage[row][col] = null;
                console.log(`Cleared cell [${row}][${col}]`);
            }
        }
        clearAll() {
            for (let row = 0; row < this.gridSize; row++) {
                for (let col = 0; col < this.gridSize; col++) {
                    this.storage[row][col] = null;
                }
            }
            console.log('All cells cleared');
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
        z-index: 100;
        display: none;
        transition: right 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    `;
    document.body.appendChild(container);
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
            // If a chord was clicked previously, prepare it for storage now that the grid is visible.
            // This allows the workflow: click node -> open grid (toggle) -> click cell to store.
            setTimeout(() => {
                try {
                    if (gridSketch && gridSketch.getGrid && window.lastClickedChord) {
                        const grid = gridSketch.getGrid();
                        grid.prepareToStore(window.lastClickedChord);
                        // Clear the transient selection so it doesn't auto-apply again
                        window.lastClickedChord = null;
                    }
                } catch (e) {
                    console.warn('Failed to prepare last clicked chord for storage on grid open', e);
                }
            }, 120);
            gridToggleBtn.textContent = 'Hide Grid';
        } else {
            // Hide grid
            container.style.display = 'none';
            gridToggleBtn.textContent = 'Chord Grid';
        }
    });
    document.body.appendChild(gridToggleBtn);
    console.log('Grid toggle button created');
}

function setupGridMuteButton() {
    // Mute button is now drawn directly in the canvas - no HTML element needed
    console.log('Grid mute button (canvas-based) ready');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupGridContainer();
        setupGridToggleButton();
        setupGridMuteButton();
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
console.log('Chord Memory Grid module loaded');