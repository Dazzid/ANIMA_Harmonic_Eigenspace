// © 2025 David Dalmazzo. All Rights Reserved. (ANIMA — MSCA PF 101203318)
// Proprietary research code — see header in the other modal_studio_*.js files.
//
// MS Frequency Spectrum (STRATEGY §6.5) — a HORIZONTAL, multi-octave frequency strip
// for the Modal Studio scene. Mirrors the ES ChordVisualization math (log frequency
// axis, 12-TET markers, 53-TET ticks) but laid out horizontally and drawn on the
// SHARED MS canvas — NOT a private p5 instance (that would re-introduce the §4
// "any p5 mousePressed fires on any window press" leak). The host (modal_studio_app.js)
// calls layout()/draw()/mousePressed() inside its own scene loop.
//
// Step 1 (this file): geometry + freq↔x mapping + background, 12-TET note markers,
// octave labels and 53-TET ticks, plus the data-feed API (setActiveFrequencies /
// setMIDIActiveNotes / setKeyboardMappedScale / setRoot) that later steps fill in
// from the grid chords, the MIDI keyboard, and the computer keyboard.

class MSFrequencySpectrum {
    constructor() {
        // Outer region (x / y / w / h) is set every frame by layout(p) from the canvas.

        // Octave span. Low end at C1 (32.70 Hz) so chord basses — which can sit as low
        // as the app's C0 ≈ 32.7 Hz — are visible instead of filtered off the left.
        this.octaves = 5;
        this.minFreq = 32.70;            // C1
        this.maxFreq = 32.70 * Math.pow(2, this.octaves); // C1 + N octaves (≈ C6)

        // The x-axis is WHITE-KEY-uniform (a real piano): 7 white keys per octave,
        // equal width, black keys narrower on top between them. WKU maps a chromatic
        // semitone (0..12 above C) to white-key units (0..7): naturals on integers,
        // sharps on the half-unit boundary they straddle. So a 12-TET note lands on its
        // key centre and there is NO white slot for the sharps.
        this.WKU = [0, 0.5, 1, 1.5, 2, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7];
        this.BLACK_WKU = [0.5, 1.5, 3.5, 4.5, 5.5]; // C# D# F# G# A# within an octave

        this.pad = 16;       // inner horizontal padding
        this.titleH = 22;    // title bar height
        this.labelH = 16;    // bottom octave-label row

        this.fiftyThree = null;   // 53-TET reference notes [{frequency, noteName, ...}]
        this.noteFreqs = [];      // 12-TET reference grid within range (markers)

        // Live data (populated by later steps)
        this.activeFreqs = [];        // [{freq, amp, displayAmp, on}]  chord/keyboard bars
        this.midiNotes = [];          // [{freq, velocity}]             MIDI keyboard
        this.keyboardScale = null;    // {freqs:[], color:[r,g,b]}      computer keyboard map
        this.rootFreq = null;

        this.animationSpeed = 0.25;
        this.barHoldMs = 2600;   // chord bars linger then fade (≈ the note's tail)

        // Palette — all the spectrum's colors in one place (easy to tune).
        this.panelBg   = [210, 210, 210, 0.9];     // strip background (around the key field)
        this.textCol   = [10, 10, 10];  // title (on the dark panel)
        this.labelCol  = [30, 30, 30];      // octave C labels (dark — reads on the light field)
        this.rootCol   = [0, 200, 255];     // root / hover marker (cyan)
        this.barCol    = [255, 180, 0];     // played-note bars (orange)
        // --- piano-key reference (ES colors) ---
        this.whiteKeyCol = [220, 220, 220]; // white-key field (ES whiteKeysPiano)
        this.blackKeyCol = [40, 40, 40];    // black-key bars
        this.tetLineCol  = [25, 25, 25, 128];// 12-TET reference lines (ES lineColors)
        // --- our microtonal lines, recolored to read on the gray field ---
        this.tickCol   = [240, 240, 240, 110];  // 53-TET ticks (the microtonal grid)
        this.octaveCol = [12, 12, 14, 210];  // octave C lines + baseline
        this.NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        this._rebuildNotes();
    }

    setup(fiftyThree) {
        this.fiftyThree = fiftyThree || null;
        this._rebuildNotes();
    }

    // Switch the octave span (3 or 4) for the space test; keeps the low end at C2.
    setOctaves(n) {
        this.octaves = n;
        this.minFreq = 32.70;
        this.maxFreq = 32.70 * Math.pow(2, n);
        this._rebuildNotes();
    }

    setOctaveRange(minFreq, maxFreq) {
        this.minFreq = minFreq;
        this.maxFreq = maxFreq;
        this._rebuildNotes();
    }

    // 12-TET equal-tempered reference grid (the marker lines / octave labels).
    _rebuildNotes() {
        this.noteFreqs = [];
        for (let m = 0; m <= 127; m++) {
            const f = 440 * Math.pow(2, (m - 69) / 12);
            if (f < this.minFreq * 0.999 || f > this.maxFreq * 1.001) continue;
            const pc = ((m % 12) + 12) % 12;
            this.noteFreqs.push({
                freq: f,
                name: this.NOTE_NAMES[pc],
                pc,
                octave: Math.floor(m / 12) - 1,   // MIDI: C4 = 60 → octave 4
                isC: pc === 0,
                isNatural: ![1, 3, 6, 8, 10].includes(pc)
            });
        }
    }

    // Bottom-docked, full-width strip by default. Tune here once we see the space.
    layout(p) {
        this.w = Math.min(1200, p.width - 20);
        this.x = 10;
        this.h = 250;
        this.y = p.height - this.h - 10;
    }

    // Inner spectrum rect (inside padding / title / label rows)
    get specX() { return this.x + this.pad; }
    get specY() { return this.y + this.titleH; }
    get specW() { return this.w - this.pad * 2; }
    get specH() { return this.h - this.titleH - this.labelH; }

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

    // White-key units → x, and frequency → x (the spectrum axis).
    _wkuX(wku) { return this.specX + this.specW * (wku + 0.5) / (this._totalWku() + 1); }
    freqToX(freq) { return this._wkuX(this._freqToWku(freq)); }

    // x → frequency (inverse, for click/hover): invert the WKU piecewise map.
    xToFreq(px) {
        const wku = ((px - this.specX) / this.specW) * (this._totalWku() + 1) - 0.5;
        const oct = Math.floor(wku / 7);
        const wkuIn = wku - oct * 7;
        let s = 0;
        for (let i = 0; i < 12; i++) {
            if (wkuIn >= this.WKU[i] && wkuIn <= this.WKU[i + 1]) {
                s = i + (wkuIn - this.WKU[i]) / (this.WKU[i + 1] - this.WKU[i]);
                break;
            }
        }
        return this.minFreq * Math.pow(2, (oct * 12 + s) / 12);
    }

    draw(p) {
        const sy = this.specY, sh = this.specH;
        p.push();

        // Panel
        p.noStroke();
        p.fill(this.panelBg[0], this.panelBg[1], this.panelBg[2], 240);
        p.rect(this.x, this.y, this.w, this.h, 10);

        // Title + range readout
        p.fill(this.textCol[0], this.textCol[1], this.textCol[2]);
        p.textAlign(p.LEFT, p.CENTER);
        p.textSize(13);
        p.text('Frequency Spectrum', this.x + this.pad, this.y + this.titleH / 2 + 2);
        p.fill(110, 110, 118);
        p.textAlign(p.RIGHT, p.CENTER);
        p.text(`${this.octaves} oct · ${this.minFreq.toFixed(0)}–${this.maxFreq.toFixed(0)} Hz`,
               this.x + this.w - this.pad, this.y + this.titleH / 2 + 2);

        // Piano keyboard reference (white & black keys) behind everything else.
        this._drawPianoKeys(p);

        // 53-TET ticks (lower half) — the microtonal grid. Dark fine lines so they
        // read on the ES gray-100 key field (this version's lines, ES colors).
        if (this.fiftyThree) {
            p.strokeWeight(1);
            p.stroke(this.tickCol[0], this.tickCol[1], this.tickCol[2], this.tickCol[3]);
            for (const n of this.fiftyThree) {
                if (n.frequency < this.minFreq || n.frequency > this.maxFreq) continue;
                const x = this.freqToX(n.frequency);
                p.line(x, sy, x, sy + 20);
            }
        }

        // Octave reference: a bold dark line + label at each C.
        p.textAlign(p.CENTER, p.TOP);
        p.textSize(10);
        for (const note of this.noteFreqs) {
            if (!note.isC) continue;
            const x = this.freqToX(note.freq);
            p.noStroke();
            p.fill(this.labelCol[0], this.labelCol[1], this.labelCol[2]);
            p.text(`C${note.octave}`, x, this.y + this.h - this.labelH + 2);
        }

        // Computer-keyboard mapped scale (Step 6 feed) — short top ticks
        if (this.keyboardScale && this.keyboardScale.freqs) {
            const c = this.keyboardScale.color || [255, 255, 255];
            p.stroke(c[0], c[1], c[2], 190);
            p.strokeWeight(2);
            for (const f of this.keyboardScale.freqs) {
                if (f < this.minFreq || f > this.maxFreq) continue;
                const x = this.freqToX(f);
                p.line(x, sy, x, sy + sh * 0.22);
            }
        }

        // MIDI active notes (Step 5 feed) — exact-freq translucent bands
        p.noStroke();
        for (const note of this.midiNotes) {
            const f = note.freq;
            if (f < this.minFreq || f > this.maxFreq) continue;
            const x = this.freqToX(f);
            p.fill(255, 255, 255, 45);
            p.rect(x - 5, sy, 10, sh, 3);
        }

        // Root indicator
        if (this.rootFreq && this.rootFreq >= this.minFreq && this.rootFreq <= this.maxFreq) {
            const x = this.freqToX(this.rootFreq);
            p.noStroke();
            p.fill(this.rootCol[0], this.rootCol[1], this.rootCol[2], 120);
            p.rect(x - 3, sy, 6, sh, 2);
        }

        // Active chord / keyboard bars (Step 4 feed) — rise from the baseline
        this._updateBars();
        const baseY = sy + sh;
        p.noStroke();
        for (const a of this.activeFreqs) {
            if (a.freq < this.minFreq || a.freq > this.maxFreq) continue;
            const x = this.freqToX(a.freq);
            const barH = a.displayAmp * sh * 0.9;
            p.fill(this.barCol[0], this.barCol[1], this.barCol[2], 225);
            p.rect(x - 3, baseY - barH, 6, barH, 2);
        }

        // Hover tick — the 53-TET step under the cursor + its name/Hz
        this._drawHover(p);

        p.pop();
    }

    // A REAL piano keyboard: 7 equal-width white keys per octave that touch, with
    // narrower/shorter black keys ON TOP between them (no white slot for the sharps).
    // The x-axis is white-key-uniform (_wkuX), so the keys are evenly spaced like the
    // real instrument and 12-TET notes land on their key centres.
    _drawPianoKeys(p) {
        const sy = this.specY, sh = this.specH;
        const total = this._totalWku();
        const u = this.specW / (total + 1);      // one white-key unit, in pixels

        // White keys: each spans boundary-to-boundary (half a unit either side of the
        // note), so adjacent keys TOUCH. The mapping reserves half a key at each end, so
        // the first (C1) and last (C6) keys are FULL — never cut.
        p.strokeWeight(1);
        p.stroke(this.tetLineCol[0], this.tetLineCol[1], this.tetLineCol[2], this.tetLineCol[3]);
        p.fill(this.whiteKeyCol[0], this.whiteKeyCol[1], this.whiteKeyCol[2]);
        for (let w = 0; w <= Math.round(total); w++) {
            const left = this._wkuX(w - 0.5);
            const right = this._wkuX(w + 0.5);
            p.rect(left, sy, right - left, sh, 0, 0, 5, 5);
        }

        // Black keys: narrower + shorter dark rects ON TOP, at the half-unit positions
        // (C# D# F# G# A#) of each octave — never E–F or B–C.
        const octs = Math.ceil(Math.log(this.maxFreq / this.minFreq) / Math.log(2));
        p.fill(this.blackKeyCol[0], this.blackKeyCol[1], this.blackKeyCol[2]);
        for (let k = 0; k < octs; k++) {
            for (const off of this.BLACK_WKU) {
                const wku = k * 7 + off;
                if (wku > total) continue;
                p.rect(this._wkuX(wku) - u * 0.3, sy, u * 0.6, sh * 0.62, 0, 0, 3, 3);
            }
        }
    }

    // Thin highlight over the nearest 53-TET step under the cursor, with a label.
    _drawHover(p) {
        const mx = p.mouseX, my = p.mouseY;
        if (!this.contains(mx, my)) return;
        const n = this.noteAtX(mx);
        if (!n) return;
        const sy = this.specY, sh = this.specH;
        const x = this.freqToX(n.frequency);
        p.stroke(this.rootCol[0], this.rootCol[1], this.rootCol[2], 200);
        p.strokeWeight(1.5);
        p.line(x, sy, x, sy + sh);
        p.noStroke();
        p.fill(this.textCol[0], this.textCol[1], this.textCol[2]);
        p.textSize(11);
        p.textAlign(x > this.specX + this.specW - 80 ? p.RIGHT : p.LEFT, p.TOP);
        const lx = x > this.specX + this.specW - 80 ? x - 5 : x + 5;
        p.text(`${n.noteName || ''}  ${n.frequency.toFixed(1)} Hz`, lx, sy + 3);
    }

    _updateBars() {
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        for (let i = this.activeFreqs.length - 1; i >= 0; i--) {
            const a = this.activeFreqs[i];
            if (a.until && now > a.until) a.on = false; // transient pulse expired → fade
            const target = a.on ? a.amp : 0;
            a.displayAmp += (target - a.displayAmp) * this.animationSpeed;
            if (!a.on && a.displayAmp < 0.01) this.activeFreqs.splice(i, 1);
        }
    }

    // ---- Data feeds (filled by later steps) ----------------------------------
    // A chord/keyboard set of Hz → bars. Notes not in the new set fade out.
    setActiveFrequencies(freqs) {
        for (const a of this.activeFreqs) a.on = false;
        if (!freqs) return;
        const until = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + this.barHoldMs;
        for (const f of freqs) {
            const a = this.activeFreqs.find(x => Math.abs(x.freq - f) < 0.5);
            if (a) { a.on = true; a.amp = 1; a.until = until; }
            else this.activeFreqs.push({ freq: f, amp: 1, displayAmp: 0, on: true, until });
        }
    }
    setMIDIActiveNotes(notes) { this.midiNotes = notes || []; }
    // key_map.js sends an array of {freq, name, step} (not raw numbers) — normalize so
    // either shape works; keep names for an optional label later.
    setKeyboardMappedScale(freqs, color) {
        const list = Array.isArray(freqs)
            ? freqs.map(e => (typeof e === 'number' ? e : (e && typeof e.freq === 'number' ? e.freq : null)))
                   .filter(f => f != null)
            : [];
        this.keyboardScale = { freqs: list, color: Array.isArray(color) ? color : null };
    }
    setRoot(freq) { this.rootFreq = freq; }
    clear() { for (const a of this.activeFreqs) a.on = false; this.midiNotes = []; }

    // A momentary played note (computer keyboard / spectrum click): a bar that
    // lights then auto-fades, so individual key presses register without a note-off.
    pulse(freq) {
        if (!freq || freq < this.minFreq || freq > this.maxFreq) return;
        const until = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 220;
        const a = this.activeFreqs.find(x => Math.abs(x.freq - freq) < 0.5);
        if (a) { a.on = true; a.amp = 1; a.until = until; }
        else this.activeFreqs.push({ freq, amp: 1, displayAmp: 0, on: true, until });
    }

    // ---- Interaction ---------------------------------------------------------
    contains(mx, my) {
        return mx >= this.x && mx <= this.x + this.w && my >= this.y && my <= this.y + this.h;
    }
    // The nearest 53-TET reference note to an x position (or null).
    noteAtX(px) {
        if (!this.fiftyThree) return null;
        const raw = this.xToFreq(px);
        let best = null, bd = Infinity;
        for (const n of this.fiftyThree) {
            if (n.frequency < this.minFreq || n.frequency > this.maxFreq) continue;
            const d = Math.abs(n.frequency - raw);
            if (d < bd) { bd = d; best = n; }
        }
        return best;
    }
    // Snap an x to the nearest 53-TET reference frequency (falls back to raw).
    freqAtX(px) {
        const n = this.noteAtX(px);
        return n ? n.frequency : this.xToFreq(px);
    }
    mousePressed(mx, my) {
        if (!this.contains(mx, my)) return false;
        const f = this.freqAtX(mx);
        this.setRoot(f);
        if (typeof window !== 'undefined' && typeof window.playNote === 'function') {
            window.playNote(f);
        }
        return true;
    }
}

if (typeof window !== 'undefined') window.MSFrequencySpectrum = MSFrequencySpectrum;
