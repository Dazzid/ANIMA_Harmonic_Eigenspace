// ============================================================================
// MIDI/MPE CONTROLLER - Harmonic Eigenspace to MIDI/MPE
// Sends microtonal chord data to Ableton Live via Web MIDI API
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

        // UI state
        this.isUIVisible = false;
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    async initialize() {
        if (!navigator.requestMIDIAccess) {
            console.warn('Web MIDI API not supported in this browser');
            return false;
        }

        try {
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
            console.log('MIDI Access granted');

            // Listen for device connection changes
            this.midiAccess.onstatechange = (e) => {
                console.log('MIDI device state change:', e.port.name, e.port.state);
                this.updateDeviceList();
            };

            this.midiEnabled = true;
            return true;
        } catch (error) {
            console.error('Failed to get MIDI access:', error);
            return false;
        }
    }

    // ============================================================================
    // DEVICE MANAGEMENT
    // ============================================================================

    getOutputDevices() {
        if (!this.midiAccess) {
            console.log('getOutputDevices: no midiAccess');
            return [];
        }

        const outputs = [];
        console.log('getOutputDevices: midiAccess.outputs size:', this.midiAccess.outputs.size);
        this.midiAccess.outputs.forEach((output) => {
            const deviceInfo = {
                id: output.id,
                name: output.name,
                manufacturer: output.manufacturer,
                state: output.state
            };
            console.log('Found MIDI output:', deviceInfo);
            outputs.push(deviceInfo);
        });
        console.log('getOutputDevices returning:', outputs);
        return outputs;
    }

    selectOutput(deviceId) {
        if (!this.midiAccess) return false;

        const output = this.midiAccess.outputs.get(deviceId);
        if (output && output.state === 'connected') {
            this.selectedOutput = output;
            console.log('Selected MIDI output:', output.name);

            // Send MPE configuration
            this.configureMPE();
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
            console.log('Device refresh complete. Found devices:', devices);
            
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
            console.error('Failed to refresh MIDI devices:', error);
        }
    }

    // Manual method for console testing
    forceRenderDevices() {
        console.log('Force rendering devices...');
        const devices = this.getOutputDevices();
        console.log('Devices found for manual render:', devices);
        this.renderDeviceSelector();
    }

    // EMERGENCY TEST FUNCTION - Call this from console
    emergencyTest() {
        console.log('EMERGENCY TEST STARTING');
        
        // Find the select element
        const select = document.getElementById('midi-device-select');
        console.log('Select found:', !!select);
        
        if (!select) {
            console.log('SELECT NOT FOUND!');
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
        
        console.log('Options added. Select innerHTML:', select.innerHTML);
        console.log('Select children count:', select.children.length);
        
        // Force refresh
        select.style.display = 'none';
        select.offsetHeight; // Trigger reflow
        select.style.display = '';
        
        console.log('EMERGENCY TEST COMPLETE');
    }

    manualDeviceScan() {
        console.log('Manual device scan starting...');
        const select = document.getElementById('midi-device-select');
        
        if (!select) {
            console.error('Select element not found!');
            return;
        }

        // Clear and add default
        select.innerHTML = '<option value="">Scanning...</option>';
        
        // Get devices directly
        if (!this.midiAccess) {
            console.error('No MIDI access!');
            select.innerHTML = '<option value="">No MIDI access</option>';
            return;
        }

        console.log('MIDI access available, outputs size:', this.midiAccess.outputs.size);
        
        // Manual device population
        select.innerHTML = '<option value="">Select MIDI device...</option>';
        
        let deviceCount = 0;
        this.midiAccess.outputs.forEach((output) => {
            console.log(`Manual scan - found device: ${output.name} (${output.id})`);
            const option = document.createElement('option');
            option.value = output.id;
            option.textContent = output.name || `Device ${output.id}`;
            select.appendChild(option);
            deviceCount++;
        });
        
        console.log(`Manual scan complete - added ${deviceCount} devices`);
        
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

        console.log(`MPE configured: ±${this.pitchBendRange} semitones pitch bend range`);
    }

    // ============================================================================
    // FREQUENCY TO MIDI CONVERSION
    // ============================================================================

    freqToMIDI(frequency) {
        // Convert frequency to MIDI note number + cents deviation
        // MIDI note 69 = A4 = 440 Hz
        const noteNumber = 69 + 12 * Math.log2(frequency / 440.0);
        const midiNote = Math.round(noteNumber);
        const cents = (noteNumber - midiNote) * 100; // Cents deviation from nearest semitone

        return {
            note: Math.max(0, Math.min(127, midiNote)),
            cents: cents,
            pitchBend: this.centsToPitchBend(cents)
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
            // No free channels, steal oldest
            const oldestNote = this.activeNotes.entries().next().value;
            if (oldestNote) {
                const [noteId, noteData] = oldestNote;
                this.sendNoteOff(noteData.channel, noteData.midiNote);
                this.activeNotes.delete(noteId);
                return noteData.channel;
            }
            return this.noteChannels[0]; // Fallback
        }
        return this.channelPool.shift();
    }

    releaseChannel(channel) {
        if (!this.channelPool.includes(channel)) {
            this.channelPool.push(channel);
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
        if (!this.selectedOutput || !this.midiEnabled) return;

        // Stop any currently playing notes
        this.stopAllNotes();

        // Map dissonance to velocity (inverted: low dissonance = high velocity)
        // Assuming dissonance range is roughly 0-10
        const normalizedDiss = Math.max(0, Math.min(1, dissonance / 10));
        const velocity = Math.round(127 - normalizedDiss * 87) + 20; // Range: 40-127

        // Play each frequency as a separate MPE note
        frequencies.forEach((freq, index) => {
            const midiData = this.freqToMIDI(freq);
            const channel = this.allocateChannel();

            // Track this note
            const noteId = `note_${Date.now()}_${index}`;
            this.activeNotes.set(noteId, {
                channel: channel,
                midiNote: midiData.note,
                frequency: freq,
                timestamp: Date.now()
            });

            // Send MIDI
            this.sendNoteOn(channel, midiData.note, velocity, midiData.pitchBend);

            console.log(`MPE Note ${index}: ${freq.toFixed(2)} Hz → MIDI ${midiData.note} (${midiData.cents.toFixed(1)} cents) on channel ${channel + 1}`);
        });
    }

    stopAllNotes() {
        // Send note off for all active notes
        this.activeNotes.forEach((noteData, noteId) => {
            this.sendNoteOff(noteData.channel, noteData.midiNote);
            this.releaseChannel(noteData.channel);
        });
        this.activeNotes.clear();
    }

    // Scheduled note off (for envelope-controlled playback)
    scheduleNoteOff(delayMs = 2000) {
        setTimeout(() => {
            this.stopAllNotes();
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
        console.log('MIDI Panic: All notes off');
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
                <div class="midi-device-section">
                    <label>Output Device:</label>
                    <div class="device-selector-row">
                        <select id="midi-device-select" class="midi-select">
                        </select>
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

        // Event listeners
        document.getElementById('midi-close').addEventListener('click', () => {
            this.hideUI();
        });

        document.getElementById('midi-device-select').addEventListener('change', (e) => {
            if (e.target.value) {
                const success = this.selectOutput(e.target.value);
                this.updateStatus(success);
            }
        });

        document.getElementById('midi-refresh-devices').addEventListener('click', () => {
            console.log('Refreshing MIDI device list...');
            this.refreshDevices();
            // Also force immediate render
            setTimeout(() => {
                console.log('Manual render after refresh button click');
                this.renderDeviceSelector();
            }, 50);
        });

        document.getElementById('midi-panic').addEventListener('click', () => {
            this.panic();
        });

        this.renderDeviceSelector();
    }

    renderDeviceSelector() {
        const select = document.getElementById('midi-device-select');
        if (!select) {
            return;
        }

        // Clear all existing options
        select.innerHTML = '';
        
        // Add default option using the working method from your example
        let defaultEl = document.createElement("option");
        defaultEl.textContent = "Select MIDI device...";
        defaultEl.value = "";
        select.appendChild(defaultEl);
        
        // Get the real devices and add them using the same method
        if (this.midiAccess && this.midiAccess.outputs) {
            this.midiAccess.outputs.forEach((output) => {
                let el = document.createElement("option");
                el.textContent = output.name;
                el.value = output.id;
                select.appendChild(el);
                console.log(`Added device: ${output.name} (${output.id})`);
            });
        }
        
        console.log('Total options in select:', select.children.length);
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