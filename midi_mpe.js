// ============================================================================
// MIDI/MPE CONTROLLER - Harmonic Eigenspace to MIDI/MPE
// Sends microtonal chord data to Ableton Live via Web MIDI API
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

class MIDIController {
    constructor() {
        this.midiAccess = null;
        this.selectedOutput = null;
        this.midiEnabled = false;

        // MPE Configuration
        this.mpeEnabled = true;
        this.masterChannel = 0;  // Channel 1 (0-indexed) for MPE master
        this.noteChannels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]; // Channels 2-16
        this.channelPool = [...this.noteChannels];
        this.activeNotes = new Map(); // Track active notes and their channels

        // MIDI/MPE parameters
        this.pitchBendRange = 48; // ±48 semitones (standard MPE range)
        this.defaultVelocity = 100;
        this.noteOffDelay = 50; // ms delay before sending note off

        // Timeout tracking for scheduled note-offs
        this.noteOffTimeout = null;

        // UI state
        this.isUIVisible = false;

        // Counter for unique note IDs (prevents duplicates in same millisecond)
        this.noteIdCounter = 0;
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    async initialize() {
        if (!navigator.requestMIDIAccess) {
            // console.warn('Web MIDI API not supported in this browser');
            return false;
        }

        try {
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
            // console.log('MIDI Access granted');

            // Listen for device connection changes
            this.midiAccess.onstatechange = (e) => {
                // console.log('MIDI device state change:', e.port.name, e.port.state);
                this.updateDeviceList();
            };

            this.midiEnabled = true;
            return true;
        } catch (error) {
            // console.error('Failed to get MIDI access:', error);
            return false;
        }
    }

    // ============================================================================
    // DEVICE MANAGEMENT
    // ============================================================================

    getOutputDevices() {
        if (!this.midiAccess) {
            // console.log('getOutputDevices: no midiAccess');
            return [];
        }

        const outputs = [];
        // console.log('getOutputDevices: midiAccess.outputs size:', this.midiAccess.outputs.size);
        this.midiAccess.outputs.forEach((output) => {
            const deviceInfo = {
                id: output.id,
                name: output.name,
                manufacturer: output.manufacturer,
                state: output.state
            };
            // console.log('Found MIDI output:', deviceInfo);
            outputs.push(deviceInfo);
        });
        // console.log('getOutputDevices returning:', outputs);
        return outputs;
    }

    selectOutput(deviceId) {
        if (!this.midiAccess) return false;

        const output = this.midiAccess.outputs.get(deviceId);
        if (output && output.state === 'connected') {
            this.selectedOutput = output;
            // console.log('Selected MIDI output:', output.name);

            // Send MPE configuration
            this.configureMPE();

            // CRITICAL: Notify MIDI Piano to reinitialize inputs (exclude this output to prevent feedback)
            if (window.midiPianoHandler && typeof window.midiPianoHandler.reinitializeInputs === 'function') {
                console.log('[MIDI Controller] Output device changed, reinitializing MIDI Piano inputs');
                window.midiPianoHandler.reinitializeInputs();
            }

            return true;
        }
        return false;
    }

    updateDeviceList() {
        if (this.isUIVisible) {
            this.renderDeviceSelector();
        }
    }

    async refreshDevices() {
        try {
            // Re-request MIDI access to refresh device list
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });

            // Wait for device enumeration
            await new Promise(resolve => setTimeout(resolve, 100));

            // Force update the device selector
            this.renderDeviceSelector();

            const devices = this.getOutputDevices();
            // console.log('Device refresh complete. Found devices:', devices);

            // Show user feedback
            const refreshBtn = document.getElementById('midi-refresh-devices');
            if (refreshBtn) {
                const originalText = refreshBtn.textContent;
                refreshBtn.textContent = '✓';
                refreshBtn.style.color = '#4CAF50';
                setTimeout(() => {
                    refreshBtn.textContent = originalText;
                    refreshBtn.style.color = '';
                }, 1000);
            }
        } catch (error) {
            // console.error('Failed to refresh MIDI devices:', error);
        }
    }

    // Manual method for // console testing
    forceRenderDevices() {
        // console.log('Force rendering devices...');
        const devices = this.getOutputDevices();
        // console.log('Devices found for manual render:', devices);
        this.renderDeviceSelector();
    }

    // EMERGENCY TEST FUNCTION - Call this from // console
    emergencyTest() {
        // console.log('EMERGENCY TEST STARTING');

        // Find the select element
        const select = document.getElementById('midi-device-select');
        // console.log('Select found:', !!select);

        if (!select) {
            // console.log('SELECT NOT FOUND!');
            return;
        }

        // Clear everything
        select.innerHTML = '';

        // Add options the most basic way possible
        const option1 = document.createElement('option');
        option1.value = '';
        option1.appendChild(document.createTextNode('Choose device...'));
        select.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = 'test1';
        option2.appendChild(document.createTextNode('TEST DEVICE 1'));
        select.appendChild(option2);

        const option3 = document.createElement('option');
        option3.value = 'test2';
        option3.appendChild(document.createTextNode('TEST DEVICE 2'));
        select.appendChild(option3);

        // console.log('Options added. Select innerHTML:', select.innerHTML);
        // console.log('Select children count:', select.children.length);

        // Force refresh
        select.style.display = 'none';
        select.offsetHeight; // Trigger reflow
        select.style.display = '';

        // console.log('EMERGENCY TEST COMPLETE');
    }

    manualDeviceScan() {
        // console.log('Manual device scan starting...');
        const select = document.getElementById('midi-device-select');

        if (!select) {
            // console.error('Select element not found!');
            return;
        }

        // Clear and add default
        select.innerHTML = '<option value="">Scanning...</option>';

        // Get devices directly
        if (!this.midiAccess) {
            // console.error('No MIDI access!');
            select.innerHTML = '<option value="">No MIDI access</option>';
            return;
        }

        // console.log('MIDI access available, outputs size:', this.midiAccess.outputs.size);

        // Manual device population
        select.innerHTML = '<option value="">Select MIDI device...</option>';

        let deviceCount = 0;
        this.midiAccess.outputs.forEach((output) => {
            // console.log(`Manual scan - found device: ${output.name} (${output.id})`);
            const option = document.createElement('option');
            option.value = output.id;
            option.textContent = output.name || `Device ${output.id}`;
            select.appendChild(option);
            deviceCount++;
        });

        // console.log(`Manual scan complete - added ${deviceCount} devices`);

        if (deviceCount === 0) {
            select.innerHTML = '<option value="">No devices found</option>';
        }
    }

    // ============================================================================
    // MPE CONFIGURATION
    // ============================================================================

    configureMPE() {
        if (!this.selectedOutput || !this.mpeEnabled) return;

        // Send RPN message to set pitch bend range on all channels
        for (let channel = 0; channel < 16; channel++) {
            // RPN MSB (0x65): 0 (pitch bend sensitivity)
            this.selectedOutput.send([0xB0 + channel, 0x65, 0x00]);
            // RPN LSB (0x64): 0
            this.selectedOutput.send([0xB0 + channel, 0x64, 0x00]);
            // Data Entry MSB: pitch bend range in semitones
            this.selectedOutput.send([0xB0 + channel, 0x06, this.pitchBendRange]);
            // Data Entry LSB: 0
            this.selectedOutput.send([0xB0 + channel, 0x26, 0x00]);
            // Reset RPN
            this.selectedOutput.send([0xB0 + channel, 0x65, 0x7F]);
            this.selectedOutput.send([0xB0 + channel, 0x64, 0x7F]);
        }

        // console.log(`MPE configured: ±${this.pitchBendRange} semitones pitch bend range`);
    }

    // ============================================================================
    // FREQUENCY TO MIDI CONVERSION
    // ============================================================================

    freqToMIDI(frequency) {
        // Convert frequency to MIDI note number + cents deviation
        // MIDI note 69 = A4 = 440 Hz
        const exactNoteNumber = 69 + 12 * Math.log2(frequency / 440.0);

        // Clamp to valid MIDI range
        const clampedNote = Math.max(0, Math.min(127, Math.round(exactNoteNumber)));

        // Calculate pitch bend needed to reach the exact frequency
        // This handles both:
        // 1. Microtonal deviations within a semitone (normal case)
        // 2. Out-of-range notes that got clamped (extreme chords)
        const semitoneDeviation = exactNoteNumber - clampedNote;
        const cents = semitoneDeviation * 100; // Convert semitones to cents

        // Clamp pitch bend to ±48 semitones (±4800 cents)
        const maxCents = this.pitchBendRange * 100;
        const clampedCents = Math.max(-maxCents, Math.min(maxCents, cents));

        // Log warning if pitch bend was clamped (frequency way out of range)
        if (Math.abs(cents) > maxCents) {
            console.warn(`[freqToMIDI] Frequency ${frequency.toFixed(2)} Hz requires ${cents.toFixed(0)} cents bend (exceeds ±${maxCents} range), clamping to ±${maxCents}`);
        }

        return {
            note: clampedNote,
            cents: clampedCents,
            pitchBend: this.centsToPitchBend(clampedCents)
        };
    }

    centsToPitchBend(cents) {
        // Convert cents to 14-bit pitch bend value
        // Center = 8192, Range = ±pitchBendRange semitones = ±(pitchBendRange * 100) cents
        const maxCents = this.pitchBendRange * 100;
        const normalized = cents / maxCents; // -1 to +1
        const pitchBendValue = Math.round(8192 + normalized * 8191);
        return Math.max(0, Math.min(16383, pitchBendValue));
    }

    // ============================================================================
    // MPE CHANNEL MANAGEMENT
    // ============================================================================

    allocateChannel() {
        if (this.channelPool.length === 0) {
            // No free channels - force release the oldest note
            console.warn('[Channel Allocation] No free MIDI channels! Stealing oldest note...');
            const oldestNote = this.activeNotes.entries().next().value;
            if (oldestNote) {
                const [noteId, noteData] = oldestNote;
                console.log(`[Channel Allocation] Stealing channel ${noteData.channel + 1} from note ${noteId}`);
                this.sendNoteOff(noteData.channel, noteData.midiNote);
                this.activeNotes.delete(noteId);
                // Return the channel directly without adding to pool
                console.log(`[Channel Allocation] Allocated channel ${noteData.channel + 1} (stolen). Free channels: ${this.channelPool.length}`);
                return noteData.channel;
            }
            // Absolute fallback
            console.error('[Channel Allocation] Cannot allocate channel - no active notes to steal!');
            return this.noteChannels[0];
        }
        const channel = this.channelPool.shift();
        console.log(`[Channel Allocation] Allocated channel ${channel + 1}. Free channels: ${this.channelPool.length}`);
        return channel;
    }

    releaseChannel(channel) {
        // Only release if not already in pool
        if (!this.channelPool.includes(channel)) {
            this.channelPool.unshift(channel); // Add to front for immediate reuse
            console.log(`[Channel Release] Released channel ${channel + 1}. Free channels: ${this.channelPool.length}`);
        } else {
            console.warn(`[Channel Release] Channel ${channel + 1} already in pool! (duplicate release attempt)`);
        }
    }

    // ============================================================================
    // MIDI MESSAGE SENDING
    // ============================================================================

    sendNoteOn(channel, note, velocity, pitchBend) {
        if (!this.selectedOutput) return;

        // Set pitch bend first (before note on)
        this.sendPitchBend(channel, pitchBend);

        // Note On message
        const status = 0x90 + channel; // Note On
        this.selectedOutput.send([status, note, velocity]);
    }

    sendNoteOff(channel, note) {
        if (!this.selectedOutput) return;

        // Note Off message
        const status = 0x80 + channel; // Note Off
        this.selectedOutput.send([status, note, 0]);
        // console.log(`    [MIDI Out] Note OFF: channel=${channel + 1}, note=${note}, status=0x${status.toString(16)}`);

        // Reset pitch bend to center (8192) after note off
        // This prevents pitch bend from "sticking" on the channel
        this.sendPitchBend(channel, 8192);
    }

    sendPitchBend(channel, pitchBendValue) {
        if (!this.selectedOutput) return;

        // Pitch bend message (14-bit value split into LSB and MSB)
        const lsb = pitchBendValue & 0x7F;
        const msb = (pitchBendValue >> 7) & 0x7F;
        const status = 0xE0 + channel;
        this.selectedOutput.send([status, lsb, msb]);
    }

    sendCC(channel, ccNumber, value) {
        if (!this.selectedOutput) return;

        // Control Change message
        const status = 0xB0 + channel;
        this.selectedOutput.send([status, ccNumber, value]);
    }

    // ============================================================================
    // HIGH-LEVEL CHORD CONTROL
    // ============================================================================

    playChord(frequencies, dissonance = 0) {
        if (!this.selectedOutput || !this.midiEnabled) {
            return []; // Return empty array if MIDI not available
        }

        // Map dissonance to velocity (inverted: low dissonance = high velocity)
        // Assuming dissonance range is roughly 0-10
        const normalizedDiss = Math.max(0, Math.min(1, dissonance / 10));
        const velocity = Math.round(127 - normalizedDiss * 87) + 20; // Range: 40-127

        // Create a unique chord ID for this click event
        const chordId = Date.now();
        const chordNoteIds = [];

        // Play each frequency as a separate MPE note
        frequencies.forEach((freq, index) => {
            const channel = this.allocateChannel();
            const midiData = this.freqToMIDI(freq);

            // Track this note with chord ID
            const noteId = `note_${chordId}_${index}`;
            chordNoteIds.push(noteId);

            this.activeNotes.set(noteId, {
                channel: channel,
                midiNote: midiData.note,
                frequency: freq,
                timestamp: Date.now(),
                chordId: chordId
            });

            // Send MIDI note-on
            this.sendNoteOn(channel, midiData.note, velocity, midiData.pitchBend);

            // console.log(`[Chord ${chordId}] Note ${index}: freq=${freq.toFixed(2)}Hz, MIDI=${midiData.note}, channel=${channel + 1}, noteId=${noteId}`);
        });

        // console.log(`[Chord ${chordId}] Started with ${chordNoteIds.length} notes. Active notes: ${this.activeNotes.size}, Free channels: ${this.channelPool.length}`);

        // Return the chord note IDs so they can be stopped independently
        return chordNoteIds;
    }

    // Play single note (for keyboard mapping)
    playSingleNote(frequency) {
        if (!this.selectedOutput || !this.midiEnabled) {
            return null;
        }

        // Allocate a channel for this note
        const channel = this.allocateChannel();
        const midiData = this.freqToMIDI(frequency);
        const velocity = 100; // Fixed velocity for keyboard notes

        // Create unique note ID with counter (prevents duplicates in same millisecond)
        const noteId = `keyboard_${Date.now()}_${this.noteIdCounter++}`;

        // Track this note
        this.activeNotes.set(noteId, {
            channel: channel,
            midiNote: midiData.note,
            frequency: frequency,
            timestamp: Date.now()
        });

        // Send MIDI note-on with pitch bend
        this.sendNoteOn(channel, midiData.note, velocity, midiData.pitchBend);

        console.log(`[Single Note] freq=${frequency.toFixed(2)}Hz, MIDI=${midiData.note}, bend=${midiData.pitchBend}, channel=${channel + 1}, noteId=${noteId}`);

        return noteId;
    }

    stopAllNotes() {
        const noteCount = this.activeNotes.size;
        if (noteCount === 0) {
            // console.log('[Stop All] No active notes to stop');
            return;
        }

        // console.log(`[Stop All] Stopping ${noteCount} active notes`);

        // Send note off for all active notes
        this.activeNotes.forEach((noteData, noteId) => {
            // console.log(`  [Stop All] Note off: ${noteId}, MIDI=${noteData.midiNote}, channel=${noteData.channel + 1}`);
            this.sendNoteOff(noteData.channel, noteData.midiNote);
            this.releaseChannel(noteData.channel);
        });
        this.activeNotes.clear();

        // console.log(`[Stop All] Complete. Free channels: ${this.channelPool.length}`);
    }

    // Stop only chord notes (from node clicks), leave keyboard notes playing
    stopChordNotes() {
        const chordNoteIds = [];

        // Find all notes that start with "note_" (chord notes)
        this.activeNotes.forEach((noteData, noteId) => {
            if (noteId.startsWith('note_')) {
                chordNoteIds.push(noteId);
            }
        });

        if (chordNoteIds.length === 0) {
            // console.log('[Stop Chord Notes] No chord notes to stop');
            return;
        }

        // console.log(`[Stop Chord Notes] Stopping ${chordNoteIds.length} chord notes`);

        // Stop each chord note
        chordNoteIds.forEach(noteId => {
            const noteData = this.activeNotes.get(noteId);
            if (noteData) {
                this.sendNoteOff(noteData.channel, noteData.midiNote);
                this.releaseChannel(noteData.channel);
                this.activeNotes.delete(noteId);
            }
        });

        // console.log(`[Stop Chord Notes] Complete. Remaining active notes: ${this.activeNotes.size}`);
    }

    // Stop specific notes by their IDs (for independent chord release)
    stopSpecificNotes(noteIds) {
        if (!noteIds || noteIds.length === 0) {
            console.warn('[stopSpecificNotes] called with empty or undefined noteIds');
            return;
        }

        console.log(`[stopSpecificNotes] Attempting to stop ${noteIds.length} notes: ${noteIds.join(', ')}`);
        let stoppedCount = 0;
        let alreadyStoppedCount = 0;

        noteIds.forEach(noteId => {
            const noteData = this.activeNotes.get(noteId);
            if (noteData) {
                this.sendNoteOff(noteData.channel, noteData.midiNote);
                this.releaseChannel(noteData.channel);
                this.activeNotes.delete(noteId);
                stoppedCount++;
                console.log(`[stopSpecificNotes] Stopped ${noteId}: MIDI=${noteData.midiNote}, channel=${noteData.channel + 1}`);
            } else {
                alreadyStoppedCount++;
                console.warn(`[stopSpecificNotes] ${noteId}: Not found (already stopped or invalid ID)`);
            }
        });

        console.log(`[stopSpecificNotes] Complete. Stopped: ${stoppedCount}, Not found: ${alreadyStoppedCount}, Active notes remaining: ${this.activeNotes.size}, Free channels: ${this.channelPool.length}`);
    }

    // Scheduled note off (for envelope-controlled playback)
    scheduleNoteOff(delayMs = 2000) {
        // CRITICAL: Cancel any existing scheduled note-off to prevent conflicts
        if (this.noteOffTimeout !== null) {
            clearTimeout(this.noteOffTimeout);
        }

        // Schedule new note-off
        this.noteOffTimeout = setTimeout(() => {
            this.stopAllNotes();
            this.noteOffTimeout = null;
        }, delayMs);
    }

    // ============================================================================
    // PANIC - ALL NOTES OFF
    // ============================================================================

    panic() {
        if (!this.selectedOutput) return;

        // Send All Notes Off (CC 123) on all channels
        for (let channel = 0; channel < 16; channel++) {
            this.sendCC(channel, 123, 0);
        }

        this.activeNotes.clear();
        this.channelPool = [...this.noteChannels];
        // console.log('MIDI Panic: All notes off');
    }

    // ============================================================================
    // UI RENDERING
    // ============================================================================

    createUI() {
        // Create MIDI panel container
        const container = document.createElement('div');
        container.id = 'midi-panel';
        container.className = 'midi-panel';
        container.innerHTML = `
            <div class="midi-header">
                <span class="midi-title">MIDI/MPE Output</span>
                <button class="midi-close-btn" id="midi-close">×</button>
            </div>
            <div class="midi-content">
                <div class="midi-status" id="midi-status">
                    <span class="status-indicator" id="status-dot"></span>
                    <span id="status-text">Not connected</span>
                </div>
                <div class="midi-piano-section">
                    <button id="midi-piano-toggle" class="midi-piano-btn">MIDI Piano: Initializing...</button>
                </div>
                <div class="midi-device-section">
                    <label>Output Device:</label>
                    <div class="device-selector-row">
                        <div class="midi-device-container"></div>
                        <button id="midi-refresh-devices" class="midi-refresh-btn" title="Refresh device list">🔄</button>
                    </div>
                </div>
                <div class="midi-info">
                    <div class="info-row">
                        <span>Mode:</span>
                        <span class="info-value">MPE (15 channels)</span>
                    </div>
                    <div class="info-row">
                        <span>Pitch Bend Range:</span>
                        <span class="info-value">±${this.pitchBendRange} semitones</span>
                    </div>
                </div>
                <button class="midi-panic-btn" id="midi-panic">All Notes Off (Panic)</button>
            </div>
        `;

        document.body.appendChild(container);

        // Initialize MIDI Piano button after panel is created
        setTimeout(() => {
            if (window.midiPianoHandler && typeof window.setupMidiPianoUI === 'function') {
                // Try to initialize MIDI if not already done
                if (!window.midiPianoHandler.midiAccess) {
                    window.midiPianoHandler.initialize().then(success => {
                        window.setupMidiPianoUI(success);
                    });
                } else {
                    window.setupMidiPianoUI(true);
                }
            }
        }, 100);

        // Event listeners
        document.getElementById('midi-close').addEventListener('click', () => {
            this.hideUI();
        });

        document.getElementById('midi-refresh-devices').addEventListener('click', () => {
            // console.log('Refreshing MIDI device list...');
            this.refreshDevices();
            // Also force immediate render
            setTimeout(() => {
                // console.log('Manual render after refresh button click');
                this.renderDeviceSelector();
            }, 50);
        });

        document.getElementById('midi-panic').addEventListener('click', () => {
            this.panic();
        });

        this.renderDeviceSelector();
    }

    renderDeviceSelector() {
        // Remove old dropdown if exists
        const oldSelect = document.getElementById('midi-device-select');
        if (oldSelect) {
            oldSelect.remove();
        }

        const container = document.querySelector('.midi-device-container');
        if (!container) {
            return;
        }

        // Create custom dropdown structure
        const customSelect = document.createElement('div');
        customSelect.id = 'midi-device-select';
        customSelect.className = 'custom-dropdown';
        customSelect.style.cssText = 'position: relative; width: 100%; cursor: pointer; user-select: none;';

        // Create the selected display
        const selectedDisplay = document.createElement('div');
        selectedDisplay.className = 'dropdown-selected';
        selectedDisplay.textContent = 'Select MIDI device...';
        selectedDisplay.style.cssText = 'padding: 10px; background: white; color: black; border: 2px solid black; border-radius: 4px;';

        // Create the options list
        const optionsList = document.createElement('div');
        optionsList.className = 'dropdown-options';
        optionsList.style.cssText = 'position: absolute; top: 100%; left: 0; right: 0; background: white; border: 2px solid black; border-top: none; max-height: 200px; overflow-y: auto; display: none; z-index: 10000;';

        // Add devices as options
        if (this.midiAccess && this.midiAccess.outputs) {
            this.midiAccess.outputs.forEach((output) => {
                const option = document.createElement('div');
                option.className = 'dropdown-option';
                option.textContent = output.name;
                option.dataset.deviceId = output.id;
                option.style.cssText = 'padding: 10px; color: black; cursor: pointer; border-bottom: 1px solid #ccc;';

                // Hover effect
                option.addEventListener('mouseenter', () => {
                    option.style.background = '#00ff00';
                });
                option.addEventListener('mouseleave', () => {
                    option.style.background = 'white';
                });

                // Click handler
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.selectOutput(output.id)) {
                        selectedDisplay.textContent = output.name;
                        optionsList.style.display = 'none';
                        this.updateStatus(true);
                        // console.log('Device selected:', output.name);
                    }
                });

                optionsList.appendChild(option);
                // console.log(`Added device option: ${output.name} (${output.id})`);
            });
        }

        // Toggle dropdown
        selectedDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = optionsList.style.display === 'block';
            optionsList.style.display = isVisible ? 'none' : 'block';
            // console.log('Dropdown toggled, visible:', !isVisible);
        });

        // Close on outside click
        document.addEventListener('click', () => {
            optionsList.style.display = 'none';
        });

        customSelect.appendChild(selectedDisplay);
        customSelect.appendChild(optionsList);
        container.appendChild(customSelect);

        // console.log('Custom dropdown created with', optionsList.children.length, 'options');
    }

    updateStatus(connected) {
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');

        if (statusDot && statusText) {
            if (connected && this.selectedOutput) {
                statusDot.className = 'status-indicator connected';
                statusText.textContent = `Connected: ${this.selectedOutput.name}`;
            } else {
                statusDot.className = 'status-indicator';
                statusText.textContent = 'Not connected';
            }
        }
    }

    showUI() {
        let panel = document.getElementById('midi-panel');
        if (!panel) {
            this.createUI();
            panel = document.getElementById('midi-panel');
        }
        panel.classList.add('visible');
        this.isUIVisible = true;

        // Populate the dropdown after UI is ready
        setTimeout(() => {
            this.renderDeviceSelector();
        }, 100);
    }

    hideUI() {
        const panel = document.getElementById('midi-panel');
        if (panel) {
            panel.classList.remove('visible');
        }
        this.isUIVisible = false;
    }

    toggleUI() {
        if (this.isUIVisible) {
            this.hideUI();
        } else {
            this.showUI();
        }
    }
}

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

const midiController = new MIDIController();

// Expose to global scope (but don't auto-initialize yet)
window.midiController = midiController;