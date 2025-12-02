// ============================================================================
// MODAL STUDIO - MIDI PIANO KEYBOARD MAPPING
// ============================================================================
// Adapts the 7-note modal scale to a 12-note chromatic mapping for MIDI piano
// Based on key_map.js from Eigenspace, but designed for modal_studio's 7-note scales

class ModalStudioKeyMap {
    constructor() {
        this.currentScale = null; // 13-note scale (12 + octave)
        this.rootFrequency = null;
    }

    // 53-TET calculation function
    get53tetRatio(steps) {
        return Math.pow(2, steps / 53.0);
    }

    // Find closest 53-TET step for a given frequency ratio relative to root
    findClosest53TETStep(ratio) {
        const steps = Math.round(53 * Math.log2(ratio));
        return steps;
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

        console.log('[ModalStudioKeyMap] Input scale frequencies:', validFreqs.map(f => f.toFixed(2)).join(', '));

        // Step 1: Convert scale frequencies to 53-TET steps relative to root
        const scaleSteps = validFreqs.map(freq => {
            const ratio = freq / rootFreq;
            return this.findClosest53TETStep(ratio);
        });

        // Sort and remove duplicates
        const uniqueScaleSteps = [...new Set(scaleSteps)].sort((a, b) => a - b);
        console.log('[ModalStudioKeyMap] Scale mapped to 53-TET steps:', uniqueScaleSteps.join(', '));

        // Step 2: Build a 12-note chromatic scale
        // We'll place the 7 modal notes at appropriate positions and fill in the gaps
        const rootStep = uniqueScaleSteps[0];
        const scaleIntervals = uniqueScaleSteps.map(step => step - rootStep);

        const scale12Steps = new Array(12);
        
        // Map scale notes to chromatic positions based on 53-TET interval classification
        // Following the Scale Editor wheel ranges from your diagram
        scaleIntervals.forEach((interval, idx) => {
            let pos = null;

            if (interval === 0) {
                // Root (C)
                pos = 0;
            } else if (interval >= 3 && interval <= 7) {
                // Minor 2nd region (C# / Db) - steps 3-7
                pos = 1;
            } else if (interval >= 8 && interval <= 10) {
                // Major 2nd region (D) - steps 8-10
                pos = 2;
            } else if (interval >= 11 && interval <= 15) {
                // Minor 3rd region (Eb) - steps 11-15
                pos = 3;
            } else if (interval >= 16 && interval <= 20) {
                // Major 3rd region (E) - steps 16-20
                pos = 4;
            } else if (interval >= 21 && interval <= 24) {
                // Perfect 4th region (F) - steps ~22
                pos = 5;
            } else if (interval >= 25 && interval <= 28) {
                // Augmented 4th / Tritone region (F#) - steps 25-28
                pos = 6;
            } else if (interval >= 29 && interval <= 33) {
                // Perfect 5th region (G) - steps ~31
                pos = 7;
            } else if (interval >= 34 && interval <= 37) {
                // Minor 6th region (Ab) - steps 34-37
                pos = 8;
            } else if (interval >= 38 && interval <= 41) {
                // Major 6th region (A) - steps 38-41
                pos = 9;
            } else if (interval >= 42 && interval <= 46) {
                // Minor 7th region (Bb) - steps 42-46 (includes neutral 7th)
                pos = 10;
            } else if (interval >= 47 && interval <= 51) {
                // Major 7th region (B) - steps 47-51
                pos = 11;
            }

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
                    const range = (rootStep + 53) - prevStep;
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
                    scale12Steps[i] = rootStep + Math.round((i / 12) * 53);
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

        // Add 13th note: octave (root + 53 steps)
        const octaveStep = rootStep + 53;
        const octaveRatio = this.get53tetRatio(octaveStep);
        const octaveFreq = rootFreq * octaveRatio;
        scale12Notes.push({
            step: octaveStep,
            ratio: octaveRatio,
            freq: octaveFreq,
            isScaleNote: true
        });

        console.log('[ModalStudioKeyMap] Generated 13-note chromatic scale:');
        scale12Notes.forEach((note, i) => {
            const scaleLabel = note.isScaleNote ? ' ★' : '';
            console.log(`  [${i}]: ${note.freq.toFixed(2)} Hz (step ${note.step})${scaleLabel}`);
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
            console.log('[ModalStudioKeyMap] Updating MIDI Piano with new scale');
            window.midiPianoHandler.updateScale(scale12, this.rootFrequency);
        } else {
            console.warn('[ModalStudioKeyMap] MIDI Piano handler not available');
        }
    }
}

// Create global instance
window.modalStudioKeyMap = new ModalStudioKeyMap();
console.log('✅ Modal Studio Key Mapping initialized');
