// modal_studio_sketch.js
// P5.js sketch initialization and event handlers

// p5.js sketch - uses OfApp class from modal_studio_main.js
const sketch = (p) => {
    let app;
    const MIN_WIDTH = 1330;
    const MIN_HEIGHT = 1000;
    
    p.setup = async () => {
        const w = Math.max(p.windowWidth, MIN_WIDTH);
        const h = Math.max(p.windowHeight, MIN_HEIGHT);
        p.createCanvas(w, h);
        p.textFont('Source Code Pro');
        app = new OfApp();
        
        // Set up scene toggle button handler
        let isModalScene = true;
        const toggleButton = document.getElementById('sceneToggle');
        const sceneLabel = document.getElementById('sceneLabel');
        const audioToggle = document.getElementById('audioToggle');
        const audioLabel = document.getElementById('audioLabel');
        const audioGuiContainer = document.getElementById('audio-gui-container');
        
        toggleButton.addEventListener('click', () => {
            isModalScene = !isModalScene;
            if (isModalScene) {
                app.setScene('chord');
                sceneLabel.textContent = 'Modal Interchange';
            } else {
                app.setScene('grid');
                sceneLabel.textContent = 'Modal Scene';
            }
        });
        
        // Hide audio GUI by default
        audioGuiContainer.style.display = 'none';
        
        audioToggle.addEventListener('click', () => {
            if (audioGuiContainer.style.display === 'none') {
                audioGuiContainer.style.display = 'block';
                audioLabel.textContent = 'Audio Settings: Hide';
            } else {
                audioGuiContainer.style.display = 'none';
                audioLabel.textContent = 'Audio Settings: Show';
            }
        });
        
        await app.loadJSONData('53_reference_notes.json');
        app.setupReferenceMap();
        app.generateAllModes(p);
        
        // Initialize audio on first click (browsers require user interaction)
        document.addEventListener('click', async () => {
            if (!app.audioEngine.audioInitialized) {
                await app.audioEngine.initAudio();
                console.log('🔊 Audio system ready');
            }
        }, { once: true });
        
        // Initialize MIDI controller
        setTimeout(async () => {
            if (typeof MIDIController !== 'undefined') {
                window.midiController = new MIDIController();
                const initialized = await window.midiController.initialize();
                if (initialized) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    console.log('🎹 MIDI Controller ready');
                    console.log('Available devices:', window.midiController.getOutputDevices());
                    
                    // Show MIDI button
                    const midiButton = document.getElementById('midiToggle');
                    if (midiButton) {
                        midiButton.style.display = 'flex';
                        midiButton.addEventListener('click', () => {
                            window.midiController.toggleUI();
                        });
                    }
                    console.log('MIDI integration ready');
                }
            }
            
            // Initialize MIDI Piano
            if (typeof MIDIPianoHandler !== 'undefined') {
                window.midiPianoHandler = new MIDIPianoHandler();
            }
        }, 400);
        
        // Set ADSR to light mode
        setDark(false);
        
        // Make app global for debugging
        window.app = app;
        
        // Expose playNote globally for MIDI piano
        window.playNote = (freq) => app.playNote(freq);

        // Grid debugging helpers
        window.testGrid = () => {
            const grid = app.grid;
            console.log('=== GRID INTEGRITY TEST ===');
            console.log('Total cells:', grid.cells.length, '(expected 64)');
            console.log('Chord progression length:', grid.chordProgression.length, '(expected 8)');
            console.log('Selected cell:', grid.selectedCellRow, grid.selectedCellCol);
            console.log('Scale size:', grid.scale.length);
            console.log('Modes count:', grid.modes.length);
            
            // Test cell calculations
            for (let test = 0; test < 5; test++) {
                const row = Math.floor(Math.random() * 8);
                const col = Math.floor(Math.random() * 8);
                const index = row * 8 + col;
                const backRow = Math.floor(index / 8);
                const backCol = index % 8;
                console.log(`Test ${test+1}: (${row},${col}) -> idx:${index} -> (${backRow},${backCol}) ${row===backRow && col===backCol ? '✓' : '✗'}`);
            }
            
            // Verify chord progression references row 0
            let progressionValid = true;
            for (let col = 0; col < 8; col++) {
                const expectedCell = grid.cells[col]; // row 0, so index = col
                const actualCell = grid.chordProgression[col];
                if (expectedCell !== actualCell) {
                    console.error(`❌ Chord progression[${col}] does not reference cells[${col}]`);
                    progressionValid = false;
                }
            }
            if (progressionValid) {
                console.log('✓ Chord progression correctly references row 0');
            }
            
            console.log('======================');
        };
        
        window.selectCell = (row, col) => {
            console.log(`Selecting cell (${row},${col})`);
            const grid = app.grid;
            const x = grid.globalPosition.x + col * (grid.cellWidth + grid.cellSpacingX) + 10;
            const y = grid.globalPosition.y + row * (grid.cellHeight + grid.cellSpacingY) + 10;
            grid.mousePressed(x, y);
        };
    };
    
    p.draw = () => {
        if (app) {
            app.draw(p);
        }
    };
    
    p.mousePressed = () => {
        if (app) {
            app.mousePressed(p.mouseX, p.mouseY);
        }
    };
    
    p.mouseDragged = () => {
        if (app) {
            app.mouseDragged(p.mouseX, p.mouseY);
        }
    };
    
    p.mouseReleased = () => {
        if (app) {
            app.mouseReleased(p.mouseX, p.mouseY);
        }
    };
    
    p.windowResized = () => {
        const w = Math.max(p.windowWidth, MIN_WIDTH);
        const h = Math.max(p.windowHeight, MIN_HEIGHT);
        p.resizeCanvas(w, h);
        if (app) {
            app.updatePositions(p);
        }
    };
};

// Initialize p5 sketch
new p5(sketch, 'canvas-container');
