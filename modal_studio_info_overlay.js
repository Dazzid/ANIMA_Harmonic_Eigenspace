// ============================================================================
// MODAL STUDIO INFO OVERLAY - Educational Panel
// ============================================================================

class ModalStudioInfoOverlay {
    constructor() {
        this.isVisible = false;
        this.overlay = null;
        this.infoButton = null;
        this.init();
    }

    init() {
        this.createOverlay();
        this.createInfoButton();
    }

    createOverlay() {
        // Create overlay backdrop
        this.overlay = document.createElement('div');
        this.overlay.id = 'modalstudio-info-overlay';
        this.overlay.className = 'info-overlay';

        // Create info panel
        const panel = document.createElement('div');
        panel.className = 'info-panel';

        // Add content
        panel.innerHTML = `
            <div class="header-section">
                <h1 class="main-title">Modal Studio</h1>
                <div class="subtitle">53-TET Modal Interchange & Chord Exploration</div>
            </div>

            <div class="content-section">
                <div class="section">
                    <h3>Overview</h3>
                    <p>
                        The Modal Studio is a novel computer application that enables real-time exploration and manipulation of microtonal harmonies in 53-tone equal temperament (53-TET). 
                        Building upon traditional 12-TET modes and incorporating principles from 31-TET, that extend minor/major interval qualities with subminor, neutral, 
                        and supermajor distinctions. Subsequently, extending to 53-TET's harmonic landscape with detailed interval qualities. 
                        The application offers an intuitive interface with real-time visualization and MIDI Polyphonic Expression (MPE) support.
                    </p>
                    <p>
                        Through an MPE adaptation it is possible to connect directly to any DAW and use the app as a MIDI controller that allows MPE format.
                    </p>

                </div>

                <div class="section">
                    <h3>Understanding Modal Interchange</h3>
                    <p>
                        Although harmonic exploration can be made through singular modes, a compelling method for expanding research to other chords is through <strong>modal interchanges</strong>. 
                        Modal interchange involves borrowing chords from parallel or relative modes to introduce new harmonic colors 
                        while maintaining a connection to the original mode.
                    </p>
                </div>

                <div class="section">
                    <h3>Parallel Interchange</h3>
                    <p>
                        This involves borrowing chords from a mode sharing the same root as the original one.
                        For instance, if we are in C major/Ionian, we can borrow from C Aeolian.
                    </p>
                </div>

                <div class="section">
                    <h3>Relative Interchange</h3>
                    <p>
                        This involves shifting to a mode where the original root
                        functions as a different degree of the scale and borrowing chords from the obtained mode.
                        For instance, starting from C major/Ionian, an Aeolian relative modal interchange
                        would place C at the 6th degree of E♭ major/Ionian.
                        Therefore, we can borrow from E♭ major.
                    </p>
                </div>

                <div class="section">
                    <div class="modal-image">
                        <img src="figures/modal_interchanges.png" alt="Modal Interchange Diagram" />
                        <p class="image-caption">Modal interchange examples showing parallel and relative Aeolian interchanges on a C major progression</p>
                    </div>
                </div>

                <div class="section">
                    <h3>Applying Modal Interchanges</h3>
                    <p>
                        The distinction between parallel and relative modal interchanges appears more clearly
                        when applied to chord progressions. The figure shows a simple "I vi ii V I" 12-TET progression in C major,
                        and the parallel and relative Aeolian interchanges for the middle chords.
                    </p>
                    <p>
                        The move from Ionian to Aeolian means adding a ♭3 (E♭), ♭6 (A♭), and ♭7 (B♭).
                        In the parallel interchange, the chords are still based on the root of C. 
                        Am7 becomes A♭maj7 to correspond to the new bag of notes of C Aeolian. Similarly, we obtain Dm7♭5 and Gm7. 
                        In the relative interchange, the chords are now based on the root of E♭.
                        The vi is, therefore, the 6th degree of E♭ major, i.e., Cm7. Similarly, we obtain Fm7 and B♭7.
                    </p>
                </div>

                <div class="section">
                    <h3>53-TET Extension</h3>
                    <p>
                        This concept of modal interchanges can be directly applied to the extended modal possibilities of 53-TET. 
                        Once a mode is defined, parallel and relative motion can borrow new chords and harmonic content into a progression. 
                        This approach is at the core of harmonic exploration in this application.
                    </p>
                </div>

                <div class="section">
                    <h3>Interval Qualities in 53-TET</h3>
                    <div class="modal-image">
                        <img src="figures/intervals.png" alt="53-TET Interval Qualities" />
                        <p class="image-caption">Extended interval qualities in 53-TET: from subminor to supermajor</p>
                    </div>
                </div>

                <div class="section">
                    <h3>Key Features</h3>
                    <ul>
                        <li><strong>Scale Editor:</strong> Interactive 53-TET wheel for editing interval distances</li>
                        <li><strong>Chord Buttons:</strong> Click any chord to hear and explore its voicing</li>
                        <li><strong>Grid:</strong> 8x8 grid interface for exploring modal substitutions</li>
                        <li><strong>Voicing Editor:</strong> Spiral visualization for chord voicing control</li>
                        <li><strong>MIDI Integration:</strong> MPE support through custom MaxForLive Bridge</li>
                    </ul>
                </div>

                <div class="section">
                    <h3>Computer Keyboard Mapping</h3>
                    <p>
                        When you click a chord, the computer keyboard keys are automatically mapped to the corresponding scale:
                    </p>
                    <ul>
                        <li><strong>z, s, x, d, c, v, g, b, h, n, j, m, ,</strong> - 13-note chromatic scale based on clicked chord</li>
                        <li><strong>&lt;</strong> - Shift octave down</li>
                        <li><strong>&gt;</strong> - Shift octave up</li>
                    </ul>
                </div>

                <div class="section">
                    <h3>Learn More</h3>
                    <p>
                        For detailed information about the system and its mathematical foundation, see our NIME 2025 paper:
                    </p>
                    <p>
                        <a href="https://nime.org/proceedings/2025/nime2025_33.pdf" target="_blank" class="paper-link">
                            "A Computer Application to Explore 53-Tone Equal Temperament Harmonies Through Modal Interchange"
                        </a>
                    </p>
                </div>

                <div class="section citation-section">
                    <h3>Citation</h3>
                    <p class="citation-text">
                        Dalmazzo, David, Ken Déguernel, and Bob LT Sturm. "A Computer Application to Explore 53-Tone Equal Temperament Harmonies Through Modal Interchange." <em>New Interfaces for Musical Expression</em>. 2025.
                    </p>
                </div>
            </div>

            <button class="close-button">×</button>
        `;

        this.overlay.appendChild(panel);
        document.body.appendChild(this.overlay);

        // Hide initially
        this.overlay.style.display = 'none';

        // Setup close button
        const closeButton = this.overlay.querySelector('.close-button');
        closeButton.addEventListener('click', () => this.hide());

        // Close on backdrop click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    createInfoButton() {
        this.infoButton = document.getElementById('modalstudio-info-button');
        
        if (this.infoButton) {
            this.infoButton.addEventListener('click', () => {
                if (this.isVisible) {
                    this.hide();
                } else {
                    this.show();
                }
            });
        }
    }

    show() {
        if (this.overlay) {
            this.overlay.style.display = 'flex';
            this.isVisible = true;
            
            // Add active class to button
            if (this.infoButton) {
                this.infoButton.classList.add('active');
            }
        }
    }

    hide() {
        if (this.overlay) {
            this.overlay.style.display = 'none';
            this.isVisible = false;
            
            // Remove active class from button
            if (this.infoButton) {
                this.infoButton.classList.remove('active');
            }
        }
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
}

// Create global instance when DOM is ready
window.addEventListener('load', () => {
    window.modalStudioInfoOverlay = new ModalStudioInfoOverlay();
});
