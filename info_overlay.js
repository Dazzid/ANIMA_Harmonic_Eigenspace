// ============================================================================
// INFO OVERLAY - Educational Panel for 4D Harmonic Eigenspace
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

        // Show on first load
        setTimeout(() => {
            if (!this.hasShownOnLoad) {
                this.show();
                this.hasShownOnLoad = true;
            }
        }, 500);
    }

    createOverlay() {
        // Create overlay backdrop
        this.overlay = document.createElement('div');
        this.overlay.id = 'info-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(8px);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        // Create info panel
        const panel = document.createElement('div');
        panel.style.cssText = `
            background: rgba(238, 238, 238, 1);
            border: none;
            border-radius: 20px;
            padding: 40px;
            max-width: 800px;
            width: 90%;
            max-height: 85vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            position: relative;
            transform: scale(0.9);
            transition: transform 0.3s ease;
        `;

        // Define text color as const for use in template literal
        const textColor = 'rgba(16, 16, 16, 1)';

        // Add content
        panel.innerHTML = `
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="
                    color: ${textColor};
                    font-family: 'Monaco', 'Courier New', monospace;
                    font-size: 28px;
                    margin: 0 0 10px 0;
                    font-weight: light;
                ">4D Harmonic Eigenspace</h1>
                <div style="
                    color: ${textColor};
                    font-family: 'Monaco', monospace;
                    font-size: 14px;
                    letter-spacing: 2px;
                    font-weight: light;
                ">PSYCHOACOUSTIC DISSONANCE VISUALIZATION</div>
            </div>

            <div style="color: ${textColor}; font-family: 'Monaco', monospace; font-size: 14px; line-height: 1.8;">
                <div style="margin-bottom: 25px;">
                    <h3 style="color: ${textColor}; font-size: 16px; margin: 0 0 10px 0; font-weight: light;">
                        What is This?
                    </h3>
                    <p style="margin: 0 0 10px 0;">
                        This is an <strong>interactive 4-dimensional map</strong> of harmonic consonance and dissonance. 
                        The visualization explores how three simultaneous frequency ratios (α, β, γ) interact with a root note 
                        to create varying degrees of psychoacoustic roughness.
                    </p>
                </div>

                <div style="margin-bottom: 25px;">
                    <h3 style="color: ${textColor}; font-size: 16px; margin: 0 0 10px 0; font-weight: light;">
                        The 4D Space
                    </h3>
                    <p style="margin: 0 0 10px 0;">
                        The four dimensions are:
                    </p>
                    <ul style="margin: 0 0 10px 20px; padding: 0;">
                        <li style="margin-bottom: 8px;"><strong style="color: rgb(255, 119, 0);">α</strong> (alpha) - x axis interval ratio</li>
                        <li style="margin-bottom: 8px;"><strong style="color: rgb(118, 236, 0);">β</strong> (beta) - y axis interval ratio</li>
                        <li style="margin-bottom: 8px;"><strong style="color: rgb(0, 128, 255);">γ</strong> (gamma) - z axis interval ratio</li>
                        <li style="margin-bottom: 8px;"><strong style="color: rgba(0, 0, 0, 1);">Root</strong> - (origin) The fundamental frequency</li>
                    </ul>
                </div>

                <div style="margin-bottom: 25px;">
                    <h3 style="color: ${textColor}; font-size: 16px; margin: 0 0 10px 0; font-weight: light;">
                        The Eigenspace View
                    </h3>
                    <p style="margin: 0 0 10px 0;">
                        What you see is a <strong>3D slice</strong> through the 4D space. The dissonance values are computed 
                        using the <em>Plomp-Levelt</em> psychoacoustic model, which quantifies the sensory roughness 
                        created by interacting harmonics.
                    </p>
                    <p style="margin: 0 0 10px 0;">
                        This creates an <strong>eigenspace</strong> - a mathematical space where each point represents 
                        a unique chord configuration, and the "valleys" represent consonant combinations discovered 
                        through acoustic physics. 
                    </p>
                </div>

                <div style="margin-bottom: 25px;">
                    <h3 style="color: ${textColor}; font-size: 16px; margin: 0 0 10px 0; font-weight: light;">
                        Deriving Chords from Acoustic Spectrum
                    </h3>
                    <p style="margin: 0 0 10px 0;">
                        This visualization extends the concept of finding consonant intervals to finding consonant
                        <em>chords</em>. Rather than varying a single frequency ratio, we explore all possible
                        combinations of three simultaneous ratios (α, β, γ) relative to a root tone.
                    </p>
                    <p style="margin: 0 0 10px 0;">
                        The current sound uses 6 harmonic partials with frequencies [1, 2, 3, 4, 5, 6] and
                        decreasing amplitudes. When multiple copies of this sound interact at different frequency
                        ratios, certain combinations produce minimal roughness. These appear as valleys in the
                        3D landscape - the deeper the valley, the more consonant the chord.
                    </p>
                    <p style="margin: 0 0 10px 0;">
                        For harmonic spectra like this one, the valleys align with familiar just intonation ratios.
                        The visualization reveals <em>why</em> these ratios sound consonant: they minimize the beating
                        between interacting partials. Click any point to hear that chord combination.
                    </p>
                </div>

                <div style="
                    background: rgba(0, 174, 255, 0.5);
                    padding: 15px;
                    border-radius: 8px;
                    margin-top: 25px;
                    font-size: 12px;
                ">
                    <strong>Technical Note:</strong>
                    This visualization uses computational psychoacoustics to map an imaginary space of harmonic possibilities. 
                    The local minima (white numbered dots) correspond to just intonation intervals and microtonal consonances out of tone equal temperaments rations.
                </div>
            </div>

            <button id="close-info-btn" style="
                position: absolute;
                top: 20px;
                right: 20px;
                background: transparent;
                border: 1px solid rgba(150, 150, 150, 0.5);
                color: rgba(150, 150, 150, 1);
                width: 36px;
                height: 36px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 18px;
                font-weight: light;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: Arial, sans-serif;
            ">
                ✕
            </button>

            <div style="text-align: center; margin-top: 30px;">
                <button id="got-it-btn" style="
                    background: rgba(31, 125, 255, 1);
                    border: none;
                    color: white;
                    padding: 12px 40px;
                    font-size: 14px;
                    font-family: 'Monaco', monospace;
                    font-weight: light;
                    border-radius: 8px;
                    cursor: pointer;
                ">
                    Got It
                </button>
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
        this.infoButton.innerHTML = 'ℹ Info';
        this.infoButton.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 110, 255, 0.9);
            border: none;
            color: white;
            padding: 8px 20px;
            font-size: 14px;
            font-family: 'Monaco', 'Courier New', monospace;
            font-weight: light;
            border-radius: 8px;
            cursor: pointer;
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 8px;
        `;

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