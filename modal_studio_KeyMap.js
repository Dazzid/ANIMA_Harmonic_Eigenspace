// ============================================================================
// MODAL STUDIO - MIDI PIANO KEYBOARD MAPPING
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
// Adapts the 7-note modal scale to a 12-note chromatic mapping for MIDI piano
// Based on key_map.js from Eigenspace, but designed for modal_studio's 7-note scales

class ModalStudioKeyMap {
    constructor() {
        this.currentScale = null; // 13-note scale (12 + octave)
        this.rootFrequency = null;
    }

    // Tuning math delegates to the active temperament (temperament.js); Phase 1
    // keeps it at 53-TET so results are identical.
    get53tetRatio(steps) {
        return window.Temperament.active.stepToRatio(steps);
    }

    // Find closest step for a given frequency ratio relative to root.
    findClosest53TETStep(ratio) {
        return window.Temperament.active.ratioToStep(ratio);
    }

    // Calculate 12-note chromatic scale from 7 modal scale notes using 53-TET
    calculateChromatic12Notes(scaleFreqs) {
        // scaleFreqs should be the 7 notes of the modal scale
        if (!scaleFreqs || scaleFreqs.length < 3) {
            console.warn('[ModalStudioKeyMap] Invalid scale frequencies for keyboard mapping');
            return null;
        }

        // Filter out undefined/null values
        const validFreqs = scaleFreqs.filter(f => f != null && typeof f === 'number' && !isNaN(f));
        
        if (validFreqs.length < 3) {
            console.warn('[ModalStudioKeyMap] Not enough valid frequencies:', scaleFreqs);
            return null;
        }

        const rootFreq = validFreqs[0];
        this.rootFrequency = rootFreq;

        //console.log('[ModalStudioKeyMap] Input scale frequencies:', validFreqs.map(f => f.toFixed(2)).join(', '));

        // Step 1: Convert scale frequencies to 53-TET steps relative to root
        const scaleSteps = validFreqs.map(freq => {
            const ratio = freq / rootFreq;
            return this.findClosest53TETStep(ratio);
        });

        // Sort and remove duplicates
        const uniqueScaleSteps = [...new Set(scaleSteps)].sort((a, b) => a - b);
        //console.log('[ModalStudioKeyMap] Scale mapped to 53-TET steps:', uniqueScaleSteps.join(', '));

        // Step 2: Build a 12-note chromatic scale
        // We'll place the 7 modal notes at appropriate positions and fill in the gaps
        const rootStep = uniqueScaleSteps[0];
        const scaleIntervals = uniqueScaleSteps.map(step => step - rootStep);

        const scale12Steps = new Array(12);
        
        // Map scale notes to chromatic positions based on 53-TET interval classification
        // Following the Scale Editor wheel ranges from your diagram
        scaleIntervals.forEach((interval, idx) => {
            let pos = window.Temperament.active.chromaticPosition(interval);

            if (pos !== null && pos < 12) {
                scale12Steps[pos] = rootStep + interval;
            }
        });

        // Fill gaps by interpolating between the 7 modal scale notes
        // This creates organic microtonal chromatic notes that respect the actual intervals
        for (let i = 0; i < 12; i++) {
            if (scale12Steps[i] === undefined) {
                // Find the surrounding defined notes
                let prevPos = -1, nextPos = 12;
                for (let j = i - 1; j >= 0; j--) {
                    if (scale12Steps[j] !== undefined) {
                        prevPos = j;
                        break;
                    }
                }
                for (let j = i + 1; j < 12; j++) {
                    if (scale12Steps[j] !== undefined) {
                        nextPos = j;
                        break;
                    }
                }

                // Interpolate between surrounding notes
                if (prevPos >= 0 && nextPos < 12) {
                    const prevStep = scale12Steps[prevPos];
                    const nextStep = scale12Steps[nextPos];
                    const range = nextStep - prevStep;
                    const positions = nextPos - prevPos;
                    const offset = i - prevPos;
                    scale12Steps[i] = Math.round(prevStep + (range * offset / positions));
                } else if (prevPos >= 0) {
                    // Fill from last defined note to octave
                    const prevStep = scale12Steps[prevPos];
                    const range = (rootStep + window.Temperament.active.octave) - prevStep;
                    const positions = 12 - prevPos;
                    const offset = i - prevPos;
                    scale12Steps[i] = Math.round(prevStep + (range * offset / positions));
                } else if (nextPos < 12) {
                    // Fill from root to first defined note
                    const nextStep = scale12Steps[nextPos];
                    const range = nextStep - rootStep;
                    const positions = nextPos;
                    const offset = i;
                    scale12Steps[i] = Math.round(rootStep + (range * offset / positions));
                } else {
                    // Fallback (shouldn't happen with 7 modal notes)
                    scale12Steps[i] = rootStep + Math.round((i / 12) * window.Temperament.active.N);
                }
            }
        }

        // Convert steps to frequencies
        const scale12Notes = scale12Steps.map(step => {
            const ratio = this.get53tetRatio(step);
            const freq = rootFreq * ratio;
            const isScaleNote = scaleSteps.includes(step);

            return {
                step: step,
                ratio: ratio,
                freq: freq,
                isScaleNote: isScaleNote
            };
        });

        // Add 13th note: octave (root + N steps)
        const octaveStep = rootStep + window.Temperament.active.octave;
        const octaveRatio = this.get53tetRatio(octaveStep);
        const octaveFreq = rootFreq * octaveRatio;
        scale12Notes.push({
            step: octaveStep,
            ratio: octaveRatio,
            freq: octaveFreq,
            isScaleNote: true
        });

        //console.log('[ModalStudioKeyMap] Generated 13-note chromatic scale:');
        scale12Notes.forEach((note, i) => {
            const scaleLabel = note.isScaleNote ? ' ★' : '';
            //console.log(`  [${i}]: ${note.freq.toFixed(2)} Hz (step ${note.step})${scaleLabel}`);
        });

        this.currentScale = scale12Notes;
        return scale12Notes;
    }

    // Update MIDI Piano with the current scale
    updateMidiPiano(scaleFreqs) {
        const scale12 = this.calculateChromatic12Notes(scaleFreqs);

        if (!scale12) {
            console.warn('[ModalStudioKeyMap] Failed to generate chromatic scale');
            return;
        }

        // Update MIDI piano handler with the new scale
        if (window.midiPianoHandler && window.midiPianoHandler.updateScale) {
            //console.log('[ModalStudioKeyMap] Updating MIDI Piano with new scale');
            window.midiPianoHandler.updateScale(scale12, this.rootFrequency);
        } else {
            console.warn('[ModalStudioKeyMap] MIDI Piano handler not available');
        }
    }
}

// Create global instance
window.modalStudioKeyMap = new ModalStudioKeyMap();
console.log('✅ Modal Studio Key Mapping initialized');
