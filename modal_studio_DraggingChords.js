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

// DraggingChords.js - Direct port from C++ DraggingChords.cpp
// Created by David Dalmazzo on 13/11/24
// Ported to JavaScript for web implementation

class DraggingChords {
    constructor() {
        // Dragging state
        this.isDragging = false;
        this.dragCopyExists = false;
        this.dragOffset = { x: 0, y: 0 };
        
        // Layout properties
        this.startX = 0;
        this.startY = 0;
        this.dragSize = { x: 150, y: 60 };
        this.round = 10;
        this.cellSpacingX = 5;
        this.cellSpacingY = 2;
        this.xOffset = 152; // dragSize.x + spacing
        this.yOffset = 62;  // dragSize.y + spacing
        
        // Grid dimensions
        this.gridRows = 8;
        this.gridCols = 8;
        this.scaleLength = 7;
        
        // Visual properties
        this.darkMode = false;
        this.lightTextColor = [255, 255, 255];
        this.darkTextColor = [10, 10, 10];
        this.textColor = this.darkTextColor;
        this.dragCopyColor = [255, 200, 100];
        
        // Labels
        this.title = "Draggable Chords";
        this.titlePos = { x: 0, y: 0 };
        this.dragCopyLabel = "";
        
        // Drag copy rectangle
        this.dragCopy = { x: 0, y: 0, width: 0, height: 0 };
        
        // Data
        this.modes = [];
        this.chords = [];
        this.copyChord = null;
        this.scale = [];
        
        // Callbacks
        this.onCleanup = null;
        this.onDraggingStateChanged = null;
        
        // p5 instance
        this.p = null;
    }
    
    // Setup method -----------------------------------------------------------------------
    setup(x, y, buttonSizeX, buttonSizeY, modes) {
        this.startX = x;
        this.startY = y;
        this.dragSize = { x: buttonSizeX - 2, y: buttonSizeY - 2 };
        this.xOffset = this.dragSize.x + this.cellSpacingX + 2;
        this.yOffset = this.dragSize.y + this.cellSpacingY + 2;
        
        this.titlePos = { x: x + 5, y: y - 10 };
        
        // Store modes and create chords
        this.updateScale(modes);
        
        // console.log('DraggingChords setup complete', {
        //     position: { x, y },
        //     chords: this.chords.length
        // });
    }
    
    // C++ DraggingChords.cpp lines 49-55 - Set dark mode
    setDarkMode(inDarkMode) {
        this.darkMode = inDarkMode;
        this.textColor = this.darkMode ? this.lightTextColor : this.darkTextColor;
    }
    
    // C++ DraggingChords.cpp lines 58-63 - Set inversions
    setInversions(refInversion) {
        // console.log('🎵 DraggingChords.setInversions called with:', refInversion);
        for (const chord of this.chords) {
            // Skip Empty and Clean buttons
            if (chord.info === "Empty" || chord.info === "Clean") {
                continue;
            }
            
            if (chord.handleInversions) {
                chord.handleInversions(refInversion);
                // console.log('🎵 Updated draggable chord:', chord.finalInfo || chord.quality);
            }
            if (chord.setGlobalInversion) {
                chord.setGlobalInversion(refInversion);
            }
        }
    }
    
    // C++ DraggingChords.cpp lines 73-130 - Update scale and create chords
    updateScale(inModes) {
        this.modes = inModes;
        this.chords = [];
        
        if (!this.modes || this.modes.length === 0) {
            console.warn('No modes provided to DraggingChords');
            return;
        }
        
        // Use first mode (Ionian) to create the 7 draggable chords
        const currentMode = this.modes[0];
        const modeNotes = currentMode.scale;
        
        // Create 7 draggable chords, one per scale degree. (The old 8th column was
        // the octave repeat of degree 1 — dropped; "Empty" now takes that slot.)
        for (let col = 0; col < 7; col++) {
            const chord = new Chord();
            const xPosition = this.startX + (col * this.xOffset);
            const yPosition = this.startY;
            
            // Define scale mode starting from this degree
            const subScale = this.defineScaleMode(col, modeNotes);
            
            // Set up chord
            chord.pos = { x: xPosition, y: yPosition };
            chord.size = { x: this.dragSize.x, y: this.dragSize.y };
            chord.rounded = this.round;
            chord.setNotes(subScale);
            
            if (subScale.length > 0) {
                chord.root = subScale[0];
                chord.setRoot53(subScale[0]); // C++ DraggingChords.cpp line 92
            }
            
            chord.setChordQuality();
            chord.voicing(col); // Set voicing based on scale degree
            
            this.chords.push(chord);
        }
        
        // Create "Empty" chord (C++ DraggingChords.cpp lines 111-119). Sits in the
        // freed 8th column (where the octave-repeat chord used to be).
        const emptyChord = new Chord();
        emptyChord.pos = { x: this.startX + 7 * this.xOffset, y: this.startY };
        emptyChord.size = { x: this.dragSize.x, y: this.dragSize.y };
        emptyChord.rounded = this.round;
        emptyChord.setNotes([]); // Empty notes array
        emptyChord.setChordQuality(); // Sets function to "Empty" for empty chords
        emptyChord.setInfo("Empty"); // Sets quality and chordFunction to "Empty"
        this.chords.push(emptyChord);
        
        // Create "Clean" button (C++ DraggingChords.cpp lines 121-127). Moves up
        // into the row the "Empty" button used to occupy.
        const cleanChord = new Chord();
        cleanChord.pos = { x: this.startX, y: this.startY + this.yOffset + 1 };
        cleanChord.size = { x: this.dragSize.x, y: this.dragSize.y };
        cleanChord.rounded = this.round;
        cleanChord.setNotes([]); // Empty notes array
        cleanChord.setChordQuality();
        cleanChord.setInfo("Clean"); // Sets quality and chordFunction to "Clean"
        this.chords.push(cleanChord);
        
        console.log(`✓ DraggingChords: Created ${this.chords.length} chords (7 scale + Empty + Clean)`);
    }
    
    // C++ DraggingChords.cpp lines 133-149 - Define scale mode
    defineScaleMode(interval, inScale) {
        const subScale = [];
        if (interval < inScale.length) {
            for (let i = interval; i < inScale.length; i++) {
                const note = {
                    ft_note: inScale[i].ft_note,
                    name: inScale[i].name,
                    interval: (i - interval) + 1,
                    localInterval: i + 1
                };
                subScale.push(note);
            }
        }
        return subScale;
    }
    
    // Helper to determine if white text is needed on a background color
    // Matches Chord.needsWhiteText() implementation
    needsWhiteText(color) {
        if (!color || color.length < 3) return false;
        const luminance = (0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2]) / 255.0;
        const alpha = (color.length > 3 ? color[3] : 255) / 255.0;
        const adjustedLuminance = luminance * alpha + (1.0 - alpha);
        return adjustedLuminance < 0.6;
    }
    
    // C++ DraggingChords.cpp lines 177-193 - Draw method
    draw(p) {
        if (!p) return;
        this.p = p;
        
        p.push();
        
        // Draw title
        p.fill(...this.textColor);
        p.noStroke();
        p.textAlign(p.LEFT, p.BOTTOM);
        p.textSize(14);
        p.text(this.title, this.titlePos.x, this.titlePos.y);
        
        // Draw all chords
        for (const chord of this.chords) {
            this.drawChord(p, chord);
        }
        
        // Draw dragged copy if exists
        if (this.dragCopyExists) {
            p.fill(...this.dragCopyColor);
            p.stroke(255);
            p.strokeWeight(1);
            p.rect(this.dragCopy.x, this.dragCopy.y, this.dragCopy.width, this.dragCopy.height, this.round);
            
            // Draw label with function split
            const textColor = this.needsWhiteText(this.dragCopyColor) ? 255 : 0;
            p.fill(textColor);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(12);
            
            const centerX = this.dragCopy.x + this.dragCopy.width / 2;
            const centerY = this.dragCopy.y + this.dragCopy.height / 2;
            
            // Check if label contains function notation [I], [II], etc.
            const functionMatch = this.dragCopyLabel.match(/^(.+)\[(.+)\]$/);
            p.noStroke();
            if (functionMatch) {
                // Split chord quality and function
                const chordPart = functionMatch[1];
                const functionPart = '[' + functionMatch[2] + ']';
                
                // Draw chord quality slightly above center
                p.text(chordPart, centerX, centerY - 5);
                
                // Draw function below in smaller text
                p.textSize(9);
                p.text(functionPart, centerX, centerY + 8);
            } else {
                // Single line text
                p.text(this.dragCopyLabel, centerX, centerY);
            }
        }
        
        p.pop();
    }
    
    // Helper to draw a single chord
    drawChord(p, chord) {
        const x = chord.pos.x;
        const y = chord.pos.y;
        const w = chord.size.x;
        const h = chord.size.y;
        
        // Background
        const bgColor = chord.mouseClicked ? [255, 200, 100] : 
                       chord.mouseHoverCheck ? [255, 255, 255] : 
                       chord.defaultColor || [240, 240, 240];
        p.fill(...bgColor);
        p.stroke(250);
        p.strokeWeight(1);
        p.rect(x, y, w, h, chord.rounded);
        
        // Label - use finalInfo (with function in brackets) if available, otherwise quality or "Empty"
        // This matches C++ where chord.draw() displays finalInfo with roman numerals
        const label = chord.finalInfo || chord.quality || "Empty";
        const textColor = this.needsWhiteText(bgColor) ? 255 : 0;
        p.fill(textColor);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(12);
        
        // Check if label contains function notation [I], [II], etc.
        const functionMatch = label.match(/^(.+)\[(.+)\]$/);
        p.noStroke();
        if (functionMatch) {
            // Split chord quality and function
            const chordPart = functionMatch[1]; // e.g., "Cmaj7" or "Cmaj7/E"
            const functionPart = '[' + functionMatch[2] + ']'; // e.g., "[I]"
            
            // Draw chord quality slightly above center
            p.text(chordPart, x + w / 2, y + h / 2 - 5);
            
            // Draw function below in smaller text
            p.textSize(9);
            p.text(functionPart, x + w / 2, y + h / 2 + 8);
        } else {
            // Single line text (for "Empty", "Clean", etc.)
            p.text(label, x + w / 2, y + h / 2);
        }
    }
    
    // C++ DraggingChords.cpp lines 196-208 - Mouse pressed
    mousePressed(mouseX, mouseY) {
        for (const chord of this.chords) {
            const x = chord.pos.x;
            const y = chord.pos.y;
            const w = chord.size.x;
            const h = chord.size.y;
            
            if (mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h) {
                // Check chordFunction for Clean button (C++ DraggingChords.cpp line 201)
                const chordFunction = chord.chordFunction || chord.getInfo();
                
                // Handle Clean button - check function field
                if (chordFunction === "Clean" && this.onCleanup) {
                    this.onCleanup();
                    console.log('✓ Clean button pressed');
                    return;
                }
                
                // Start dragging
                this.startDragging(chord, mouseX, mouseY);
                break;
            }
        }
    }
    
    // C++ DraggingChords.cpp lines 211-216 - Mouse dragged
    mouseDragged(mouseX, mouseY) {
        if (this.isDragging && this.dragCopyExists) {
            this.dragCopy.x = mouseX - this.dragOffset.x;
            this.dragCopy.y = mouseY - this.dragOffset.y;
        }
    }
    
    // C++ DraggingChords.cpp lines 219-233 - Mouse released
    mouseReleased(mouseX, mouseY, grid) {
        if (this.isDragging) {
            // Check if dropped over grid
            if (grid && this.copyChord) {
                const cellIndex = grid.getCellIndex(mouseX, mouseY);
                if (cellIndex >= 0) {
                    grid.dropChordIntoCell(cellIndex, this.copyChord);
                }
            }
            
            // Clear drag state completely
            this.isDragging = false;
            this.dragCopyExists = false;
            this.copyChord = null;
            this.dragCopyLabel = "";
            
            if (this.onDraggingStateChanged) {
                this.onDraggingStateChanged(false);
            }
        }
    }
    
    // C++ DraggingChords.cpp lines 241-268 - Start dragging
    startDragging(chord, mouseX, mouseY) {
        this.isDragging = true;
        this.dragCopyExists = true;
        
        const x = chord.pos.x;
        const y = chord.pos.y;
        const w = chord.size.x;
        const h = chord.size.y;
        
        this.dragCopy = { x, y, width: w, height: h };
        // Use chord's finalInfo for label (shows function and inversion, e.g., "Cmaj7/E [I]")
        this.dragCopyLabel = chord.info || chord.finalInfo || chord.quality || "Empty";
        // Use chord's actual color for dragged button
        this.dragCopyColor = chord.getColor();
        this.copyChord = chord;
        this.dragOffset = { x: mouseX - x, y: mouseY - y };
        
        if (this.onDraggingStateChanged) {
            this.onDraggingStateChanged(true);
        }
        
        console.log('Started dragging:', this.dragCopyLabel);
    }
    
    // Getters
    isCurrentlyDragging() {
        return this.isDragging;
    }
    
    getDraggedChord() {
        return this.copyChord;
    }
    
    setRound(inRound) {
        this.round = inRound;
        for (const chord of this.chords) {
            chord.rounded = inRound;
        }
    }
    
    update() {
        // Update hover states if needed
    }
}
