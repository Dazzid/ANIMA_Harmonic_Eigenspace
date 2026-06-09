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

// VoicingEditor.js - Direct port from C++ VoicingEditor class
// Port of C++_app/src/VoicingEditor.hpp and VoicingEditor.cpp

// ============================================================================
// CHORD COMPONENT TYPES (from .hpp lines 9-20)
// ============================================================================
const ChordComponentType = {
    ROOT: 0,
    THIRD: 1,
    FIFTH: 2,
    SEVENTH: 3,
    NINTH: 4,
    ELEVENTH: 5,
    SHARP_ELEVENTH: 6,
    THIRTEENTH: 7,
    UNKNOWN: 8
};

// ============================================================================
// VOICING EDITOR CLASS
// ============================================================================
class VoicingEditor {
    constructor() {
        // Constants (from .hpp lines 142-145)
        this.NODE_RADIUS = 9.0;
        this.SELECTION_RADIUS = 10.0;
        this.STEPS_PER_OCTAVE = 53;
        this.TOTAL_STEPS = 53;
        
        // 12-TET pattern for reference notes (from .hpp line 146)
        this.STEP_PATTERN = [0, 5, 4, 5, 4, 4, 5, 4, 5, 4, 4, 5];
        
        // Display properties (from .cpp lines 5-20)
        this.radius = 0;
        this.innerRadius = 0.3;  // Start point for 6 rings (-1, 0, 1, 2, 3, 4)
        this.center = { x: 0, y: 0 };
        this.octaveSpacing = 0;
        // Frame size scaling. Grown 1.45 → 1.66 to fit the 6th (outer) ring at
        // r=1.35·radius while keeping the SAME margin the old outer ring had
        // (1.45−1.14 = 0.31). The existing rings are NOT resized — only the frame
        // expands outward, so the widget gets wider (innerRadius/octaveSpacing fixed).
        this.factorSize = 1.66; //area of the frame size scaling
        
        // Title bar dragging (from .hpp lines 182-184)
        this.isDraggingTitleBar = false;
        this.titleBarOffset = { x: 0, y: 0 };
        this.titleBarHeight = 24;
        
        // Note dragging state (from .hpp lines 106-113)
        this.draggedNoteIndex = -1;
        this.dragStartAngle = 0;
        this.dragStartTETPosition = 0;
        this.isNoteDragging = false;
        this.previousDragAngle = 0;
        
        // Voicing data (from .hpp lines 215-219)
        this.currentVoicing = [];
        this.chordComponents = [];
        this.currentScalePositions = [];
        this.noteData = [];
        this.addOctaveBase = true;

        // --- Dynamic-editing state (Voicing Editor v2, STRATEGY §6.3) ---
        // Root tracked by PITCH CLASS, not by array index (R3) — so component ID
        // stays correct when the bass ≠ root (drop voicings) and after re-sorts.
        this.rootPitchClass = 0;
        // Notes carry a stable id so selection/drag survive re-sorting (R2).
        this.noteIdCounter = 0;
        this.selectedNoteId = -1;
        // Click-vs-drag tracking: a press only becomes a drag once the pointer
        // travels past CLICK_DRAG_THRESHOLD; otherwise release = a select click.
        this._pressNoteId = -1;
        this._pressX = 0;
        this._pressY = 0;
        this._didDrag = false;
        this.CLICK_DRAG_THRESHOLD = 4; // px
        // Snapshot of the voicing as loaded, for the Reset button (R8).
        this.originalVoicing = [];
        
        // State flags (from .hpp lines 216-217, 241)
        this.isChordClicked = false;
        this.hasActiveChord = false;
        this.lastChordId = -1;
        
        // Dark mode (from .hpp line 161)
        this.darkMode = true;
        
        // Callback for voicing changes (from .hpp line 49)
        this.onVoicingChanged = null;
        
        // Colors - matching C++ exactly (from .hpp lines 220-254)
        this.lightTextColor = [255, 255, 255];
        this.darkTextColor = [0, 0, 0];
        this.textColor = [255, 255, 255];
        this.selectedNodeColor = [255, 200, 0];
        this.outNote = [255, 85, 10];
        this.selectorCircle = [0, 100, 255];
        this.scaleNode = [50, 50, 50, 80];
        this.ring = [50, 50, 50, 100];
        this.subScale = [255, 192, 75];
        this.activeNote = [10, 10, 10];
        this.nodeBackground = [223, 223, 223];
        this.lineColor = [0, 204, 255, 200];
        
        // Chord component colors (from .hpp lines 244-251)
        this.root_note = [252, 204, 60];
        this.third_note = [117, 218, 255];
        this.fifth_note = [54, 191, 255];
        this.seventh_note = [4, 159, 255];
        this.ninth_note = [255, 201, 86];
        this.eleventh_note = [255, 204, 63];
        this.sharp_eleventh_note = [255, 194, 82];
        this.thirteenth_note = [255, 183, 0];
        
        // Current fill/stroke colors for drawing
        this.fillColor = [255, 255, 255];
        this.strokeColor = [255, 255, 255];

        this.Report = true;
    }
    
    // ========================================================================
    // SETUP AND INITIALIZATION (from .cpp lines 5-73)
    // ========================================================================
    setup(inRadius, topLeft, noteDataArray) {
        // Match ScaleEditor size exactly (from .cpp lines 6-10)
        this.radius = inRadius;
        // Center should be at outerRadius distance from topLeft for proper positioning
        // Add 5px down to account for title bar eating space (matches C++ implementation)
        const outerRadius = this.radius * this.factorSize;
        this.center = {
            x: topLeft.x + outerRadius,
            y: topLeft.y + outerRadius + 5
        };
        this.drawCenterY = this.center.y + 10;
        
        // Initialize interaction states (from .cpp lines 12-13)
        this.selectedNote = -1;
        this.isDragging = false;
        
        // Load note data (from .cpp line 16)
        this.noteData = noteDataArray;
        
        // Set spacing between octave rings (from .cpp line 18)
        this.octaveSpacing = this.radius * 0.21;
        
        // Initialize colors (from .cpp lines 23-24 and 36-42)
        this.rootColor = this.selectorCircle;
        this.noteColor = [200, 200, 200];
        
        if (this.darkMode) {
            this.textColor = this.lightTextColor;
            this.ring = [255, 255, 255, 50];
            this.scaleNode = [255, 255, 255, 80];
        } else {
            this.textColor = this.darkTextColor;
            this.ring = [50, 50, 50, 100];
            this.scaleNode = [50, 50, 50, 80];
        }
    }
    
    // ========================================================================
    // DARK MODE (from .cpp lines 45-58)
    // ========================================================================
    setDarkMode(inDarkMode) {
        this.darkMode = inDarkMode;
        if (this.darkMode) {
            this.textColor = this.lightTextColor;
            this.ring = [255, 255, 255, 50];
            this.scaleNode = [255, 255, 255, 80];
        } else {
            this.textColor = this.darkTextColor;
            this.ring = [50, 50, 50, 100];
            this.scaleNode = [50, 50, 50, 80];
        }
    }
    
    // ========================================================================
    // SCALE MANAGEMENT (from .cpp lines 118-182)
    // ========================================================================
    setCurrentScale(notes) {
        this.currentScalePositions = [];
        for (let note of notes) {
            let normalizedPos = ((note.ft_note % this.TOTAL_STEPS) + this.TOTAL_STEPS) % this.TOTAL_STEPS;
            this.currentScalePositions.push(normalizedPos);
        }
        
        // Sort and remove duplicates (from .cpp lines 126-128)
        this.currentScalePositions.sort((a, b) => a - b);
        this.currentScalePositions = [...new Set(this.currentScalePositions)];
    }
    
    isNoteInScale(tetPosition) {
        // If no scale is set, allow all positions (from .cpp lines 135-137)
        if (this.currentScalePositions.length === 0) {
            return true;
        }
        
        // Normalize to 0-52 range (from .cpp line 140)
        let normalizedPos = ((tetPosition % this.TOTAL_STEPS) + this.TOTAL_STEPS) % this.TOTAL_STEPS;
        
        // Binary search to check if position is in scale (from .cpp lines 142-147)
        return this.currentScalePositions.includes(normalizedPos);
    }
    
    snapToNearestScaleNote(tetPosition) {
        // Direct port - currently returns position as-is (from .cpp lines 152-176)
        return tetPosition;
    }
    
    // ========================================================================
    // NOTE FINDING AND INTERACTION (from .cpp lines 180-230)
    // ========================================================================
    findNearestNote(mouse, includeRoot = false) {
        if (this.currentVoicing.length === 0) return -1;

        let closestDist = 25.0;  // Increased for easier selection
        let closestNote = -1;

        for (let i = 0; i < this.currentVoicing.length; i++) {
            // The root (index 0) can be SELECTED (includeRoot) but not angular-dragged.
            if (i === 0 && !includeRoot) continue;

            let pos = this.currentVoicing[i];
            let angle = this.getAngle(pos.normalizedTET);
            // 5-ring system: radius * innerRadius + ((octave + 1) * octaveSpacing)
            let r = this.radius * this.innerRadius + ((pos.octave + 1) * this.octaveSpacing);
            
            // Calculate note position
            let notePos = {
                x: this.center.x + r * Math.cos(angle),
                y: this.drawCenterY + r * Math.sin(angle)
            };
            
            let distance = Math.sqrt(Math.pow(mouse.x - notePos.x, 2) + Math.pow(mouse.y - notePos.y, 2));
            if (distance < closestDist) {
                closestDist = distance;
                closestNote = i;
            }
        }
        
        return closestNote;
    }
    
    isWithinDraggingLimits(noteIndex, newAngle) {
        if (noteIndex <= 0 || noteIndex >= this.currentVoicing.length)
            return false;
        
        // Calculate normalized TET position for the new angle
        let newTETPosition = this.angleToTETPosition(newAngle);
        
        // Get the current octave of the note
        let currentOctave = this.currentVoicing[noteIndex].octave;
        
        // Check previous note (if it exists)
        if (noteIndex > 1) {
            let prevNote = this.currentVoicing[noteIndex - 1];
            
            // If same octave, check TET position
            if (currentOctave === prevNote.octave) {
                let prevTETPosition = prevNote.normalizedTET;
                if (newTETPosition <= prevTETPosition) {
                    return false;
                }
            }
        }
        
        // Check next note (if it exists)
        if (noteIndex < this.currentVoicing.length - 1) {
            let nextNote = this.currentVoicing[noteIndex + 1];
            
            // If same octave, check TET position
            if (currentOctave === nextNote.octave) {
                let nextTETPosition = nextNote.normalizedTET;
                if (newTETPosition >= nextTETPosition) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    // ========================================================================
    // ANGLE/TET CONVERSION (from .cpp lines 262-288)
    // ========================================================================
    angleToTETPosition(angle) {
        const PI = Math.PI;
        const TWO_PI = Math.PI * 2;
        
        // Adjust angle to match TET calculation (C at top)
        angle = (angle + PI/2) % TWO_PI;
        if (angle < 0) angle += TWO_PI;
        
        // Calculate TET position
        let tetPos = Math.round((angle * this.TOTAL_STEPS) / TWO_PI);
        
        // Ensure positive modulo result
        return ((tetPos % this.TOTAL_STEPS) + this.TOTAL_STEPS) % this.TOTAL_STEPS;
    }
    
    tetPositionToAngle(position) {
        const PI = Math.PI;
        const TWO_PI = Math.PI * 2;
        
        // Convert from TET position to angle (adjusting for C at top)
        let angle = (TWO_PI * position / this.TOTAL_STEPS) - (PI/2);
        return angle;
    }
    
    // ========================================================================
    // NOTE DRAGGING (from .cpp lines 290-307)
    // ========================================================================
    handleNoteDragging(mouseAngle) {
        const TWO_PI = Math.PI * 2;
        
        if (this.draggedNoteIndex <= 0 || this.draggedNoteIndex >= this.currentVoicing.length)
            return;
        
        // Normalize the angle to 0-2PI range
        while (mouseAngle < 0) mouseAngle += TWO_PI;
        while (mouseAngle >= TWO_PI) mouseAngle -= TWO_PI;
        
        // Check if the new position is valid
        if (!this.isWithinDraggingLimits(this.draggedNoteIndex, mouseAngle)) {
            return;
        }
        
        // Update the dragged note's position
        let newTETPosition = this.angleToTETPosition(mouseAngle);
        this.updateVoicingAfterDrag(this.draggedNoteIndex, newTETPosition);
    }
    
    updateVoicingAfterDrag(noteIndex, newPosition) {
        if (noteIndex <= 0 || noteIndex >= this.currentVoicing.length)
            return;
        
        // Update the normalized TET position
        this.currentVoicing[noteIndex].normalizedTET = newPosition;
        
        // Update the absolute TET position preserving the original octave
        let octaveOffset = this.currentVoicing[noteIndex].octave;
        this.currentVoicing[noteIndex].absoluteTET = newPosition + (octaveOffset * this.TOTAL_STEPS);
        
        // Update the note name based on the new position
        this.currentVoicing[noteIndex].noteName = this.getNoteNameForStep(newPosition, true);
        
        // Notify parent of the change
        this.notifyVoicingChanged();
    }
    
    // ========================================================================
    // VOICING CHANGE NOTIFICATION (from .cpp lines 311-322)
    // ========================================================================
    notifyVoicingChanged() {
        if (this.onVoicingChanged) {
            // Create a vector of the updated positions
            let newPositions = [];
            for (let pos of this.currentVoicing) {
                newPositions.push(pos.absoluteTET);
            }
            //console.log('🔄 VoicingEditor notifying change:', newPositions);
            this.onVoicingChanged(newPositions);
        } else {
            //console.warn('⚠️ VoicingEditor: onVoicingChanged callback not set!');
        }
    }
    
    // ========================================================================
    // CHORD COMPONENT IDENTIFICATION (from .cpp lines 324-392)
    // ========================================================================
    identifyChordComponents() {
        this.chordComponents = [];
        
        if (this.currentVoicing.length === 0) return;

        // Root reference = tracked root PITCH CLASS, not the bass note (R3) — so
        // intervals stay correct when the lowest note isn't the root (drop voicings).
        let rootPos = this.rootPitchClass;

        // First pass: identify basic components
        for (let pos of this.currentVoicing) {
            let component = {
                type: ChordComponentType.UNKNOWN,
                position: pos.normalizedTET,
                name: pos.noteName,
                octave: pos.octave,
                isActive: true
            };
            
            // Calculate interval from root
            let interval = (pos.normalizedTET - rootPos + this.TOTAL_STEPS) % this.TOTAL_STEPS;
            
            component.type = this.determineComponentType(interval);
            this.chordComponents.push(component);
        }
    }
    
    determineComponentType(interval) {
        // These intervals are specific to 53TET (from .cpp lines 346-358)
        if (interval === 0) return ChordComponentType.ROOT;
        if (interval >= 11 && interval <= 20) return ChordComponentType.THIRD;
        if (interval >= 27 && interval <= 35) return ChordComponentType.FIFTH;
        if (interval >= 42 && interval <= 52) return ChordComponentType.SEVENTH;
        if (interval >= 3 && interval <= 10) return ChordComponentType.NINTH;
        if (interval >= 21 && interval <= 25) return ChordComponentType.ELEVENTH;
        if (interval === 26) return ChordComponentType.SHARP_ELEVENTH;
        if (interval >= 33 && interval <= 41) return ChordComponentType.THIRTEENTH;
        
        return ChordComponentType.UNKNOWN;
    }
    
    calculateExtendedComponents() {
        if (this.currentVoicing.length === 0) return;

        // SCALE-DERIVED extensions (R4): the 9th/11th/13th are the 2nd/4th/6th
        // scale degrees above the root, raised one octave — so e.g. a Lydian 11th
        // comes out as the #11 the scale actually contains, not a hardcoded P4.
        // Pitch classes come from currentScalePositions; falls back to fixed
        // 53-TET offsets if no scale is loaded. (#11 intentionally dropped — the
        // set is 9/11/13 per the design decision.)
        let rootPos = this.rootPitchClass;
        let rootAbs = this.getRootAbsolute();
        // Top of the current voicing — extensions are added ABOVE this (upper notes).
        let topAbs = this.currentVoicing.reduce((m, v) => Math.max(m, v.absoluteTET), rootAbs);

        // Scale-degree intervals above the root, ascending:
        // rel[1]=2nd, rel[3]=4th, rel[5]=6th  →  9th, 11th, 13th.
        let rel = [...new Set(this.currentScalePositions.map(
            pc => (((pc - rootPos) % this.TOTAL_STEPS) + this.TOTAL_STEPS) % this.TOTAL_STEPS))]
            .sort((a, b) => a - b);
        const degInterval = (i, fallback) => (rel.length > i ? rel[i] : fallback);

        const exts = [
            { type: ChordComponentType.NINTH,      interval: degInterval(1, 9)  },
            { type: ChordComponentType.ELEVENTH,   interval: degInterval(3, 22) },
            { type: ChordComponentType.THIRTEENTH, interval: degInterval(5, 40) },
        ];

        const MAX_OCTAVE = 4; // outermost ring — nothing may go beyond it
        for (const e of exts) {
            // Place the extension's pitch class just ABOVE the current top note (the
            // upper note of the voicing)…
            let abs = rootAbs + e.interval;
            while (abs <= topAbs) abs += this.TOTAL_STEPS;
            // …but HARD-CLAMP to the rings so a spread voicing can't fling it off the
            // widget (was producing notes ~17 rings up). Drop octaves until on a ring.
            while (this.getOctave(abs) > MAX_OCTAVE) abs -= this.TOTAL_STEPS;
            let pc = ((abs % this.TOTAL_STEPS) + this.TOTAL_STEPS) % this.TOTAL_STEPS;
            this.chordComponents.push({
                type: e.type,
                position: pc,
                absoluteTET: abs,
                name: this.getNoteNameForStep(pc, false),
                octave: this.getOctave(abs),
                isActive: false
            });
        }
    }

    // Absolute 53-TET position of the chord root (lowest note whose pitch class is
    // the root). The bass may not be the root after drop voicings, so search.
    getRootAbsolute() {
        let best = null;
        for (let v of this.currentVoicing) {
            if (v.normalizedTET === this.rootPitchClass && (best === null || v.absoluteTET < best)) {
                best = v.absoluteTET;
            }
        }
        if (best !== null) return best;
        return this.currentVoicing.length ? this.currentVoicing[0].absoluteTET : this.rootPitchClass;
    }

    // Move the currently-selected note up (+1) or down (−1) one octave ring
    // (Step 7). Clamped to the 6 rings (−1…4) so it can't leave the widget. The
    // note keeps its id, so the selection highlight follows it.
    moveSelectedNoteOctave(delta) {
        let v = this.currentVoicing.find(n => n.id === this.selectedNoteId);
        if (!v) return;
        let newOctave = v.octave + delta;
        if (newOctave < -1 || newOctave > 4) return; // clamp to rings
        v.octave = newOctave;
        v.absoluteTET = v.normalizedTET + newOctave * this.TOTAL_STEPS;
        v.scalePosition = v.absoluteTET;
        this.currentVoicing.sort((a, b) => a.absoluteTET - b.absoluteTET);
        this.identifyChordComponents();
        this.calculateExtendedComponents();
        this.notifyVoicingChanged();
    }

    // Is voicing-note v this extension `type`? Prefer the explicit `extType` tag we
    // put on notes WE added (reliable); fall back to interval-band classification
    // for extensions that were already in the loaded voicing.
    isExtension(v, type) {
        if (v.extType !== undefined) return v.extType === type;
        let band = this.determineComponentType(
            (((v.normalizedTET - this.rootPitchClass) % this.TOTAL_STEPS) + this.TOTAL_STEPS) % this.TOTAL_STEPS);
        return band === type;
    }

    // Add or remove a 9th/11th/13th (Step 3). Toggle: if already present, remove
    // EVERY note of that extension (so repeated clicks can't keep stacking); else
    // add ONE at the clamped above-top position, tagged with its type. Re-IDs
    // components and notifies the chord so the label picks up …9/11/13.
    toggleExtension(type) {
        if (this.currentVoicing.some(v => this.isExtension(v, type))) {
            this.currentVoicing = this.currentVoicing.filter(v => !this.isExtension(v, type));
        } else {
            let ghost = this.chordComponents.find(c => c.type === type && c.isActive === false);
            if (!ghost) return;
            let abs = ghost.absoluteTET;
            this.currentVoicing.push({
                id: this.noteIdCounter++,
                extType: type,                  // tag → reliable toggle-off
                scalePosition: abs,
                absoluteTET: abs,
                normalizedTET: ((abs % this.TOTAL_STEPS) + this.TOTAL_STEPS) % this.TOTAL_STEPS,
                octave: this.getOctave(abs),
                noteName: ghost.name
            });
            this.currentVoicing.sort((a, b) => a.absoluteTET - b.absoluteTET);
        }
        this.identifyChordComponents();
        this.calculateExtendedComponents();
        this.notifyVoicingChanged();
    }

    // Hit-test the inactive extension ghosts (for click-to-add). Returns the
    // component type under the cursor, or null. Only ghosts whose band is NOT yet
    // voiced are clickable (ghost-click = ADD; removal is via the buttons / Step 6).
    extensionGhostAt(mouse) {
        const EXT = [ChordComponentType.NINTH, ChordComponentType.ELEVENTH, ChordComponentType.THIRTEENTH];
        for (let c of this.chordComponents) {
            if (!EXT.includes(c.type) || c.isActive) continue;
            if (this.currentVoicing.some(v => this.isExtension(v, c.type))) continue;
            let angle = this.getAngle(c.position);
            let r = this.radius * this.innerRadius + ((c.octave + 1) * this.octaveSpacing);
            let px = this.center.x + r * Math.cos(angle);
            let py = this.drawCenterY + r * Math.sin(angle);
            if (Math.hypot(mouse.x - px, mouse.y - py) < 18) return c.type;
        }
        return null;
    }
    
    calculateSharpEleventh(rootPosition) {
        // In 53TET, sharp 11th is approximately 26 steps from root
        return (rootPosition + 26) % this.TOTAL_STEPS;
    }
    
    // ========================================================================
    // COMPONENT COLOR AND LABELS (from .cpp lines 419-472)
    // ========================================================================
    getComponentColor(type, isActive) {
        switch(type) {
            case ChordComponentType.ROOT:
                this.fillColor = isActive ? this.root_note : [...this.root_note, 150];
                this.strokeColor = this.root_note;
                break;
            case ChordComponentType.THIRD:
                this.fillColor = isActive ? this.third_note : [...this.third_note, 150];
                this.strokeColor = this.third_note;
                break;
            case ChordComponentType.FIFTH:
                this.fillColor = isActive ? this.fifth_note : this.root_note;
                this.strokeColor = this.fifth_note;
                break;
            case ChordComponentType.SEVENTH:
                this.fillColor = isActive ? this.seventh_note : this.root_note;
                this.strokeColor = this.seventh_note;
                break;
            case ChordComponentType.NINTH:
                this.fillColor = isActive ? this.ninth_note : this.root_note;
                this.strokeColor = this.ninth_note;
                break;
            case ChordComponentType.ELEVENTH:
                this.fillColor = isActive ? this.eleventh_note : this.root_note;
                this.strokeColor = this.eleventh_note;
                break;
            case ChordComponentType.SHARP_ELEVENTH:
                this.fillColor = isActive ? this.sharp_eleventh_note : this.root_note;
                this.strokeColor = this.sharp_eleventh_note;
                break;
            case ChordComponentType.THIRTEENTH:
                this.fillColor = isActive ? this.thirteenth_note : this.root_note;
                this.strokeColor = this.thirteenth_note;
                break;
            case ChordComponentType.UNKNOWN:
            default:
                this.fillColor = isActive ? this.root_note : this.root_note;
                this.strokeColor = this.root_note;
                break;
        }
    }
    
    getComponentLabel(type) {
        switch(type) {
            case ChordComponentType.ROOT: return "R";
            case ChordComponentType.THIRD: return "3";
            case ChordComponentType.FIFTH: return "5";
            case ChordComponentType.SEVENTH: return "7";
            case ChordComponentType.NINTH: return "9";
            case ChordComponentType.ELEVENTH: return "11";
            case ChordComponentType.SHARP_ELEVENTH: return "♯11";
            case ChordComponentType.THIRTEENTH: return "13";
            default: return "";
        }
    }
    
    isChordExtension(type) {
        return type === ChordComponentType.NINTH || 
               type === ChordComponentType.ELEVENTH || 
               type === ChordComponentType.SHARP_ELEVENTH ||
               type === ChordComponentType.THIRTEENTH;
    }
    
    // ========================================================================
    // HELPER FUNCTIONS (from .cpp lines 476-531)
    // ========================================================================
    shouldDrawNoteAtStep(step) {
        if (step === 0) return true; // Always draw C
        
        let cumulativeSteps = 0;
        
        // Check each position in the pattern
        for (let p = 0; p < 12; p++) {
            cumulativeSteps += this.STEP_PATTERN[p];
            if (step === cumulativeSteps) {
                return true;
            }
        }
        
        return false;
    }
    
    getNoteNameForStep(steps, drawNumber) {
        for (let note of this.noteData) {
            if (note.reference === steps) {
                let name = note.noteName;
                if (name.length > 0 && !isNaN(name[name.length - 1]) && !drawNumber) {
                    name = name.slice(0, -1); // Remove octave number if not needed
                }
                return name;
            }
        }
        return "";
    }
    
    getOctave(absolutePosition) {
        // Math.floor handles both positive and negative correctly
        // -40 / 53 = -0.75... → floor = -1 ✓
        // -53 / 53 = -1.0 → floor = -1 ✓
        // -54 / 53 = -1.01... → floor = -2 ✓
        return Math.floor(absolutePosition / this.TOTAL_STEPS);
    }
    
    getNormalizedPosition(absolutePosition) {
        return ((absolutePosition % this.TOTAL_STEPS) + this.TOTAL_STEPS) % this.TOTAL_STEPS;
    }
    
    // ========================================================================
    // VOICING ANALYSIS (from .cpp lines 549-575)
    // ========================================================================
    updateCurrentVoicing(notes, positions) {
        // console.log('🎵 VoicingEditor.updateCurrentVoicing called:', {
        //     notesCount: notes.length,
        //     positionsCount: positions.length,
        //     positions: positions,
        //     notesFtNotes: notes.map(n => n.ft_note)
        // });
        // console.log('📍 Incoming positions (absoluteTET):', positions);
        // console.log('📍 Current voicing before update:', this.currentVoicing.map(v => `${v.noteName}(oct:${v.octave}, abs:${v.absoluteTET})`));
        
        if (notes.length === 0 || positions.length === 0) {
            //console.warn('⚠️ VoicingEditor: Empty notes or positions array');
            return;
        }
        
        this.isChordClicked = true;
        // Snapshot the as-loaded voicing so the Reset button can restore it (R8).
        this.originalVoicing = [...positions];
        this.selectedNoteId = -1; // clear any stale selection from the previous chord
        this.analyzeVoicing(notes, positions);
        this.identifyChordComponents();
        this.calculateExtendedComponents();
        
        // console.log('✓ VoicingEditor updated:', {
        //     voicingCount: this.currentVoicing.length,
        //     isChordClicked: this.isChordClicked,
        //     voicing: this.currentVoicing.map(v => `${v.noteName}(oct:${v.octave}, tet:${v.normalizedTET})`)
        // });
    }
    
    analyzeVoicing(notes, voicingPositions) {
        this.currentVoicing = [];

        // Root pitch class = the chord root (notes[0]), tracked independently of
        // array order so component ID survives drops / re-sorts (R3).
        if (notes.length > 0) {
            this.rootPitchClass = ((notes[0].ft_note % this.TOTAL_STEPS) + this.TOTAL_STEPS) % this.TOTAL_STEPS;
        }

        // Create note lookup map
        let noteMap = new Map();
        for (let note of notes) {
            noteMap.set(note.ft_note, note);
        }

        for (let tetPosition of voicingPositions) {
            // Calculate octave first (which ring the note is on)
            let octave = this.getOctave(tetPosition);

            // Normalize to 0-52 range for angular position around the circle
            let normalizedTET = ((tetPosition % this.TOTAL_STEPS) + this.TOTAL_STEPS) % this.TOTAL_STEPS;

            let vPos = {
                id: this.noteIdCounter++,   // stable identity (R2)
                scalePosition: tetPosition,
                absoluteTET: tetPosition,
                normalizedTET: normalizedTET,
                octave: octave,
                noteName: ""
            };

            let note = noteMap.get(tetPosition);
            if (note) {
                vPos.noteName = note.name;
            }

            this.currentVoicing.push(vPos);
        }

        // NOTE: the old "smart root doubling" (addOctaveBase) was removed — it
        // inserted a phantom duplicate root that corrupted drop-voicing numbering
        // and selection (STRATEGY R5). currentVoicing now holds only real notes.
    }
    
    calculateInterval(baseNote, targetNote) {
        let info = {
            rawInterval: targetNote - baseNote,
            octaveOffset: 0,
            normalizedInterval: 0
        };
        
        info.octaveOffset = Math.floor(info.rawInterval / this.TOTAL_STEPS);
        info.normalizedInterval = info.rawInterval % this.TOTAL_STEPS;
        
        if (info.normalizedInterval < 0) {
            info.normalizedInterval += this.TOTAL_STEPS;
            info.octaveOffset -= 1;
        }
        
        return info;
    }
    
    // ========================================================================
    // DRAWING: CIRCLE GRID (from .cpp lines 693-789)
    // ========================================================================
    drawCircleGrid() {
        const p = this.p;
        if (!p) return;
        
        const PI = Math.PI;
        const TWO_PI = Math.PI * 2;
        
        // Draw reference circles for each octave (-1 to 4) - 6 rings total
        // radius * innerRadius + ((octave + 1) * octaveSpacing)
        for (let octave = -1; octave < 5; octave++) {
            let r = this.radius * this.innerRadius + ((octave + 1) * this.octaveSpacing);
            
            // Draw the main circle
            p.noFill();
            p.stroke(...this.ring);
            p.strokeWeight(1);
            p.circle(this.center.x, this.drawCenterY, r * 2);
            
            // Draw tick marks for each step
            for (let step = 0; step < this.TOTAL_STEPS; step++) {
                // Adjust angle to put C at top
                let angle = this.getAngle(step);
                
                let innerPos = {
                    x: this.center.x + (r - 4) * Math.cos(angle),
                    y: this.drawCenterY + (r - 4) * Math.sin(angle)
                };
                
                let outerPos = {
                    x: this.center.x + r * Math.cos(angle),
                    y: this.drawCenterY + r * Math.sin(angle)
                };
                
                // Check if step is in current scale
                let normalizedStep = ((step % this.TOTAL_STEPS) + this.TOTAL_STEPS) % this.TOTAL_STEPS;
                if (this.currentScalePositions.includes(normalizedStep)) {
                    // Draw a bigger, light gray circle for scale notes
                    p.fill(...this.nodeBackground);
                    p.noStroke();
                    p.circle(outerPos.x, outerPos.y, 15); // diameter = 2 * radius
                } else {
                    // Draw regular small node
                    p.noFill();
                    p.stroke(...this.scaleNode);
                    p.strokeWeight(1);
                    p.circle(outerPos.x, outerPos.y, 5);
                }
                
                // Only draw reference points and labels for the innermost wheel
                if (octave === -1) {
                    if (this.shouldDrawNoteAtStep(step)) {
                        let angle = (TWO_PI * ((step + 13) % this.TOTAL_STEPS) / this.TOTAL_STEPS) - PI;
                        // p.fill(...this.subScale);
                        // p.noStroke();
                        // p.circle(outerPos.x, outerPos.y, 5);
                        
                        // Use reference relative to C0
                        let reference = step - 40; // Adjust to match C at top
                        let noteName = this.getNoteNameForStep(reference, false);
                        if (noteName !== "") {
                            let labelRadius = r - 15.0;
                            let labelPos = {
                                x: this.center.x + labelRadius * Math.cos(angle),
                                y: this.drawCenterY + labelRadius * Math.sin(angle)
                            };
                            
                            p.fill(...this.textColor);
                            p.noStroke();
                            p.textAlign(p.CENTER, p.CENTER);
                            p.textSize(12);
                            p.text(noteName, labelPos.x, labelPos.y);
                        }
                    }
                }
            }
        }
    }
    
    // ========================================================================
    // DRAWING: MAIN CIRCLE BACKGROUND (from .cpp lines 791-828)
    // ========================================================================
    drawMainCircle() {
        const p = this.p;
        if (!p) return;
        
        let outerRadius = this.radius * this.factorSize;
        let padding = 0;
        let rectWidth = (outerRadius + padding) * 2;
        let rectHeight = (outerRadius + padding) * 2;
        let rectX = this.center.x - rectWidth / 2;
        let rectY = this.center.y - rectHeight / 2;
        let rounded = 15;

        // Use gradient if available
        if (window.shaderManager && window.shaderManager.initialized) {
            let startColor, endColor;
            if (this.darkMode) {
                startColor = [255, 255, 255, 255];  // Lighter gray center
                endColor = [215, 215, 215, 200];     // Darker gray edges (more visible)
            } else {
                startColor = [255, 255, 255, 255];  // White center
                endColor = [215, 215, 215, 200];     // Light gray edges
            }
            window.shaderManager.drawEditorBackground(
                p, this.center.x, this.center.y, 
                rectWidth, rectHeight, 
                startColor, endColor, rounded
            );
        } else {
            // Fallback
            if (this.darkMode) {
                p.fill(127, 127, 127, 230);
            } else {
                p.fill(240, 200);
            }
            p.noStroke();
            p.rect(rectX, rectY, rectWidth, rectHeight, rounded);
        }
    }
    
    // ========================================================================
    // DRAWING: TITLE BAR (from .cpp lines 830-850)
    // ========================================================================
    drawTitleBar() {
        const p = this.p;
        if (!p) return;
        
        let outerRadius = this.radius * this.factorSize;
        let titleBarWidth = outerRadius * 2;
        let titleBarY = this.center.y - outerRadius;
        let rounded = 15;
        let halfHeight = this.titleBarHeight / 2.0;
        
        // Draw title bar background
        p.fill(210);
        p.noStroke();
        p.rect(this.center.x - outerRadius, titleBarY + halfHeight, titleBarWidth, halfHeight);
        p.rect(this.center.x - outerRadius, titleBarY, titleBarWidth, this.titleBarHeight, rounded, rounded, 0, 0);
        
        // Draw title
        p.fill(20);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(14);
        p.text("Voicing Editor", this.center.x, titleBarY + this.titleBarHeight * 0.5);
    }
    
    // ========================================================================
    // DRAWING: CURRENT VOICING (from .cpp lines 852-946)
    // ========================================================================
    drawCurrentVoicing() {
        const p = this.p;
        if (!p) return;
        if (this.currentVoicing.length === 0) return;
        
        if (this.Report){
            // Log voicing positions used for ring placement
            // console.log('🎼 Voicing positions on rings:', this.currentVoicing.map(pos => 
            //     `note#${this.currentVoicing.indexOf(pos)}: normalizedTET=${pos.normalizedTET}, octave=${pos.octave}, absoluteTET=${pos.absoluteTET}`
            // ));
            this.Report = false;
        }
        
        // Draw each note with its order number
        for (let i = 0; i < this.currentVoicing.length; i++) {
            let pos = this.currentVoicing[i];
            
            // Get note name
            let noteName = pos.noteName;
            
            // Eliminate octave number from note name
            if (noteName.length > 1 && !isNaN(noteName[noteName.length - 1])) {
                noteName = noteName.slice(0, -1);
            }
            
            // Fallback for outside notes
            if (noteName === "") {
                noteName = this.getNoteNameForStep(pos.normalizedTET, true);
            }
            // Remove trailing number (octave) if present
            if (noteName.length > 0 && !isNaN(noteName[noteName.length - 1])) {
                noteName = noteName.slice(0, -1);
            }
            
            // Use ScaleEditor's angle calculation method
            let angle = this.getAngle(pos.normalizedTET);
            // 5-ring system: radius * innerRadius + ((octave + 1) * octaveSpacing)
            let r = this.radius * this.innerRadius + ((pos.octave + 1) * this.octaveSpacing);
            
            // Calculate note position
            let notePos = {
                x: this.center.x + r * Math.cos(angle),
                y: this.drawCenterY + r * Math.sin(angle)
            };
            
            // Prepare text to get its bounds
            let info = noteName;
            p.textSize(14);
            let infoWidth = p.textWidth(info);
            let textHeight = 14; // approximate
            
            // Add padding to the rectangle
            let padding_x = 5;
            let padding_y = 4;
            let rectWidth = infoWidth + padding_x * 2 + 10; // extra space for text
            let rectHeight = textHeight + padding_y * 2;
            
            // Determine color based on selection state and note function
            let bgColor;
            if (i === 0) {
                // Root note - fixed color
                bgColor = this.root_note;
            } else if (i === this.draggedNoteIndex && this.isNoteDragging) {
                // Currently selected note
                bgColor = this.selectedNodeColor;
            } else {
                // Check if this note is in the scale
                let normalizedPos = pos.normalizedTET;
                let inScale = this.currentScalePositions.includes(normalizedPos);
                
                // Set color based on scale membership
                if (!inScale) {
                    bgColor = this.outNote; // Red for out-of-scale notes
                } else {
                    // Use the normal color for scale notes
                    bgColor = this.fillColor;
                }
            }
            
            // Draw the rounded rectangle background
            p.fill(...bgColor);
            p.noStroke();
            p.rect(notePos.x - rectWidth/2, notePos.y - rectHeight/2, rectWidth, rectHeight, 10);
            
            // Set text color
            let textColor;
            if (i === this.draggedNoteIndex && this.isNoteDragging) {
                textColor = [255, 255, 255];
            } else {
                let normalizedPos = pos.normalizedTET;
                let inScale = this.currentScalePositions.includes(normalizedPos);
                if (!inScale) {
                    textColor = [255, 255, 255]; // white text for red background
                } else {
                    textColor = [0, 0, 0];
                }
            }
            
            p.fill(...textColor);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(14);
            p.text(info, notePos.x, notePos.y);
            
            // Add a border to indicate draggable notes (except the root)
            if (i > 0) {
                p.noFill();
                p.stroke(255);
                p.strokeWeight(i === this.draggedNoteIndex ? 3 : 1);
                p.rect(notePos.x - rectWidth/2, notePos.y - rectHeight/2, rectWidth, rectHeight, 10);
            }

            // Persistent selection highlight (Step 2): bold ORANGE ring around the
            // selected note (works for the root too). Drives the octave-move (Step 7).
            if (pos.id === this.selectedNoteId) {
                p.noFill();
                p.stroke(...this.selectedNodeColor);
                p.strokeWeight(3);
                p.rect(notePos.x - rectWidth/2 - 3, notePos.y - rectHeight/2 - 3,
                       rectWidth + 6, rectHeight + 6, 12);
            }
        }
    }
    
    // ========================================================================
    // DRAWING: INTERVAL LINES (from .cpp lines 948-1006)
    // ========================================================================
    drawIntervalLines() {
        if (this.currentVoicing.length < 2) return;
        
        const PI = Math.PI;
        const TWO_PI = Math.PI * 2;
        const p = this.p;
        if (!p) return;
        
        p.stroke(...this.lineColor);
        p.noFill();
        p.strokeWeight(5);
        
        // Draw all connections including root to first note
        for (let i = 0; i < this.currentVoicing.length - 1; i++) {
            let note1 = this.currentVoicing[i];
            let note2 = this.currentVoicing[i + 1];
            
            let angle1 = this.getAngle(note1.normalizedTET);
            let angle2 = this.getAngle(note2.normalizedTET);
            // 5-ring system: radius * innerRadius + ((octave + 1) * octaveSpacing)
            let r1 = this.radius * this.innerRadius + ((note1.octave + 1) * this.octaveSpacing);
            let r2 = this.radius * this.innerRadius + ((note2.octave + 1) * this.octaveSpacing);
            
            // Special handling for same note in different octaves
            if (note1.normalizedTET === note2.normalizedTET && note1.octave !== note2.octave) {
                angle2 += TWO_PI;  // Force a full rotation
            }
            // Regular clockwise progression for different notes
            else if (angle2 < angle1) {
                let angleDiff = angle1 - angle2;
                if (angleDiff > PI) {
                    angle1 -= TWO_PI;
                } else {
                    angle2 += TWO_PI;
                }
            }
            
            // Number of steps for the path
            const numSteps = 20;
            
            p.beginShape();
            for (let step = 0; step <= numSteps; step++) {
                let t = step / numSteps;
                let currentAngle = angle1 + (angle2 - angle1) * t;
                let currentR = r1 + (r2 - r1) * t;
                
                let pos = {
                    x: this.center.x + currentR * Math.cos(currentAngle),
                    y: this.drawCenterY + currentR * Math.sin(currentAngle)
                };
                p.vertex(pos.x, pos.y);
            }
            p.endShape();
        }
    }
    
    // ========================================================================
    // DRAWING: CHORD COMPONENTS (from .cpp lines 1008-1090)
    // ========================================================================
    drawComponentAtOctave(component, octave) {
        const p = this.p;
        if (!p) return;
        
        let angle = this.getAngle(component.position);
        let r = this.radius * this.innerRadius + ((octave + 1) * this.octaveSpacing);
        let pos = {
            x: this.center.x + r * Math.cos(angle),
            y: this.drawCenterY + r * Math.sin(angle)
        };
        
        this.getComponentColor(component.type, component.isActive);
        
        // Check if note is being used in current voicing
        let isUsed = false;
        for (let voicingPos of this.currentVoicing) {
            if (component.position === voicingPos.normalizedTET && 
                octave === voicingPos.octave) {
                isUsed = true;
                break;
            }
        }
        
        // Draw labels
        let functionLabel = this.getComponentLabel(component.type);
        let noteLabel = component.name;
        if (noteLabel.length > 1 && !isNaN(noteLabel[noteLabel.length - 1])) {
            noteLabel = noteLabel.slice(0, -1);  // Remove octave number
        }
        if (noteLabel.includes("#")) {
            functionLabel = "#" + functionLabel;
        }
        
        p.textSize(12);
        let labelWidth = p.textWidth(functionLabel) + 15;
        let labelHeight = 16;
        
        if (!isUsed) {
            // Unused notes: only stroke
            p.noFill();
            p.stroke(...this.strokeColor);
            p.strokeWeight(2);
            p.rect(pos.x - labelWidth/2, pos.y - labelHeight/2, labelWidth, labelHeight, 10);
        }
        
        p.fill(...this.textColor);
        p.noStroke();
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(12);
        p.text(functionLabel, pos.x, pos.y);
    }
    
    drawChordComponents() {
        const p = this.p;
        if (!p) return;
        
        for (let component of this.chordComponents) {
            // For main chord tones (R, 3, 5, 7)
            if (component.type === ChordComponentType.ROOT ||
                component.type === ChordComponentType.THIRD ||
                component.type === ChordComponentType.FIFTH ||
                component.type === ChordComponentType.SEVENTH) {
                // Draw main components in all wheels
                for (let octave = 0; octave < 4; octave++) {
                    this.drawComponentAtOctave(component, octave);
                }
            } else {
                // Extensions (9/11/13 ghosts): draw on their own scale-derived ring.
                this.drawComponentAtOctave(component, component.octave);
            }
        }
    }
    
    // ========================================================================
    // UPDATE (from .cpp update method)
    // ========================================================================
    update(p) {
        // Store p5 instance for drawing
        this.p = p;
    }
    
    // ========================================================================
    // MAIN DRAW (from .cpp lines 1092-1105)
    // ========================================================================
    draw(p) {
        // Store p5 instance
        this.p = p;
        
        if (this.isChordClicked && this.currentVoicing.length > 0) {
            p.push();
            this.drawMainCircle();
            this.drawCircleGrid();
            this.drawIntervalLines();
            this.drawChordComponents();
            this.drawCurrentVoicing();
            this.drawBottomButtons();
            this.drawTitleBar();
            p.pop();
        }
    }

    // Bottom controls:
    //   bottom-LEFT  : [ 9 ] [ 11 ] [ 13 ]  (toggle extensions; orange when voiced)
    //   bottom-RIGHT : [ ↑ ]                 (move SELECTED note a ring — vertical
    //                  [ ↓ ]                  stepper, ↑ above ↓; dim when no selection)
    // Rects cached for hit-testing.
    drawBottomButtons() {
        const p = this.p;
        if (!p) return;
        const outerRadius = this.radius * this.factorSize;
        const bottom = this.center.y + outerRadius - 8;
        p.textAlign(p.CENTER, p.CENTER);

        // --- extension buttons: horizontal row, bottom-left ---
        const ew = 38, eh = 22, egap = 6;
        const eY = bottom - eh;
        const ext = [
            { type: ChordComponentType.NINTH, label: '9' },
            { type: ChordComponentType.ELEVENTH, label: '11' },
            { type: ChordComponentType.THIRTEENTH, label: '13' },
        ];
        this._extButtons = [];
        p.textSize(13);
        let ex = this.center.x - outerRadius + 10;
        for (const e of ext) {
            const active = this.currentVoicing.some(v => this.isExtension(v, e.type));
            if (active) p.fill(...this.selectedNodeColor); else p.fill(210, 210, 210); // orange on / light gray off
            p.stroke(150); p.strokeWeight(1);
            p.rect(ex, eY, ew, eh, 6);
            p.noStroke();
            p.fill(active ? 255 : 50); // white text on orange, dark text on gray
            p.text(e.label, ex + ew / 2, eY + eh / 2);
            this._extButtons.push({ type: e.type, x: ex, y: eY, w: ew, h: eh });
            ex += ew + egap;
        }

        // --- octave buttons: vertical stepper (↑ on top, ↓ below), bottom-right ---
        const ow = 28, oh = 20, ovgap = 4;
        const ox = this.center.x + outerRadius - 10 - ow;
        const hasSel = this.currentVoicing.some(v => v.id === this.selectedNoteId);
        const oct = [
            { delta: +1, label: '↑', y: bottom - 2 * oh - ovgap }, // upper
            { delta: -1, label: '↓', y: bottom - oh },             // lower
        ];
        this._octButtons = [];
        p.textSize(15);
        for (const o of oct) {
            if (hasSel) p.fill(...this.selectedNodeColor); else p.fill(210, 210, 210); // orange when a note is selected, light gray otherwise
            p.stroke(150); p.strokeWeight(1);
            p.rect(ox, o.y, ow, oh, 6);
            p.noStroke();
            p.fill(hasSel ? 255 : 50); // white arrow on orange, dark on gray
            p.text(o.label, ox + ow / 2, o.y + oh / 2);
            this._octButtons.push({ delta: o.delta, x: ox, y: o.y, w: ow, h: oh });
        }
    }
    
    // ========================================================================
    // ANGLE CALCULATION (from .cpp lines 1107-1111)
    // ========================================================================
    getAngle(noteReference) {
        const TWO_PI = Math.PI * 2;
        const PI = Math.PI;
        let a = (TWO_PI * noteReference / this.TOTAL_STEPS + (2 * PI/2));
        return a;
    }
    
    // ========================================================================
    // MOUSE INTERACTION (from .cpp lines 1113-1256)
    // ========================================================================
    mousePressed(x, y, button) {
        if (!this.isChordClicked || this.currentVoicing.length === 0) return false;
        
        let mouse = { x: x, y: y };
        let outerRadius = this.radius * this.factorSize;
        let titleBarY = this.center.y - outerRadius;
        
        // Check title bar dragging
        if (mouse.y >= titleBarY && 
            mouse.y <= titleBarY + this.titleBarHeight && 
            mouse.x >= this.center.x - outerRadius && 
            mouse.x <= this.center.x + outerRadius) {
            // Only start dragging if not already interacting
            if (!this.isInteracting) {
                this.isDraggingTitleBar = true;
                this.isInteracting = true;
                this.titleBarOffset = { x: x - this.center.x, y: y - this.center.y };
            }
            return true;
        }
        
        // 9/11/13 buttons (lower-left) → toggle that extension.
        if (this._extButtons) {
            for (let b of this._extButtons) {
                if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                    this.toggleExtension(b.type);
                    return true;
                }
            }
        }

        // Octave ↑/↓ buttons (lower-right) → move the selected note a ring.
        if (this._octButtons) {
            for (let b of this._octButtons) {
                if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                    this.moveSelectedNoteOctave(b.delta);
                    return true;
                }
            }
        }

        // Click an inactive 9/11/13 ghost → add that extension (Step 3).
        if (!this.isInteracting) {
            let extType = this.extensionGhostAt(mouse);
            if (extType !== null) {
                this.toggleExtension(extType);
                return true;
            }
        }

        // Press on a note → selection candidate (any note incl. root) + arm an
        // angular drag for non-root notes. The drag only fires past the click
        // threshold (see mouseDragged), so a plain click just selects.
        if (!this.isInteracting) {
            let idx = this.findNearestNote(mouse, true); // include root for selection
            if (idx >= 0) {
                this._pressNoteId = this.currentVoicing[idx].id;
                this._pressX = x;
                this._pressY = y;
                this._didDrag = false;
                this.isInteracting = true;
                if (idx > 0) {
                    this.draggedNoteIndex = idx;
                    this.isNoteDragging = true;
                    this.dragStartAngle = Math.atan2(y - this.drawCenterY, x - this.center.x);
                    this.dragStartTETPosition = this.currentVoicing[idx].normalizedTET;
                }
                return true;
            }
        }
        return false;
    }
    
    mouseDragged(x, y, button) {
        if (!this.isChordClicked || this.currentVoicing.length === 0) return;
        
        if (this.isDraggingTitleBar) {
            // Title bar dragging
            let newX = x - this.titleBarOffset.x;
            let newY = y - this.titleBarOffset.y;
            
            let outerRadius = this.radius * this.factorSize;
            let minX = outerRadius;
            let minY = outerRadius;
            const p = this.p;
            if (!p) return;
            let maxX = p.width - outerRadius;
            let maxY = p.height - outerRadius;
            
            this.center.x = p.constrain(newX, minX, maxX);
            this.center.y = p.constrain(newY, minY, maxY);
            
            // Update drawCenterY to maintain offset from new center position
            this.drawCenterY = this.center.y + 8;
            
            return;
        }
        
        // Handle note dragging
        if (this.isNoteDragging && this.draggedNoteIndex > 0) {
            const PI = Math.PI;
            const TWO_PI = Math.PI * 2;

            // Click-vs-drag threshold: don't move the note until the pointer has
            // travelled a few px, so a select-click doesn't nudge it.
            if (!this._didDrag) {
                let dx = x - this._pressX, dy = y - this._pressY;
                if ((dx * dx + dy * dy) < (this.CLICK_DRAG_THRESHOLD * this.CLICK_DRAG_THRESHOLD)) return;
                this._didDrag = true;
            }

            // Calculate current mouse angle
            let currentMouseAngle = Math.atan2(y - this.drawCenterY, x - this.center.x);
            
            // Calculate angle difference and handle wrap-around
            let angleDiff = currentMouseAngle - this.dragStartAngle;
            if (angleDiff > PI) angleDiff -= TWO_PI;
            if (angleDiff < -PI) angleDiff += TWO_PI;
            
            // Convert angle difference to TET steps
            let tetStepsDiff = (angleDiff * this.TOTAL_STEPS) / TWO_PI;
            
            // Calculate new potential position
            let newTETPosition = Math.round(this.dragStartTETPosition + tetStepsDiff);
            
            // Normalize to valid range
            newTETPosition = ((newTETPosition % this.TOTAL_STEPS) + this.TOTAL_STEPS) % this.TOTAL_STEPS;
            
            // Snap to nearest scale note if needed
            let snappedPosition = this.snapToNearestScaleNote(newTETPosition);
            
            // Update the note position
            this.currentVoicing[this.draggedNoteIndex].normalizedTET = snappedPosition;
            
            // Update absolute TET position preserving octave
            let octave = this.currentVoicing[this.draggedNoteIndex].octave;
            this.currentVoicing[this.draggedNoteIndex].absoluteTET = snappedPosition + (octave * this.TOTAL_STEPS);
            
            // Update note name
            this.currentVoicing[this.draggedNoteIndex].noteName = this.getNoteNameForStep(snappedPosition, true);
            
            // Notify of change
            this.notifyVoicingChanged();
            this.identifyChordComponents();
            this.calculateExtendedComponents();
        }
    }
    
    mouseReleased(x, y, button) {
        this.isDraggingTitleBar = false;

        // A press that never crossed the drag threshold = a click → toggle selection
        // of that note (click the selected note again to deselect). Persistent: not
        // cleared on release (only on chord change).
        if (this._pressNoteId !== -1 && !this._didDrag) {
            this.selectedNoteId = (this.selectedNoteId === this._pressNoteId) ? -1 : this._pressNoteId;
        }
        // Only notify if we actually dragged a note (not on a plain select-click).
        if (this.isNoteDragging && this.draggedNoteIndex > 0 && this._didDrag) {
            this.notifyVoicingChanged();
        }

        this.isNoteDragging = false;
        this.draggedNoteIndex = -1;
        this.isInteracting = false;
        this._pressNoteId = -1;
        this._didDrag = false;
        this.Report = true;
    }
    
    isValidTETPosition(noteIndex, newPosition) {
        if (noteIndex <= 0 || noteIndex >= this.currentVoicing.length)
            return false;
        
        let currentOctave = this.currentVoicing[noteIndex].octave;
        
        // Check previous note (if it exists)
        if (noteIndex > 1) {
            let prevNote = this.currentVoicing[noteIndex - 1];
            
            // If same octave, check TET position
            if (currentOctave === prevNote.octave) {
                let prevTETPosition = prevNote.normalizedTET;
                if (newPosition <= prevTETPosition) {
                    return false;
                }
            }
        }
        
        // Check next note (if it exists)
        if (noteIndex < this.currentVoicing.length - 1) {
            let nextNote = this.currentVoicing[noteIndex + 1];
            
            // If same octave, check TET position
            if (currentOctave === nextNote.octave) {
                let nextTETPosition = nextNote.normalizedTET;
                if (newPosition >= nextTETPosition) {
                    return false;
                }
            }
        }
        
        return true;
    }
}
