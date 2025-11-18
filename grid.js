// ============================================================================
// CHORD MEMORY GRID - 8x8 Storage System
// ============================================================================
// Standalone p5.js visualization on the right side of screen
let gridSketch;
let gridToggleBtn;
let selectedChordForStorage = null;
// p5.js sketch in instance mode
const createGridSketch = (p) => {
    let chordGrid;
    p.setup = function () {
        // Create canvas for grid
        canvasWidth = 400;
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
            this.cellSize = 40; // 40x40 pixels
            this.cellPadding = 2; // Space between cells
            this.cornerRadius = 5; // Rounded corners
            this.visible = true; // Visible by default when grid is shown
            // Calculate total dimensions
            this.totalWidth = (this.cellSize + this.cellPadding) * this.gridSize;
            this.totalHeight = (this.cellSize + this.cellPadding) * this.gridSize;
            // Position within canvas (centered)
            this.x = (canvasWidth - this.totalWidth) / 2;
            this.y = 50; // Below title
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
            // Draw grid cells
            for (let row = 0; row < this.gridSize; row++) {
                for (let col = 0; col < this.gridSize; col++) {
                    this.drawCell(p, row, col);
                }
            }
            // Draw instruction text when waiting for cell selection
            if (this.waitingForCell) {
                p.fill(255, 183, 0);
                p.textAlign(p.CENTER);
                p.textSize(10);
                p.text('Click a cell to store chord', this.x + this.totalWidth / 2, this.y + this.totalHeight + 15);
            }
            p.pop();
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
                p.fill(this.textColor);
                p.textAlign(p.CENTER, p.CENTER);
                p.textSize(10);
                p.textFont('Source Code Pro');
                // Display chord name if available, otherwise node number or coordinates
                let label;
                if (chord.chordName) {
                    label = chord.chordName;
                } else if (chord.nodeNumber !== undefined && chord.nodeNumber !== null) {
                    label = `#${chord.nodeNumber}`;
                } else {
                    label = `${row},${col}`;
                }
                p.text(label, x + this.cellSize / 2, y + this.cellSize / 2);
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
        handleClick(p) {
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
                timestamp: Date.now()
            };
            console.log(`Stored chord at [${row}][${col}]:`, this.storage[row][col]);
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
                // Update keyboard mapping with the stored (original) frequencies
                if (typeof window.updateKeyboardMapping === 'function') {
                    window.updateKeyboardMapping(chord.frequencies);
                }
                // Play the chord using the existing playChord function (uses ratios + baseFreq)
                if (typeof playChord === 'function') {
                    playChord(chord.alpha, chord.beta, chord.gamma, chord.root);
                } else if (typeof window.playChord === 'function') {
                    window.playChord(chord.alpha, chord.beta, chord.gamma, chord.root);
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
// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupGridContainer();
        setupGridToggleButton();
    });
} else {
    setupGridContainer();
    setupGridToggleButton();
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