// Mode.js - Direct port from C++ Mode.cpp
class Mode {
    constructor() {
        this.scale = [];
        this.chords = [];
        this.modeName = '';
        this.modeNumber = 0;
        this.scaleLength = 7;
        this.posChord = { x: 0, y: 0 };
        this.chordSize = { x: 160, y: 50 };
        this.chordDistances = {x: 5, y: 5};
        this.roundedCorners = 10;
        this.modeFunction = {
            mode: '',
            chordQualities: []
        };
        this.selectedChordIndex = -1; // C++ Mode.hpp line 62
    }
    
    // C++: void Mode::setup(int x, int y, int size_x, int size_y, int round, const vector<int>& theScale, const vector<string>& names)
    setup(x, y, sizeX, sizeY, round, theScale, names) {
        this.posChord = { x: x, y: y };
        this.chordSize = { x: sizeX, y: sizeY };
        this.scale = [];
        this.roundedCorners = round;
        // Populate the scale
        for (let i = 0; i < theScale.length; i++) {
            const note = new Note();
            note.ft_note = theScale[i];
            note.localInterval = ((i % this.scaleLength) + 1) + (Math.floor(i / this.scaleLength) * this.scaleLength);
            if (i < names.length) {
                note.name = names[i];
            }
            this.scale.push(note);
        }
        
        // Set the chords
        this.setChords(this.posChord, this.scale);
    }
    
    // C++: void Mode::setChords(glm::vec2 chordPos, vector<Note> scale)
    setChords(chordPos, scale) {
        this.chords = [];
        
        for (let i = 0; i < this.scaleLength; i++) {
            const chord = new Chord();
            
            // Set position
            const x = chordPos.x + (i * (this.chordSize.x + 3));
            chord.pos = { x: x, y: chordPos.y };
            chord.size = { x: this.chordSize.x, y: this.chordSize.y };
            chord.setRound(this.roundedCorners);
            // Get notes from scale (C++ Mode.cpp lines 211-223)
            const subScale = [];
            for (let j = i; j < scale.length; j++) {
                const note = new Note();
                note.ft_note = scale[j].ft_note;
                note.name = scale[j].name;
                note.interval = (j - i) + 1;
                note.localInterval = i + 1;
                subScale.push(note);
            }
            
            chord.setNotes(subScale);
            chord.setChordQuality();
            chord.numVoicing = i; // Set voicing based on chord degree (I, II, III, etc.)
            chord.voicing(i); // Generate voicing
            this.chords.push(chord);
        }
    }
    
    // C++: void Mode::updateScale(const vector<int>& newScaleReference, const vector<string>& newNames)
    updateScale(newScaleReference, newNames) {
        this.scale = [];
        
        for (let i = 0; i < newScaleReference.length; i++) {
            const note = new Note();
            note.ft_note = newScaleReference[i];
            note.localInterval = ((i % this.scaleLength) + 1) + (Math.floor(i / this.scaleLength) * this.scaleLength);
            if (i < newNames.length) {
                note.name = newNames[i];
            }
            this.scale.push(note);
        }
        
        this.updateChords();
    }
    
    // C++: void Mode::updateChords()
    updateChords() {
        if (this.chords.length === 0 || this.scale.length === 0) return;
        
        for (let i = 0; i < this.chords.length && i < this.scaleLength; i++) {
            const subScale = [];
            for (let j = i; j < this.scale.length; j++) {
                const note = new Note();
                note.ft_note = this.scale[j].ft_note;
                note.name = this.scale[j].name;
                note.interval = (j - i) + 1;
                note.localInterval = i + 1;
                subScale.push(note);
            }
            
            // Store previous quality for comparison
            const prevQuality = this.chords[i].getChordQuality();
            
            this.chords[i].setNotes(subScale);
            this.chords[i].setChordQuality();
            this.chords[i].voicing(i); // Regenerate voicing
            
            const newQuality = this.chords[i].getChordQuality();
            if (prevQuality !== newQuality) {
                //console.log(`  Chord ${i+1} (${this.modeName}): ${prevQuality} → ${newQuality}`);
            }
        }
    }
    
    setMode(num) {
        this.modeNumber = num;
    }
    
    setModeName(name) {
        this.modeName = name;
    }
    
    // C++: void Mode::draw() - case CHORDS
    draw(p, mouseX, mouseY) {
        // Check hover state for all chords
        for (let i = 0; i < this.chords.length; i++) {
            this.chords[i].checkHover(mouseX, mouseY);
        }
        
        // Draw chords
        for (let i = 0; i < this.chords.length; i++) {
            const x = this.posChord.x + (i * (this.chordSize.x + this.chordDistances.x));
            const y = this.posChord.y + this.chordDistances.y;
            this.chords[i].draw(p, x, y, this.chordSize.x, this.chordSize.y);
        }
        
        // Draw mode name on the right
        p.fill(0);
        p.noStroke();
        p.textAlign(p.LEFT, p.CENTER);
        p.textSize(14);
        const nameX = this.posChord.x + (this.chordSize.x * this.scaleLength) + this.chordDistances.x * 5;
        p.text(`- ${this.modeName}`, nameX + this.chordDistances.x, this.posChord.y + this.chordSize.y / 2 + this.chordDistances.y);
    }
    
    // Handle mouse press on chords
    mousePressed(mouseX, mouseY) {
        // C++ Mode.cpp lines 308-329
        const previousSelected = this.selectedChordIndex;
        this.selectedChordIndex = -1;
        
        for (let i = 0; i < this.chords.length; i++) {
            if (this.chords[i].checkHover(mouseX, mouseY)) {
                this.chords[i].setChordClicked(true);
                this.selectedChordIndex = i; // C++ Mode.cpp line 328
                console.log(`✓ Mode (${this.modeName}): selectedChordIndex=${this.selectedChordIndex}`);
                return true;
            }
        }
        return false;
    }
    
    // Handle mouse release on chords
    mouseReleased() {
        for (let i = 0; i < this.chords.length; i++) {
            this.chords[i].setChordClicked(false);
        }
    }
    
    // Get mode function with chord qualities
    getModeFunction() {
        // Update modeFunction with current chord qualities
        this.updateModeFunction();
        return this.modeFunction;
    }
    
    // Update modeFunction with current chord qualities from chords
    updateModeFunction() {
        this.modeFunction.mode = this.modeName;
        this.modeFunction.chordQualities = [];
        
        // Extract chord quality and notes from each chord
        for (let i = 0; i < this.chords.length; i++) {
            const chord = this.chords[i];
            const quality = chord.getChordQuality();
            const notes = chord.getNotes();
            
            // Create ChordQuality object matching C++ structure
            const chordQuality = {
                id: quality ? quality.id : i + 1,
                name: quality ? quality.name : '',
                notes: notes || [],
                intervals: quality ? quality.intervals : []
            };
            
            this.modeFunction.chordQualities.push(chordQuality);
        }
    }
    
    // C++ Mode.cpp lines 173-177 - setInversions method
    setInversions(refInversion) {
        //console.log(`🎵 Mode.setInversions(${refInversion}), chords.length:`, this.chords.length);
        for (let i = 0; i < this.chords.length; i++) {
            //console.log(`  🎵 Mode: Calling chords[${i}].handleInversions(${refInversion})`);
            this.chords[i].handleInversions(refInversion);
        }
    }
    
    // C++ Mode.cpp lines 132-139 - updateSelectedChordVoicing method
    updateSelectedChordVoicing(newVoicing) {
        // If no chord is selected, do nothing
        if (this.selectedChordIndex < 0 || this.selectedChordIndex >= this.chords.length) {
            console.log(`⚠️ Mode.updateSelectedChordVoicing: invalid selectedChordIndex=${this.selectedChordIndex}`);
            return;
        }
        
        console.log(`📝 Mode.updateSelectedChordVoicing: updating chord ${this.selectedChordIndex}`);
        // Update the chord's voicing using the correct method
        this.chords[this.selectedChordIndex].updateVoicing(newVoicing);
        this.chords[this.selectedChordIndex].setChordQualityFromVoicing(newVoicing);
    }
}
