// ============================================================================
// CHORD FREQUENCY SPECTRUM VISUALIZATION
// Shows frequency range C3-C5 with current playing notes
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

class ChordVisualization {
    constructor() {

        //get adsr canvas size
        let adsrCanvasSize = getCanvasSize();

        // Calculate position: ADSR container top (10px) + ADSR height + gap (10px)
        const adsrContainerTop = 10;
        this.topPosition = adsrContainerTop + adsrCanvasSize.height + 10;
        
        this.canvas = null;
        this.W = 320;
        this.H = 640;

        // Frequency range: C3 to C6 (3 octaves)
        this.minFreq = 130.81;   // C3
        this.maxFreq = 1046.50;  // C6

        // Visual parameters
        this.padding = 10;
        this.spectrumX = 10;
        this.spectrumWidth = 240;
        this.spectrumHeight = this.H - 100;
        this.spectrumY = 50;
        this.positionKeys = 40;

        // Currently playing frequencies
        this.activeFreqs = [];
        this.targetFreqs = [];
        this.rootFreq = 220.0; // A3 default

        // Keyboard mapped frequencies (chromatic scale)
        this.keyboardMappedFreqs = [];
        this.mappedScaleColor = [255, 255, 255]; // Default white

        // MIDI keyboard active notes (exact frequencies, not normalized to 12-TET)
        this.midiActiveNotes = []; // Array of {freq: number, velocity: number}

        this.bgColor = 'rgba(25, 25, 25, 0.9)';

        // Frequency doubling flags for each voice
        this.doublingFlags = {
            R: false,    // Root
            α: false,    // Alpha  
            β: false,    // Beta
            γ: false     // Gamma
        };

        // Animation
        this.animationSpeed = 0.25;
        this.round = 10;

        this.textColor = 'rgba(222, 222, 222, 1)';
        this.whiteKeysPiano = 'rgb(80, 80, 80)';
        this.lineColors = 'rgba(25, 25, 25, 0.5)';

        // Note names for reference
        this.noteFreqs = [
            { freq: 130.81, name: 'C3' },
            { freq: 138.59, name: 'C#3' },
            { freq: 146.83, name: 'D3' },
            { freq: 155.56, name: 'D#3' },
            { freq: 164.81, name: 'E3' },
            { freq: 174.61, name: 'F3' },
            { freq: 185.00, name: 'F#3' },
            { freq: 196.00, name: 'G3' },
            { freq: 207.65, name: 'G#3' },
            { freq: 220.00, name: 'A3' },
            { freq: 233.08, name: 'A#3' },
            { freq: 246.94, name: 'B3' },
            { freq: 261.63, name: 'C4' },
            { freq: 277.18, name: 'C#4' },
            { freq: 293.66, name: 'D4' },
            { freq: 311.13, name: 'D#4' },
            { freq: 329.63, name: 'E4' },
            { freq: 349.23, name: 'F4' },
            { freq: 369.99, name: 'F#4' },
            { freq: 392.00, name: 'G4' },
            { freq: 415.30, name: 'G#4' },
            { freq: 440.00, name: 'A4' },
            { freq: 466.16, name: 'A#4' },
            { freq: 493.88, name: 'B4' },
            { freq: 523.25, name: 'C5' },
            { freq: 554.37, name: 'C#5' },
            { freq: 587.33, name: 'D5' },
            { freq: 622.25, name: 'D#5' },
            { freq: 659.26, name: 'E5' },
            { freq: 698.46, name: 'F5' },
            { freq: 739.99, name: 'F#5' },
            { freq: 783.99, name: 'G5' },
            { freq: 830.61, name: 'G#5' },
            { freq: 880.00, name: 'A5' },
            { freq: 932.33, name: 'A#5' },
            { freq: 987.77, name: 'B5' },
            { freq: 1046.50, name: 'C6' }
        ];

        // P5 instance mode reference
        this.p5Instance = null;

        this.colors = [
            [255, 255, 255],    // Root (white)
            [255, 100, 0],      // rgba(255, 100, 0, 1)
            [118, 236, 0],      // rgba(118, 236, 0, 1)
            [0, 128, 255]       // rgba(0, 128, 255, 1)
        ];

        // WHITE-KEY-uniform axis (same real-piano design as the MS spectrum): 7 white
        // keys per octave, equal size, black keys narrower ON TOP between them — no
        // white slot for the sharps. WKU maps a chromatic semitone (0..12 above C) to
        // white-key units (0..7); a 12-TET note lands on its key centre.
        this.WKU = [0, 0.5, 1, 1.5, 2, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7];
        this.BLACK_WKU = [0.5, 1.5, 3.5, 4.5, 5.5]; // C# D# F# G# A# within an octave
    }
    //----------------------------------------------------------------------------------------
    setup(p) {
        this.p5Instance = p;
        this.canvas = p.createCanvas(this.W, this.H);
        this.canvas.parent('chord-visualization-container');

        // Position is controlled by #chord-visualization-container in style.css
        // (no dynamic top here, so the panel sits where the CSS places it).
        
        // p.textMode(p.CENTER);
        p.textFont('Fira Code');
    }
    //----------------------------------------------------------------------------------------
    draw(p) {
        // Clear background
        p.clear();
        // Dark background
        p.noStroke();
        p.fill(this.bgColor);
        p.rect(0, 0, this.W, this.H, this.round);

        // Draw title
        p.fill(this.textColor);
        p.textAlign(p.CENTER);
        p.textSize(15);
        p.text('Frequency Spectrum', this.W / 2, 25);

        // Draw background spectrum area
        this.drawSpectrumBackground(p);

        // Draw MIDI active notes (shows exact frequency positions)
        this.drawMIDINotes(p);

        // Draw frequency axis
        // this.drawFrequencyAxis(p);

        // Draw note markers
        this.drawNoteMarkers(p);

        // Draw the 53-TET step ticks (clickable root steps)
        this.draw53TetTicks(p);

        // Thin hover highlight over the 53-TET step under the cursor
        this.draw53TetHover(p);

        // Draw keyboard mapped scale markers
        this.drawKeyboardMappedScale(p);

        // Draw current root indicator
        this.drawRootIndicator(p);

        // Draw active frequencies
        this.updateAndDrawActiveFrequencies(p);

        // Draw frequency labels
        this.drawFrequencyLabels(p);
    }
    //----------------------------------------------------------------------------------------
    drawSpectrumBackground(p) {
        const bgX = this.spectrumX;
        const bgY = this.spectrumY - 10;
        const bgWidth = 300;
        const bgHeight = this.spectrumHeight + 20;

        // Background panel
        p.fill(this.whiteKeysPiano);
        p.stroke(60, 60, 60);
        p.strokeWeight(1);
        // p.rect(bgX, bgY, bgWidth, bgHeight, 8);

        // --- Real piano keys (same design as the MS spectrum), drawn VERTICAL ---
        const total = this._totalWku();
        const uY = this.spectrumHeight / (total + 1);   // one white-key unit, px (Y)
        const keyX = bgX + 5;
        const keyW = bgWidth - 10;

        // White keys: horizontal bands spanning boundary-to-boundary so adjacent keys
        // TOUCH; the stroke borders delineate them. Bottom (C3) and top (C6) are full.
        p.stroke(this.lineColors);
        p.strokeWeight(1);
        p.fill(this.whiteKeysPiano);
        for (let w = 0; w <= Math.round(total); w++) {
            const yTop = this._wkuY(w + 0.5);   // higher freq → smaller y
            const yBot = this._wkuY(w - 0.5);
            p.rect(keyX, yTop, keyW, yBot - yTop, 0, 5, 5, 0);
        }

        // Black keys: narrower (left part) + shorter dark bands ON TOP, centered on each
        // sharp (C# D# F# G# A#) of every octave — never E–F or B–C.
        const octs = Math.ceil(Math.log(this.maxFreq / this.minFreq) / Math.log(2));
        p.noStroke();
        p.fill(20);
        for (let k = 0; k < octs; k++) {
            for (const off of this.BLACK_WKU) {
                const wku = k * 7 + off;
                if (wku > total) continue;
                const yc = this._wkuY(wku);
                p.rect(keyX, yc - uY * 0.3, keyW * 0.55, uY * 0.6, 0, 4, 4, 0);
            }
        }
    }

    //----------------------------------------------------------------------------------------
    drawFrequencyAxis(p) {
        // Main vertical line
        p.stroke(120);
        p.strokeWeight(2);
        p.line(this.spectrumX, this.spectrumY, this.spectrumX, this.spectrumY + this.spectrumHeight);

        // Horizontal tick marks for octaves with precise alignment
        p.strokeWeight(1);
        const octaveFreqs = [130.81, 261.63, 523.25]; // C3, C4, C5
        for (let freq of octaveFreqs) {
            const y = this.freqToY(freq);
            p.stroke(100);
            p.line(this.spectrumX - 12, y, this.spectrumX + 5, y);

            // Major frequency label
            p.fill(this.textColor);
            p.noStroke();
            p.textAlign(p.RIGHT);
            p.textSize(9);
            const note = this.noteFreqs.find(n => Math.abs(n.freq - freq) < 0.1);
            if (note) {
                p.text(note.name, this.spectrumX - 15, y + 2);
                p.fill(240);
                p.text(`${freq.toFixed(0)}Hz`, this.spectrumX - 17, y + 12);
            }
        }

        // Add intermediate frequency grid lines for better reference
        const intermediateFreqs = [146.83, 174.61, 196.00, 220.00, 246.94, 293.66, 349.23, 392.00, 440.00, 493.88];
        for (let freq of intermediateFreqs) {
            if (freq >= this.minFreq && freq <= this.maxFreq) {
                const y = this.freqToY(freq);
                p.stroke(40);
                p.line(this.spectrumX - 5, y, this.spectrumX + 2, y);
            }
        }
    }

    //----------------------------------------------------------------------------------------
    drawMIDINotes(p) {
        // Draw subtle white rectangles for currently pressed MIDI keys
        // Shows exact frequency position (not normalized to 12-TET) to see micro-tuning displacement
        if (!this.midiActiveNotes || this.midiActiveNotes.length === 0) {
            return;
        }

        const bgX = this.spectrumX;
        const bgWidth = 300;

        if (!this.midiActiveNotes || this.midiActiveNotes.length === 0) {
            return;
        }

        p.noStroke();
        for (let note of this.midiActiveNotes) {
            const freq = note.freq;
            const y = this.freqToY(freq);
            const rectHeight = 12;
            
            // Subtle white rectangle with 20% alpha (51 = 0.2 * 255)
            p.fill(255, 255, 255, 51);
            p.rect(bgX + 5, y - rectHeight/2, bgWidth - 10, rectHeight, 8);
        }
    }

    //----------------------------------------------------------------------------------------
    drawNoteMarkers(p) {
        // Tiny ticks at the 12-TET reference positions. (The old q/w/e key letters
        // were removed — the keyboard no longer maps to those specific keys; root
        // selection + names are handled by the 53-TET ticks/hover.)
        for (let note of this.noteFreqs) {
            if (note.key) {
                const y = this.freqToY(note.freq);
                p.stroke(100);
                p.line(this.positionKeys - 15, y, this.positionKeys, y);
            }
        }
    }

    //----------------------------------------------------------------------------------------
    drawRootIndicator(p) {
        const y = this.freqToY(this.rootFreq);

        // Root frequency line (extends across the spectrum)
        p.fill(0, 200, 255, 100);
        // p.strokeWeight(1);
        p.noStroke();
        p.rect(this.spectrumX + 10, y-5, this.spectrumX + 220, 10, 5);

        // Root label with better positioning
        // p.fill(0, 200, 255);
        // p.textAlign(p.LEFT);
        // p.textSize(10);
        // const rootNote = this.getNoteName(this.rootFreq);
        // Position label to avoid overlap with bars
        // const labelY = y < this.spectrumY + 40 ? y + 25 : y - 10;
        // p.text(`${rootNote}`, this.spectrumX + 275, labelY + 14);
    }

    //----------------------------------------------------------------------------------------
    updateAndDrawActiveFrequencies(p) {
        // Smooth animation to target frequencies
        for (let i = this.activeFreqs.length - 1; i >= 0; i--) {
            let active = this.activeFreqs[i];

            // Find corresponding target
            let target = this.targetFreqs.find(t =>
                Math.abs(t.freq - active.targetFreq) < 0.1 &&
                t.harmonic === active.harmonic
            );

            if (target) {
                // Animate to target amplitude
                active.amp += (target.amp - active.amp) * this.animationSpeed;
                active.displayAmp = active.amp;
            } else {
                // Fade out
                active.displayAmp *= 0.85;
                if (active.displayAmp < 0.01) {
                    this.activeFreqs.splice(i, 1);
                    continue;
                }
            }

            // Draw frequency bar
            this.drawFrequencyBar(p, active.freq, active.displayAmp, active.harmonic, active.noteIndex);
        }

        // Add new frequencies
        for (let target of this.targetFreqs) {
            let exists = this.activeFreqs.find(a =>
                Math.abs(a.targetFreq - target.freq) < 0.1 &&
                a.harmonic === target.harmonic
            );

            if (!exists) {
                this.activeFreqs.push({
                    freq: target.freq,
                    targetFreq: target.freq,
                    amp: 0,
                    displayAmp: 0,
                    harmonic: target.harmonic,
                    noteIndex: target.noteIndex
                });
            }
        }
    }

    //----------------------------------------------------------------------------------------
    drawFrequencyBar(p, freq, amplitude, harmonic, noteIndex) {
        // Skip if frequency is out of range
        if (freq < this.minFreq || freq > this.maxFreq) return;

        const y = this.freqToY(freq);
        const barWidth = amplitude * 152; // Animated width based on amplitude
        const barHeight = 5; // Fixed height for all bars

        const baseColor = this.colors[noteIndex] || [200, 200, 200];

        p.fill(baseColor[0], baseColor[1], baseColor[2], 255);
        p.noStroke();
        
        // ALL bars aligned at the same horizontal position, starting from the frequency axis
        const barX = this.spectrumX + 10;
        const barY = y - Math.floor(barHeight / 2);
        p.rect(barX, barY, barWidth, barHeight, 3);

        // Draw frequency value for all fundamentals when bar is visible
        if (amplitude > 0.3 && barWidth > 10) {
            p.fill(baseColor[0], baseColor[1], baseColor[2], 255);
            p.textAlign(p.LEFT);
            p.noStroke();
            p.textSize(12);
            
            // Check if this voice is doubled
            const labels = ['R', 'α', 'β', 'γ'];
            const voiceLabel = labels[noteIndex];
            const isDoubled = this.doublingFlags[voiceLabel];
            
            // Show frequency with optional [x2] indicator
            const freqText = isDoubled ? 
                freq.toFixed(3) + ' Hz [x2]' : 
                freq.toFixed(3) + ' Hz';
            p.text(freqText, barX + barWidth + 5, y + 4);
        }
    }
 
    //----------------------------------------------------------------------------------------
    drawFrequencyLabels(p) {
        // Legend for the colors
        const y = this.spectrumY + this.spectrumHeight + 15;
       
        const labels = [
            { color: this.colors[0], text: 'R' },
            { color: this.colors[1], text: 'α' },
            { color: this.colors[2], text: 'β' },
            { color: this.colors[3], text: 'γ' }
        ];
        
        p.noStroke();
        for (let i = 0; i < labels.length; i++) {
            const x = (this.spectrumX + i * 70) + 25;

            // Draw label text
            p.textSize(12);
            p.textAlign(p.LEFT);
            p.fill(labels[i].color[0], labels[i].color[1], labels[i].color[2], 255);
            p.text(labels[i].text, x + 24, y + 14);
            
            // Draw [x2] button
            const buttonX = x;
            const buttonY = y;
            const buttonW = 20;
            const buttonH = 20;
            
            // Check if this voice is doubled
            const isDoubled = this.doublingFlags[labels[i].text];

            // Hover detection (must match the hit-test in handleMouseClick)
            const isHovered = p.mouseX >= buttonX && p.mouseX <= buttonX + buttonW &&
                              p.mouseY >= buttonY && p.mouseY <= buttonY + buttonH;

            // Button background
            if (isDoubled) {
                // Use the corresponding axis color when active
                p.noStroke();
                p.fill(labels[i].color[0], labels[i].color[1], labels[i].color[2], 255);
            } else {
                p.fill(0, 0, 0);
                p.stroke(labels[i].color[0], labels[i].color[1], labels[i].color[2], 255);
            }
            p.strokeWeight(1);
            p.rect(buttonX, buttonY, buttonW, buttonH, 2);

            // Hover highlight: light gray overlay with alpha to enhance interaction
            if (isHovered) {
                p.noStroke();
                p.fill(200, 200, 200, 60); // light gray, ~24% alpha
                p.rect(buttonX, buttonY, buttonW, buttonH, 2);
            }

            // Button text
            p.noStroke();
            p.fill(isDoubled ? 0 : 180); // Black text on orange, light gray on dark
            p.textSize(9);
            p.textAlign(p.CENTER);
            p.text('x2', buttonX + buttonW/2, buttonY + 13);
            
           
        }
    }

    //----------------------------------------------------------------------------------------
    // Set keyboard mapped frequencies and color
    setKeyboardMappedScale(notes, color) {
        // notes can be either array of numbers (frequencies) or array of {freq, name, step}
        this.keyboardMappedFreqs = notes || [];
        if (color && Array.isArray(color) && color.length >= 3) {
            this.mappedScaleColor = color;
        }
    }

    //----------------------------------------------------------------------------------------
    // Draw small horizontal lines for keyboard mapped frequencies
    drawKeyboardMappedScale(p) {
        if (!this.keyboardMappedFreqs || this.keyboardMappedFreqs.length === 0) {
            return;
        }

        for (let note of this.keyboardMappedFreqs) {
            // Handle both old format (just frequency) and new format (object with freq, name, step)
            const freq = typeof note === 'number' ? note : note.freq;
            const noteName = note.name || null;
            
            // Skip if frequency is outside visible range
            if (freq < this.minFreq || freq > this.maxFreq) continue;

            const y = this.freqToY(freq);
            const lineX = this.spectrumX + this.spectrumWidth + 15; // Right side of spectrum
            const lineWidth = 15;

            // Draw horizontal line marker (25x1) in white
            p.stroke(255, 255, 255, 180);
            p.strokeWeight(0.5);
            p.line(lineX, y, lineX + lineWidth, y);
            
            // Draw note name label in white if available
            if (noteName) {
                p.noStroke();
                p.fill(255, 255, 255, 200);
                p.textAlign(p.LEFT, p.CENTER);
                p.textSize(10);
                p.text(noteName, lineX + lineWidth + 3, y);
            }
            p.textAlign(p.LEFT, p.BASELINE);
        }
    }

    //----------------------------------------------------------------------------------------
    // Short ticks for every 53-TET step on the left edge of the spectrum — the
    // clickable root steps. The 12-TET lines (drawNoteMarkers) stay the prominent
    // labeled anchors; these are subtle. The current root's step is highlighted.
    draw53TetTicks(p) {
        const steps = window.tet53Steps;
        if (!steps || steps.length === 0) return;
        const x0 = this.spectrumX + 2;
        for (const s of steps) {
            const y = this.freqToY(s.frequency);
            const isRoot = Math.abs(s.frequency - this.rootFreq) < 0.5;
            
            p.stroke(255, 255, 255, 120); // faint but visible
            p.strokeWeight(1);
            p.line(x0, y, x0 + 8, y);
            
        }
    }

    // Thin hover highlight that tracks the 53-TET step under the cursor and shows
    // its name — so the whole spectrum reads as clickable (not just the 12 notes).
    draw53TetHover(p) {
        const steps = window.tet53Steps;
        if (!steps || steps.length === 0) return;
        const mx = p.mouseX, my = p.mouseY;
        const left = this.positionKeys - 35;
        const right = this.positionKeys + this.spectrumWidth + 25;
        if (mx < left || mx > right) return;
        if (my < this.spectrumY - 6 || my > this.spectrumY + this.spectrumHeight + 6) return;

        let best = null, bestD = Infinity;
        for (const s of steps) {
            const d = Math.abs(this.freqToY(s.frequency) - my);
            if (d < bestD) { bestD = d; best = s; }
        }
        if (!best) return;
        const y = this.freqToY(best.frequency);

        // Thin band + line (much thinner than the old 12-TET block)
        p.noStroke();
        p.fill(255, 255, 255, 26);
        p.rect(this.positionKeys - 20, y - 3, this.spectrumWidth + 45, 6, 6);
        // p.stroke(255, 255, 255, 150);
        // p.strokeWeight(1);
        // p.rect(this.positionKeys - 20, y, this.positionKeys + this.spectrumWidth + 25, y);

        // 53-TET note name of the hovered step
        p.noStroke();
        p.fill(255, 220, 120);
        p.textAlign(p.RIGHT);
        p.textSize(10);
        p.text(best.noteName, this.positionKeys + this.spectrumWidth + 22, y - 4);
    }

    // Total white-key units spanned (7 per octave).
    _totalWku() { return 7 * (Math.log(this.maxFreq / this.minFreq) / Math.log(2)); }

    // Frequency → white-key units above minFreq (piecewise via WKU).
    _freqToWku(freq) {
        const s = 12 * (Math.log(freq / this.minFreq) / Math.log(2)); // semitones above minFreq
        const oct = Math.floor(s / 12);
        const rem = s - oct * 12;                                     // 0..12 within octave
        const lo = Math.floor(rem), hi = Math.min(lo + 1, 12);
        const wkuIn = this.WKU[lo] + (this.WKU[hi] - this.WKU[lo]) * (rem - lo);
        return oct * 7 + wkuIn;
    }

    // White-key units → Y. Reserves half a key at each end so the bottom (C3) and top
    // (C6) keys are FULL; high frequency at the top (inverted).
    _wkuY(wku) {
        const ratio = (wku + 0.5) / (this._totalWku() + 1);
        return this.spectrumY + this.spectrumHeight * (1 - ratio);
    }

    // Frequency → Y on the white-key-uniform axis (a note lands on its piano key).
    freqToY(freq) {
        return this._wkuY(this._freqToWku(freq));
    }

    //----------------------------------------------------------------------------------------
    getNoteName(freq) {
        // Find closest note name
        let closest = this.noteFreqs[0];
        let minDiff = Math.abs(freq - closest.freq);

        for (let note of this.noteFreqs) {
            const diff = Math.abs(freq - note.freq);
            if (diff < minDiff) {
                minDiff = diff;
                closest = note;
            }
        }

        // If very close to a named note, return it
        if (minDiff < 2) {
            return closest.name;
        }

        // Otherwise return frequency
        return freq.toFixed(1) + ' Hz';
    }

    //----------------------------------------------------------------------------------------
    getCurrentRatios() {
        // Calculate the ratios from current frequencies
        if (this.targetFreqs.length === 0) return null;

        const fundamentals = this.targetFreqs.filter(f => f.harmonic === 0);
        if (fundamentals.length < 4) return null;

        const ratios = fundamentals.map(f => f.freq / this.rootFreq);
        return {
            alpha: ratios[1].toFixed(3),
            beta: ratios[2].toFixed(3),
            gamma: ratios[3].toFixed(3)
        };
    }

    //----------------------------------------------------------------------------------------
    setPlayingChord(alpha, beta, gamma, baseFreq) {
        // Update root frequency
        this.rootFreq = baseFreq;

        // Clear target frequencies
        this.targetFreqs = [];

        // Add ONLY fundamental frequencies (no fake harmonics)
        const ratios = [1, alpha, beta, gamma];
        const labels = ['R', 'α', 'β', 'γ'];

        for (let noteIndex = 0; noteIndex < ratios.length; noteIndex++) {
            const baseFreqForNote = baseFreq * ratios[noteIndex];
            
            // Apply frequency doubling if flag is set for this voice
            const actualFreq = this.doublingFlags[labels[noteIndex]] ? 
                baseFreqForNote * 2 : baseFreqForNote;

            // Always add to display (visual shows original frequency)
            if (baseFreqForNote >= this.minFreq && baseFreqForNote <= this.maxFreq) {
                this.targetFreqs.push({
                    freq: baseFreqForNote, // Visual always shows original frequency
                    amp: 1.0, // All fundamentals same amplitude
                    harmonic: 0, // Only fundamental
                    noteIndex: noteIndex,
                    actualPlaybackFreq: actualFreq // Store actual playback frequency
                });
            }
        }
    }

    //----------------------------------------------------------------------------------------
    clearPlayingNotes() {
        this.targetFreqs = [];
    }
    //----------------------------------------------------------------------------------------
    setRootFrequency(freq) {
        this.rootFreq = freq;
    }
    //----------------------------------------------------------------------------------------
    getHoveredNote(mouseX, mouseY) {
        // Check if mouse is within the note area
        const clickAreaLeft = this.positionKeys - 25;
        const clickAreaRight = this.positionKeys + this.spectrumWidth + 25;
        
        if (mouseX >= clickAreaLeft && mouseX <= clickAreaRight) {
            // Check each clickable note
            for (let note of this.noteFreqs) {
                if (note.key) {
                    const y = this.freqToY(note.freq);
                    const noteHeight = 20;
                    
                    if (mouseY >= y - noteHeight/2 && mouseY <= y + noteHeight/2) {
                        return note;
                    }
                }
            }
        }
        return null;
    }
    //----------------------------------------------------------------------------------------
    handleMouseClick(mouseX, mouseY) {
        // Check for [x2] button clicks first
        // NOTE: must match the buttonY used in drawFrequencyLabels (y = ... + 15)
        const legendY = this.spectrumY + this.spectrumHeight + 15;
        const labels = ['R', 'α', 'β', 'γ'];
        
        for (let i = 0; i < labels.length; i++) {
            const x = (this.spectrumX + i * 70) + 25;
            const buttonX = x;
            const buttonY = legendY;
            const buttonW = 20;
            const buttonH = 20;
            
            // Check if click is within this [x2] button
            if (mouseX >= buttonX && mouseX <= buttonX + buttonW && 
                mouseY >= buttonY && mouseY <= buttonY + buttonH) {
                
                // Toggle the doubling flag for this voice
                this.doublingFlags[labels[i]] = !this.doublingFlags[labels[i]];
                
                // Update the audio with current chord settings
                if (typeof window.updateChordWithDoubling === 'function') {
                    window.updateChordWithDoubling();
                }
                
                return true; // Click was handled
            }
        }
        
        // Check if click is within the note area (where keyboard notes are displayed)
        const clickAreaLeft = this.positionKeys - 35;
        const clickAreaRight = this.positionKeys + this.spectrumWidth + 25;
        
        if (mouseX >= clickAreaLeft && mouseX <= clickAreaRight) {
            // 53-TET root selection: snap the click to the nearest 53-TET step on
            // the spectrum (the 12-TET notes stay as visual reference). Names come
            // from the reference data (window.tet53Steps).
            const steps = window.tet53Steps;
            if (steps && steps.length &&
                mouseY >= this.spectrumY - 10 && mouseY <= this.spectrumY + this.spectrumHeight + 10) {
                let best = null, bestD = Infinity;
                for (const s of steps) {
                    const d = Math.abs(this.freqToY(s.frequency) - mouseY);
                    if (d < bestD) { bestD = d; best = s; }
                }
                if (best) {
                    this.setRootFrequency(best.frequency);
                    if (typeof window.updateGlobalRoot === 'function') {
                        window.updateGlobalRoot(best.frequency, best.noteName);
                    }
                    return true;
                }
            }

            // Fallback (before the 53-TET data loads): original 12-TET note hit-test.
            for (let note of this.noteFreqs) {
                if (note.key) {
                    const y = this.freqToY(note.freq);
                    const noteHeight = 20; // Height of clickable area around each note
                    if (mouseY >= y - noteHeight/2 && mouseY <= y + noteHeight/2) {
                        this.setRootFrequency(note.freq);
                        if (typeof window.updateGlobalRoot === 'function') {
                            window.updateGlobalRoot(note.freq);
                        }
                        return true;
                    }
                }
            }
        }
        return false; // Click was not on a note or button
    }
}

// Create global instance and P5 sketch
let chordViz = new ChordVisualization();

// Create P5 instance for chord visualization
// Held in a module-scope handle so EigenspaceScene can gate its events by scene
// (this p5 instance's mousePressed fires on any window press).
let chordVizP5 = new p5(function (p) {
    // Gated by the active scene (see EigenspaceScene.activateComponents).
    let eventsEnabled = true;

    p.setup = function () {
        chordViz.setup(p);
    };

    p.draw = function () {
        chordViz.draw(p);
    };

    p.mousePressed = function () {
        if (!eventsEnabled) return false;
        // Check if mouse is within the canvas bounds
        if (p.mouseX >= 0 && p.mouseX <= chordViz.W &&
            p.mouseY >= 0 && p.mouseY <= chordViz.H) {
            return chordViz.handleMouseClick(p.mouseX, p.mouseY);
        }
        return false;
    };

    // Scene gating hooks (mirrors colorbar-slider.js) — called by EigenspaceScene.
    p.enableEvents = function () { eventsEnabled = true; };
    p.disableEvents = function () { eventsEnabled = false; };
});

// Expose global functions for integration with test.js
window.setChordVisualization = function (alpha, beta, gamma, baseFreq) {
    if (chordViz) {
        chordViz.setPlayingChord(alpha, beta, gamma, baseFreq);
    }
};

window.clearChordVisualization = function () {
    if (chordViz) {
        chordViz.clearPlayingNotes();
    }
};

window.setRootVisualization = function (freq) {
    if (chordViz) {
        chordViz.setRootFrequency(freq);
    }
};

window.getDoublingFlags = function () {
    return chordViz ? chordViz.doublingFlags : { R: false, α: false, β: false, γ: false };
};

window.setDoublingFlags = function (flags) {
    if (!chordViz) return;
    chordViz.doublingFlags = { ...flags };
    console.log('Doubling flags set to:', chordViz.doublingFlags);
};

window.getActualPlaybackFrequencies = function () {
    if (!chordViz || !chordViz.targetFreqs) return [];
    
    return chordViz.targetFreqs.map(freq => ({
        originalFreq: freq.freq,
        playbackFreq: freq.actualPlaybackFreq || freq.freq,
        noteIndex: freq.noteIndex,
        isDoubled: freq.actualPlaybackFreq > freq.freq
    }));
};

window.setKeyboardMappedScale = function (frequencies, color) {
    if (chordViz) {
        chordViz.setKeyboardMappedScale(frequencies, color);
    }
};

window.setMIDIActiveNotes = function (notes) {
    // notes should be an array of {freq: number, velocity: number}
    // freq is the exact frequency (not normalized to 12-TET)
    if (chordViz) {
        chordViz.midiActiveNotes = notes || [];
    }
};