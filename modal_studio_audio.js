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

// Audio Engine for Modal Studio
// Based on Harmonic_Eigenspace.js audio system

class AudioEngine {
    constructor() {
        this.audioCtx = null;
        this.reverbNode = null;
        this.audioInitialized = false;
        this.currentlyPlaying = [];
        this.audioMuted = false;
        
        // Use global audioParams shared with ADSR GUI (defined in HTML)
        // No need for local params - we'll reference window.audioParams directly
    }
    
    // Initialize Web Audio API
    async initAudio() {
        if (this.audioInitialized) return true;
        
        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            await this.audioCtx.resume();
            this.reverbNode = this.createReverb();
            this.reverbNode.connect(this.audioCtx.destination);
            
            // Pre-warm: play silent note to prime audio graph
            const warmupOsc = this.audioCtx.createOscillator();
            const warmupGain = this.audioCtx.createGain();
            warmupGain.gain.value = 0.0001;
            warmupOsc.connect(warmupGain);
            warmupGain.connect(this.audioCtx.destination);
            warmupOsc.start();
            warmupOsc.stop(this.audioCtx.currentTime + 0.01);
            
            this.audioInitialized = true;
            console.log('✓ Audio initialized');
            return true;
        } catch (e) {
            console.error('Audio initialization failed:', e);
            return false;
        }
    }
    
    // Create reverb using convolution
    createReverb() {
        const convolver = this.audioCtx.createConvolver();
        const rate = this.audioCtx.sampleRate;
        const length = rate * 2.0;  // second reverb
        const impulse = this.audioCtx.createBuffer(2, length, rate);
        const impulseL = impulse.getChannelData(0);
        const impulseR = impulse.getChannelData(1);
        
        for (let i = 0; i < length; i++) {
            const n = length - i;
            impulseL[i] = (Math.random() * 2 - 1) * Math.pow(n / length, 2);
            impulseR[i] = (Math.random() * 2 - 1) * Math.pow(n / length, 2);
        }
        
        convolver.buffer = impulse;
        return convolver;
    }
    
    // Play a single note with frequency
    async playNote(frequency) {
        // Check global mute state from ADSR GUI
        if (window.audioMuted || this.audioMuted) {
            console.log('[Audio] Muted, skipping playback');
            return;
        }
        
        if (!this.audioInitialized) {
            await this.initAudio();
            if (!this.audioInitialized) return;
        }
        
        if (!this.audioCtx || !this.reverbNode) return;
        
        const t = this.audioCtx.currentTime + 0.01;
        const harmonics = [1, 2, 3, 4, 5, 6];
        const amplitudes = [1, 0.41, 0.333, 0.27, 0.13, 0.11];
        
        this.createNote(frequency, harmonics, amplitudes, t);
    }
    
    // Play a chord (array of frequencies)
    async playChord(frequencies) {
        // Check global mute state from ADSR GUI
        if (window.audioMuted || this.audioMuted) {
            console.log('[Audio] Muted, skipping playback');
            return;
        }
        
        if (!this.audioInitialized) {
            await this.initAudio();
            if (!this.audioInitialized) return;
        }
        
        if (!this.audioCtx || !this.reverbNode) return;
        
        // Don't stop currently playing audio - let sounds overlap and complete their envelope
        // this.stopAll();
        
        const t = this.audioCtx.currentTime + 0.06;
        const harmonics = [1, 2, 3, 4, 5, 6];
        const amplitudes = [1, 0.41, 0.333, 0.27, 0.13, 0.11];
        
        // Play each note in the chord
        for (let freq of frequencies) {
            this.createNote(freq, harmonics, amplitudes, t);
        }
    }
    
    // Create a single note with ADSR envelope
    createNote(freq, harmonics, amplitudes, startTime) {
        const masterGain = this.audioCtx.createGain();
        const dryGain = this.audioCtx.createGain();
        const wetGain = this.audioCtx.createGain();
        
        // Equal-power crossfade for dry/wet mix
        dryGain.gain.value = Math.sqrt(1.0 - window.audioParams.dryWet);
        wetGain.gain.value = Math.sqrt(window.audioParams.dryWet) * 2.0;
        
        masterGain.connect(dryGain);
        masterGain.connect(wetGain);
        dryGain.connect(this.audioCtx.destination);
        wetGain.connect(this.reverbNode);
        
        masterGain.gain.value = 0.15;  // Base gain
        
        // Create each harmonic as separate oscillator
        for (let i = 0; i < harmonics.length; i++) {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.type = window.audioParams.waveType;
            osc.frequency.value = freq * harmonics[i];
            
            osc.connect(gain);
            gain.connect(masterGain);
            
            // Track oscillator for cleanup
            this.currentlyPlaying.push({
                oscillator: osc,
                gainNode: gain
            });
            
            // ADSR envelope
            const attack = window.audioParams.attack;
            const sustain = window.audioParams.sustain;
            const release = window.audioParams.release;
            
            const attackAmp = amplitudes[i] * window.audioParams.attackLevel;
            const sustainAmp = amplitudes[i] * window.audioParams.sustainLevel;
            
            gain.gain.setValueAtTime(0.001, startTime);
            gain.gain.exponentialRampToValueAtTime(attackAmp, startTime + attack);
            gain.gain.exponentialRampToValueAtTime(sustainAmp, startTime + attack + sustain);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + attack + sustain + release);
            
            const length = attack + sustain + release;
            osc.start(startTime);
            osc.stop(startTime + length);
            
            // Remove from tracking when ended
            osc.addEventListener('ended', () => {
                const index = this.currentlyPlaying.findIndex(item => item.oscillator === osc);
                if (index !== -1) {
                    this.currentlyPlaying.splice(index, 1);
                }
            });
        }
    }
    
    // Stop all currently playing audio
    stopAll() {
        const now = this.audioCtx ? this.audioCtx.currentTime : 0;
        
        for (let item of this.currentlyPlaying) {
            try {
                item.gainNode.gain.cancelScheduledValues(now);
                item.gainNode.gain.setValueAtTime(item.gainNode.gain.value, now);
                item.gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                item.oscillator.stop(now + 0.05);
            } catch (e) {
                // Oscillator may already be stopped
            }
        }
        
        this.currentlyPlaying = [];
    }
    
    // Toggle mute
    setMuted(muted) {
        this.audioMuted = muted;
        if (muted) {
            this.stopAll();
        }
    }
}
