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

// ScaleEditor.js - Direct port from C++ ScaleEditor.cpp (1178 lines)
// Created by David Dalmazzo on 19/12/24
// Ported to JavaScript for web implementation

class ScaleEditor {
    constructor() {
        // C++ ScaleEditor.cpp lines 10-18
        this.selectedNode = -1;
        this.numNodes = 0;
        this.startingStep = -40;  // Start at C0
        this.rootRotation = 0.0;  // INITIAL_ROTATION
        this.previousAngle = 0.0;
        this.isRotating = false;
        this.currentOctave = 1;
        this.rootNote = 0;
        
        // Size configuration
        this.outerRingSize = 160; // Radius of the main 53-step circle with nodes
        
        // C++ ScaleEditor.hpp lines 87-103 - Constants
        this.TOTAL_STEPS = 53;
        this.MIN_NODES = 3;
        this.MAX_NODES = 17;
        this.MAX_OCTAVES = 2;
        this.STEPS_PER_OCTAVE = 53;
        this.NODE_RADIUS = 15.0;
        this.SELECTION_RADIUS = 10.0;
        this.ROTATION_RADIUS = 0.45;
        this.INITIAL_ROTATION = 0.0;
        this.INVERSION_RADIUS = 0.65;
        
        // C++ ScaleEditor.hpp lines 105-113 - Inversion constants
        this.INVERSION_INNER_BOUND = 0.2;
        this.INVERSION_OUTER_BOUND = 1.0;
        this.SMOOTH_FACTOR = 0.15;
        this.LABEL_PADDING = 12;
        this.FTTnotesSize = 11;
        
        // C++ ScaleEditor.hpp lines 105 - Step pattern for 12-tone octave division
        this.STEP_PATTERN = [0, 5, 4, 5, 4, 4, 5, 4, 5, 4, 4, 5];
        
        // C++ ScaleEditor.hpp lines 115-125 - Inversion state
        this.isAnimatingInversion = false;
        this.targetInversionRotation = 0.0;
        this.animationStartRotation = 0.0;
        this.animationStartTime = 0.0;
        this.inversionRotation = 0.0;
        this.previousInversionAngle = 0.0;
        this.isRotatingInversion = false;
        this.currentInversion = 'ROOT';  // Enum: ROOT, NINTH, THIRD, FOURTH, FIFTH, SEVENTH
        this.factorSize = 1.6; //area of the frame size scaling — matches Voicing Editor
        this.textDistanceFactor = 0.23; //factor to determine how far text is drawn from center
        this.pointDistanceFactor = 0.1; //factor to determine how far point is drawn from center
        
        // C++ ScaleEditor.hpp lines 212-214 - Title bar dragging
        this.isDraggingTitleBar = false;
        this.titleBarOffset = { x: 0, y: 0 };
        this.titleBarHeight = 24; //height of the clickable draggable area for the title bar
        
        // Interaction lock for mutual exclusion with VoicingEditor
        this.isInteracting = false;
        
        // C++ ScaleEditor.hpp lines 149-158 - Core state
        this.noteData = [];  // Array of {reference, noteName, frequency}
        this.nodeSteps = [];  // Intervals between nodes
        this.nodePoints = [];  // Visual positions of nodes
        this.center = { x: 0, y: 0 };
        this.radius = 0;
        this.drawCenterY = 0;  // Offset Y coordinate for wheel drawing
        
        // Chromatic scale - populated from ModalStudioKeyMap
        this.chromaticSteps = [];  // Intervals from root (from KeyMap's non-scale notes)
        this.chromaticPoints = [];  // Visual positions of chromatic nodes
        this.selectedChromaticNode = -1;  // Currently selected chromatic node (-1 = none)
        this.chromaticNotesData = [];  // Full chromatic note data from KeyMap
        
        // C++ ScaleEditor.hpp lines 162 - Visual configuration
        this.intervalMarkers = [];  // Array of {steps, name, color}
        
        // C++ ScaleEditor.hpp line 41 - Callback for configuration changes
        this.onConfigurationChanged = null;
        
        // Callback for inversion changes
        this.onInversionChanged = null;
        
        this.setDarkMode(false);  // Initialize colors
    }
    
    // C++ ScaleEditor.cpp lines 77-119 - Set dark/light mode
    setDarkMode(inDarkMode) {
        if (inDarkMode) {
            this.textColor = [255, 255, 255];
            this.ringNode = [255, 255, 255, 120];
            
            this.WHITE = [255, 255, 255];
            this.LIGHT_GREY = [232, 232, 232];
            this.GREY = [180, 180, 180];
            
            this.ORANGE = [255, 149, 0];
            this.MID_ORANGE = [255, 187, 79];
            this.LIGHT_ORANGE = [254, 245, 177];
            
            this.BLUE_GREEN = [8, 160, 255];
            this.MID_BLUE_GREEN = [93, 200, 254];
            this.DIST_BLUE_GREEN = [0, 213, 255];
            
            this.NEUTRAL = [250, 250, 250];
            this.NEUTRAL_MINOR = [200, 200, 200];
            this.NEUTRAL_MAJOR = [200, 200, 200];
            this.wheelColor = [200, 200, 200];
        } else {
            this.textColor = [10, 10, 10];
            this.ringNode = [0, 0, 0, 120];
            
            this.WHITE = [255, 255, 255];
            this.LIGHT_GREY = [220, 220, 220];
            this.GREY = [113, 113, 113];
            
            this.ORANGE = [255, 149, 0]; //rgba(255, 149, 0, 1)
            this.MID_ORANGE = [255, 187, 79]; //rgba(255, 187, 79, 1)
            this.LIGHT_ORANGE = [255, 172, 18];
            
            this.BLUE_GREEN = [3, 158, 255];
            this.MID_BLUE_GREEN = [73, 157, 200];
            this.DIST_BLUE_GREEN = [0, 213, 255]; //rgba(0, 213, 255, 1)
            
            this.NEUTRAL = [10, 10, 10];
            this.NEUTRAL_MINOR = [215, 215, 215]; //rgba(215, 215, 215, 1)
            this.NEUTRAL_MAJOR = [234, 234, 234]; //rgba(234, 234, 234, 1)
            this.wheelColor = [200, 200, 200];
        }
        this.initializeIntervalMarkers();
    }
    
    // C++ ScaleEditor.cpp lines 22-47 - setup method
    setup(r, initialNodes, topLeft, noteDataArray) {
        //console.log('ScaleEditor.setup called', { r, initialNodes, topLeft, noteDataCount: noteDataArray?.length });
        this.radius = r;
        // Center should be at outerRadius distance from topLeft for proper positioning
        const outerRadius = this.radius * this.factorSize;
        this.center = {
            x: topLeft.x + outerRadius,
            y: topLeft.y + outerRadius
        };
        // Offset for drawing circles down inside the frame (to give space from title bar)
        this.drawCenterY = this.center.y + 15;
        
        // Load note data (passed from ofApp)
        this.noteData = noteDataArray;
        
        // Setup node count
        this.setNumNodes(initialNodes);
        this.initializeIntervalMarkers();
        
        // Initialize root note
        this.updateRootNote();
        
        this.currentInversion = 'ROOT';
        
        // console.log('ScaleEditor.setup complete', { center: this.center, numNodes: this.numNodes });
    }
    
    // C++ ScaleEditor.cpp lines 64-73 - Get current scale degrees
    getCurrentScaleDegrees() {
        const degrees = [];
        let pos = this.startingStep % this.STEPS_PER_OCTAVE;
        degrees.push(pos);
        for (let i = 0; i < this.nodeSteps.length - 1; i++) {
            pos = (pos + this.nodeSteps[i]) % this.STEPS_PER_OCTAVE;
            degrees.push(pos);
        }
        return degrees;
    }
    
    // C++ ScaleEditor.cpp lines 409-466 - Initialize interval markers
    initializeIntervalMarkers() {
        this.intervalMarkers = [
            {steps: 0, name: "Root", color: this.WHITE},
            {steps: 1, name: "^1", color: this.LIGHT_GREY},
            {steps: 2, name: "^^1", color: this.DIST_BLUE_GREEN},
            {steps: 3, name: "vm2", color: this.DIST_BLUE_GREEN},
            {steps: 4, name: "m2", color: this.BLUE_GREEN},
            {steps: 5, name: "^m2", color: this.BLUE_GREEN},
            {steps: 6, name: "^^m2", color: this.LIGHT_GREY},
            {steps: 7, name: "vvM2", color: this.LIGHT_GREY},
            {steps: 8, name: "vM2", color: this.MID_ORANGE},
            {steps: 9, name: "M2", color: this.MID_ORANGE},
            {steps: 10, name: "^M2", color: this.LIGHT_GREY},
            {steps: 11, name: "vvm3", color: this.DIST_BLUE_GREEN},
            {steps: 12, name: "vm3", color: this.DIST_BLUE_GREEN},
            {steps: 13, name: "m3", color: this.BLUE_GREEN},
            {steps: 14, name: "^m3", color: this.BLUE_GREEN},
            {steps: 15, name: "^^m3", color: this.NEUTRAL_MINOR},
            { steps: 16, name: "vvM3", color: this.NEUTRAL_MAJOR },
            {steps: 17, name: "vM3", color: this.MID_ORANGE},
            {steps: 18, name: "M3", color: this.MID_ORANGE},
            {steps: 19, name: "^M3", color: this.ORANGE},
            {steps: 20, name: "^^M3", color: this.ORANGE},
            {steps: 21, name: "v4", color: this.LIGHT_GREY},
            {steps: 22, name: "P4", color: this.WHITE},
            {steps: 23, name: "^4", color: this.LIGHT_GREY},
            {steps: 24, name: "^^4", color: this.LIGHT_GREY},
            {steps: 25, name: "vvA4", color: this.LIGHT_GREY},
            {steps: 26, name: "vA4", color: this.LIGHT_GREY},
            {steps: 27, name: "^d5", color: this.LIGHT_GREY},
            {steps: 28, name: "^^d5", color: this.LIGHT_GREY},
            {steps: 29, name: "vv5", color: this.LIGHT_GREY},
            {steps: 30, name: "v5", color: this.LIGHT_GREY},
            {steps: 31, name: "P5", color: this.WHITE},
            {steps: 32, name: "^5", color: this.LIGHT_GREY},
            {steps: 33, name: "^^5", color: this.DIST_BLUE_GREEN},
            {steps: 34, name: "vm6", color: this.DIST_BLUE_GREEN},
            {steps: 35, name: "m6", color: this.BLUE_GREEN},
            {steps: 36, name: "^m6", color: this.BLUE_GREEN},
            {steps: 37, name: "^^m6", color: this.LIGHT_GREY},
            {steps: 38, name: "vvM6", color: this.LIGHT_GREY},
            {steps: 39, name: "vM6", color: this.MID_ORANGE},
            {steps: 40, name: "M6", color: this.MID_ORANGE},
            {steps: 41, name: "^M6", color: this.LIGHT_GREY},
            {steps: 42, name: "vvm7", color: this.DIST_BLUE_GREEN},
            {steps: 43, name: "vm7", color: this.DIST_BLUE_GREEN},
            {steps: 44, name: "m7", color: this.BLUE_GREEN},
            {steps: 45, name: "^m7", color: this.BLUE_GREEN},
            {steps: 46, name: "^^m7", color: this.NEUTRAL_MINOR},
            { steps: 47, name: "vvM7", color: this.NEUTRAL_MAJOR },
            {steps: 48, name: "vM7", color: this.MID_ORANGE},
            {steps: 49, name: "M7", color: this.MID_ORANGE},
            {steps: 50, name: "^M7", color: this.ORANGE},
            {steps: 51, name: "^^M7", color: this.ORANGE},
            {steps: 52, name: "v8", color: this.LIGHT_GREY}
        ];
    }
    
    // C++ ScaleEditor.cpp lines 491-507 - Get note name for step
    getNoteNameForStep(steps, drawNumber) {
        for (const note of this.noteData) {
            if (note.reference === steps) {
                let name = note.noteName;
                if (name && !drawNumber && !isNaN(name[name.length - 1])) {
                    name = name.slice(0, -1);
                }
                return name;
            }
        }
        return "";
    }
    
    // C++ ScaleEditor.cpp lines 387-407 - Should draw note at step
    shouldDrawNoteAtStep(step) {
        if (step === 0) return true;
        
        let cumulativeSteps = 0;
        for (let p = 0; p < 12; p++) {
            cumulativeSteps += this.STEP_PATTERN[p];
            if (step === cumulativeSteps) {
                return true;
            }
        }
        return false;
    }
    
    // C++ ScaleEditor.cpp lines 509-515 - Set number of nodes
    setNumNodes(num) {
        this.numNodes = Math.max(this.MIN_NODES, Math.min(num, this.MAX_NODES));
        this.nodeSteps = new Array(this.numNodes);
        this.distributeSteps();
        this.updateNodePositions();
    }
    
    // C++ ScaleEditor.cpp lines 518-526 - Distribute steps equally
    distributeSteps() {
        const baseSteps = Math.floor(this.TOTAL_STEPS / this.numNodes);
        const remainder = this.TOTAL_STEPS % this.numNodes;
        
        for (let i = 0; i < this.numNodes; i++) {
            this.nodeSteps[i] = baseSteps + (i < remainder ? 1 : 0);
        }
    }
    
    // C++ ScaleEditor.cpp lines 529-538 - Update node positions
    updateNodePositions() {
        this.nodePoints = [];
        let currentAngle = 0;
        
        for (let i = 0; i < this.numNodes; i++) {
            this.nodePoints.push(this.getPointOnCircle(currentAngle));
            currentAngle += (Math.PI * 2 * this.nodeSteps[i]) / this.TOTAL_STEPS;
        }
        
        // Update chromatic positions when modal positions change
        this.updateChromaticPositions();
    }
    
    // Update chromatic note positions based on intervals from root
    updateChromaticPositions() {
        this.chromaticPoints = [];
        
        for (let i = 0; i < this.chromaticSteps.length; i++) {
            // chromaticSteps[i] is the 53-TET interval from root
            // This represents the musical interval, which should map directly to angle
            // The modal nodes also use their intervals directly to calculate angles
            let interval = this.chromaticSteps[i];
            
            // Convert interval to angle - intervals map directly to angular position
            // This is the same calculation used in updateNodePositions for modal nodes
            let angle = (Math.PI * 2 * interval) / this.TOTAL_STEPS;
            
            // Use getPointOnCircle which applies -Math.PI / 2 offset to put 0 at top
            this.chromaticPoints.push(this.getPointOnCircle(angle));
        }
    }
    
    // C++ ScaleEditor.cpp lines 541-546 - Get point on circle
    getPointOnCircle(angle) {
        const adjustedAngle = angle - Math.PI / 2;
        return {
            x: this.center.x + this.radius * Math.cos(adjustedAngle),
            y: this.drawCenterY + this.radius * Math.sin(adjustedAngle)
        };
    }
    
    // C++ ScaleEditor.cpp lines 549-551 - Get mouse angle
    getMouseAngle(mouse) {
        return Math.atan2(mouse.y - this.drawCenterY, mouse.x - this.center.x) + Math.PI / 2;
    }
    
    // C++ ScaleEditor.cpp lines 163-172 - Calculate cumulative steps
    calculateCumulativeSteps(nodeIndex) {
        if (nodeIndex >= this.nodeSteps.length) return 0;
        
        let steps = 0;
        for (let i = 0; i < nodeIndex; i++) {
            steps += this.nodeSteps[i];
        }
        return steps;
    }
    
    // C++ ScaleEditor.cpp lines 175-193 - Get interval step
    getIntervalStep(interval) {
        if (this.nodeSteps.length === 0) return 0;
        
        switch(interval) {
            case 'ROOT': return 0;
            case 'NINTH': return this.calculateCumulativeSteps(1);
            case 'THIRD': return this.calculateCumulativeSteps(2);
            case 'FOURTH': return this.calculateCumulativeSteps(3);
            case 'FIFTH': return this.calculateCumulativeSteps(4);
            case 'SEVENTH': return this.calculateCumulativeSteps(6);
            default: return 0;
        }
    }
    
    // C++ ScaleEditor.cpp lines 196-205 - Get all interval steps
    getAllIntervalSteps() {
        return [
            this.getIntervalStep('ROOT'),
            this.getIntervalStep('NINTH'),
            this.getIntervalStep('THIRD'),
            this.getIntervalStep('FOURTH'),
            this.getIntervalStep('FIFTH'),
            this.getIntervalStep('SEVENTH')
        ];
    }
    
    // C++ ScaleEditor.cpp lines 208-218 - Calculate label position
    calculateLabelPosition(innerRadius, step) {
        const angleRadians = (Math.PI * 2 * step / this.STEPS_PER_OCTAVE) - Math.PI / 2;
        
        return {
            position: {
                x: this.center.x + (innerRadius - this.LABEL_PADDING) * Math.cos(angleRadians),
                y: this.drawCenterY + (innerRadius - this.LABEL_PADDING) * Math.sin(angleRadians)
            },
            angle: angleRadians
        };
    }
    
    // C++ ScaleEditor.cpp lines 831-862 - Update root note
    updateRootNote() {
        let normalizedRotation = this.rootRotation;
        while (normalizedRotation < 0) normalizedRotation += Math.PI * 2;
        
        const rotations = normalizedRotation / (Math.PI * 2);
        this.currentOctave = Math.max(0, Math.min(Math.floor(rotations), this.MAX_OCTAVES));
        
        const remainingRotation = normalizedRotation - (this.currentOctave * Math.PI * 2);
        this.rootNote = Math.floor((remainingRotation / (Math.PI * 2)) * this.STEPS_PER_OCTAVE);
        
        if (this.rootRotation < 0) {
            const negativeSteps = (this.rootRotation * this.STEPS_PER_OCTAVE) / (Math.PI * 2);
            this.startingStep = -40 + Math.floor(negativeSteps);
        } else {
            this.startingStep = -40 + (this.currentOctave * this.STEPS_PER_OCTAVE) + this.rootNote;
        }
        
        // Resync chromatic notes when root changes (recalculates intervals from new root)
        this.syncChromaticNotesFromKeyMap();
    }
    
    // C++ ScaleEditor.cpp lines 865-905 - Handle root rotation
    handleRootRotation(mouseAngle) {
        if (!this.isRotating) {
            this.isRotating = true;
            this.previousAngle = mouseAngle;
        } else {
            let angleDiff = mouseAngle - this.previousAngle;
            
            if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            const potentialRotation = this.rootRotation + angleDiff;
            
            let normalizedPotential = potentialRotation;
            while (normalizedPotential < 0) normalizedPotential += Math.PI * 2;
            
            const potentialOctave = normalizedPotential / (Math.PI * 2);
            
            let allowRotation = true;
            
            if (angleDiff > 0 && potentialOctave > this.MAX_OCTAVES) {
                this.rootRotation = this.MAX_OCTAVES * Math.PI * 2;
                allowRotation = false;
            } else if (angleDiff < 0 && potentialRotation <= -((13.0 * Math.PI * 2) / this.STEPS_PER_OCTAVE)) {
                this.rootRotation = -((13.0 * Math.PI * 2) / this.STEPS_PER_OCTAVE);
                allowRotation = false;
            }
            
            if (allowRotation) {
                this.rootRotation = potentialRotation;
            }

            this.previousAngle = mouseAngle;
            const prevStartingStep = this.startingStep;
            this.updateRootNote();

            // Fire callback during drag when the root actually changes,
            // so MIDI keyboard mapping (and modes) follow root rotation live.
            if (this.startingStep !== prevStartingStep && this.onConfigurationChanged) {
                this.onConfigurationChanged(this.nodeSteps);
            }
        }
    }
    
    // C++ ScaleEditor.cpp lines 221-242 - Handle inversion rotation
    handleInversionRotation(mouseAngle) {
        if (!this.isRotatingInversion) {
            this.isRotatingInversion = true;
            this.previousInversionAngle = mouseAngle;
            return;
        }
        
        let angleDiff = mouseAngle - this.previousInversionAngle;
        
        if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        this.inversionRotation += angleDiff;
        this.previousInversionAngle = mouseAngle;
        
        while (this.inversionRotation < 0) this.inversionRotation += Math.PI * 2;
        while (this.inversionRotation >= Math.PI * 2) this.inversionRotation -= Math.PI * 2;
        
        this.currentInversion = this.getNearestInversion(this.inversionRotation);
        // console.log('🎯 Rotation:', this.inversionRotation, 'Current inversion:', this.currentInversion);
    }
    
    // C++ ScaleEditor.cpp lines 271-296 - Get nearest inversion
    getNearestInversion(rotation) {
        const distToZero = Math.abs(rotation);
        const distToTwoPi = Math.abs(Math.PI * 2 - rotation);
        let closestAngleDiff = Math.min(distToZero, distToTwoPi);
        let closestInversion = 'ROOT';
        
        const inversionTypes = ['ROOT', 'NINTH', 'THIRD', 'FOURTH', 'FIFTH', 'SEVENTH'];
        
        for (const inv of inversionTypes) {
            const steps = this.getIntervalStep(inv);
            const intervalAngle = (Math.PI * 2 * steps) / this.TOTAL_STEPS;
            let angleDiff = Math.abs(rotation - intervalAngle);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
            
            if (angleDiff < closestAngleDiff) {
                closestAngleDiff = angleDiff;
                closestInversion = inv;
            }
        }
        
        return closestInversion;
    }
    
    // C++ ScaleEditor.cpp lines 251-271 - Get inversion number
    getInversion() {
        // Returns 0-5 mapping for handleInversions()
        switch(this.currentInversion) {
            case 'ROOT': return 0;
            case 'NINTH': return 5;
            case 'THIRD': return 1;
            case 'FOURTH': return 2;
            case 'FIFTH': return 3;
            case 'SEVENTH': return 4;
            default: return 0;
        }
    }
    
    // C++ ScaleEditor.cpp lines 964-984 - Find nearest inversion angle
    findNearestInversionAngle(currentRotation) {
        const distToZero = Math.abs(currentRotation);
        const distToTwoPi = Math.abs(Math.PI * 2 - currentRotation);
        let minDistance = Math.min(distToZero, distToTwoPi);
        let closestAngle = 0.0;
        
        const intervalSteps = this.getAllIntervalSteps();
        
        for (const step of intervalSteps) {
            const intervalAngle = (Math.PI * 2 * step) / this.TOTAL_STEPS;
            let distance = Math.abs(currentRotation - intervalAngle);
            if (distance > Math.PI) distance = Math.PI * 2 - distance;
            
            if (distance < minDistance) {
                minDistance = distance;
                closestAngle = intervalAngle;
            }
        }
        
        return closestAngle;
    }
    
    // C++ ScaleEditor.cpp lines 987-1002 - Update inversion animation
    updateInversionAnimation() {
        if (!this.isAnimatingInversion) return;
        
        const currentTime = Date.now() / 1000;
        let animationProgress = (currentTime - this.animationStartTime) / 0.3;
        
        animationProgress = Math.max(0, Math.min(animationProgress, 1));
        const t = 1.0 - Math.pow(1.0 - animationProgress, 3);
        
        this.inversionRotation = this.animationStartRotation + 
            (this.targetInversionRotation - this.animationStartRotation) * t;
        
        if (animationProgress >= 1.0) {
            this.inversionRotation = this.targetInversionRotation;
            this.isAnimatingInversion = false;
            this.currentInversion = this.getNearestInversion(this.inversionRotation);
        }
    }
    
    // C++ ScaleEditor.cpp lines 917-928 - Find nearest node
    findNearestNode(mouse) {
        let closestDist = this.SELECTION_RADIUS;
        let closestNode = -1;
        
        for (let i = 0; i < this.nodePoints.length; i++) {
            const dx = mouse.x - this.nodePoints[i].x;
            const dy = mouse.y - this.nodePoints[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < closestDist) {
                closestDist = dist;
                closestNode = i;
            }
        }
        
        return closestNode;
    }
    
    // Find nearest chromatic node - similar to findNearestNode but for chromatic scale
    findNearestChromaticNode(mouse) {
        let closestDist = this.SELECTION_RADIUS;
        let closestNode = -1;
        
        for (let i = 0; i < this.chromaticPoints.length; i++) {
            const dx = mouse.x - this.chromaticPoints[i].x;
            const dy = mouse.y - this.chromaticPoints[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < closestDist) {
                closestDist = dist;
                closestNode = i;
            }
        }
        
        return closestNode;
    }
    
    // C++ ScaleEditor.cpp lines 1006-1012 - update method
    update(p) {
        // Store p5 instance for use in mouse handlers
        this.p = p;
        if (this.isAnimatingInversion) {
            this.updateInversionAnimation();
        }
    }
    
    // C++ ScaleEditor.cpp lines 1015-1029 - draw method  
    draw(p) {
        this.drawMainCircle(p);
        this.drawTitleBar(p);
        this.drawIntervalMarkers(p);
        this.drawNodes(p);
        this.drawChromaticNodes(p);  // Draw chromatic nodes after modal nodes
        this.drawRootSelector(p);
        this.drawInversionWheel(p);
    }
    
    // C++ ScaleEditor.cpp lines 600-630 - Draw main circle --------------------------------------------------------------------
    drawMainCircle(p) {
        const outerRadius = this.radius * this.factorSize;
        const padding = 0;
        const rectWidth = (outerRadius + padding) * 2;
        const rectHeight = (outerRadius + padding) * 2;
        const rectX = this.center.x - rectWidth / 2;
        const rectY = this.center.y - rectHeight / 2;  // Background frame stays at center.y
        let rounded = 15;
        
        // Use gradient if available
        if (window.shaderManager && window.shaderManager.initialized) {
            const startColor = [255, 255, 255, 255];  // White center
            const endColor = [215, 215, 215, 200];    // Light gray edges
            window.shaderManager.drawEditorBackground(
                p, this.center.x, this.center.y,  // Background centered at center.y (not offset)
                rectWidth, rectHeight, 
                startColor, endColor, rounded
            );
        } else {
            // Fallback
            p.push();
            p.fill(240, 200);
            p.noStroke();
            p.rect(rectX, rectY, rectWidth, rectHeight, rounded);
            p.pop();
        }
    }
    
    // C++ ScaleEditor.cpp lines 817-829 - Draw title bar ----------------------------------------------------------------
    drawTitleBar(p) {
        const outerRadius = this.radius * this.factorSize;
        const titleBarWidth = outerRadius * 2;
        const titleBarY = this.center.y - outerRadius;
        const titleBarHeight = 24;
        
        p.push();
        p.fill(210);
        p.noStroke();
        p.rect(this.center.x - outerRadius, titleBarY, titleBarWidth, titleBarHeight, 15, 15, 0, 0);
        
        p.fill(20);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(14);
        p.text("Scale Editor", this.center.x, titleBarY + titleBarHeight * 0.5);
        p.pop();
    }
    
    // C++ ScaleEditor.cpp lines 554-599 - Draw interval markers ----------------------------------------------------------------
    drawIntervalMarkers(p) {
        for (const marker of this.intervalMarkers) {
            const angle = (Math.PI * 2 * marker.steps) / this.TOTAL_STEPS;
            const pos = this.getPointOnCircle(angle);
            const dx = pos.x - this.center.x;
            const dy = pos.y - this.drawCenterY;
            const len = Math.sqrt(dx * dx + dy * dy);
            const labelPos = {
                x: pos.x + (dx / len) * (this.radius * this.textDistanceFactor),
                y: pos.y + (dy / len) * (this.radius * this.textDistanceFactor)
            };
            const labelPosDot = {
                x: pos.x + (dx / len) * (this.radius * this.pointDistanceFactor),
                y: pos.y + (dy / len) * (this.radius * this.pointDistanceFactor)
            };
            
            // Draw colored wedge slice (pizza slice) for this Holdrian comma position
            const innerRadius = this.radius; // Start at the outer circle edge
            const outerRadius = this.radius + 55; // Extend outward beyond the circle
            const angleSpan = (Math.PI * 2) / this.TOTAL_STEPS; // Angular span for one step
            // Apply the same -PI/2 rotation that getPointOnCircle uses
            const adjustedAngle = angle - Math.PI / 2;
            const startAngle = adjustedAngle - angleSpan / 2;
            const endAngle = adjustedAngle + angleSpan / 2;
            
            // Draw filled wedge shape using beginShape
            p.push();
            p.fill(...marker.color); // Semi-transparent color
            p.stroke(240);
            p.strokeWeight(1);
            p.beginShape();
            // Start at inner radius, startAngle
            p.vertex(
                this.center.x + innerRadius * Math.cos(startAngle),
                this.drawCenterY + innerRadius * Math.sin(startAngle)
            );
            // Draw arc along outer radius
            for (let a = startAngle; a <= endAngle; a += angleSpan / 10) {
                p.vertex(
                    this.center.x + outerRadius * Math.cos(a),
                    this.drawCenterY + outerRadius * Math.sin(a)
                );
            }
            // End point at outer radius, endAngle
            p.vertex(
                this.center.x + outerRadius * Math.cos(endAngle),
                this.drawCenterY + outerRadius * Math.sin(endAngle)
            );
            // Draw arc back along inner radius
            for (let a = endAngle; a >= startAngle; a -= angleSpan / 10) {
                p.vertex(
                    this.center.x + innerRadius * Math.cos(a),
                    this.drawCenterY + innerRadius * Math.sin(a)
                );
            }
            p.endShape(p.CLOSE);
            p.pop();
            
            p.push();
            p.stroke(...marker.color);
            p.strokeWeight(1);
            // p.line(pos.x, pos.y, labelPosDot.x, labelPosDot.y);
            p.fill(...marker.color);
            // p.noStroke();
            p.circle(pos.x, pos.y, 4);
            // p.circle(labelPosDot.x, labelPosDot.y, 4);
            
            let rotationDeg = (angle * 180 / Math.PI) - 90;
            if (rotationDeg > 90 && rotationDeg < 270) {
                rotationDeg += 180;
            }
            
            // Calculate brightness of marker color to determine text color
            const brightness = (marker.color[0] * 0.299 + marker.color[1] * 0.587 + marker.color[2] * 0.114);
            const textColor = brightness > 128 ? 20 : 240; // Dark text for bright colors, light text for dark colors
            
            p.noStroke();
            p.translate(labelPos.x, labelPos.y);
            p.rotate(rotationDeg * Math.PI / 180);
            p.fill(textColor);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(this.FTTnotesSize);
            p.text(marker.name, 0, 0);
            p.pop();
            
            // Draw Holdrian comma step number on the inside of the wheel
            const stepNumberDistance = this.radius * 1.08; // Closer to center than note names
            const stepNumPos = {
                x: this.center.x + (dx / len) * stepNumberDistance,
                y: this.drawCenterY + (dy / len) * stepNumberDistance
            };
            
            p.push();
            p.fill(100); // Gray color for step numbers
            p.noStroke();
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(8);
            p.text(marker.steps, stepNumPos.x, stepNumPos.y);
            p.pop();
        }
    }
    
    // C++ ScaleEditor.cpp lines 633-725 - Draw nodes --------------------------------------------------------------------
    drawNodes(p) {
        
        let cumulativeSteps = this.startingStep;
        
        // Draw connections and step numbers
        for (let i = 0; i < this.nodePoints.length; i++) {
            const nextIndex = (i + 1) % this.nodePoints.length;
            
            p.push();
            p.stroke(0, 200, 255);
            p.strokeWeight(2);
            p.line(this.nodePoints[i].x, this.nodePoints[i].y, 
                   this.nodePoints[nextIndex].x, this.nodePoints[nextIndex].y);
            
            const midpoint = {
                x: (this.nodePoints[i].x + this.nodePoints[nextIndex].x) * 0.5,
                y: (this.nodePoints[i].y + this.nodePoints[nextIndex].y) * 0.5
            };
            
            p.fill(255, 190);
            p.noStroke();
            p.circle(midpoint.x, midpoint.y, this.NODE_RADIUS * 1.1);
            
            p.fill(0);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(10);
            p.text(this.nodeSteps[i].toString(), midpoint.x, midpoint.y);
            p.pop();
            
            // Draw nodes
            p.push();
            if (i === this.selectedNode) {
                p.fill(255, 100, 0);
                p.noStroke();
                p.circle(this.nodePoints[i].x, this.nodePoints[i].y, this.NODE_RADIUS);
            } else {
                p.noFill();
                p.stroke(...this.ringNode);
                p.strokeWeight(1);
                p.circle(this.nodePoints[i].x, this.nodePoints[i].y, this.NODE_RADIUS);
            }
            
            // Draw note names
            const dx = this.nodePoints[i].x - this.center.x;
            const dy = this.nodePoints[i].y - this.drawCenterY;
            const len = Math.sqrt(dx * dx + dy * dy);
            const noteNamePos = {
                x: this.nodePoints[i].x - (dx / len) * (this.NODE_RADIUS + 5),
                y: this.nodePoints[i].y - (dy / len) * (this.NODE_RADIUS + 5)
            };
            
            const noteName = this.getNoteNameForStep(cumulativeSteps, false);
            if (noteName) {
                p.fill(...this.textColor);
                p.noStroke();
                p.textAlign(p.CENTER, p.CENTER);
                p.textSize(12);
                p.text(noteName, noteNamePos.x, noteNamePos.y);
            }
            p.pop();
            
            cumulativeSteps += this.nodeSteps[i];
        }
    }
    
    // Draw chromatic nodes (no connection lines)
    drawChromaticNodes(p) {
        for (let i = 0; i < this.chromaticSteps.length; i++) {
            // Calculate absolute position for note name lookup
            let absolutePosition = this.startingStep + this.chromaticSteps[i];
            
            // Get visual position
            let pos = this.chromaticPoints[i];
            
            // Draw chromatic node
            p.push();
            if (i === this.selectedChromaticNode) {
                // Selected chromatic node - slightly larger and opaque
                p.fill(255, 200, 0, 255);
                p.noStroke();
                p.circle(pos.x, pos.y, this.NODE_RADIUS * 0.9);
            } else {
                // Unselected chromatic node - smaller and semi-transparent
                p.noFill();
                p.stroke(255, 150, 0, 190);
                p.strokeWeight(1.5);
                p.circle(pos.x, pos.y, this.NODE_RADIUS * 0.9);
            }
            
            // Draw note name in gray
            const dx = pos.x - this.center.x;
            const dy = pos.y - this.drawCenterY;
            const len = Math.sqrt(dx * dx + dy * dy);
            const noteNamePos = {
                x: pos.x - (dx / len) * 15,
                y: pos.y - (dy / len) * 15
            };
            
            const noteName = this.getNoteNameForStep(absolutePosition, false);
            if (noteName) {
                p.fill(130, 130, 130);
                p.noStroke();
                p.textAlign(p.CENTER, p.CENTER);
                p.textSize(10);
                p.text(noteName, noteNamePos.x, noteNamePos.y);
            }
            p.pop();
        }
    }
    
    // C++ ScaleEditor.cpp lines 728-815 - Draw root selector --------------------------------------------------------------------
    drawRootSelector(p) {
        const innerRadius = this.radius * this.ROTATION_RADIUS;
        
        p.push();
        p.noFill();
        p.stroke(...this.wheelColor);
        p.strokeWeight(2);
        p.circle(this.center.x, this.drawCenterY, innerRadius * 2);
        
        // Draw rotating tick marks
        for (let i = 0; i < this.STEPS_PER_OCTAVE; i++) {
            const angle = (Math.PI * 2 * i / this.STEPS_PER_OCTAVE) - Math.PI / 2 + this.rootRotation;
            
            const outerPos = {
                x: this.center.x + innerRadius * Math.cos(angle),
                y: this.drawCenterY + innerRadius * Math.sin(angle)
            };
            
            const innerPos = {
                x: this.center.x + (innerRadius - 8) * Math.cos(angle),
                y: this.drawCenterY + (innerRadius - 8) * Math.sin(angle)
            };
            
            p.stroke(120);
            p.strokeWeight(1);
            p.line(innerPos.x, innerPos.y, outerPos.x, outerPos.y);
        }
        
        // Draw static labels
        for (let i = 0; i < this.STEPS_PER_OCTAVE; i++) {
            if (!this.shouldDrawNoteAtStep(i)) continue;
            
            const labelPos = this.calculateLabelPosition(innerRadius, i);
            const adjustedStep = -40 + i;
            const noteName = this.getNoteNameForStep(adjustedStep, false);
            
            if (noteName) {
                p.fill(20);
                p.noStroke();
                p.textAlign(p.CENTER, p.CENTER);
                p.textSize(10);
                p.text(noteName, labelPos.position.x, labelPos.position.y);
            }
        }
        
        // Draw rotating root indicator
        const rootAngle = this.rootRotation - Math.PI / 2;
        const rootPos = {
            x: this.center.x + innerRadius * Math.cos(rootAngle),
            y: this.drawCenterY + innerRadius * Math.sin(rootAngle)
        };
        
        p.fill(255, 100, 0);
        p.noStroke();
        p.circle(rootPos.x, rootPos.y, this.NODE_RADIUS);
        
        // Draw growing ellipse indicator
        const totalRange = (this.MAX_OCTAVES * this.STEPS_PER_OCTAVE) + 13;
        const currentPosition = this.startingStep + 100;
        const growthFactor = currentPosition / totalRange;
        const maxEllipseSize = innerRadius * 0.6;
        const currentSize = maxEllipseSize * growthFactor * 2.0;
        
        p.fill(0, 120, 255, 80);
        p.noStroke();
        p.ellipse(this.center.x, this.drawCenterY, currentSize, currentSize);
        
        // Draw current root note in center
        const rootNoteName = this.getNoteNameForStep(this.startingStep, true);
        p.fill(...this.textColor);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(15);
        p.text(rootNoteName, this.center.x, this.drawCenterY);
        p.pop();
    }
    
    // C++ ScaleEditor.cpp lines 321-373 - Draw inversion wheel
    drawInversionWheel(p) {
        const inversionRadius = this.radius * this.INVERSION_RADIUS;
        
        p.push();
        p.noFill();
        p.stroke(...this.wheelColor);
        p.strokeWeight(1);
        p.circle(this.center.x, this.drawCenterY, inversionRadius * 2);
        
        const intervalSteps = this.getAllIntervalSteps();
        const intervalNames = ["Root", "9th", "3rd", "4th", "5th", "7th"];
        
        // Draw interval markers
        for (let i = 0; i < intervalSteps.length; i++) {
            const fixedAngle = (Math.PI * 2 * intervalSteps[i] / this.TOTAL_STEPS) - Math.PI / 2;
            
            const outerPos = {
                x: this.center.x + inversionRadius * Math.cos(fixedAngle),
                y: this.drawCenterY + inversionRadius * Math.sin(fixedAngle)
            };
            
            const innerPos = {
                x: this.center.x + (inversionRadius - 8) * Math.cos(fixedAngle),
                y: this.drawCenterY + (inversionRadius - 8) * Math.sin(fixedAngle)
            };
            
            p.stroke(120);
            p.strokeWeight(1);
            p.line(innerPos.x, innerPos.y, outerPos.x, outerPos.y);
            
            const dx = outerPos.x - this.center.x;
            const dy = outerPos.y - this.drawCenterY;
            const len = Math.sqrt(dx * dx + dy * dy);
            const labelPos = {
                x: outerPos.x + (dx / len) * 12,
                y: outerPos.y + (dy / len) * 12
            };
            
            p.fill(...this.textColor);
            p.noStroke();
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(10);
            p.text(intervalNames[i], labelPos.x, labelPos.y);
        }
        
        // Draw current inversion indicator
        const currentAngle = this.inversionRotation - Math.PI / 2;
        const indicatorPos = {
            x: this.center.x + inversionRadius * Math.cos(currentAngle),
            y: this.drawCenterY + inversionRadius * Math.sin(currentAngle)
        };
        
        p.fill(255, 100, 0);
        p.noStroke();
        p.circle(indicatorPos.x, indicatorPos.y, this.NODE_RADIUS);
        p.pop();
    }
    
    // C++ ScaleEditor.cpp lines 1032-1051 - Mouse pressed
    mousePressed(mouseX, mouseY) {
        const mouse = { x: mouseX, y: mouseY };
        const outerRadius = this.radius * this.factorSize;
        const titleBarY = this.center.y - outerRadius;
        
        // Check title bar dragging (C++ lines 1042-1050)
        if (mouse.y >= titleBarY &&
            mouse.y <= titleBarY + this.titleBarHeight &&
            mouse.x >= this.center.x - outerRadius &&
            mouse.x <= this.center.x + outerRadius) {
            // Only start dragging if not already interacting
            if (!this.isInteracting) {
                this.isDraggingTitleBar = true;
                this.isInteracting = true;
                this.titleBarOffset = {
                    x: mouseX - this.center.x,
                    y: mouseY - this.center.y
                };
            }
            return;
        }
        
        // Only check for interactions if not already interacting
        if (!this.isInteracting) {
            // Calculate distance to center
            const dx = mouse.x - this.center.x;
            const dy = mouse.y - this.drawCenterY;
            const distToCenter = Math.sqrt(dx * dx + dy * dy);
            const rotationZone = this.radius * this.ROTATION_RADIUS;
            const inversionZone = this.radius * this.INVERSION_RADIUS;
            
            // Check for inversion wheel click
            const distToInversionZone = Math.abs(distToCenter - inversionZone);
            if (distToInversionZone < this.SELECTION_RADIUS) {
                this.isRotatingInversion = true;
                this.isInteracting = true;
                this.previousInversionAngle = Math.atan2(dy, dx);
                return;
            }
            
            // Check for root selector click
            const innerBound = rotationZone * 0.2;
            const outerBound = rotationZone * 1.2;
            if (distToCenter >= innerBound && distToCenter <= outerBound) {
                this.isRotating = true;
                this.isInteracting = true;
                this.previousAngle = Math.atan2(dy, dx);
                return;
            }
            
            // Check for node selection (modal nodes first)
            this.selectedNode = this.findNearestNode(mouse);
            if (this.selectedNode >= 0) {
                this.isInteracting = true;
                return;
            }
            
            // Check for chromatic node selection (only if no modal node selected)
            this.selectedChromaticNode = this.findNearestChromaticNode(mouse);
            if (this.selectedChromaticNode >= 0) {
                this.isInteracting = true;
            }
        }
    }
    
    // C++ ScaleEditor.cpp lines 1054-1155 - Mouse dragged
    mouseDragged(mouseX, mouseY) {
        if (!this.p) return;
        
        // Handle title bar dragging (C++ lines 1062-1083)
        if (this.isDraggingTitleBar) {
            // Calculate potential new position
            const newX = mouseX - this.titleBarOffset.x;
            const newY = mouseY - this.titleBarOffset.y;
            
            // Calculate boundaries - same as VoicingEditor
            const outerRadius = this.radius * this.factorSize;
            const minX = outerRadius;
            const minY = outerRadius;
            const maxX = this.p.width - outerRadius;
            const maxY = this.p.height - outerRadius;
            
            // Clamp the position within canvas bounds
            this.center.x = this.p.constrain(newX, minX, maxX);
            this.center.y = this.p.constrain(newY, minY, maxY);
            this.drawCenterY = this.center.y + 15; // Recalculate offset after moving
            
            this.updateNodePositions();
            return;
        }
        
        const mouse = { x: mouseX, y: mouseY };
        const mouseAngle = Math.atan2(mouse.y - this.drawCenterY, mouse.x - this.center.x);
        const dx = mouse.x - this.center.x;
        const dy = mouse.y - this.drawCenterY;
        const distToCenter = Math.sqrt(dx * dx + dy * dy);
        const rotationZone = this.radius * this.ROTATION_RADIUS;
        const inversionZone = this.radius * this.INVERSION_RADIUS;
        
        // Check inversion wheel rotation
        if (this.isRotatingInversion) {
            this.handleInversionRotation(mouseAngle);
            return;
        }
        
        // Check root selector rotation
        if (this.isRotating) {
            this.handleRootRotation(mouseAngle);
            return;
        }
        
        // Don't start new interactions in mouseDragged - only continue existing ones
        // Rotation and inversion must be initiated in mousePressed, not here
        
        // Handle chromatic node dragging
        if (this.selectedChromaticNode >= 0) {
            // Get raw mouse angle (0 at right, increasing counterclockwise)
            let rawAngle = Math.atan2(mouse.y - this.drawCenterY, mouse.x - this.center.x);
            
            // Add PI/2 to align with our coordinate system (0 at top)
            let adjustedAngle = rawAngle + Math.PI / 2;
            
            // Normalize to 0 to 2*PI
            while (adjustedAngle < 0) adjustedAngle += Math.PI * 2;
            while (adjustedAngle >= Math.PI * 2) adjustedAngle -= Math.PI * 2;
            
            // Convert angle to interval (0-52 in 53-TET)
            let intervalFromRoot = Math.round((adjustedAngle * this.TOTAL_STEPS) / (Math.PI * 2));
            if (intervalFromRoot >= this.TOTAL_STEPS) intervalFromRoot = 0;
            
            // Update chromatic step
            if (intervalFromRoot !== this.chromaticSteps[this.selectedChromaticNode]) {
                this.chromaticSteps[this.selectedChromaticNode] = intervalFromRoot;
                this.updateChromaticPositions();

                // Update KeyMap with the new chromatic note position and push
                // the refreshed scale to the MIDI piano so the keyboard mapping
                // follows chromatic edits live.
                if (window.modalStudioKeyMap && this.chromaticNotesData[this.selectedChromaticNode]) {
                    const km = window.modalStudioKeyMap;
                    const rootStep = km.currentScale[0].step;
                    const note = this.chromaticNotesData[this.selectedChromaticNode];
                    note.step = rootStep + intervalFromRoot;
                    note.ratio = km.get53tetRatio(note.step);
                    note.freq = km.rootFrequency * note.ratio;

                    if (window.midiPianoHandler && window.midiPianoHandler.updateScale) {
                        window.midiPianoHandler.updateScale(km.currentScale, km.rootFrequency);
                    }
                }
            }
            return;
        }
        
        // Handle modal node dragging
        if (this.selectedNode >= 0) {
            const actualNode = this.selectedNode - 1;
            if (actualNode < 0 || actualNode >= this.numNodes) return;
            
            let currentAngle = this.getMouseAngle(mouse);
            let normalizedAngle = currentAngle;
            while (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
            while (normalizedAngle >= Math.PI * 2) normalizedAngle -= Math.PI * 2;
            
            let targetStep = Math.round((normalizedAngle * this.TOTAL_STEPS) / (Math.PI * 2));
            if (targetStep >= this.TOTAL_STEPS) targetStep = 0;
            
            const newSteps = [...this.nodeSteps];
            
            let currentPosition = 0;
            for (let i = 0; i < actualNode; i++) {
                currentPosition += this.nodeSteps[i];
            }
            
            let desiredSteps = targetStep - currentPosition;
            if (desiredSteps < 1) desiredSteps = 1;
            
            const nextNode = (actualNode + 1) % this.numNodes;
            const maxAvailableSteps = this.TOTAL_STEPS - currentPosition - (this.numNodes - actualNode - 1);
            desiredSteps = Math.max(1, Math.min(desiredSteps, maxAvailableSteps));
            
            if (desiredSteps !== this.nodeSteps[actualNode]) {
                const stepDiff = desiredSteps - this.nodeSteps[actualNode];
                newSteps[actualNode] = desiredSteps;
                newSteps[nextNode] -= stepDiff;
                
                if (newSteps[nextNode] >= 1) {
                    this.nodeSteps = newSteps;
                    this.updateNodePositions();
                    
                    // C++ ScaleEditor.cpp line 1172: Trigger callback when configuration changes
                    if (this.onConfigurationChanged) {
                        this.onConfigurationChanged(this.nodeSteps);
                    }
                }
            }
        }
    }
    
    // C++ ScaleEditor.cpp lines 1158-1179 - Mouse released
    mouseReleased(mouseX, mouseY) {
        if (this.isRotatingInversion) {
            // console.log('🔄 Mouse released on inversion wheel');
            this.targetInversionRotation = this.findNearestInversionAngle(this.inversionRotation);
            this.animationStartRotation = this.inversionRotation;
            this.animationStartTime = Date.now() / 1000;
            this.isAnimatingInversion = true;
            
            const prevInversion = this.currentInversion;
            this.currentInversion = this.getNearestInversion(this.targetInversionRotation);
            
            // console.log('🔄 prevInversion:', prevInversion, 'currentInversion:', this.currentInversion);
            
            // Fire callback if inversion changed
            if (prevInversion !== this.currentInversion && this.onInversionChanged) {
                //console.log('🔄 Inversion changed from', prevInversion, 'to', this.currentInversion);
                this.onInversionChanged(this.currentInversion);
            } else if (prevInversion === this.currentInversion) {
                //console.log('🔄 Inversion did NOT change - still', this.currentInversion);
            } else if (!this.onInversionChanged) {
                //console.log('🔄 ERROR: onInversionChanged callback is NULL');
            }
        }
        
        // Reset title bar dragging (C++ line 1168)
        this.isDraggingTitleBar = false;
        
        // C++ line 1171: Trigger callback if selectedNode was active OR root was rotating
        if (this.onConfigurationChanged && (this.selectedNode >= 0 || this.isRotating)) {
            //console.log('🎯 Root rotation released, triggering update. startingStep:', this.startingStep);
            this.onConfigurationChanged(this.nodeSteps);
        }
        
        this.selectedNode = -1;
        this.selectedChromaticNode = -1;  // Reset chromatic selection
        this.isRotating = false;
        this.isRotatingInversion = false;
        this.isInteracting = false;
    }
    
    // C++ ScaleEditor.hpp line 57: setIntervals - Set intervals from external source
    setIntervals(newIntervals) {
        if (newIntervals.length !== this.numNodes) {
           // console.warn('ScaleEditor: New intervals size doesn\'t match number of nodes');
            return;
        }
        this.nodeSteps = [...newIntervals];
        this.updateNodePositions();
        
        // Update chromatic notes from KeyMap after modal scale changes
        this.syncChromaticNotesFromKeyMap();
    }
    
    getCurrentIntervals() {
        return this.nodeSteps;
    }
    
    // Sync chromatic notes from ModalStudioKeyMap
    syncChromaticNotesFromKeyMap() {
        if (!window.modalStudioKeyMap) {
            //console.log('ScaleEditor: ModalStudioKeyMap not found');
            return;
        }
        
        if (!window.modalStudioKeyMap.currentScale) {
            console.log('ScaleEditor: KeyMap.currentScale is null - scale not calculated yet');
            return;
        }
        
        const keyMapScale = window.modalStudioKeyMap.currentScale;
        
        //console.log('ScaleEditor: Syncing chromatic notes...');
        //console.log('  KeyMap scale length:', keyMapScale.length);
        
        // Build the actual scale steps from nodeSteps (cumulative intervals)
        const modalScaleSteps = [];
        let cumulative = 0;
        for (let i = 0; i < this.nodeSteps.length; i++) {
            modalScaleSteps.push(cumulative);
            cumulative += this.nodeSteps[i];
        }
        
        //console.log('  Modal scale intervals:', modalScaleSteps);
        
        // Extract chromatic notes that are NOT in the modal scale
        this.chromaticNotesData = keyMapScale
            .slice(0, 12)  // Exclude octave (13th note)
            .filter(note => !note.isScaleNote);
        
        //console.log('  Found', this.chromaticNotesData.length, 'chromatic notes from KeyMap');
        
        if (this.chromaticNotesData.length === 0) {
            //console.log('  No chromatic notes to display');
            this.chromaticSteps = [];
            return;
        }
        
        // For each chromatic note, use its actual 53-TET step as the interval
        // KeyMap already calculated these in proper 53-TET space
        this.chromaticSteps = this.chromaticNotesData.map(note => {
            // note.step is already in 53-TET space relative to the root
            // Convert it to interval from root (0-52)
            const rootStep = keyMapScale[0].step; // Root is always first in KeyMap scale
            let interval = note.step - rootStep;
            // Normalize to 0-52 range
            while (interval < 0) interval += 53;
            while (interval >= 53) interval -= 53;
            return interval;
        });
        
        //console.log('✓ ScaleEditor: Synced', this.chromaticSteps.length, 'chromatic notes');
        //console.log('  Chromatic intervals:', this.chromaticSteps);
        
        // Update visual positions
        this.updateChromaticPositions();
    }
}
