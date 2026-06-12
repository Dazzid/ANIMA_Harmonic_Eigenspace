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
        
        // Display properties 
        this.radius = 0;
        this.innerRadius = 0.3;  // Start point for 6 rings (-1, 0, 1, 2, 3, 4)
        this.center = { x: 0, y: 0 };
        this.octaveSpacing = 0;
        // Frame size scaling. Grown 1.45 → 1.6 to fit the 6th (outer) ring at
        // r=1.35·radius while keeping the SAME margin the old outer ring had
        // (1.45−1.14 = 0.31). The existing rings are NOT resized — only the frame
        // expands outward, so the widget gets wider (innerRadius/octaveSpacing fixed).
        this.factorSize = 1.6; //area of the frame size scaling
        
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

        // Re-root wheel (Step 4): drag the outer band to transpose the WHOLE voicing
        // by Holdrian commas (chromatic). Tracks rotation continuously across turns.
        this.isWheelDragging = false;
        this.wheelPrevAngle = 0;
        this.wheelAccumAngle = 0;
        this.wheelAppliedSteps = 0;
        this.onTranspose = null; // app hook: shift the chord's notes/root by N commas (keeps the name right)
        this.onSelectVoicing = null; // app hook: apply the chord's built-in voicing(n) preset + reload
        // "Over Column" toggle: when ON and a ROW-0 grid chord is being edited,
        // every edit (transpose, 9/11/13, octave, drag, preset) replicates down
        // the chord's column (the modal-interchange rows). Read by the app when
        // routing onVoicingChanged to the Grid. Only meaningful in the Grid scene.
        this.overColumn = false;
        this._menuOpen = false;            // voicing drop-down open?
        this._currentVoicingType = null; // which voicing is selected (label in the box; null → "Voicing")

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
        this.ring = [100, 100, 100, 50];
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

        //top Buttons background color
        this.buttonBackground = [230, 230, 230];

        this.Report = true;
    }
    
    // ========================================================================
    // SETUP AND INITIALIZATION
    // ========================================================================
    setup(inRadius, topLeft, noteDataArray) {
        // Match ScaleEditor size exactly 
        this.radius = inRadius;
        // Center should be at outerRadius distance from topLeft for proper positioning
        // Add 5px down to account for title bar eating space (matches C++ implementation)
        const outerRadius = this.radius * this.factorSize;
        this.center = {
            x: topLeft.x + outerRadius,
            y: topLeft.y + outerRadius + 5
        };
        this.drawCenterY = this.center.y + 10;
        
        // Initialize interaction states 
        this.selectedNote = -1;
        this.isDragging = false;
        
        // Load note data 
        this.noteData = noteDataArray;
        
        // Set spacing between octave rings 
        this.octaveSpacing = this.radius * 0.21;
        
        // Initialize colors
        this.rootColor = this.selectorCircle;
        this.noteColor = [200, 200, 200];
        
        if (this.darkMode) {
            this.textColor = this.lightTextColor;
            this.ring = [255, 255, 255, 50];
            this.scaleNode = [255, 255, 255, 80];
        } else {
            this.textColor = this.darkTextColor;
            this.ring = [100, 100, 100, 50];
            this.scaleNode = [50, 50, 50, 80];
        }
    }
    
    // ========================================================================
    // DARK MODE 
    // ========================================================================
    setDarkMode(inDarkMode) {
        this.darkMode = inDarkMode;
        if (this.darkMode) {
            this.textColor = this.lightTextColor;
            this.ring = [255, 255, 255, 50];
            this.scaleNode = [255, 255, 255, 80];
        } else {
            this.textColor = this.darkTextColor;
            this.ring = [100, 100, 100, 50];
            this.scaleNode = [50, 50, 50, 80];
        }
    }
    
    // ========================================================================
    // SCALE MANAGEMENT 
    // ========================================================================
    setCurrentScale(notes) {
        this.currentScalePositions = [];
        for (let note of notes) {
            let normalizedPos = ((note.ft_note % this.TOTAL_STEPS) + this.TOTAL_STEPS) % this.TOTAL_STEPS;
            this.currentScalePositions.push(normalizedPos);
        }
        
        // Sort and remove duplicates
        this.currentScalePositions.sort((a, b) => a - b);
        this.currentScalePositions = [...new Set(this.currentScalePositions)];
    }
    
    isNoteInScale(tetPosition) {
        // If no scale is set, allow all positions 
        if (this.currentScalePositions.length === 0) {
            return true;
        }
        
        // Normalize to 0-52 range 
        let normalizedPos = ((tetPosition % this.TOTAL_STEPS) + this.TOTAL_STEPS) % this.TOTAL_STEPS;
        
        // Binary search to check if position is in scale 
        return this.currentScalePositions.includes(normalizedPos);
    }
    
    snapToNearestScaleNote(tetPosition) {
        // Direct port - currently returns position as-is
        return tetPosition;
    }
    
    // ========================================================================
    // NOTE FINDING AND INTERACTION 
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
    // ANGLE/TET CONVERSION 
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
    // NOTE DRAGGING 
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

        // Notify parent of the change — silent: this is a per-frame drag, audition
        // happens once on release (mouseReleased).
        this.notifyVoicingChanged(false);
    }
    
    // ========================================================================
    // VOICING CHANGE NOTIFICATION 
    // ========================================================================
    // audition: when true (default), the app plays the resulting chord so the user
    // HEARS the edit without re-clicking the chord. Passed false by the per-frame
    // drag handlers — dragging fires this dozens of times a second and playChord
    // doesn't cut previous notes, so auditioning every frame would be a mush.
    notifyVoicingChanged(audition = true) {
        if (this.onVoicingChanged) {
            // Create a vector of the updated positions, plus a map of which of those
            // positions are tagged 9/11/13 extensions (absoluteTET → extType). The
            // tags travel WITH the voicing so they persist on the chord — otherwise
            // switching to another chord and back drops the flag and the 9/11/13
            // buttons stack infinite duplicates (they'd no longer see the note as theirs).
            let newPositions = [];
            let extTags = {};
            for (let pos of this.currentVoicing) {
                newPositions.push(pos.absoluteTET);
                if (pos.extType !== undefined) extTags[pos.absoluteTET] = pos.extType;
            }
            //console.log('🔄 VoicingEditor notifying change:', newPositions);
            this.onVoicingChanged(newPositions, extTags, audition);
        } else {
            //console.warn('⚠️ VoicingEditor: onVoicingChanged callback not set!');
        }
    }
    
    // ========================================================================
    // CHORD COMPONENT IDENTIFICATION 
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
        // These intervals are specific to 53TET
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
        // "Top" = highest CHORD TONE (root/3rd/5th/7th), ignoring:
        //   (a) octave-duplications of a pitch class already present lower (default
        //       voicings double the root 2–3 octaves up — those must NOT push the
        //       extension out to the far ring), AND
        //   (b) other extensions (9/11/13) — CRITICAL: if an already-added 11th/13th
        //       counted here, the next extension would stack ABOVE it and re-adding
        //       a 9th after a 13th would fling it above the 13th → the "escalating
        //       up" bug. Anchoring every extension to the chord-tone top instead
        //       makes 9=D, 11=F, 13=A all land in the octave above the 7th, ascending
        //       and ORDER-INDEPENDENT — nothing climbs.
        // User's rule: C2 E3 G3 B3 C4 → add D4 (C4 is a dup of C2, so the 9th lands
        // just above B3).
        let topAbs = rootAbs;
        const seenPc = new Set();
        for (const v of [...this.currentVoicing].sort((a, b) => a.absoluteTET - b.absoluteTET)) {
            if (v.extType !== undefined) continue;     // ignore other 9/11/13 (no escalation)
            if (seenPc.has(v.normalizedTET)) continue; // skip octave-duplicate of a lower note
            seenPc.add(v.normalizedTET);
            topAbs = v.absoluteTET;
        }

        // Scale-degree intervals above the root, ascending:
        // rel[1]=2nd, rel[3]=4th, rel[5]=6th  →  9th, 11th, 13th.
        let rel = [...new Set(this.currentScalePositions.map(
            pc => (((pc - rootPos) % this.TOTAL_STEPS) + this.TOTAL_STEPS) % this.TOTAL_STEPS))]
            .sort((a, b) => a - b);
        const degInterval = (i, fallback) => (rel.length > i ? rel[i] : fallback);

        // On MAJOR chords the natural 11 clashes with the major 3rd (the avoid-note),
        // so default the 11th to #11 (Lydian). The #11 = the augmented 4th / tritone
        // = step 27 in 53-TET (NOT 26 — that's the diminished 5th, a comma lower).
        // Non-major chords keep the diatonic 11 (perfect 4th = 22).
        const eleventhInterval = this.isMajorChord() ? 27 : degInterval(3, 22);
        const exts = [
            { type: ChordComponentType.NINTH,      interval: degInterval(1, 9)  },
            { type: ChordComponentType.ELEVENTH,   interval: eleventhInterval   },
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

    // Re-root: transpose EVERY note by `deltaSteps` commas (chromatic, Step 4).
    // Blocked (returns false) if any note would leave the rings (−1…4), so the
    // wheel stops at the boundary. Shifts rootPitchClass + threads the chord's
    // root via onTranspose BEFORE notify, so the name transposes correctly.
    applyWheelTranspose(deltaSteps) {
        if (deltaSteps === 0) return true;
        for (const v of this.currentVoicing) {
            const oct = this.getOctave(v.absoluteTET + deltaSteps);
            if (oct < -1 || oct > 4) return false; // would leave the rings
        }
        for (const v of this.currentVoicing) {
            v.absoluteTET += deltaSteps;
            v.scalePosition = v.absoluteTET;
            v.octave = this.getOctave(v.absoluteTET);
            v.normalizedTET = ((v.absoluteTET % this.TOTAL_STEPS) + this.TOTAL_STEPS) % this.TOTAL_STEPS;
            v.noteName = this.getNoteNameForStep(v.normalizedTET, true);
        }
        this.rootPitchClass = ((this.rootPitchClass + deltaSteps) % this.TOTAL_STEPS + this.TOTAL_STEPS) % this.TOTAL_STEPS;
        if (this.onTranspose) this.onTranspose(deltaSteps); // shift chord root/notes first
        this.identifyChordComponents();
        this.calculateExtendedComponents();
        this.notifyVoicingChanged();
        return true;
    }

    // Reset (Step 8): restore the chord's default (as-loaded) voicing — drops every
    // edit (extensions, drags, drops, transpose) back to where the chord started.
    resetVoicing() {
        if (!this.originalVoicing || !this._notes) return;
        this.selectedNoteId = -1;
        this.analyzeVoicing(this._notes, this.originalVoicing); // no prevTags → fresh, no added extensions
        this.identifyChordComponents();
        this.calculateExtendedComponents();
        this.notifyVoicingChanged();
    }

    // Voicing presets (Step 5): pick which chord tone LEADS (sits on top) by applying
    // the chord's own built-in voicing template — musical/pianistic, already in the
    // app. Delegates to the host (it owns the chord). `type` → Chord.voicing(n):
    // 0 = root on top, 2 = 7th on top, 4 = 5th on top, 6 = 3rd on top.
    selectVoicing(type) {
        if (this.onSelectVoicing) this.onSelectVoicing(type);
    }

    // Build one of the four voicings EXACTLY from David's table. Each note is
    // [chord-tone, octave-offset] (offset = octaves above the bass root). The tone
    // interval comes from the actual chord (so it works for any quality); the
    // octave/order is hardcoded note-for-note:
    //   root → C2 C3 E3 G3 B3 C4
    //   3rd  → C2 C3 G3 B3 C4 E4
    //   5th  → C2 C3 B3 C4 E3 G4
    //   7th  → C3 B3 C4 E4 G4 B4
    buildLeadingVoicing(lead) {
        const ivOf = (v) => (((v.normalizedTET - this.rootPitchClass) % this.TOTAL_STEPS) + this.TOTAL_STEPS) % this.TOTAL_STEPS;
        const tones = { root: 0 };
        for (const v of this.currentVoicing) {
            const iv = ivOf(v);
            if (iv >= 11 && iv <= 20 && tones.third === undefined) tones.third = iv;
            else if (iv >= 26 && iv <= 35 && tones.fifth === undefined) tones.fifth = iv;
            else if (iv >= 42 && iv <= 52 && tones.seventh === undefined) tones.seventh = iv;
        }
        // [tone, octaveOffset] — literal transcription of the table.
        const SPECS = {
            root:    [['root',0],['root',1],['third',1],['fifth',1],['seventh',1],['root',2]],
            third:   [['root',0],['root',1],['fifth',1],['seventh',1],['root',2],['third',2]],
            fifth:   [['root',0],['root',1],['seventh',1],['root',2],['third',1],['fifth',2]],
            seventh: [['root',1],['seventh',1],['root',2],['third',2],['fifth',2],['seventh',2]],
        };
        const spec = SPECS[lead];
        if (!spec) return;

        // Anchor to the root PITCH CLASS at a fixed low octave. This can NEVER drift:
        // rootPitchClass is reset to the same value on every chord reload (unlike
        // getRootAbsolute / a captured base, which climb when the 7th voicing's lowest
        // note is the root an octave up). Fixed octave 0 → a sane low-to-mid register.
        const rootBaseAbs = this.rootPitchClass; // octave 0
        let abs = [];
        for (const [role, oct] of spec) {
            if (tones[role] === undefined) continue; // chord lacks this tone (e.g. triad)
            abs.push(rootBaseAbs + tones[role] + oct * this.TOTAL_STEPS);
        }
        if (abs.length === 0) return;
        // Keep the whole stack on the rings (−1…4).
        while (this.getOctave(Math.max(...abs)) > 4) abs = abs.map(a => a - this.TOTAL_STEPS);
        while (this.getOctave(Math.min(...abs)) < -1) abs = abs.map(a => a + this.TOTAL_STEPS);

        this.currentVoicing = abs.map(a => {
            const pc = ((a % this.TOTAL_STEPS) + this.TOTAL_STEPS) % this.TOTAL_STEPS;
            return { id: this.noteIdCounter++, scalePosition: a, absoluteTET: a,
                normalizedTET: pc, octave: this.getOctave(a),
                noteName: this.getNoteNameForStep(pc, true) };
        });
        this.currentVoicing.sort((x, y) => x.absoluteTET - y.absoluteTET);
        this.selectedNoteId = -1;
        this.identifyChordComponents();
        this.calculateExtendedComponents();
        this.notifyVoicingChanged();
    }

    // Reload the editor from a voicing the CHORD just applied (a preset). Rebuilds
    // currentVoicing WITHOUT re-snapshotting originalVoicing, so Reset still returns
    // to the chord's default. (Presets are the core voicing — no extension carry-over.)
    reloadVoicing(notes, positions) {
        if (!notes || !positions || positions.length === 0) return;
        this._notes = notes;
        this.selectedNoteId = -1;
        this.analyzeVoicing(notes, positions);
        this.identifyChordComponents();
        this.calculateExtendedComponents();
        this.notifyVoicingChanged();
    }

    // True when the 11th should default to #11 (the natural-11 avoid-note rule).
    // Holds for MAJOR-quality chords (major 3rd at 17–20 with a major 7th or no 7th),
    // but NOT for a DOMINANT chord (major 3rd + minor/flat 7th, e.g. G7 = "GMm7") —
    // over a dominant the natural 11 is fine (the G11 / sus-dominant). So: major 3rd
    // present AND no flat (minor) 7th (42–46).
    isMajorChord() {
        let hasMajorThird = false, hasFlatSeventh = false;
        for (const v of this.currentVoicing) {
            const iv = (((v.normalizedTET - this.rootPitchClass) % this.TOTAL_STEPS) + this.TOTAL_STEPS) % this.TOTAL_STEPS;
            if (iv >= 17 && iv <= 20) hasMajorThird = true;       // major 3rd
            else if (iv >= 42 && iv <= 46) hasFlatSeventh = true; // minor / dominant 7th
        }
        return hasMajorThird && !hasFlatSeventh;
    }

    // A note IS the 9/11/13 only if it was TAGGED as such (by the button that added
    // it). Identity, not position — so the note stays "the 11" wherever it's dragged,
    // and the button removes that exact note even if it became the bass.
    isExtension(v, type) {
        return v.extType === type;
    }

    // Toggle a 9th/11th/13th: if the TAGGED note already exists, remove exactly it
    // (wherever it is); otherwise add exactly ONE note, tagged with this identity,
    // at the ghost position. Always 0 or 1 of each — never a stack.
    toggleExtension(type) {
        if (this.currentVoicing.some(v => this.isExtension(v, type))) {
            this.currentVoicing = this.currentVoicing.filter(v => !this.isExtension(v, type));
        } else {
            let ghost = this.chordComponents.find(c => c.type === type && c.isActive === false);
            if (!ghost) return;
            let abs = ghost.absoluteTET;
            this.currentVoicing.push({
                id: this.noteIdCounter++,
                extType: type,                  // identity tag — this note IS the 9/11/13 forever
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
    // COMPONENT COLOR AND LABELS
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
    // HELPER FUNCTIONS 
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
    // VOICING ANALYSIS 
    // ========================================================================
    updateCurrentVoicing(notes, positions, savedTags) {
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
        // Snapshot the as-loaded voicing + its source notes so Reset (R8) and the
        // drop voicings can rebuild names without re-querying the chord.
        this.originalVoicing = [...positions];
        this._notes = notes;
        this.selectedNoteId = -1; // clear any stale selection from the previous chord

        // Carry extension IDENTITIES (extType) across the rebuild so a 9/11/13 stays
        // "owned" by its button. Two sources, in priority order:
        //   1. savedTags — the tags PERSISTED ON THE CHORD (absoluteTET → extType).
        //      This is what survives a chord switch: select chord A, add an 11, click
        //      chord B, come back to A — A still carries its 11's flag, so re-clicking
        //      11 removes it instead of stacking another.
        //   2. The lingering editor state — only valid when the SAME chord (same root)
        //      is reloaded; a fallback for chords that were never persisted with tags.
        // Positions match by absoluteTET because the chord's voicing IS this voicing.
        const newRoot = notes.length > 0 ? (((notes[0].ft_note % this.TOTAL_STEPS) + this.TOTAL_STEPS) % this.TOTAL_STEPS) : -1;
        const sameChord = newRoot === this.rootPitchClass;
        let prevTags = null;
        if (savedTags && Object.keys(savedTags).length > 0) {
            prevTags = new Map();
            for (const key of Object.keys(savedTags)) prevTags.set(Number(key), savedTags[key]);
        } else if (sameChord) {
            prevTags = new Map();
            for (const v of this.currentVoicing) {
                if (v.extType !== undefined) prevTags.set(v.absoluteTET, v.extType);
            }
        }
        this.analyzeVoicing(notes, positions, prevTags);
        this.identifyChordComponents();
        this.calculateExtendedComponents();
        
        // console.log('✓ VoicingEditor updated:', {
        //     voicingCount: this.currentVoicing.length,
        //     isChordClicked: this.isChordClicked,
        //     voicing: this.currentVoicing.map(v => `${v.noteName}(oct:${v.octave}, tet:${v.normalizedTET})`)
        // });
    }
    
    // prevTags (optional): Map absoluteTET → extType, used to carry an extension's
    // identity across a rebuild (re-selection / interchange recalc), so a 9/11/13
    // keeps being the 9/11/13 even though the rebuild only knows raw positions.
    analyzeVoicing(notes, voicingPositions, prevTags) {
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

            // Carry an extension's identity (9/11/13) across the rebuild.
            if (prevTags && prevTags.has(tetPosition)) {
                vPos.extType = prevTags.get(tetPosition);
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
    // DRAWING: CIRCLE GRID
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
                    p.strokeWeight(0.5);
                    p.circle(outerPos.x, outerPos.y, 3);
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
    // DRAWING: MAIN CIRCLE BACKGROUND 
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
    // DRAWING: TITLE BAR 
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
    // DRAWING: CURRENT VOICING 
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
                p.strokeWeight(1);
                p.rect(notePos.x - rectWidth/2 - 3, notePos.y - rectHeight/2 - 3,
                       rectWidth + 6, rectHeight + 6, 12);
            }
        }
    }
    
    // ========================================================================
    // DRAWING: INTERVAL LINES 
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
    // DRAWING: CHORD COMPONENTS 
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
    // UPDATE 
    // ========================================================================
    update(p) {
        // Store p5 instance for drawing
        this.p = p;
    }
    
    // ========================================================================
    // MAIN DRAW 
    // ========================================================================
    draw(p) {
        // Store p5 instance
        this.p = p;
        this.ensureMenuDom();

        if (this.isChordClicked && this.currentVoicing.length > 0) {
            p.push();
            this.drawMainCircle();
            this.drawWheel();
            this.drawCircleGrid();
            this.drawIntervalLines();
            this.drawChordComponents();
            this.drawCurrentVoicing();
            this.drawToolbar();
            this.drawTitleBar();
            p.pop();
            this.updateMenuDom();   // position + show the <select>
        } else {
            this.hideMenuDom();
            this.drawEmptyPlaceholder();
        }
    }

    // §6.4: when the Voicing tab is active but no chord is selected, show the
    // framed title bar + a centered hint instead of an empty void.
    drawEmptyPlaceholder() {
        const p = this.p;
        if (!p) return;
        p.push();
        this.drawTitleBar();
        p.noStroke();
        p.fill(120);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(13);
        p.text('Click a chord to', this.center.x, this.center.y - 9);
        p.text('edit its voicing', this.center.x, this.center.y + 9);
        p.pop();
    }

    // Voicing presets as a CUSTOM DOM drop-down (trigger + list), so it's fully
    // CSS-styled with open/close transitions (a native <select> can't animate its
    // list). All design lives in modal_studio_style.css (.voicing-menu/.voicing-…).
    static VOICING_MAP = { 'Root on top': 'root', '3rd on top': 'third', '5th on top': 'fifth', '7th on top': 'seventh' };

    ensureMenuDom() {
        if (this._menuWrap) return;
        const div = (cls) => { const d = document.createElement('div'); d.className = cls; return d; };

        const wrap = div('voicing-menu');
        wrap.style.position = 'fixed';
        wrap.style.zIndex = '9999';
        wrap.style.display = 'none';

        const trigger = div('voicing-trigger');
        trigger.innerHTML = '<span class="vt-label">Voicing types</span><span class="vt-arrow">▾</span>';
        trigger.addEventListener('mousedown', (e) => { e.stopPropagation(); this._setMenuOpen(!this._menuOpen); });

        const list = div('voicing-list');
        for (const [label, lead] of Object.entries(VoicingEditor.VOICING_MAP)) {
            const opt = div('voicing-option');
            opt.textContent = label;
            opt.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.buildLeadingVoicing(lead);
                trigger.querySelector('.vt-label').textContent = label;
                this._setMenuOpen(false);
            });
            list.appendChild(opt);
        }

        wrap.appendChild(trigger);
        wrap.appendChild(list);
        document.body.appendChild(wrap);
        this._menuWrap = wrap;

        // Close when clicking anywhere outside the menu.
        document.addEventListener('mousedown', (e) => {
            if (this._menuOpen && this._menuWrap && !this._menuWrap.contains(e.target)) this._setMenuOpen(false);
        });
    }

    _setMenuOpen(open) {
        this._menuOpen = open;
        if (this._menuWrap) this._menuWrap.classList.toggle('open', open);
    }

    // Position the menu at the editor's top-LEFT (page coords) and show it.
    updateMenuDom() {
        if (!this._menuWrap || !this.p) return;
        const canvasEl = this.p.canvas || (this.p.drawingContext && this.p.drawingContext.canvas)
            || document.querySelector('#canvas-container canvas') || document.querySelector('canvas');
        if (!canvasEl) { if (!this._menuWarned) { this._menuWarned = true; console.warn('[VoicingMenu] no canvas found'); } return; }
        const r = canvasEl.getBoundingClientRect();
        const outerRadius = this.radius * this.factorSize;
        const left = r.left + this.center.x - outerRadius + 6;
        // −3 compensates the .voicing-menu 5px margin-top so the trigger's top
        // edge lands at +2, flush with the toolbar buttons (drawToolbar).
        const top = r.top + (this.center.y - outerRadius) + this.titleBarHeight - 3;
        this._menuWrap.style.left = left + 'px';
        this._menuWrap.style.top = top + 'px';
        this._menuWrap.style.display = 'block';
        if (!this._menuLogged) {
            this._menuLogged = true;
            console.log('[VoicingMenu] shown at', { left, top, inBody: document.body.contains(this._menuWrap), rLeft: r.left, rTop: r.top, cx: this.center.x, cy: this.center.y, outerRadius });
        }
    }

    hideMenuDom() { if (this._menuWrap) { this._menuWrap.style.display = 'none'; this._setMenuOpen(false); } }

    // Inner/outer radius of the re-root wheel band — centered on the outermost
    // note ring (octave 4 at 1.35·r), so the wheel is the same size as the outer ring.
    wheelRadii() {
        const r = this.radius * 1.35; // octave-4 ring
        const half = this.radius * 0.05;
        return { inner: r - half, outer: r + half };
    }

    // Re-root wheel (Step 4): a grabbable band in the outer margin. Drag (rotate)
    // it to transpose the whole voicing in Holdrian commas. Tick marks signal it's
    // draggable; it tints orange while dragging.
    drawWheel() {
        const p = this.p;
        if (!p) return;
        const cx = this.center.x, cy = this.drawCenterY;
        const { inner, outer } = this.wheelRadii();
        const mid = (inner + outer) / 2;
        const active = this.isWheelDragging;

        p.noFill();
        if (active) p.stroke(...this.selectedNodeColor, 230); else p.stroke(150, 150, 150, 140);
        p.strokeWeight(active ? 2 : 1);
        // p.circle(cx, cy, mid * 2);

        // grip ticks around the band
        //p.strokeWeight(1);
        p.push();
        p.translate(cx, cy);
        p.rotate(this.wheelAccumAngle);
        
        if (active) p.stroke(...this.selectedNodeColor, 200); else p.stroke(150, 150, 150, 120);
        const N = 106;
        for (let i = 0; i < N; i++) {
            const a = (2 * Math.PI * i / N) - Math.PI ;
            p.line(inner * Math.cos(a), inner * Math.sin(a),
                   outer * Math.cos(a), outer * Math.sin(a));
        }
        p.pop();
    }

    // Toolbar: ONE control strip in the ~23px of free space between the title
    // bar and the top of the re-root wheel (the circle is drawn 15px below the
    // frame center, which is what opens this gap):
    //   [Voicing types ▾] [9][11][13]  [↑][↓]  [Over Column]  [Reset]
    // The dropdown is the DOM menu (positioned by updateMenuDom to align with
    // this row); everything else is canvas. Shared design: rounded rect, orange
    // when active/armed, light gray otherwise. Rects cached for hit-testing.
    drawToolbar() {
        const p = this.p;
        if (!p) return;
        const outerRadius = this.radius * this.factorSize;
        const left = this.center.x - outerRadius;
        const barY = this.center.y - outerRadius + this.titleBarHeight + 2; // strip top
        const bh = 19; // button height — keeps the row clear of the wheel's top arc
        p.textAlign(p.CENTER, p.CENTER);

        //

        const drawBtn = (x, w, label, active, txtSize) => {
            if (active) p.fill(...this.selectedNodeColor); else p.fill(...this.buttonBackground); // orange on / light gray off
            p.stroke(150); p.strokeWeight(1);
            p.rect(x, barY, w, bh, 4);
            p.noStroke();
            p.fill(active ? 255 : 50); // white text on orange, dark text on gray
            p.textSize(txtSize);
            p.text(label, x + w / 2, barY + bh / 2);
            return { x: x, y: barY, w: w, h: bh };
        };

        let x = left + 6 + 124 + 12; // after the 124px-wide DOM dropdown

        // --- extension toggles 9/11/13 ---
        const ext = [
            { type: ChordComponentType.NINTH, label: '9' },
            { type: ChordComponentType.ELEVENTH, label: this.isMajorChord() ? '#11' : '11' },
            { type: ChordComponentType.THIRTEENTH, label: '13' },
        ];
        this._extButtons = [];
        for (const e of ext) {
            const active = this.currentVoicing.some(v => this.isExtension(v, e.type));
            const r = drawBtn(x, 34, e.label, active, 12);
            this._extButtons.push({ type: e.type, ...r });
            x += 34 + 5;
        }
        x += 12;

        // --- octave stepper ↑/↓ (side by side; armed when a note is selected) ---
        const hasSel = this.currentVoicing.some(v => v.id === this.selectedNoteId);
        this._octButtons = [];
        for (const o of [{ delta: +1, label: '↑' }, { delta: -1, label: '↓' }]) {
            const r = drawBtn(x, 26, o.label, hasSel, 13);
            this._octButtons.push({ delta: o.delta, ...r });
            x += 26 + 5;
        }
        x += 12;

        // --- "Over Column" toggle ---
        this.ButtonColumnSize = 50;
        this._overColBtn = drawBtn(x, this.ButtonColumnSize, 'Column', this.overColumn, 11);
        x += this.ButtonColumnSize + 12;

        // --- Reset (Step 8): back to the as-loaded voicing ---
        this._resetBtn = drawBtn(x, 48, 'Reset', false, 11);
    }
    
    // ========================================================================
    // ANGLE CALCULATION 
    // ========================================================================
    getAngle(noteReference) {
        const TWO_PI = Math.PI * 2;
        const PI = Math.PI;
        let a = (TWO_PI * noteReference / this.TOTAL_STEPS + (2 * PI/2));
        return a;
    }
    
    // ========================================================================
    // MOUSE INTERACTION 
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
        
        // (Voicing menu is now a native <select> DOM element — handles its own clicks.)

        // Toolbar — 9/11/13 buttons → toggle that extension.
        if (this._extButtons) {
            for (let b of this._extButtons) {
                if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                    this.toggleExtension(b.type);
                    return true;
                }
            }
        }

        // Toolbar — "Over Column" toggle → replicate row-0 edits down the grid
        // column. Turning it ON re-notifies the current voicing (silently) so the
        // column syncs immediately, not just on the next edit.
        if (this._overColBtn) {
            const b = this._overColBtn;
            if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                this.overColumn = !this.overColumn;
                if (this.overColumn) this.notifyVoicingChanged(false);
                return true;
            }
        }

        // Toolbar — octave ↑/↓ → move the selected note a ring.
        if (this._octButtons) {
            for (let b of this._octButtons) {
                if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                    this.moveSelectedNoteOctave(b.delta);
                    return true;
                }
            }
        }

        // Toolbar — Reset → restore the chord's as-loaded voicing (drops every
        // edit; notifies, so an active Over Column re-syncs the column too).
        if (this._resetBtn) {
            const b = this._resetBtn;
            if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                this.resetVoicing();
                return true;
            }
        }

        // Re-root wheel (Step 4): grab the outer band to transpose the whole voicing.
        // Skip if a note is under the cursor — note selection/drag takes priority so
        // an octave-4 node stays clickable through the band.
        if (!this.isInteracting && this.findNearestNote(mouse, true) < 0) {
            const dist = Math.hypot(x - this.center.x, y - this.drawCenterY);
            const { inner, outer } = this.wheelRadii();
            if (dist >= inner && dist <= outer) {
                this.isWheelDragging = true;
                this.isInteracting = true;
                this.wheelPrevAngle = Math.atan2(y - this.drawCenterY, x - this.center.x);
                this.wheelAccumAngle = 0;
                this.wheelAppliedSteps = 0;
                return true;
            }
        }

        // Click an inactive 9/11/13 ghost → add that extension (Step 3).
        if (!this.isInteracting) {
            let ghostType = this.extensionGhostAt(mouse);
            if (ghostType !== null) {
                this.toggleExtension(ghostType);
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

        // Re-root wheel: accumulate rotation (continuous across full turns) → comma
        // steps; apply the increment to the whole voicing (blocked at ring edges).
        if (this.isWheelDragging) {
            const TWO_PI = Math.PI * 2;
            const cur = Math.atan2(y - this.drawCenterY, x - this.center.x);
            let d = cur - this.wheelPrevAngle;
            if (d > Math.PI) d -= TWO_PI;
            if (d < -Math.PI) d += TWO_PI;
            this.wheelAccumAngle += d;
            this.wheelPrevAngle = cur;
            // clockwise (increasing screen angle) = transpose UP
            const targetSteps = Math.round(this.wheelAccumAngle / (TWO_PI / this.TOTAL_STEPS));
            const increment = targetSteps - this.wheelAppliedSteps;
            if (increment !== 0 && this.applyWheelTranspose(increment)) {
                this.wheelAppliedSteps = targetSteps;
            }
            return;
        }

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

            // Notify of change — silent during the drag; we audition once on release.
            this.notifyVoicingChanged(false);
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
        this.isWheelDragging = false;
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
