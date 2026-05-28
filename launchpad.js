// ============================================================================
// LAUNCHPAD PRO MK3 INTEGRATION
// ============================================================================
// © 2025 David Dalmazzo. All Rights Reserved.
//
// Bridges Novation Launchpad Pro MK3 (DAW port) to:
//   - Harmonic Eigenspace chord-memory grid (recall stored chords)
//   - Modal Studio chord grid (trigger row/col)
//
// LED colors mirror the web-app cell colors per scene. Press = recall only.
// Filter for the Launchpad input is added in midi_piano.js so the device does
// not double-trigger as a MIDI keyboard.
// ============================================================================

class LaunchpadHandler {
    constructor() {
        this.midiAccess = null;
        this.input = null;
        this.output = null;
        this.connected = false;
        this._exitInstalled = false;
        this._verbose = false;

        // Novation LP Pro MK3 SysEx headers
        this.SYSEX_HEADER = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0E];
        this.DAW_PORT_MATCH = /Launchpad.*Pro.*MK3.*DAW|LPProMK3 DAW/i;

        // Per-scene "currently highlighted" pad. Kept on the handler so the LED
        // stays orange after the Launchpad pad is released, independent of the
        // grid's internal selection state.
        this._highlighted = {
            eigenspace: { row: -1, col: -1 },
            modalstudio: { row: -1, col: -1 }
        };
        this.HIGHLIGHT_RGB = [255, 200, 0]; // orange — matches chordClicked
    }

    _sceneKey() {
        if (typeof currentScene === 'undefined' || typeof Scenes === 'undefined') return null;
        if (currentScene === Scenes.EIGENSPACE) return 'eigenspace';
        if (currentScene === Scenes.MODALSTUDIO) return 'modalstudio';
        return null;
    }

    // --------------------------------------------------------------------
    // Lifecycle
    // --------------------------------------------------------------------
    async initialize() {
        if (window.midiController && window.midiController.midiAccess) {
            this.midiAccess = window.midiController.midiAccess;
        } else if (navigator.requestMIDIAccess) {
            try {
                this.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
            } catch (e) {
                console.warn('[Launchpad] SysEx MIDI access denied', e);
                return false;
            }
        } else {
            return false;
        }

        this._findPorts();
        if (!this.output || !this.input) {
            console.warn('[Launchpad] DAW port not found. Ensure the LP Pro MK3 is connected and the "DAW" port is exposed.');
            return false;
        }

        this.input.onmidimessage = (msg) => this._handleMidiMessage(msg);

        this.enterDawMode();
        this.enterSessionLayout();
        this.connected = true;

        if (!this._exitInstalled) {
            window.addEventListener('beforeunload', () => this.exit());
            this._exitInstalled = true;
        }

        // Re-scan ports on hotplug
        this.midiAccess.addEventListener('statechange', () => {
            this._findPorts();
            if (this.connected) this.refreshLeds();
        });

        this.refreshLeds();
        console.log(`[Launchpad] Connected to ${this.output.name}`);
        return true;
    }

    exit() {
        if (!this.connected) return;
        try {
            this.clearAllPads();
            this.enterStandalone();
        } catch (e) {
            console.warn('[Launchpad] exit cleanup failed', e);
        }
        this.connected = false;
    }

    _findPorts() {
        if (!this.midiAccess) return;
        let out = null, inp = null;
        for (const o of this.midiAccess.outputs.values()) {
            if (this.DAW_PORT_MATCH.test(o.name || '')) { out = o; break; }
        }
        for (const i of this.midiAccess.inputs.values()) {
            if (this.DAW_PORT_MATCH.test(i.name || '')) { inp = i; break; }
        }
        this.output = out;
        this.input = inp;
    }

    // --------------------------------------------------------------------
    // SysEx / mode helpers
    // --------------------------------------------------------------------
    _sendSysex(payload) {
        if (!this.output) return;
        try {
            this.output.send([...this.SYSEX_HEADER, ...payload, 0xF7]);
        } catch (e) {
            console.warn('[Launchpad] SysEx send failed', e);
        }
    }

    enterDawMode()        { this._sendSysex([0x10, 0x01]); }
    enterStandalone()     { this._sendSysex([0x10, 0x00]); }
    enterSessionLayout()  { this._sendSysex([0x00, 0x00, 0x00, 0x00]); }

    // Per-pad RGB. r/g/b expected in 0-127.
    setPadRGB(note, r, g, b) {
        if (!this.output) return;
        this._sendSysex([0x03, 0x03, note & 0x7F, r & 0x7F, g & 0x7F, b & 0x7F]);
    }

    clearAllPads() {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                this.setPadRGB(this._rowColToNote(row, col), 0, 0, 0);
            }
        }
    }

    // --------------------------------------------------------------------
    // Grid <-> Launchpad coordinate mapping
    // Launchpad note layout (Session): top row 81..88, bottom row 11..18.
    // Grid row 0 = top, so:  note = (8 - row) * 10 + (col + 1)
    // --------------------------------------------------------------------
    _rowColToNote(row, col) { return (8 - row) * 10 + (col + 1); }
    _noteToRowCol(note) {
        return { row: 8 - Math.floor(note / 10), col: (note % 10) - 1 };
    }

    // --------------------------------------------------------------------
    // LED painting (mirrors active scene's cell colors)
    // --------------------------------------------------------------------
    refreshLeds() {
        if (!this.connected) return;
        const grid = this._getActiveGrid();
        if (!grid || typeof grid.getCellRGB !== 'function') {
            this.clearAllPads();
            return;
        }
        const sceneKey = this._sceneKey();
        const hi = sceneKey ? this._highlighted[sceneKey] : null;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                let rgb;
                if (hi && hi.row === row && hi.col === col) {
                    rgb = this.HIGHLIGHT_RGB;          // persistent press highlight
                } else {
                    rgb = grid.getCellRGB(row, col) || [0, 0, 0];
                }
                const r = Math.max(0, Math.min(127, (rgb[0] || 0) >> 1));
                const g = Math.max(0, Math.min(127, (rgb[1] || 0) >> 1));
                const b = Math.max(0, Math.min(127, (rgb[2] || 0) >> 1));
                this.setPadRGB(this._rowColToNote(row, col), r, g, b);
            }
        }
    }

    setScene(_sceneId) {
        // `currentScene` global is already updated by switchScene(); just repaint.
        // Highlight is per-scene so it survives toggling back and forth.
        this.refreshLeds();
    }

    _getActiveGrid() {
        if (typeof currentScene === 'undefined' || typeof Scenes === 'undefined') return null;
        if (currentScene === Scenes.EIGENSPACE) {
            // gridSketch is declared `let` in grid.js — accessible by bare name
            // from other scripts, but NOT as window.gridSketch.
            if (typeof gridSketch !== 'undefined' && gridSketch && typeof gridSketch.getGrid === 'function') {
                return gridSketch.getGrid();
            }
            return null;
        }
        if (currentScene === Scenes.MODALSTUDIO) {
            return (window.app && window.app.grid) ? window.app.grid : null;
        }
        return null;
    }

    // --------------------------------------------------------------------
    // Input handling
    // --------------------------------------------------------------------
    _handleMidiMessage(message) {
        const [status, data1, data2] = message.data;
        const command = status & 0xF0;
        const isNoteOn  = command === 0x90 && data2 > 0;
        const isNoteOff = command === 0x80 || (command === 0x90 && data2 === 0);

        if (this._verbose) {
            console.log(`[Launchpad] status=0x${status.toString(16)} d1=${data1} d2=${data2}`);
        }

        if (!isNoteOn && !isNoteOff) return;       // ignore CC (side/top buttons)
        if (data1 < 11 || data1 > 88) return;      // grid notes only

        const { row, col } = this._noteToRowCol(data1);
        if (row < 0 || row > 7 || col < 0 || col > 7) return;

        if (isNoteOn) {
            this._dispatchPress(row, col);
        } else {
            this._dispatchRelease(row, col);
        }
    }

    _dispatchPress(row, col) {
        const sceneKey = this._sceneKey();
        if (!sceneKey) return;
        const grid = this._getActiveGrid();
        if (!grid) return;

        this._highlighted[sceneKey] = { row, col };
        if (typeof grid.setLPPress === 'function') grid.setLPPress(row, col);

        if (sceneKey === 'eigenspace') {
            if (grid.storage[row] && grid.storage[row][col]) {
                if (typeof window.playStoredChord === 'function') {
                    window.playStoredChord(row, col);
                } else {
                    grid.recallChord(row, col);
                }
            }
        } else if (sceneKey === 'modalstudio') {
            if (typeof grid.selectCellByRowCol === 'function') {
                grid.selectCellByRowCol(row, col);
            }
        }

        this.refreshLeds();
    }

    _dispatchRelease(row, col) {
        const sceneKey = this._sceneKey();
        if (!sceneKey) return;
        const grid = this._getActiveGrid();

        const hi = this._highlighted[sceneKey];
        if (hi.row === row && hi.col === col) {
            this._highlighted[sceneKey] = { row: -1, col: -1 };
        }
        if (grid && typeof grid.clearLPPress === 'function') grid.clearLPPress(row, col);

        this.refreshLeds();
    }
}

window.launchpadHandler = new LaunchpadHandler();

console.log('Launchpad module loaded');
