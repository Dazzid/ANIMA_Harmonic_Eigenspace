// ============================================================================
// INFO OVERLAY - Educational Panel for 4D Harmonic Eigenspace
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

class InfoOverlay {
    constructor() {
        this.isVisible = false;
        this.overlay = null;
        this.infoButton = null;
        this.hasShownOnLoad = false;
        this.init();
    }

    init() {
        // Create the overlay container
        this.createOverlay();

        // Create the info button
        this.createInfoButton();

        // Don't show automatically anymore - wait for data to be ready
        // The show() method will be called from test.js when visualization is complete
    }

    createOverlay() {
        // Create overlay backdrop
        this.overlay = document.createElement('div');
        this.overlay.id = 'info-overlay';

        // Create info panel
        const panel = document.createElement('div');
        panel.className = 'info-panel';

        // Add content with clean class-based styling
        panel.innerHTML = `
            <div class="header-section">
                <h1 class="main-title">4D Harmonic Eigenspace</h1>
                <div class="subtitle">Psychoacoustic Dissonance Visualization</div>
            </div>

            <div class="content-section">
                <div class="section">
                    <h3>The Dissonance Map</h3>
                    <p>
                        This is an <strong>interactive 4-dimensional map</strong> of harmonic consonance and dissonance. 
                        The visualization explores how three simultaneous frequency ratios (α, β, γ) interact with a root note 
                        to create varying degrees of psychoacoustic roughness.
                    </p>
                </div>

                <div class="section">
                    <h3>The 4D Space</h3>
                    <p>The four dimensions are:</p>
                    <ul>
                        <li><strong class="root-color">Root</strong> - (origin) The fundamental frequency</li>
                        <li><strong class="alpha-color">α</strong> (alpha) - x axis, 1st frequency ratio</li>
                        <li><strong class="beta-color">β</strong> (beta) - y axis, 2nd frequency ratio</li>
                        <li><strong class="gamma-color">γ</strong> (gamma) - z axis, 3rd frequency ratio</li>
                    </ul>
                </div>

                <div class="section">
                    <h3>The Eigenspace View</h3>
                    <p>
                        What you see is a <strong>3D visualization</strong> slice of the four-dimensional space of tetrachord dissonance relationships. Each axis represents 
                        the interaction of <strong>6 first harmonics</strong> at different frequency ratios, computed using 
                        the <em>Plomp-Levelt</em> [1] roughness model from Sethares' <a href="https://sethares.engr.wisc.edu/ttss.html" target="_blank"><em>Tuning, Timbre, Spectrum, Scale</em> [2]</a>.
                        The visualization maps dissonance values across all possible combinations of the three frequency ratios, creating a 3D landscape of psychoacoustic roughness.
                    </p>
                    <p>
                        The color scale reveals <strong>intersection zones</strong> where harmonic interactions create varying 
                        dissonance levels: blue regions indicate low dissonance (consonance), 
                        white areas show moderate roughness, and red zones represent high dissonance.
                    </p>    
                    <div class="eigenspace-image">
                        <img src="figures/EigenSpace.png" alt="Harmonic Eigenspace Visualization" />
                        <p class="image-caption">Dissonance landscape showing consonant valleys where harmonic series align</p>
                    </div>
                </div>

                <div class="section">
                    <h3>Deriving Chords from Acoustic Spectrum</h3>
                    <p>
                        This visualization extends the concept of finding consonant intervals to finding consonant
                        <em>chords</em>. Rather than varying a single frequency ratio, we explore all possible
                        combinations of three simultaneous ratios (α, β, γ) relative to a root tone.
                    </p>
                    <p>
                        Within this harmonic landscape, we identify the most stable regions—<strong>local dissonance minima</strong>—that correspond to just intonation ratios.
                        The visualization reveals <em>why</em> these ratios sound consonant: they are positioned at <em>confluences</em> where multiple dissonance rivers meet and merge.
                        These spots appear as numbered white nodes, marking precise coordinates in the harmonic topological space. Click any point to hear that chord/sound combination.
                    </p>
                </div>

                <div class="section">
                    <h3>Mathematical Foundation</h3>
                    <p>
                        The dissonance values range precisely from 14 to 22 due to the specific parameters of this visualization:
                    </p>
                    <p>
                        • Base Parameters: 220 Hz fundamental, 6 harmonics, frequency ratios [1.0-2.0]<br>
                        • Plomp-Levelt Formula: <div class="formula">D = Σ<sub>pairs</sub> a × [5·e<sup>−3.51·S·Δf</sup> − 5·e<sup>−5.75·S·Δf</sup>]</div><br>
                        • Lower Bound (≈14): Perfect consonances (2:1, 3:2) with 276 harmonic pairs contributing minimal residual roughness<br>
                        • Upper Bound (≈22): Maximum clustering within critical bands, limited by exponential decay saturation
                    </p>
                    <p>
                        These bounds emerge from psychoacoustic constants; a mathematical structure of the human auditory perception as modeled by <a href="https://pubs.aip.org/asa/jasa/article-abstract/38/4/548/615274/Tonal-Consonance-and-Critical-Bandwidth" target="_blank">Plomp and Levelt</a>.
                    </p>
                    <p>
                        <strong>References:</strong><br>
                        1) Plomp, Reinier, and Willem Johannes Maria Levelt. "Tonal consonance and critical bandwidth." The journal of the Acoustical Society of America 38.4 (1965): 548-560.<br>
                        2) Sethares, William A. Tuning, timbre, spectrum, scale. London: Springer London, 2005.
                    </p>
                </div>

                <div class="technical-note">
                    <h3>Technical Note: MIDI/MPE Setup (macOS)</h3>
                    <strong>1. Enable IAC Driver (built-in virtual MIDI):</strong><br>
                    • Open <em>Audio MIDI Setup</em> (Applications/Utilities or Spotlight search)<br>
                    • Go to Window → Show MIDI Studio<br>
                    • Double-click the <em>IAC Driver</em> icon<br>
                    • Check "Device is online"<br>
                    • You should see a port called "IAC Driver Bus 1"<br>
                    <br>
                    <strong>2. In your browser:</strong><br>
                    • The IAC ports will appear in the MIDI device dropdown<br>
                    • Select the IAC port you want to use<br>
                    <br>
                    <strong>3. In Ableton Live:</strong><br>
                    • Go to Preferences → Link/Tempo/MIDI<br>
                    • Under MIDI Ports, find the IAC Driver port<br>
                    • Enable <em>Track</em> and <em>Remote</em> for that port<br>
                    • Check the <em>MPE</em> box to enable MPE support<br>
                    • Create a MIDI track and set its input to the IAC Driver port<br>
                    • Now you can receive the MPE microtonal chords from the visualization!<br>
                </div>
            </div>

            <button id="close-info-btn" class="close-btn">✕</button>

            <div class="button-section">
                <button id="got-it-btn" class="got-it-btn">Got It</button>
            </div>
        `;

        this.overlay.appendChild(panel);
        document.body.appendChild(this.overlay);

        // Add event listeners
        const closeBtn = document.getElementById('close-info-btn');
        const gotItBtn = document.getElementById('got-it-btn');

        closeBtn.addEventListener('click', () => this.hide());
        gotItBtn.addEventListener('click', () => this.hide());

        // Click outside to close
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });

        // Store panel reference for animation
        this.panel = panel;
    }

    createInfoButton() {
        this.infoButton = document.createElement('button');
        this.infoButton.id = 'info-button';
        this.infoButton.innerHTML = 'Info';
        // Styling is now handled in style.css via #info-button selector

        this.infoButton.addEventListener('click', () => this.show());

        document.body.appendChild(this.infoButton);
    }

    show() {
        if (this.isVisible) return;

        this.overlay.style.display = 'flex';

        // Trigger animation
        requestAnimationFrame(() => {
            this.overlay.style.opacity = '1';
            this.panel.style.transform = 'scale(1)';
        });

        this.isVisible = true;

        // Prevent body scroll when overlay is open
        document.body.style.overflow = 'hidden';
    }

    hide() {
        if (!this.isVisible) return;

        this.overlay.style.opacity = '0';
        this.panel.style.transform = 'scale(0.9)';

        setTimeout(() => {
            this.overlay.style.display = 'none';
            this.isVisible = false;

            // Restore body scroll
            document.body.style.overflow = '';
        }, 300);
    }

    // Intentionally does NOT auto-open on load — the intro overlay only appears
    // when the user clicks the info button (wired in the constructor). Kept as a
    // no-op so existing callers (eigenspace.js) stay valid.
    showWhenReady() {
        this.hasShownOnLoad = true;
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
}

// Initialize the info overlay when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.infoOverlay = new InfoOverlay();
    });
} else {
    window.infoOverlay = new InfoOverlay();
}

// Expose toggle function globally
window.toggleInfo = function () {
    if (window.infoOverlay) {
        window.infoOverlay.toggle();
    }
};