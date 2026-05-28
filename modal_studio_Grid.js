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

// Grid.js - Direct port from C++ Grid.cpp (770 lines)
// Created by David Dalmazzo on 6/11/24
// Ported to JavaScript for web implementation

// Cell class - represents a single grid cell containing a chord
class Cell {
    constructor(positionName, chord, colorCode) {
        this.positionName = positionName || "";
        this.chord = chord || new Chord();
        this.colorCode = colorCode || [240, 240, 240];
    }
}

// Grid class - 8x8 grid of chords with modal interchange functionality
class Grid {
    constructor() {
        // C++ Grid.hpp lines 124-145 - Member variables
        this.rows = 8;
        this.cols = 8;
        this.cellWidth = 120;
        this.cellHeight = 50;
        this.cellSpacingX = 5;
        this.cellSpacingY = 5;
        this.round = 10;
        
        // Grid state
        this.cells = [];
        this.globalPosition = { x: 0, y: 0 };
        this.theScale = [];
        this.noteNames = [];
        this.scale = [];
        this.scaleSize = 36;
        
        // Selection state
        this.selectedCellRow = -1;
        this.selectedCellCol = -1;
        
        // Chord progression (top row)
        this.chordProgression = [];
        
        // Modes for modal interchange
        this.modes = [];
        this.parentModes = [];
        
        // Colors
        this.darkMode = false;
        this.lightTextColor = [255, 255, 255];
        this.darkTextColor = [10, 10, 10];
        this.textColor = this.darkTextColor;
        this.cellColor = [240, 240, 240];
        
        // Callbacks
        this.onChordSelected = null;
        
        // Mode substitution tracking (C++ Grid.hpp lines 141-153)
        this.rowModeInfos = [];
        
        // Label drawing settings
        this.labelXOffset = 0;
        this.startY = 270; // Will be updated in setup

        // Cell currently held down via Launchpad pad. Used by draw() to force
        // the chord's mouseClicked / mouseHoverCheck flags so the LP press
        // renders identically to a mouse click.
        this._lpPressed = null;
        
        // Initialize cells (C++ Grid.cpp lines 11-22) - Total 64 cells
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const positionName = `(${row},${col})`;
                const myChord = new Chord();
                // Set chord position and size
                myChord.pos = { x: 0, y: 0 };
                myChord.size = { x: this.cellWidth, y: this.cellHeight };
                myChord.rounded = this.round;
                this.cells.push(new Cell(positionName, myChord, this.cellColor));
            }
        }
        
        // Verify 64 cells created
        if (this.cells.length !== 64) {
            //console.error('Grid initialization error: Expected 64 cells, got', this.cells.length);
        }
        
        // Initialize scale array
        this.scale = new Array(this.scaleSize);
    }
    
    // C++ Grid.cpp lines 25-56 - Setup method
    setup(x, y, width, height, inScale, names) {
        this.cellWidth = width;
        this.cellHeight = height;
        this.theScale = inScale;
        this.noteNames = names;
        
        // Set global position
        this.globalPosition = { x, y };
        this.startY = y;
        
        // Calculate label position (to the right of the grid)
        this.labelXOffset = x + (8 * (this.cellWidth + this.cellSpacingX)) + 10;
        
        // Initialize all cells with proper positions
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                // Calculate index using literal 8
                const index = row * 8 + col;
                const cell = this.cells[index];
                const cellX = x + col * (this.cellWidth + this.cellSpacingX);
                const cellY = y + row * (this.cellHeight + this.cellSpacingY);
                
                // Set chord position and size
                cell.chord.pos = { x: cellX, y: cellY };
                cell.chord.size = { x: this.cellWidth - 2, y: this.cellHeight - 2 };
                cell.chord.rounded = this.round;
            }
        }
        
        // Initialize chord progression (exactly 8 cells for top row)
        this.chordProgression = new Array(8);
        for (let col = 0; col < 8; col++) {
            // Reference to row 0 cells: index = 0 * 8 + col
            this.chordProgression[col] = this.cells[col];
        }
        
        // Initialize parent modes
        this.initializeParentModes();
        
        // Populate the scale
        this.updateScale(inScale, names);
        
        // Initialize all cells: first row "Drop Here", all others "Empty"
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const index = row * 8 + col;
                const cell = this.cells[index];
                if (row === 0) {
                    cell.chord.setInfo("Drop Here");
                } else {
                    cell.chord.setInfo("Empty");
                }
            }
        }
        
        // console.log('Grid setup complete', { 
        //     position: this.globalPosition, 
        //     cellSize: { w: this.cellWidth, h: this.cellHeight },
        //     cells: this.cells.length 
        // });
    }
    
    // C++ Grid.cpp lines 77-85 - Set dark mode
    setDarkMode(inDarkMode) {
        this.darkMode = inDarkMode;
        if (this.darkMode) {
            this.textColor = this.lightTextColor;
        } else {
            this.textColor = this.darkTextColor;
        }
    }
    
    // C++ Grid.cpp lines 292-299 - Get mode name from index
    getModeNameForIndex(index) {
        const modeNames = [
            "Ionian", "Dorian", "Phrygian", "Lydian",
            "Mixolydian", "Aeolian", "Locrian"
        ];
        if (index >= 0 && index < modeNames.length) {
            return modeNames[index];
        }
        return "Unknown";
    }
    
    // C++ Grid.cpp lines 303-313 - Get mode label for a row
    getModeLabel(row) {
        if (row === 0) return "Original";
        
        for (const info of this.rowModeInfos) {
            if (info.targetRow === row) {
                const modeName = this.getModeNameForIndex(info.modeIndex);
                return (info.isParallel ? "Parallel " : "Relative ") + modeName;
            }
        }
        return "";
    }
    
    // C++ Grid.cpp lines 100-108 - Set corner rounding
    setRound(inRound) {
        this.round = inRound;
        for (const cell of this.cells) {
            cell.chord.setRound(inRound);
        }
    }
    
    // C++ Grid.cpp lines 111-115 - Set modes for modal interchange
    setModes(inModes) {
        this.modes = inModes;
        //console.log('Grid received modes:', this.modes.length);
    }
    
    // C++ Grid.cpp lines 118-145 - Update selected chord voicing
    updateSelectedChordVoicing(newVoicing) {
        // C++ Grid.cpp lines 119-146: Update selected chord voicing and recalculate modal interchange
        // console.log('📝 Grid.updateSelectedChordVoicing called:', {
        //     newVoicing,
        //     selectedRow: this.selectedCellRow,
        //     selectedCol: this.selectedCellCol
        // });
        
        // Only update if there's a valid selection
        if (this.selectedCellRow < 0 || this.selectedCellCol < 0) {
            //console.warn('⚠️ No cell selected, cannot update voicing');
            return;
        }
        
        const cellIndex = this.selectedCellRow * 8 + this.selectedCellCol;
        if (cellIndex >= 0 && cellIndex < 64) {
            const cell = this.cells[cellIndex];
            //console.log('📝 Updating cell', cellIndex, 'chord with voicing:', newVoicing);
            
            cell.chord.updateVoicing(newVoicing);
            cell.chord.setChordQualityFromVoicing(newVoicing);
            
            // Update cell colorCode after quality change
            cell.colorCode = cell.chord.getColor();
            
            // console.log('✓ Grid cell updated:', {
            //     cellIndex,
            //     newQuality: cell.chord.getChordQuality(),
            //     newColor: cell.colorCode
            // });
            
            // Update progression if row 0
            if (this.selectedCellRow === 0) {
                this.chordProgression[this.selectedCellCol] = cell;
                // C++ ALWAYS recalculates modal interchange after voicing change in row 0
                this.calculateModalInterchange();
            }
            
            //console.log(`✓ Updated cell (${this.selectedCellRow},${this.selectedCellCol}) voicing:`, newVoicing);
        }
    }
    
    // C++ Grid.cpp lines 148-150 - Set inversions for dragging chords
    // This method simply delegates to the draggingChords member
    setInversionsForDraggingChords(refInversion) {
        // C++ Grid.cpp line 149: draggingChords.setInversions(refInversion);
        // The draggingChords is owned by ofApp and passed here, so do nothing
        // The actual call happens in ofApp.onInversionChanged
        //console.log('🎯 Grid.setInversionsForDraggingChords called (delegated to ofApp)');
    }
    
    // C++ Grid.cpp lines 153-163 - Initialize parent modes
    initializeParentModes() {
        this.parentModes = [];
        
        // Allocate 8 slots for each column
        for (let col = 0; col < this.cols; col++) {
            this.parentModes.push(new Array(8));
        }
        
        // Initialize each column's modes based on the first row chords
        for (let col = 0; col < this.cols; col++) {
            this.updateParentMode(col);
        }
    }
    
    // C++ Grid.cpp lines 166-181 - Update parent mode for a column
    updateParentMode(column) {
        if (!this.modes || this.modes.length === 0) return;
        
        const parentCell = this.cells[column];
        const parentQuality = parentCell.chord.getChordQuality();
        
        // Handle empty cells or invalid quality
        if (!parentQuality || !parentQuality.id) {
            // Clear this column's parent modes
            for (let i = 0; i < 8; i++) {
                this.parentModes[column][i] = null;
            }
            
            // Clear all modal interchange cells in this column (rows 1-7)
            for (let row = 1; row < 8; row++) {
                const targetIndex = row * 8 + column;
                const targetCell = this.cells[targetIndex];
                targetCell.chord.setNotes([]);
                targetCell.chord.setInfo("Empty");
                targetCell.chord.quality = "Empty";
                targetCell.chord.chordFunction = "Empty";
                targetCell.chord.setColor(this.cellColor);
                targetCell.chord.hoverColor = this.cellColor;
                targetCell.colorCode = this.cellColor;
            }
            return;
        }
        
        const parentId = parentQuality.id;
        let index = 0;
        
        // Overwrite the 8 slots directly
        for (const mode of this.modes) {
            const mf = mode.getModeFunction();
            const chordQualities = mf.chordQualities;
            
            // parentId is 1-based, chordQualities length is the max valid id
            if (parentId > 0 && parentId <= chordQualities.length) {
                this.parentModes[column][index++] = mode;
            }
        }
    }
    
    // C++ Grid.cpp lines 184-217 - Update scale
    updateScale(inScale, names) {
        this.theScale = inScale;
        this.noteNames = names;
        //console.log('Updating scale in Grid with size:', this.theScale.length);
        
        // If chordProgression is empty, initialize it
        if (this.chordProgression.length === 0) {
            this.chordProgression = new Array(this.cols);
        }
        
        // Clear and populate the scale array
        this.scale = [];
        const scaleLength = 7; // Standard scale length
        for (let i = 0; i < this.theScale.length; i++) {
            const note = {
                ft_note: this.theScale[i],
                localInterval: ((i % scaleLength) + 1) + Math.floor(i / scaleLength) * scaleLength,
                name: this.noteNames[i] || ""
            };
            this.scale.push(note);
        }
        
        // Update all existing chords with new scale
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                // Calculate index using literal 8
                const index = row * 8 + col;
                const cell = this.cells[index];
                const cellX = this.globalPosition.x + col * (this.cellWidth + this.cellSpacingX);
                const cellY = this.globalPosition.y + row * (this.cellHeight + this.cellSpacingY);
                
                // Update chord position
                cell.chord.pos = { x: cellX, y: cellY };
                cell.chord.size = { x: this.cellWidth - 2, y: this.cellHeight - 2 };
                
                // Sync chord progression for row 0
                if (row === 0) {
                    this.chordProgression[col] = cell;
                }
            }
        }
        
        //console.log('Grid scale updated, notes:', this.scale.length);
    }
    
    // C++ Grid.cpp lines 290-308 - Get cell index from mouse position
    getCellIndex(mouseX, mouseY) {
        const relX = mouseX - this.globalPosition.x;
        const relY = mouseY - this.globalPosition.y;
        
        if (relX < 0 || relY < 0) return -1;
        
        const col = Math.floor(relX / (this.cellWidth + this.cellSpacingX));
        const row = Math.floor(relY / (this.cellHeight + this.cellSpacingY));
        
        // Validate bounds using literal 8
        if (row >= 0 && row < 8 && col >= 0 && col < 8) {
            // Calculate index using literal 8
            return row * 8 + col;
        }
        
        return -1;
    }
    
    // C++ Grid.cpp lines 355-389 - Mouse pressed handler
    mousePressed(mouseX, mouseY) {
        const cellIndex = this.getCellIndex(mouseX, mouseY);
        
        if (cellIndex >= 0 && cellIndex < 64) {
            // Calculate row/col using literal 8
            const row = Math.floor(cellIndex / 8);
            const col = cellIndex % 8;
            const cell = this.cells[cellIndex];
            
            // Get notes before checking if valid
            const notes = cell.chord.getNotes();
            
            // Only select if cell has valid chord
            if (!notes || notes.length === 0) {
                //console.log(`Cell (${row},${col}) is empty, skipping selection`);
                return;
            }
            
            // Clear previous selection state
            if (this.selectedCellRow >= 0 && this.selectedCellCol >= 0) {
                const prevIndex = this.selectedCellRow * 8 + this.selectedCellCol;
                if (prevIndex >= 0 && prevIndex < 64) {
                    this.cells[prevIndex].chord.setChordClicked(false);
                }
            }
            
            // Update selection atomically
            this.selectedCellRow = row;
            this.selectedCellCol = col;
            cell.chord.setChordClicked(true);
            
            // Get the mode for this row (row 0 = mode 0, row 1 = mode 1 (Dorian), etc.)
            // Row-to-mode mapping: 0→0, 1→1, 2→2, 3→5, 4→1, 5→2, 6→5, 7→6
            const modeIndexMap = [0, 1, 2, 5, 1, 2, 5, 6];
            const modeIndex = modeIndexMap[row] || 0;
            const mode = this.modes && this.modes[modeIndex] ? this.modes[modeIndex] : null;
            
            // Trigger callback with notes, voicing, chord, and mode
            const voicing = cell.chord.getNoteVoicing();
            if (this.onChordSelected) {
                this.onChordSelected(notes, voicing, cell.chord, mode);
                //console.log(`✓ Grid cell selected: (${row},${col}), mode: ${mode ? mode.modeName : 'unknown'}, notes: ${notes.length}, voicing: ${voicing.length}`);
            }
            // Refresh LP cell colors only; the press highlight is reserved for
            // physical LP pad presses.
            if (window.launchpadHandler) window.launchpadHandler.refreshLeds();
        }
    }
    
    // C++ Grid.cpp lines 391-395 - Mouse dragged handler
    mouseDragged(mouseX, mouseY) {
        // TODO: Implement dragging logic when DraggingChords is ported
    }
    
    // C++ Grid.cpp lines 397-401 - Mouse released handler
    mouseReleased(mouseX, mouseY) {
        // Reset clicked state on ALL cells
        for (let i = 0; i < this.cells.length; i++) {
            this.cells[i].chord.setChordClicked(false);
        }
        
        // DON'T clear selection - keep the cell selected for VoicingEditor to update it
        // Selection will be cleared when clicking outside grid or using Clean button
    }
    
    // C++ Grid.cpp lines 520-598 - Draw method
    draw(p, mouseX, mouseY) {
        p.push();

        // Draw each cell
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                // Calculate index using literal 8
                const index = row * 8 + col;
                const cell = this.cells[index];

                const x = this.globalPosition.x + col * (this.cellWidth + this.cellSpacingX);
                const y = this.globalPosition.y + row * (this.cellHeight + this.cellSpacingY);

                // Update hover state for this chord
                cell.chord.checkHover(mouseX, mouseY);

                // If the Launchpad is holding this pad, make the cell render
                // exactly as if the mouse were clicking it.
                if (this._lpPressed && this._lpPressed.row === row && this._lpPressed.col === col) {
                    cell.chord.mouseHoverCheck = true;
                    cell.chord.mouseClicked = true;
                }

                // Draw cell using the chord's own draw method to handle hover/click states correctly
                // Chord's draw() method handles everything: background color, hover/click states, and text
                cell.chord.draw(p, x, y, this.cellWidth, this.cellHeight);
            }
        }

        // Draw mode labels to the right of each row (C++ Grid.cpp lines 613-621)
        p.fill(...this.textColor);
        p.noStroke();
        p.textAlign(p.LEFT, p.CENTER);
        p.textSize(13);

        for (let row = 0; row < this.rows; row++) {
            const label = this.getModeLabel(row);
            if (label) {
                const yPos = this.startY + (row * (this.cellHeight + this.cellSpacingY)) + (this.cellHeight / 2);
                p.text(label, this.labelXOffset, yPos);
            }
        }

        p.pop();
    }
    
    // C++ Grid.cpp lines 600-605 - Update method
    update() {
        // Update logic if needed
    }
    
    // Getters
    getScale() {
        return this.theScale;
    }
    
    getNoteNames() {
        return this.noteNames;
    }
    
    getCurrentScale() {
        return this.scale;
    }
    
    getCellColor(row, col) {
        // Validate bounds
        if (row < 0 || row >= 8 || col < 0 || col >= 8) {
            return [240, 240, 240];
        }
        const index = row * 8 + col;
        return this.cells[index].colorCode;
    }

    // RGB (0-255) of the cell's underlying color (mode tint or chord color).
    // The Launchpad handler overlays its own press highlight on top, so this
    // function intentionally ignores selection state.
    getCellRGB(row, col) {
        if (row < 0 || row >= 8 || col < 0 || col >= 8) return [0, 0, 0];
        const cell = this.cells[row * 8 + col];
        if (!cell || !cell.chord) return [0, 0, 0];
        return cell.chord.defaultColor || [240, 240, 240];
    }

    // Programmatic trigger equivalent to a mouse click on (row, col).
    // Used by the Launchpad so a pad press reproduces the click path exactly.
    selectCellByRowCol(row, col) {
        if (row < 0 || row >= 8 || col < 0 || col >= 8) return false;
        const cellIndex = row * 8 + col;
        const cell = this.cells[cellIndex];
        const notes = cell.chord.getNotes();
        if (!notes || notes.length === 0) return false;

        if (this.selectedCellRow >= 0 && this.selectedCellCol >= 0) {
            const prevIndex = this.selectedCellRow * 8 + this.selectedCellCol;
            if (prevIndex >= 0 && prevIndex < 64) {
                this.cells[prevIndex].chord.setChordClicked(false);
            }
        }

        this.selectedCellRow = row;
        this.selectedCellCol = col;
        cell.chord.setChordClicked(true);

        const modeIndexMap = [0, 1, 2, 5, 1, 2, 5, 6];
        const modeIndex = modeIndexMap[row] || 0;
        const mode = this.modes && this.modes[modeIndex] ? this.modes[modeIndex] : null;
        const voicing = cell.chord.getNoteVoicing();

        if (this.onChordSelected) {
            this.onChordSelected(notes, voicing, cell.chord, mode);
        }
        if (window.launchpadHandler) window.launchpadHandler.refreshLeds();
        return true;
    }

    setLPPress(row, col) {
        this._lpPressed = { row, col };
    }
    clearLPPress(row, col) {
        if (this._lpPressed && this._lpPressed.row === row && this._lpPressed.col === col) {
            this._lpPressed = null;
        }
    }

    // True when the cell has a playable chord (used by Launchpad for LED brightness)
    cellHasChord(row, col) {
        if (row < 0 || row >= 8 || col < 0 || col >= 8) return false;
        const cell = this.cells[row * 8 + col];
        if (!cell || !cell.chord) return false;
        const notes = cell.chord.getNotes();
        return !!(notes && notes.length > 0);
    }
    
    // Clean all chords from grid
    cleanAllChords() {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const index = row * 8 + col;
                const cell = this.cells[index];
                cell.chord.setNotes([]);
                cell.chord.setChordQuality();
                cell.chord.setColor(this.cellColor);
                // Sync color to cell's colorCode for rendering
                this.cells[index].colorCode = this.cellColor;
                
                // Clear the clicked state so cell doesn't show orange highlight
                cell.chord.setChordClicked(false);
                
                if (row === 0) {
                    this.chordProgression[col] = cell;
                    // Set info to "Drop Here" for first row
                    cell.chord.setInfo("Drop Here");
                } else {
                    // Set info to "Empty" for other rows
                    cell.chord.setInfo("Empty");
                }
            }
        }
        
        // Clear the selection so no cell shows the orange highlight
        this.selectedCellRow = -1;
        this.selectedCellCol = -1;

        if (window.launchpadHandler) window.launchpadHandler.refreshLeds();
        //console.log('✓ All chords cleaned from grid');
    }
    
    // Get cell at row, col
    getCell(row, col) {
        if (row < 0 || row >= 8 || col < 0 || col >= 8) {
            //console.error('Invalid cell coordinates:', row, col);
            return null;
        }
        const index = row * 8 + col;
        return this.cells[index];
    }
    
    // Validate selection state
    isValidSelection() {
        return this.selectedCellRow >= 0 && this.selectedCellRow < 8 &&
               this.selectedCellCol >= 0 && this.selectedCellCol < 8;
    }
    
    // Get current selected cell
    getSelectedCell() {
        if (!this.isValidSelection()) {
            return null;
        }
        const index = this.selectedCellRow * 8 + this.selectedCellCol;
        return this.cells[index];
    }
    
    // Clear selection
    clearSelection() {
        if (this.isValidSelection()) {
            const index = this.selectedCellRow * 8 + this.selectedCellCol;
            this.cells[index].chord.setChordClicked(false);
        }
        this.selectedCellRow = -1;
        this.selectedCellCol = -1;
    }

    // Print the 8x8 grid chord names to console for easy copy-paste
    printGrid() {
        const separator = '-'.repeat(120);
        let lines = [];
        lines.push('');
        lines.push(separator);
        lines.push('MODAL STUDIO GRID (8x8)');
        lines.push(separator);

        // Header with column numbers
        const colWidth = 15;
        const rowLabelWidth = 15;
        const headerCols = [];
        for (let col = 0; col < 8; col++) {
            headerCols.push(`Col ${col}`.padEnd(colWidth));
        }
        let header = 'Row\\Col'.padEnd(rowLabelWidth) + '| ' + headerCols.join('| ') + '|';
        lines.push(header);
        lines.push(separator);

        for (let row = 0; row < 8; row++) {
            const modeLabel = this.getModeLabel(row);
            let cells = [];
            for (let col = 0; col < 8; col++) {
                const index = row * 8 + col;
                const cell = this.cells[index];
                const chord = cell.chord;
                // Same logic as chord drawing: info first, then finalInfo, then quality
                let label = '';
                if (chord.info && chord.info.length > 0 && chord.info !== 'Empty' && chord.info !== 'Drop Here') {
                    label = chord.info;
                } else if (chord.finalInfo && chord.finalInfo.length > 0) {
                    label = chord.finalInfo;
                } else if (chord.quality && chord.quality !== 'Empty' && chord.quality !== 'Drop Here') {
                    label = chord.quality;
                } else {
                    label = 'Empty';
                }
                cells.push(label.padEnd(colWidth));
            }
            const rowLabel = modeLabel ? `${row} (${modeLabel})` : `${row}`;
            lines.push(`${rowLabel.padEnd(rowLabelWidth)}| ${cells.join('| ')}|`);
        }

        lines.push(separator);
        lines.push('');
        const output = lines.join('\n');
        console.log(output);
        return output;
    }
    
    // Calculate modal interchange for all rows based on row 0 chord progression
    calculateModalInterchange() {
        if (!this.modes || this.modes.length < 7) {
            //console.warn('Not enough modes for modal interchange');
            return;
        }
        
        // Parallel mode substitution: rows 1-3 use modes 1 (Dorian), 2 (Phrygian), 5 (Aeolian)
        this.modeSubstitution(1, 1); // Row 1: Dorian
        this.modeSubstitution(2, 2); // Row 2: Phrygian  
        this.modeSubstitution(5, 3); // Row 3: Aeolian
        
        // Relative mode substitution: rows 4-7
        this.relativeModeSubstitution(1, 4); // Row 4: Dorian
        this.relativeModeSubstitution(2, 5); // Row 5: Phrygian
        this.relativeModeSubstitution(5, 6); // Row 6: Aeolian
        this.relativeModeSubstitution(6, 7); // Row 7: Locrian
        
        //console.log('✓ Modal interchange calculated for all rows');
    }
    
    // Parallel mode substitution (C++ Grid.cpp lines 310-434)
    modeSubstitution(modeIndex, targetRow) {
        //console.log('🟢 modeSubstitution CALLED - modeIndex:', modeIndex, 'targetRow:', targetRow);
        
        // Update mode info for this row (C++ Grid.cpp lines 317-327)
        let found = false;
        for (const info of this.rowModeInfos) {
            if (info.targetRow === targetRow) {
                info.modeIndex = modeIndex;
                info.isParallel = true;
                found = true;
                break;
            }
        }
        if (!found) {
            this.rowModeInfos.push({
                isParallel: true,
                modeIndex: modeIndex,
                targetRow: targetRow
            });
        }
        
        // Iterate through each column
        for (let col = 0; col < 8; col++) {
            const targetIndex = targetRow * 8 + col;
            //console.log('  → Column:', col);
            
            // Store previous chord's voicing for voice leading
            let prevVoicing = [];
            if (col > 0) {
                const prevCell = this.cells[targetIndex - 1];
                prevVoicing = prevCell.chord.getNoteVoicing();
            }
            
            // Get the parent mode for this specific column
            if (col >= this.parentModes.length || modeIndex >= this.parentModes[col].length) {
                continue;
            }
            
            const parentMode = this.parentModes[col][modeIndex];
            if (!parentMode) {
                continue;
            }
            const MF = parentMode.getModeFunction();
            const myCQ = MF.chordQualities;
            //console.log('  🔵 Using mode:', MF.mode, 'myCQ length:', myCQ.length);
            
            const parentCell = this.cells[col];
            const parentQuality = parentCell.chord.getChordQuality();
            const parentId = parentQuality.id;
            
            // C++ line 356: If parent empty, make target empty
            if (parentCell.chord.getNotes().length === 0) {
                const targetCell = this.cells[targetIndex];
                targetCell.chord.setNotes([]);
                targetCell.chord.setInfo("Empty");
                targetCell.chord.quality = "Empty";
                targetCell.chord.chordFunction = "Empty";
                targetCell.chord.setColor(this.cellColor);
                targetCell.chord.hoverColor = this.cellColor;
                targetCell.colorCode = this.cellColor;
                continue;
            }
            
            // C++ line 365: Validation
            if (parentId < 0 || parentCell.chord.getNotes().length === 0) {
                continue;
            }
            
            // C++ line 369: Index check
            if (targetIndex >= this.cells.length) {
                continue;
            }
            
            const targetCell = this.cells[targetIndex];
            const globalInversion = parentCell.chord.getGlobalInversion();
            
            // Set previous voicing for voice leading
            if (prevVoicing.length > 0) {
                targetCell.chord.setPreviousVoicing(prevVoicing);
            }
            
            //console.log('🔧 modeSubstitution - col:', col, 'parentId:', parentId, 'globalInversion:', globalInversion, 'targetRow:', targetRow);
            
            // C++ logic: Handle different cases
            if (parentId >= 1 && globalInversion !== 0) {
                //console.log('  ✓ Entered inverted chord branch');
                // Handle inverted chords - C++ line 383
                const refScale = myCQ[parentId - 1].notes;
                //console.log('  📊 myCQ[', parentId - 1, '] has', refScale.length, 'notes, quality:', myCQ[parentId - 1].quality);
                if (refScale.length > 0) {
                    targetCell.chord.setNotes(refScale);
                    //console.log('  📊 After setNotes - notes:', targetCell.chord.notes.length, 'globalInv before:', targetCell.chord.getGlobalInversion());
                    targetCell.chord.setGlobalInversion(globalInversion);
                    //console.log('  📊 After setGlobalInversion:', targetCell.chord.getGlobalInversion());
                    targetCell.chord.setChordQuality();
                    //console.log('  🎵 After setChordQuality - finalInfo:', targetCell.chord.finalInfo);
                }
            }
            else if (parentId >= 2 && globalInversion === 0) {
                // Handle non-tonic root position chords - C++ line 389
                const refScale = myCQ[parentId - 1].notes;
                if (refScale.length > 0) {
                    targetCell.chord.setNotes(refScale);
                    targetCell.chord.setGlobalInversion(globalInversion);
                    targetCell.chord.setChordQuality();
                }
            }
            else if (parentId === 1 && this.parentModes[col].length > 0 && globalInversion === 0) {
                // Handle tonic chords (function I) - C++ line 396
                if (this.isRootPosition(col)) {
                    // Preserve original quality for first and last tonic chords
                    const refScale = parentCell.chord.getNotes();
                    if (refScale.length > 0) {
                        targetCell.chord.setNotes(refScale);
                        targetCell.chord.setGlobalInversion(globalInversion);
                        targetCell.chord.setChordQuality();
                    }
                } else {
                    // Apply mode substitution for other tonic chords
                    const refScale = myCQ[parentId - 1].notes;
                    if (refScale.length > 0) {
                        targetCell.chord.setNotes(refScale);
                        targetCell.chord.setGlobalInversion(globalInversion);
                        targetCell.chord.setChordQuality();
                    }
                }
            }
            else {
                // Handle any other cases by clearing the chord
                targetCell.chord.setNotes([]);
                targetCell.chord.setGlobalInversion(0);
                targetCell.chord.setChordQuality();
            }
        }
    }
    
    // Relative mode substitution (C++ Grid.cpp lines 437-541)
    relativeModeSubstitution(modeIndex, targetRow) {
        // Update mode info for this row
        let found = false;
        for (const info of this.rowModeInfos) {
            if (info.targetRow === targetRow) {
                info.modeIndex = modeIndex;
                info.isParallel = false;
                found = true;
                break;
            }
        }
        if (!found) {
            this.rowModeInfos.push({
                isParallel: false,
                modeIndex: modeIndex,
                targetRow: targetRow
            });
        }
        
        // Iterate through each column (C++ Grid.cpp lines 443-464)
        for (let col = 0; col < 8; col++) {
            const targetIndex = targetRow * 8 + col;
            
            // Store previous chord's voicing if there is one
            let prevVoicing = [];
            if (col > 0) {
                const prevCell = this.cells[targetIndex - 1];
                prevVoicing = prevCell.chord.getNoteVoicing();
            }
            
            // Skip if no valid parent modes
            if (col >= this.parentModes.length || modeIndex >= this.parentModes[col].length) {
                continue;
            }
            
            // Get parent chord and check validity
            const parentCell = this.cells[col];
            const parentQuality = parentCell.chord.getChordQuality();
            const parentId = parentQuality ? (parentQuality.id - 1) : -1; // Adjusted for 0-based index
            const globalInversion = parentCell.chord.getGlobalInversion();
            
            // If parent is empty, make target empty
            if (!parentCell.chord.getNotes() || parentCell.chord.getNotes().length === 0) {
                const targetCell = this.cells[targetIndex];
                targetCell.chord.setNotes([]);
                targetCell.chord.setChordQuality();
                targetCell.chord.setColor(this.cellColor);
                // Reset hover color to gray as well
                targetCell.chord.hoverColor = this.cellColor;
                targetCell.colorCode = this.cellColor;
                targetCell.chord.setInfo("Empty");
                continue;
            }
            
            if (targetIndex >= 64) {
                continue;
            }
            
            // Get mode information
            const parentMode = this.parentModes[col][modeIndex];
            
            // Check if parentMode is valid
            if (!parentMode) {
                continue;
            }
            
            const MF = parentMode.getModeFunction();
            const myCQ = MF.chordQualities;
            
            if (!myCQ || myCQ.length === 0) {
                continue;
            }
            
            const targetCell = this.cells[targetIndex];
            
            // Before setting the new chord, pass the previous voicing (C++ Grid.cpp lines 488-490)
            if (prevVoicing.length > 0) {
                targetCell.chord.setPreviousVoicing(prevVoicing);
            }
            
            // Special handling for the first column (C++ Grid.cpp lines 493-502)
            if (col === 0) {
                // Preserve the first chord with function 1 and its inversion
                if (parentId === 0) { // Function 1 (tonic)
                    targetCell.chord.setNotes(parentCell.chord.getNotes());
                    targetCell.chord.setGlobalInversion(globalInversion);
                    targetCell.chord.setChordQuality();
                    // Update cell colorCode for rendering (setChordQuality calculates color)
                    targetCell.colorCode = targetCell.chord.getColor();
                    continue;
                }
            }
            
            // Handle chords based on inversion state
            if (globalInversion !== 0) {
                // Handle inverted chords
                if (parentId >= 0 && parentId < myCQ.length) {
                    const newId = (parentId + this.getOffsetForMode(MF.mode)) % myCQ.length;
                    
                    // Check if element exists
                    if (myCQ[newId] && myCQ[newId].notes) {
                        const refScale = myCQ[newId].notes;
                        
                        if (refScale.length > 0) {
                            // Apply voice leading from previous cell
                            if (col > 0) {
                                const prevCell = this.cells[targetIndex - 1];
                                targetCell.chord.setPreviousVoicing(prevCell.chord.getNoteVoicing());
                            }
                            targetCell.chord.setNotes(refScale);
                            targetCell.chord.setGlobalInversion(globalInversion);
                            targetCell.chord.setChordQuality();
                            // Update cell colorCode for rendering
                            targetCell.chord.getColor();
                        }
                    }
                }
            } else {
                // Handle root position chords
                if (this.isRootPosition(col)) {
                    // Preserve tonality for important positions
                    targetCell.chord.setNotes(parentCell.chord.getNotes());
                    targetCell.chord.setGlobalInversion(globalInversion);
                    targetCell.chord.setChordQuality();
                    // Update cell colorCode for rendering
                    targetCell.colorCode = targetCell.chord.getColor();
                } else if (parentId >= 0 && parentId < myCQ.length) {
                    // For other root position chords
                    const newId = (parentId + this.getOffsetForMode(MF.mode)) % myCQ.length;
                    
                    // Check if element exists
                    if (myCQ[newId] && myCQ[newId].notes) {
                        const refScale = myCQ[newId].notes;
                        
                        if (refScale.length > 0) {
                            // Apply voice leading from previous cell
                            if (col > 0) {
                                const prevCell = this.cells[targetIndex - 1];
                                targetCell.chord.setPreviousVoicing(prevCell.chord.getNoteVoicing());
                            }
                            targetCell.chord.setNotes(refScale);
                            targetCell.chord.setGlobalInversion(globalInversion);
                            targetCell.chord.setChordQuality();
                            // Update cell colorCode for rendering
                            targetCell.colorCode = targetCell.chord.getColor();
                        }
                    }
                }
            }
        }
    }
    
    // Get offset for mode (mode number determines rotation)
    getOffsetForMode(mode) {
        // C++ Grid.hpp lines 209-216: Maps mode name to offset
        if (mode === "Dorian") return 6;
        if (mode === "Phrygian") return 5;
        if (mode === "Lydian") return 4;
        if (mode === "Mixolydian") return 3;
        if (mode === "Aeolian") return 2;
        if (mode === "Locrian") return 1;
        return 0; // Ionian/default
    }
    
    // Check if column position is a root position (C++ Grid.cpp lines 263-286)
    isRootPosition(col) {
        // Always preserve first column regardless of function
        if (col === 0)
            return true;
        
        const myId = this.chordProgression[col].chord.getChordId();
        if (myId >= 0) {
            // Check if this is a I chord
            if (this.chordProgression[col].chord.getNotes().length > 0 && myId === 1) {
                // Find the last non-empty chord in the progression
                let lastChordPos = -1;
                for (let i = 0; i < this.chordProgression.length; i++) {
                    if (this.chordProgression[i] && this.chordProgression[i].chord && 
                        this.chordProgression[i].chord.getNotes().length > 0) {
                        lastChordPos = i;
                    }
                }
                
                // Return true if this is the last non-empty chord position and it's a I chord
                return (col === lastChordPos && lastChordPos !== -1);
            }
        }
        return false;
    }
    
    // Drop chord from DraggingChords into grid cell
    dropChordIntoCell(cellIndex, sourceChord) {
        // Validate cell index
        if (cellIndex < 0 || cellIndex >= 64) {
            //console.error('Invalid cell index for drop:', cellIndex);
            return;
        }
        
        // Calculate row/col
        const row = Math.floor(cellIndex / 8);
        const col = cellIndex % 8;
        
        // Only allow drops on row 0 (chord progression row)
        if (row !== 0) {
            //console.log('Can only drop chords on first row (chord progression)');
            return;
        }
        
        const cell = this.cells[cellIndex];
        
        // C++ Grid.cpp lines 688-694: Clean entire column before placing chord
        // This happens for BOTH regular and empty chords
        for (let r = 0; r < 8; r++) {
            const idx = r * 8 + col;
            this.cells[idx].chord.setNotes([]);
            this.cells[idx].chord.setChordQuality();
            this.cells[idx].chord.setColor(this.cellColor);
            this.cells[idx].colorCode = this.cellColor;
            // Clear the info property
            this.cells[idx].chord.setInfo("");
        }
        
        // Store target position before copying
        const targetPos = cell.chord.pos;
        const targetSize = cell.chord.size;
        
        // Set up voice leading from previous chord in row 0
        let prevVoicing = [];
        if (col > 0) {
            const prevCell = this.cells[col - 1]; // Previous cell in row 0
            prevVoicing = prevCell.chord.getNoteVoicing();
        }
        
        // C++ Grid.cpp line 710: cells[id].chord = draggedChord (full object copy)
        // Copy ALL chord data from source to row 0
        const notes = sourceChord.getNotes();
        const voicing = sourceChord.getNoteVoicing();
        const quality = sourceChord.getChordQuality();
        const sourceColor = sourceChord.getColor(); // Get color from dragged chord
        const inversion = sourceChord.getGlobalInversion();
        
        // Deep copy notes array
        const notesCopy = notes.map(note => ({
            ft_note: note.ft_note,
            name: note.name,
            interval: note.interval,
            localInterval: note.localInterval
        }));
        
        // C++ Grid.cpp line 697: cells[id].chord = draggedChord (full object copy)
        // Copy ALL properties from source chord - direct assignment, not setNotes()
        cell.chord.notes = notesCopy;
        cell.chord.chordQuality.notes = notesCopy;
        cell.chord.noteVoicing = voicing ? [...voicing] : [];
        cell.chord.numVoicing = voicing ? voicing.length : 0;
        cell.chord.voicingType = sourceChord.voicingType;
        cell.chord.root = notesCopy.length > 0 ? notesCopy[0] : null;
        cell.chord.setGlobalInversion(inversion);
        cell.chord.chordFunction = sourceChord.chordFunction;
        cell.chord.quality = sourceChord.quality; // Copy quality string
        cell.chord.finalInfo = sourceChord.finalInfo; // Copy finalInfo with slash notation
        cell.chord.info = sourceChord.info; // Copy info string
        cell.chord.root_53 = sourceChord.root_53; // Copy root reference for inversions
        cell.chord.note_53 = sourceChord.note_53;
        cell.chord.chordQuality = sourceChord.chordQuality ? { ...sourceChord.chordQuality } : null;
        
        // Restore position and size (don't copy position from dragging chord)
        cell.chord.pos = targetPos;
        cell.chord.size = targetSize;
        
        // Apply voice leading from previous chord (for 9th addition)
        if (prevVoicing.length > 0) {
            cell.chord.setPreviousVoicing(prevVoicing);
            // Clear voicing to force recalculation with voice leading
            cell.chord.noteVoicing = [];
            // Recalculate voicing with voice leading context
            cell.chord.setChordQuality();
        }
        
        // For non-empty chords, just copy color and quality from source
        // For empty chords, copy info directly
        // C++ Grid.cpp line 697: cells[id].chord = draggedChord (full copy, NO setChordQuality call)
        if (notesCopy.length >= 3) {
            // Copy quality string directly without recalculating (preserves inversions)
            cell.chord.quality = sourceChord.quality;
            // Copy color from source chord to row 0
            cell.chord.setColor(sourceColor);
            this.cells[cellIndex].colorCode = sourceColor;
        } else {
            // Empty chord - just copy info text directly without calling setChordQuality
            cell.chord.setInfo(sourceChord.info || "Empty");
            cell.chord.quality = sourceChord.info || "Empty";
            cell.chord.chordFunction = sourceChord.chordFunction || "Empty";
            // Empty chords should use gray cellColor
            cell.chord.setColor(this.cellColor);
            // Reset hover color to gray as well
            cell.chord.hoverColor = this.cellColor;
            this.cells[cellIndex].colorCode = this.cellColor;
        }
        
        // Update chord progression
        this.chordProgression[col] = cell;
        
        // Update parent modes for this column
        this.updateParentMode(col);
        
        // console.log(`✓ Dropped chord into cell (${row},${col})`, {
        //     notes: notes.length,
        //     quality: quality ? quality.name : 'none',
        //     color: sourceColor
        // });
        
        // C++ Grid.cpp lines 717-723: ALWAYS run modal substitution after drop
        // If parent is empty, modal substitution will clear the column
        this.calculateModalInterchange();

        // Mirror new cell colors on the Launchpad immediately
        if (window.launchpadHandler) window.launchpadHandler.refreshLeds();

        // Print grid to console after each drop
        this.printGrid();
    }

    
}
