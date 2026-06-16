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

        // The two arrow buttons just LEFT of the "Session" button (top row) → change scene:
        // left = previous, right = next. Session = CC 93, so the arrows are CC 91 (left) and
        // 92 (right). If yours differ, the console logs the real CC on press ("unmapped function
        // button CC N") — set these to match (or live: launchpadHandler.NAV_CC.left = N).
        this.NAV_CC = { left: 91, right: 92 };
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
            // Other apps (Ableton, etc.) can grab the LP, switch it out of
            // DAW/Session mode, and effectively detach our handlers. When the
            // tab regains focus, re-take the device.
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') this.reconnect();
            });
            window.addEventListener('focus', () => this.reconnect());
            this._exitInstalled = true;
        }

        // Re-scan ports on hotplug / external open-close
        if (!this._stateChangeInstalled) {
            this.midiAccess.addEventListener('statechange', (e) => {
                if (e.port && /Launchpad.*Pro.*MK3.*DAW|LPProMK3 DAW/i.test(e.port.name || '')) {
                    this.reconnect();
                } else {
                    this._findPorts();
                    if (this.connected) this.refreshLeds();
                }
            });
            this._stateChangeInstalled = true;
        }

        this.refreshLeds();
        console.log(`[Launchpad] Connected to ${this.output.name}`);
        return true;
    }

    // Idempotent re-grab of the LP after another app (Ableton etc.) takes it.
    async reconnect() {
        if (!this.midiAccess) {
            return this.initialize();
        }
        if (this._reconnecting) return;
        this._reconnecting = true;
        try {
            this._findPorts();
            if (!this.output || !this.input) {
                this.connected = false;
                console.warn('[Launchpad] reconnect: DAW port not found');
                return false;
            }
            // Web MIDI auto-opens on access, but an explicit open() helps if
            // the port was closed by another app.
            try {
                if (typeof this.input.open === 'function')  await this.input.open();
                if (typeof this.output.open === 'function') await this.output.open();
            } catch (e) {
                console.warn('[Launchpad] reconnect: open() failed', e);
            }
            this.input.onmidimessage = (msg) => this._handleMidiMessage(msg);
            this.enterDawMode();
            this.enterSessionLayout();
            this.connected = true;
            this.refreshLeds();
            console.log('[Launchpad] Reconnected');
            return true;
        } finally {
            this._reconnecting = false;
        }
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

        // Top/side function buttons (incl. the arrows) arrive as Control Change. The left/right
        // arrows move between scenes; everything else is logged so it can be mapped later.
        if (command === 0xB0) {
            if (data2 > 0) this._handleNavCC(data1);
            return;
        }

        if (!isNoteOn && !isNoteOff) return;
        if (data1 < 11 || data1 > 88) {
            // Not a grid pad — e.g. an arrow/function button sent as a NOTE on some layouts.
            // Log on press so the exact number is easy to read off the device for mapping.
            if (isNoteOn) console.log('[Launchpad] non-grid button note ' + data1 + ' (press)');
            return;
        }

        const { row, col } = this._noteToRowCol(data1);
        if (row < 0 || row > 7 || col < 0 || col > 7) return;

        if (isNoteOn) {
            this._dispatchPress(row, col);
        } else {
            this._dispatchRelease(row, col);
        }
    }

    // Arrow CC → change scene (left = previous, right = next). Any other function button is
    // logged with its CC so you can identify it and map it to NAV_CC if needed.
    _handleNavCC(cc) {
        if (cc === this.NAV_CC.left)  return this._changeScene(-1);
        if (cc === this.NAV_CC.right) return this._changeScene(+1);
        console.log('[Launchpad] unmapped function button CC ' + cc +
            ' (set launchpadHandler.NAV_CC.left/right = ' + cc + ' to use it for scene nav)');
    }

    // Step to the previous/next scene by numeric id (EIGENSPACE 0 → MODALSTUDIO 1 → KEYBOARD 2).
    // Clamped at the ends (no wrap): left does nothing on the first scene, right on the last.
    _changeScene(delta) {
        // Debounce: the arrow buttons emit more than one CC per physical press, so without this
        // a single tap advanced TWICE (ES → KL, skipping MS). Collapse rapid repeats into one step.
        const now = (typeof performance !== 'undefined' ? performance : Date).now();
        if (now - (this._lastNavAt || 0) < 300) return;
        this._lastNavAt = now;

        if (typeof switchScene !== 'function' || typeof Scenes === 'undefined'
            || typeof currentScene === 'undefined') return;
        const ids = Object.values(Scenes).sort((a, b) => a - b);
        const idx = ids.indexOf(currentScene);
        if (idx < 0) return;
        const next = Math.min(ids.length - 1, Math.max(0, idx + delta));
        if (next === idx) return;
        switchScene(ids[next]);
        this.refreshLeds();
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
