// ============================================================================
// CHORD FREQUENCY SPECTRUM VISUALIZATION
// Shows frequency range C3-C5 with current playing notes
// ============================================================================

class ChordVisualization {
    constructor() {
        this.canvas = null;
        this.W = 350;
        this.H = 640;

        // Frequency range: C3 to C5
        this.minFreq = 130.81;  // C3
        this.maxFreq = 523.25;  // C5

        // Visual parameters
        this.padding = 30;
        this.spectrumX = 50;
        this.spectrumWidth = 240;
        this.spectrumHeight = this.H - 100;
        this.spectrumY = 50;
        this.positionKeys = 67;

        // Currently playing frequencies
        this.activeFreqs = [];
        this.targetFreqs = [];
        this.rootFreq = 220.0; // A3 default

        // Animation
        this.animationSpeed = 0.25;
        this.round = 20;

        this.textColor = 'rgba(222, 222, 222, 1)';

        this.backgroundPiano = 'rgba(50, 50, 50, 1)';

        // Note names for reference
        this.noteFreqs = [
            { freq: 130.81, name: 'C3', key: 'a' },
            { freq: 138.59, name: 'C#3', key: 'w' },
            { freq: 146.83, name: 'D3', key: 's' },
            { freq: 155.56, name: 'D#3', key: 'e' },
            { freq: 164.81, name: 'E3', key: 'd' },
            { freq: 174.61, name: 'F3', key: 'f' },
            { freq: 185.00, name: 'F#3', key: 't' },
            { freq: 196.00, name: 'G3', key: 'g' },
            { freq: 207.65, name: 'G#3', key: 'y' },
            { freq: 220.00, name: 'A3', key: 'h' },
            { freq: 233.08, name: 'A#3', key: 'u' },
            { freq: 246.94, name: 'B3', key: 'j' },
            { freq: 261.63, name: 'C4', key: 'k' },
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
            { freq: 523.25, name: 'C5' }
        ];

        // P5 instance mode reference
        this.p5Instance = null;

        this.colors = [
            [255, 255, 255],    // Root (white)
            [255, 119, 0],    // rgba(255, 119, 0, 1)
            [118, 236, 0],        // rgba(118, 236, 0, 1)
            [0, 128, 255]       // rgba(0, 128, 255, 1)
        ];
    }
    //----------------------------------------------------------------------------------------
    setup(p) {
        this.p5Instance = p;
        this.canvas = p.createCanvas(this.W, this.H);
        this.canvas.parent('chord-visualization-container');
        p.textFont('monaco');
    }
    //----------------------------------------------------------------------------------------
    draw(p) {
        // Dark background
        p.noStroke();
        p.fill(25);
        p.rect(0, 0, this.W, this.H, this.round);

        // Draw title
        p.fill(this.textColor);
        p.textAlign(p.LEFT);
        p.textSize(13);
        p.text('Frequency Spectrum', this.padding, 25);

        // Draw background spectrum area
        this.drawSpectrumBackground(p);

        // Draw frequency axis
        this.drawFrequencyAxis(p);

        // Draw note markers
        this.drawNoteMarkers(p);

        // Draw current root indicator
        this.drawRootIndicator(p);

        // Draw active frequencies
        this.updateAndDrawActiveFrequencies(p);

        // Draw frequency labels
        this.drawFrequencyLabels(p);
    }
    //----------------------------------------------------------------------------------------
    drawSpectrumBackground(p) {
        // Background area with rounded corners
        p.fill(this.backgroundPiano); // Darker black background
        p.stroke(60, 60, 60); // Dark gray border
        p.strokeWeight(1);
        const bgX = this.spectrumX - 15;
        const bgY = this.spectrumY - 10;
        const bgWidth = 300;
        const bgHeight = this.spectrumHeight + 20;
        p.rect(bgX, bgY, bgWidth, bgHeight, 8);

        // Piano key pattern areas (white keys = light gray, black keys = dark gray)
        // Notes with keyboard mapping: A=C, W=C#, S=D, E=D#, D=E, F=F, T=F#, G=G, Y=G#, H=A, U=A#, J=B, K=C
        const pianoKeyData = [
            // Note: isBlack = true for sharps/flats (black keys on piano)
            { freq: 130.81, name: 'C3', key: 'a', isBlack: false },   // C3 - white key
            { freq: 138.59, name: 'C#3', key: 'w', isBlack: true },  // C#3 - black key
            { freq: 146.83, name: 'D3', key: 's', isBlack: false },  // D3 - white key
            { freq: 155.56, name: 'D#3', key: 'e', isBlack: true },  // D#3 - black key
            { freq: 164.81, name: 'E3', key: 'd', isBlack: false },  // E3 - white key
            { freq: 174.61, name: 'F3', key: 'f', isBlack: false },  // F3 - white key
            { freq: 185.00, name: 'F#3', key: 't', isBlack: true },  // F#3 - black key
            { freq: 196.00, name: 'G3', key: 'g', isBlack: false },  // G3 - white key
            { freq: 207.65, name: 'G#3', key: 'y', isBlack: true },  // G#3 - black key
            { freq: 220.00, name: 'A3', key: 'h', isBlack: false },  // A3 - white key
            { freq: 233.08, name: 'A#3', key: 'u', isBlack: true },  // A#3 - black key
            { freq: 246.94, name: 'B3', key: 'j', isBlack: false },  // B3 - white key
            { freq: 261.63, name: 'C4', key: 'k', isBlack: false },  // C4 - white key
            // Continue pattern for C4 to C5
            { freq: 277.18, name: 'C#4', isBlack: true },            // C#4 - black key
            { freq: 293.66, name: 'D4', isBlack: false },            // D4 - white key
            { freq: 311.13, name: 'D#4', isBlack: true },            // D#4 - black key
            { freq: 329.63, name: 'E4', isBlack: false },            // E4 - white key
            { freq: 349.23, name: 'F4', isBlack: false },            // F4 - white key
            { freq: 369.99, name: 'F#4', isBlack: true },            // F#4 - black key
            { freq: 392.00, name: 'G4', isBlack: false },            // G4 - white key
            { freq: 415.30, name: 'G#4', isBlack: true },            // G#4 - black key
            { freq: 440.00, name: 'A4', isBlack: false },            // A4 - white key
            { freq: 466.16, name: 'A#4', isBlack: true },            // A#4 - black key
            { freq: 493.88, name: 'B4', isBlack: false },            // B4 - white key
            { freq: 523.25, name: 'C5', isBlack: false }             // C5 - white key
        ];

        // Draw piano key areas
        p.noStroke();
        for (let i = 0; i < pianoKeyData.length - 1; i++) {
            const currentNote = pianoKeyData[i];
            const nextNote = pianoKeyData[i + 1];
            
            
            if (currentNote.freq >= this.minFreq && currentNote.freq <= this.maxFreq) {
                const y1 = this.freqToY(currentNote.freq);
                const y2 = this.freqToY(nextNote.freq);
                const rectHeight = Math.abs(y1 - y2);
                
                // Color based on piano key type
                if (currentNote.isBlack) {
                    p.fill(20); // Dark gray for black keys
                    p.rect(bgX + 5, Math.min(y1, y2) + rectHeight * 0.5, bgWidth * 0.5, rectHeight, 5);
                } else {
                    p.fill(this.backgroundPiano); // Light gray for white keys
                    p.rect(bgX + 5, Math.min(y1, y2) + rectHeight * 0.5, bgWidth - 10, rectHeight, 5);
                }                
            }
        }

        // Draw thin gray lines for all 12-TET notes to show deviation
        p.stroke(120, 50); // Light gray lines
        p.strokeWeight(1);
        
        // All chromatic notes from C3 to C5 (extended range)
        const chromaticFreqs = [
            130.81, 138.59, 146.83, 155.56, 164.81, 174.61, // C3 to F3
            185.00, 196.00, 207.65, 220.00, 233.08, 246.94, // F#3 to B3
            261.63, 277.18, 293.66, 311.13, 329.63, 349.23, // C4 to F4
            369.99, 392.00, 415.30, 440.00, 466.16, 493.88, // F#4 to B4
            523.25 // C5
        ];

        for (let freq of chromaticFreqs) {
            if (freq >= this.minFreq && freq <= this.maxFreq) {
                const y = this.freqToY(freq);
                p.line(bgX + 5, y, bgX + bgWidth - 5, y);
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
            p.textSize(10);
            const note = this.noteFreqs.find(n => Math.abs(n.freq - freq) < 0.1);
            if (note) {
                p.text(note.name, this.spectrumX - 15, y + 2);
                p.fill(240);
                p.textSize(9);
                p.text(`${freq.toFixed(0)}Hz`, this.spectrumX - 15, y + 12);
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
    drawNoteMarkers(p) {
        // Check for hovered note
        const hoveredNote = this.getHoveredNote(p.mouseX, p.mouseY);
        
        // Draw small markers for all notes with keyboard shortcuts
        for (let note of this.noteFreqs) {
            if (note.key) {
                const y = this.freqToY(note.freq);
                const isHovered = hoveredNote && hoveredNote.freq === note.freq;

                // Highlight if this is the current root
                if (Math.abs(note.freq - this.rootFreq) < 0.1) {
                    p.fill(0, 200, 255, 80);
                    p.noStroke();
                    p.rect(this.positionKeys - 8, y - 6, this.spectrumWidth + 35, 12, 2);
                }
                // Show hover feedback for clickable notes
                else if (isHovered) {
                    p.fill(255, 255, 255, 40);
                    p.noStroke();
                    p.rect(this.positionKeys - 8, y - 6, this.spectrumWidth + 16, 12, 2);
                }

                // Note marker - precise horizontal line
                p.stroke(80);
                p.strokeWeight(1);
                p.line(this.positionKeys - 8, y, this.positionKeys + 8, y);

                // Tiny tick on the main axis
                p.stroke(100);
                p.line(this.positionKeys - 3, y, this.positionKeys + 3, y);

                // Key label - highlight if hovered
                if (isHovered) {
                    p.fill(255, 255, 255); // Brighter when hovered
                } else {
                    p.fill(this.textColor);
                }
                p.noStroke();
                p.textAlign(p.CENTER);
                p.textSize(10);
                p.text(note.key.toUpperCase(), this.positionKeys - 25, y + 2);
                
                // Show note name on hover
                if (isHovered) {
                    p.fill(255, 200, 100);
                    p.textSize(9);
                    p.text(note.name, this.positionKeys, y + 4);
                }
            }
        }
    }

    //----------------------------------------------------------------------------------------
    drawRootIndicator(p) {
        const y = this.freqToY(this.rootFreq);

        // Root frequency line (extends across the spectrum)
        p.stroke(0, 200, 255, 150);
        p.strokeWeight(1);
        p.line(this.spectrumX + 10, y, this.spectrumX + 220, y);

        // Root label with better positioning
        p.fill(0, 200, 255);
        p.textAlign(p.LEFT);
        p.textSize(10);
        const rootNote = this.getNoteName(this.rootFreq);
        // Position label to avoid overlap with bars
        const labelY = y < this.spectrumY + 40 ? y + 25 : y - 10;
        p.text(`Root: ${rootNote}`, this.spectrumX + 225, labelY);
        p.textSize(10);
        p.fill(250);
        p.text(`${this.rootFreq.toFixed(3)} Hz`, this.spectrumX + 225, labelY + 14);
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
        const barWidth = amplitude * 140; // Animated width based on amplitude
        const barHeight = 3; // Fixed height for all bars

        const baseColor = this.colors[noteIndex] || [200, 200, 200];

        p.fill(baseColor[0], baseColor[1], baseColor[2], 255);
        p.noStroke();
        
        // ALL bars aligned at the same horizontal position, starting from the frequency axis
        const barX = this.spectrumX;
        const barY = y - Math.floor(barHeight / 2);
        p.rect(barX, barY, barWidth, barHeight, 1);

        // Draw frequency value for all fundamentals when bar is visible
        if (amplitude > 0.3 && barWidth > 10) {
            p.fill(baseColor[0], baseColor[1], baseColor[2], 255);
            p.textAlign(p.LEFT);
            p.textSize(11);
            p.text(freq.toFixed(3) + ' Hz', barX + barWidth + 5, y + 4);
        }
    }
 
    //----------------------------------------------------------------------------------------
    drawFrequencyLabels(p) {
        // Legend for the colors
        const y = this.spectrumY + this.spectrumHeight + 25;
        p.textAlign(p.LEFT);
        p.textSize(10);

        const labels = [
            { color: this.colors[0], text: 'Root' },
            { color: this.colors[1], text: 'α' },
            { color: this.colors[2], text: 'β' },
            { color: this.colors[3], text: 'γ' }
        ];

        for (let i = 0; i < labels.length; i++) {
            const x = this.spectrumX + i * 70;
            p.fill(labels[i].color[0], labels[i].color[1], labels[i].color[2]);
            p.rect(x, y, 15, 10, 2);
            p.fill(150);
            p.text(labels[i].text, x + 20, y + 8);
        }
    }

    //----------------------------------------------------------------------------------------
    freqToY(freq) {
        // Convert frequency to Y position (logarithmic scale)
        const logMin = Math.log(this.minFreq);
        const logMax = Math.log(this.maxFreq);
        const logFreq = Math.log(freq);
        const ratio = (logFreq - logMin) / (logMax - logMin);
        // Invert Y axis (high frequencies at top)
        return this.spectrumY + this.spectrumHeight * (1 - ratio);
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

        for (let noteIndex = 0; noteIndex < ratios.length; noteIndex++) {
            const freq = baseFreq * ratios[noteIndex];

            // Only add if within display range
            if (freq >= this.minFreq && freq <= this.maxFreq) {
                this.targetFreqs.push({
                    freq: freq,
                    amp: 1.0, // All fundamentals same amplitude
                    harmonic: 0, // Only fundamental
                    noteIndex: noteIndex
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
        const clickAreaLeft = this.positionKeys - 35;
        const clickAreaRight = this.positionKeys + this.spectrumWidth + 16;
        
        if (mouseX >= clickAreaLeft && mouseX <= clickAreaRight) {
            // Check each clickable note
            for (let note of this.noteFreqs) {
                if (note.key) {
                    const y = this.freqToY(note.freq);
                    const noteHeight = 12;
                    
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
        // Check if click is within the note area (where keyboard notes are displayed)
        const clickAreaLeft = this.positionKeys - 35;
        const clickAreaRight = this.positionKeys + this.spectrumWidth + 16;
        
        if (mouseX >= clickAreaLeft && mouseX <= clickAreaRight) {
            // Check each clickable note (only notes with keyboard shortcuts)
            for (let note of this.noteFreqs) {
                if (note.key) {
                    const y = this.freqToY(note.freq);
                    const noteHeight = 12; // Height of clickable area around each note
                    
                    if (mouseY >= y - noteHeight/2 && mouseY <= y + noteHeight/2) {
                        // Note was clicked! Update root frequency
                        this.setRootFrequency(note.freq);
                        
                        // Call the global root update function
                        if (typeof window.updateGlobalRoot === 'function') {
                            window.updateGlobalRoot(note.freq);
                        }
                        
                        return true; // Click was handled
                    }
                }
            }
        }
        return false; // Click was not on a note
    }
}

// Create global instance and P5 sketch
let chordViz = new ChordVisualization();

// Create P5 instance for chord visualization
new p5(function (p) {
    p.setup = function () {
        chordViz.setup(p);
    };

    p.draw = function () {
        chordViz.draw(p);
    };

    p.mousePressed = function () {
        // Check if mouse is within the canvas bounds
        if (p.mouseX >= 0 && p.mouseX <= chordViz.W && 
            p.mouseY >= 0 && p.mouseY <= chordViz.H) {
            return chordViz.handleMouseClick(p.mouseX, p.mouseY);
        }
        return false;
    };
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