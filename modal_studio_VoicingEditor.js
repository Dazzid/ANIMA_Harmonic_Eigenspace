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
        this.innerRadius = 0.3;  // Start point for 5 rings (-1, 0, 1, 2, 3)
        this.center = { x: 0, y: 0 };
        this.octaveSpacing = 0;
        this.factorSize = 1.45; //area of the frame size scaling
        
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
        this.selectedNodeColor = [255, 70, 19];
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
    findNearestNote(mouse) {
        if (this.currentVoicing.length === 0) return -1;
        
        let closestDist = 25.0;  // Increased for easier selection
        let closestNote = -1;
        
        for (let i = 0; i < this.currentVoicing.length; i++) {
            // Skip the root note (index 0) as it can't be edited
            if (i === 0) continue;
            
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
            console.log('🔄 VoicingEditor notifying change:', newPositions);
            this.onVoicingChanged(newPositions);
        } else {
            console.warn('⚠️ VoicingEditor: onVoicingChanged callback not set!');
        }
    }
    
    // ========================================================================
    // CHORD COMPONENT IDENTIFICATION (from .cpp lines 324-392)
    // ========================================================================
    identifyChordComponents() {
        this.chordComponents = [];
        
        if (this.currentVoicing.length === 0) return;
        
        // Get root position as reference
        let rootPos = this.currentVoicing[0].normalizedTET;
        
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
        
        let rootPos = this.currentVoicing[0].normalizedTET;
        
        // 9th (approximately 9 steps from root in 53TET)
        let ninthPos = (rootPos + 9) % this.TOTAL_STEPS;
        this.chordComponents.push({
            type: ChordComponentType.NINTH,
            position: ninthPos,
            name: this.getNoteNameForStep(ninthPos, false),
            octave: 2,  // Force it to upper wheels
            isActive: false
        });
        
        // 11th (F - perfect fourth)
        let eleventhPos = (rootPos + 22) % this.TOTAL_STEPS;
        this.chordComponents.push({
            type: ChordComponentType.ELEVENTH,
            position: eleventhPos,
            name: this.getNoteNameForStep(eleventhPos, false),
            octave: 2,
            isActive: false
        });
        
        // Check if it's a major chord for sharp 11th
        let isMajor = false;
        for (let comp of this.chordComponents) {
            if (comp.type === ChordComponentType.THIRD) {
                let thirdInterval = (comp.position - rootPos + this.TOTAL_STEPS) % this.TOTAL_STEPS;
                isMajor = (thirdInterval >= 17);
                break;
            }
        }
        
        // If major, add sharp 11th
        if (isMajor) {
            let sharp11Pos = (rootPos + 27) % this.TOTAL_STEPS;
            this.chordComponents.push({
                type: ChordComponentType.SHARP_ELEVENTH,
                position: sharp11Pos,
                name: this.getNoteNameForStep(sharp11Pos, false),
                octave: 2,
                isActive: false
            });
        }
        
        // 13th (approximately 37 steps from root)
        let thirteenthPos = (rootPos + 40) % this.TOTAL_STEPS;
        this.chordComponents.push({
            type: ChordComponentType.THIRTEENTH,
            position: thirteenthPos,
            name: this.getNoteNameForStep(thirteenthPos, false),
            octave: 2,
            isActive: false
        });
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
        console.log('🎵 VoicingEditor.updateCurrentVoicing called:', {
            notesCount: notes.length,
            positionsCount: positions.length,
            positions: positions,
            notesFtNotes: notes.map(n => n.ft_note)
        });
        console.log('📍 Incoming positions (absoluteTET):', positions);
        console.log('📍 Current voicing before update:', this.currentVoicing.map(v => `${v.noteName}(oct:${v.octave}, abs:${v.absoluteTET})`));
        
        if (notes.length === 0 || positions.length === 0) {
            console.warn('⚠️ VoicingEditor: Empty notes or positions array');
            return;
        }
        
        this.isChordClicked = true;
        this.analyzeVoicing(notes, positions);
        this.identifyChordComponents();
        this.calculateExtendedComponents();
        
        console.log('✓ VoicingEditor updated:', {
            voicingCount: this.currentVoicing.length,
            isChordClicked: this.isChordClicked,
            voicing: this.currentVoicing.map(v => `${v.noteName}(oct:${v.octave}, tet:${v.normalizedTET})`)
        });
    }
    
    analyzeVoicing(notes, voicingPositions) {
        this.currentVoicing = [];
        
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
        
        // Smart root doubling: if root is low and next note jumps 2+ rings, double the root
        if (this.currentVoicing.length >= 2 && this.addOctaveBase) {
            let root = this.currentVoicing[0];
            let nextNote = this.currentVoicing[1];
            let octaveGap = nextNote.octave - root.octave;
            
            // If gap is 2 or more rings, add root one octave up
            if (octaveGap >= 2) {
                let doubledRoot = {
                    scalePosition: root.scalePosition + this.TOTAL_STEPS,
                    absoluteTET: root.absoluteTET + this.TOTAL_STEPS,
                    normalizedTET: root.normalizedTET,
                    octave: root.octave + 1,
                    noteName: root.noteName
                };
                
                // Insert after root (at index 1)
                this.currentVoicing.splice(1, 0, doubledRoot);
                console.log(`🎯 Added doubled root: ${doubledRoot.noteName} at octave ${doubledRoot.octave} (gap was ${octaveGap} rings)`);
            }
        }
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
        
        // Draw reference circles for each octave (-1 to 3) - 5 rings total
        // radius * innerRadius + ((octave + 1) * octaveSpacing)
        for (let octave = -1; octave < 4; octave++) {
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
            console.log('🎼 Voicing positions on rings:', this.currentVoicing.map(pos => 
                `note#${this.currentVoicing.indexOf(pos)}: normalizedTET=${pos.normalizedTET}, octave=${pos.octave}, absoluteTET=${pos.absoluteTET}`
            ));
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
                // For extensions, only draw in last two wheels (2 and 3)
                if (component.octave >= 2) {
                    this.drawComponentAtOctave(component, component.octave);
                }
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
            this.drawTitleBar();
            p.pop();
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
        
        // Check for note selection only if not already interacting
        if (!this.isInteracting) {
            this.draggedNoteIndex = this.findNearestNote(mouse);
            if (this.draggedNoteIndex > 0) {
                this.isNoteDragging = true;
                this.isInteracting = true;
                // Store the starting angle and position for precise tracking
                this.dragStartAngle = Math.atan2(y - this.drawCenterY, x - this.center.x);
                this.dragStartTETPosition = this.currentVoicing[this.draggedNoteIndex].normalizedTET;
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
        console.log('VoicingEditor.mouseReleased called - resetting isDraggingTitleBar');
        this.isDraggingTitleBar = false;
        
        // Only notify of changes if we were actually dragging a note
        if (this.isNoteDragging && this.draggedNoteIndex > 0) {
            this.notifyVoicingChanged();
        }
        
        this.isNoteDragging = false;
        this.draggedNoteIndex = -1;
        this.isInteracting = false;
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
