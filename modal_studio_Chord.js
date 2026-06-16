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

// Chord.js - Direct port from C++ Chord.cpp
class Chord {
    // C++ Chord.cpp lines 12-20 - Modal base colors (static)
    static modalBaseColors = [
        [200, 200, 200],  // I   - Tonic
        [210, 210, 210],  // II  - Supertonic
        [220, 220, 220],  // III - Mediant
        [230, 230, 230],  // IV  - Subdominant
        [240, 240, 240],  // V   - Dominant
        [250, 250, 250],  // VI  - Submediant
        [255, 255, 255]   // VII - Leading tone
    ];

    // Microtonal third-quality → name-token, matching the lookup-table symbols.
    // Used to name triads (and any combo the 7th-chord table doesn't cover).
    static THIRD_SYMBOL = {
        supermajor: 'SM', upmajor: '^M', major: 'M', downmajor: 'vM',
        neutralmajor: 'N', neutralminor: 'n', upminor: '^m', minor: 'm',
        downminor: 'vm', subminor: 'sm',
        neutral: 'N'  // 31-EDO single neutral third (53 splits into neutralmajor/neutralminor)
    };
    
    constructor() {
        this.notes = [];
        this.quality = ''; // String representation (e.g., "Cmaj7")
        this.root = null;
        this.pos = { x: 0, y: 0 };
        this.size = { x: 160, y: 50 };
        this.noteVoicing = [];
        this.numVoicing = 0;
        this.voicingType = 0; // Which voicing template (0-6) is being used - preserves across note changes
        this.chordFunction = 'I'; // Roman numeral function (I, II, III, etc.)
        this.globalInversion = 0; // Inversion state (0=root, 1=first, 2=second, etc.)
        this.previousVoicing = []; // C++ Chord.hpp line 191 - for voice leading
        this.info = ''; // Display text for Empty, Drop Here, Clean, etc.
        this.myTextSize = 12;

        // ChordQuality struct (C++ Chord.hpp lines 17-39)
        this.chordQuality = {
            note: '',
            quality: '',
            function: 'I',
            inversion: 0,
            notes: [],
            id: 1,
            name: '' // Full chord name (e.g., "Cmaj7")
        };
        
        // Voicing arrays (1-indexed positions into the chord's own scale stack, so
        // 1/8/15 = the chord ROOT at C0/C1/C2 register and anything else is another
        // degree — the bass position must stay ≡ 1 (mod 7) or the chord gets the
        // wrong root in the bass (e.g. Dm7 over C). Only v1's bass was raised an
        // octave (8 → 15, C1 → C2) to close the gap to its cluster; v2–v7 keep the
        // original C++ formation, where the bass is already just below the cluster
        // (v2–v4) or an intentional deep doubled-root form (v5–v7).
        // Voicing templates from the active temperament (53 keeps these exact defaults; 31 is
        // tighter). Fallback to the 53 set if the temperament defines none.
        const _V = (window.Temperament && window.Temperament.active && window.Temperament.active.voicings) ||
            [[8,17,19,21,22],[8,14,17,19,22],[8,14,17,19,21],[8,12,14,17,19,21],[1,8,12,14,17,19],[1,7,12,14,17,19],[1,7,10,12,14,17]];
        this.voicing_1 = [..._V[0]];
        this.voicing_2 = [..._V[1]];
        this.voicing_3 = [..._V[2]];
        this.voicing_4 = [..._V[3]];
        this.voicing_5 = [..._V[4]];
        this.voicing_6 = [..._V[5]];
        this.voicing_7 = [..._V[6]];
        
        // C++ Chord.hpp line 192 - potential positions for 9th in upper register
        this.upperNinth = [23, 27];
        
        // C++ Chord.hpp lines 202-203, 213-216 - hover and click states
        this.mouseHoverCheck = false;
        this.mouseClicked = false;
        this.defaultColor = [240, 240, 240];
        this.hoverColor = [255, 255, 255];
        this.chordClicked = [255, 200, 0];
        this.rounded = 10;
        this.alpha = 255;
    }
    
    // C++: void Chord::setNotes(vector<Note> subScale)
    // C++ Chord.cpp lines 218-226: setNotes
    setNotes(subScale) {
        this.notes = subScale; // C++ line 219: notes = inNotes
        this.chordQuality.notes = subScale; // C++ line 220
        // C++ line 223-225: Set root_53 to first note
        if (subScale.length > 0) {
            this.root = subScale[0];
            this.root_53 = subScale[0]; // C++ line 224: root_53 = notes.at(0)
        }
    }
    
    // C++ Chord.hpp line 91: void setRoot53(Note noteRef)
    setRoot53(noteRef) {
        this.root_53 = noteRef;
        this.note_53 = noteRef.ft_note;
    }
    
    // C++ Chord.cpp lines 269-278 - Get note name from note number
    getNoteName(noteNumber) {
        // Given a reference note number, get the note name
        for (const note of this.notes) {
            if (note.ft_note === noteNumber) {
                return note.name;
            }
        }
        return "Unknown";
    }
    
    // C++ Chord.cpp lines 134-144 - Get base color for modal function
    getModalBaseColor(chordFunction) {
        const degreeMap = {
            'I': 0, 'II': 1, 'III': 2, 'IV': 3,
            'V': 4, 'VI': 5, 'VII': 6, 'VIII': 7
        };
        
        const index = degreeMap[chordFunction] !== undefined ? degreeMap[chordFunction] : 0;
        return Chord.modalBaseColors[index];
    }
    
    // C++ Chord.cpp lines 146-152 - Check if color needs white text
    needsWhiteText(color) {
        const luminance = (0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2]) / 255.0;
        const alpha = (color.length > 3 ? color[3] : 255) / 255.0;
        const adjustedLuminance = luminance * alpha + (1.0 - alpha);
        return adjustedLuminance < 0.6;
    }
    
    // C++ Chord.cpp lines 155-214 - Tint base color by chord quality ----------------------------------------
    tintForQuality(baseColor, quality) {
        let result = [...baseColor];
        const blendFactor = 0.1;
        let qualityColor;
        
        // Dominant seventh family
        if (quality.includes("Mm7") || quality === "Mm7") {
            qualityColor = [233, 233, 233, 1]; // rgba(233, 233, 233, 1)
        }
        // Major seventh family 
        else if (quality.includes("maj7")) {
            qualityColor = [255, 190, 0, 1]; // rgba(255, 160, 0, 1)
        }
        // Major family
        else if (quality.includes("M")) {
            qualityColor = [255, 140, 0, 1]; // rgba(255, 98, 0, 1)
        }
        // Up-major family
        else if (quality.includes("^M")) {
            qualityColor = [255, 140, 0, 1]; // rgba(255, 140, 0, 1)
        }

        // minor Neutral family 
        else if (quality.includes("n")) {
            qualityColor = [200, 200, 200, 1]; // rgba(200, 200, 200, 1)
        }

        // major Neutral family 
        else if (quality.includes("N")) {
            qualityColor = [222, 222, 222, 1]; // rgba(222, 222, 222, 1)
        }
        // Down-minor family 
        else if (quality.includes("vm")) {
            qualityColor = [0, 200, 255, 1]; // rgba(0, 200, 255, 1) - cyan
        }
        // Minor family 
        else if (quality.includes("m") || quality.includes("m_")) {
            qualityColor = [0, 150, 255, 1]; // rgba(0, 150, 255, 1) - blue
        }
        // Augmented family
        else if (quality.includes("aug")) {
            qualityColor = [118, 118, 118, 1]; // rgba(118, 118, 118, 1)
        }
        else {
            qualityColor = [118, 118, 118, 1]; //Default
        }
        
        // Blend base color with quality color
        // result[0] = baseColor[0] * (1 - blendFactor) + qualityColor[0] * blendFactor;
        // result[1] = baseColor[1] * (1 - blendFactor) + qualityColor[1] * blendFactor;
        // result[2] = baseColor[2] * (1 - blendFactor) + qualityColor[2] * blendFactor;
        result[0] = qualityColor[0];
        result[1] = qualityColor[1];
        result[2] = qualityColor[2];
        result[3] = qualityColor[3] * 200;
        
        // Apply modifiers
        if (quality.includes("S")) {
            result[0] = Math.min(255, result[0] + 15);
            result[1] = Math.min(255, result[1] + 10);
        }
        if (quality.includes("sm")) {
            result[2] = Math.min(255, result[2] + 20);
        }
        if (quality.includes("N")) {
            result[0] = Math.min(255, result[0] + 10);
            result[1] = Math.min(255, result[1] + 5);
        }
        if (quality.includes("*")) {
            result[2] = Math.min(255, result[2] + 20);
            result[1] = Math.min(255, result[1] + 10);
        }
        
        // Calculate hover color (shared brighten helper)
        this.hoverColor = this.deriveHoverColor(result);

        return result;
    }
    
    // C++ Chord.cpp lines 852-863 - Get chord color based on quality ----------------------------------------
    getChordColor() {
        if (this.notes.length === 0) {
            return this.defaultColor;
        }
        
        const baseColor = this.getModalBaseColor(this.chordFunction);
        return this.tintForQuality(baseColor, this.quality);
    }

    // ---- Chord-name helpers (shared by setChordQuality + setChordQualityFromVoicing) ----
    // Name the chord CORE. Prefers the C++ lookup-table token (`base`); when that
    // is empty — a triad, or any third/fifth combo the 7th-table doesn't cover —
    // it builds a triad name from the third + fifth so the chord is never left
    // unnamed. Diminished/augmented fifths get the usual o / b5 / + markers.
    qualityCore(base, thirdQuality, fifthQuality) {
        if (base) return base;
        const t = Chord.THIRD_SYMBOL[thirdQuality];
        if (!t) return '';
        if (fifthQuality === 'diminished') return t + (t.includes('m') ? 'o' : 'b5');
        if (fifthQuality === 'augmented')  return t + '+';
        return t; // perfect-fifth triad
    }

    // Append 9th / 11th / 13th to a core name from the actually-voiced intervals
    // (53-TET steps from the root). Mirrors the KL scene (keyboard.js
    // clusterChordNameExtended): the highest natural extension (13>11>9) folds
    // into the chord number by replacing a trailing 7 (maj7→maj9), and a no-7th
    // chord uses 'add'. Bands are kept clear of the core chord tones — root(0),
    // third(10-20), fifth(26-36), seventh(42-52) — so a subminor third (10), a
    // diminished fifth (26) or an augmented fifth (36) is never mistaken for an
    // extension (9th:3-9, 11th:21-25, 13th:37-41).
    qualityWithExtensions(core, intervalsFromRoot) {
        if (!core || !intervalsFromRoot || intervalsFromRoot.length === 0) return core;
        let nat9 = false, nat11 = false, nat13 = false, hasP5 = false, raised4 = false;
        const T = window.Temperament.active, xr = T.extensionRanges, L = T.landmarks;
        for (const raw of intervalsFromRoot) {
            const iv = T.mod(raw);
            if (iv >= xr.nat9.lo && iv <= xr.nat9.hi) nat9 = true;
            else if (iv >= xr.nat11.lo && iv <= xr.nat11.hi) nat11 = true;
            else if (iv >= xr.nat13.lo && iv <= xr.nat13.hi) nat13 = true;
            if (iv >= xr.p5.lo && iv <= xr.p5.hi) hasP5 = true;          // perfect 5th present
            if (iv === L.sharpEleventh) raised4 = true;                  // #11 (b5 distinct, a comma lower)
        }
        // #11 = a raised 11th (augmented 4th, step 27) ON TOP of a perfect 5th
        // (e.g. Cmaj7#11, the Lydian tonic). It is NOT a b5 — that's the diminished
        // 5th at step 26, a comma lower, handled by the core's fifth detection. 53-TET
        // keeps the two pitches distinct, so we only call 27 a #11 when a P5 is present.
        const sharp11 = raised4 && hasP5;
        const stack = nat13 ? '13' : nat11 ? '11' : nat9 ? '9' : null;
        let name = core;
        if (stack) {
            name = /7\*?$/.test(core) ? core.replace(/7(\*?)$/, stack + '$1') : core + 'add' + stack;
        }
        if (sharp11) name += '#11';
        return name;
    }

    // C++: void Chord::setChordQuality() - EXACT logic from Chord.cpp lines 722-850 ------------------------------
    setChordQuality() {
        // C++ line 931: Store original voicing to preserve it
        const originalVoicing = [...this.noteVoicing];
        const hadVoicing = originalVoicing.length > 0;
        
        // C++ Chord.cpp lines 933-945: Handle empty or invalid chord
        if (this.notes.length < 3) {
            this.quality = "Empty";
            this.chordFunction = "Empty";
            this.chordQuality.note = "Empty";
            this.chordQuality.quality = "Empty";
            this.chordQuality.function = "Empty";
            this.chordQuality.id = -1;
            this.chordQuality.notes = [];
            this.noteVoicing = [];
            return;
        }
        
        // C++ Chord.cpp lines 950-952: Return to root position for quality analysis if needed
        if (this.globalInversion !== 0 && this.noteVoicing.length > 0) {
            this.setInversion(0);
        }
        
        // C++ interval maps from Chord.cpp lines 725-772
        const thirdIntervals = window.Temperament.active.thirdQualityMap;
        
        const fifthIntervals = window.Temperament.active.fifthQualityMap;
        
        const seventhIntervals = window.Temperament.active.seventhQualityMap;
        
        // C++ chord name lookup table from Chord.hpp lines 287-485 (COMPLETE)
        const chordNames = window.Temperament.active.chordNameTable;
        
        // C++ Chord.cpp line 962-964: Use root_53 (masterRoot) for interval calculation, not notes[0]
        const masterRoot = this.root_53;
        let thirdQuality = "unknown";
        let fifthQuality = "perfect";
        let seventhQuality = "unknown";
        
        // Calculate intervals from masterRoot (C++ determineChordQualities lines 775-793)
        if (this.notes.length >= 2) {
            const thirdInterval = this.notes[2].ft_note - masterRoot.ft_note;
            if (thirdIntervals[thirdInterval]) {
                thirdQuality = thirdIntervals[thirdInterval];
            }
        }
        
        if (this.notes.length >= 3) {
            const fifthInterval = this.notes[4].ft_note - masterRoot.ft_note;
            if (fifthIntervals[fifthInterval]) {
                fifthQuality = fifthIntervals[fifthInterval];
            }
        }
        
        if (this.notes.length >= 4) {
            const seventhInterval = this.notes[6].ft_note - masterRoot.ft_note;
            if (seventhIntervals[seventhInterval]) {
                seventhQuality = seventhIntervals[seventhInterval];
            }
        }
        
        // Build quality key and lookup (C++ lines 828-829). The table covers 7th
        // chords; qualityCore() fills in a triad name when the lookup is empty so
        // triads are no longer left unnamed.
        const qualityKey = `${thirdQuality}_${fifthQuality}_${seventhQuality}`;
        const coreQuality = this.qualityCore(chordNames[qualityKey] || "", thirdQuality, fifthQuality);

        // Debug: Log unknown chord qualities
        // if (!chordNames[qualityKey]) {
        //     console.warn(`⚠️ Unknown chord quality: "${qualityKey}" for chord with intervals:`, {
        //         third: this.notes.length >= 2 ? (this.notes[2].ft_note - this.root_53.ft_note) : 'N/A',
        //         fifth: this.notes.length >= 3 ? (this.notes[4].ft_note - this.root_53.ft_note) : 'N/A',
        //         seventh: this.notes.length >= 4 ? (this.notes[6].ft_note - this.root_53.ft_note) : 'N/A'
        //     });
        // }
        
        const rootName = this.notes[0].name.slice(0, -1); // Remove octave
        
        // C++ Chord.cpp lines 686-717 - Determine chord function (Roman numeral)
        const localInterval = this.notes[0].localInterval;
        const functionMap = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII' };
        const idMap = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7 };
        this.chordFunction = functionMap[localInterval] || 'I';

        // C++ line 967: If no voicing is provided, generate the default one.
        // Done BEFORE naming so 9/11/13 tones in the voiced notes (e.g. a 9th
        // added by checkAndAddNinth, or extensions from the Voicing Editor) can be
        // read into the chord name, the way the KL scene names what is sounding.
        if (!hadVoicing) {
            this.selectVoicingBasedOnFunction(this.chordFunction);
        }
        const rootFt = masterRoot.ft_note;
        const voicedIntervals = this.noteVoicing.map(ft => window.Temperament.active.mod(ft - rootFt));
        const displayQuality = this.qualityWithExtensions(coreQuality, voicedIntervals);

        // this.quality keeps the CORE token (stable input for the color tinting in
        // getChordColor); the displayed/stored name carries the extensions.
        this.quality = rootName + coreQuality;

        // Update ChordQuality struct (C++ Chord.cpp lines 686-717)
        this.chordQuality.note = rootName;
        this.chordQuality.quality = displayQuality;
        this.chordQuality.function = this.chordFunction;
        this.chordQuality.id = idMap[localInterval] || 1;
        this.chordQuality.notes = this.notes;
        this.chordQuality.inversion = this.globalInversion;
        this.chordQuality.name = rootName + displayQuality; // Full name

        // C++ Chord.cpp line 848 - Construct finalInfo with function in brackets (NO space before [)
        this.finalInfo = this.chordQuality.note + this.chordQuality.quality + '[' + this.chordQuality.function + ']';

        // C++ Chord.cpp lines 837-851 - Set default color based on quality
        this.defaultColor = this.getChordColor();
        
        // C++ Chord.cpp lines 976-978: Restore original inversion if needed
        if (this.globalInversion !== 0) {
            this.handleInversions(this.globalInversion);
        }
    }
    
    // C++ Chord.cpp lines 799-810: selectVoicingBasedOnFunction
    selectVoicingBasedOnFunction(chordRoot) {
        // Map chord functions to voicing numbers
        const voicingMap = {
            'I': 0, 'II': 1, 'III': 2, 'IV': 3, 'V': 4, 'VI': 5, 'VII': 6
        };
        
        if (voicingMap[chordRoot] !== undefined) {
            this.numVoicing = voicingMap[chordRoot];
            this.voicing(this.numVoicing);
        } else {
            this.numVoicing = 0;
            this.voicing(0);
        }
    }
    
    getChordQuality() {
        return this.chordQuality;
    }
    
    // C++ Chord.cpp lines 236-264 - Check and add ninth for voice leading
    checkAndAddNinth(baseVoicing) {
        const MAX_DISTANCE = 7;
        
        if (!this.previousVoicing || this.previousVoicing.length === 0) {
            return baseVoicing;
        }
        
        // Get the highest ft_note from previous voicing (previousVoicing contains ft_note values)
        const prevHighestNote = Math.max(...this.previousVoicing);
        
        // Get the highest ft_note from current voicing (convert positions to ft_notes)
        let currentHighestNote = 0;
        for (const pos of baseVoicing) {
            const ftNote = this.notes[pos - 1].ft_note;
            if (ftNote > currentHighestNote) {
                currentHighestNote = ftNote;
            }
        }
        
        // Try each ninth possibility
        for (const ninth of this.upperNinth) {
            const ninthFtNote = this.notes[ninth - 1].ft_note;
            
            // Check distance from previous highest note
            const distFromPrev = Math.abs(ninthFtNote - prevHighestNote);
            
            // Check distance from current highest note
            const distFromCurrent = Math.abs(ninthFtNote - currentHighestNote);
            
            if (distFromPrev <= MAX_DISTANCE || distFromCurrent <= MAX_DISTANCE) {
                baseVoicing.push(ninth);
                return baseVoicing;
            }
        }
        return baseVoicing;
    }
    
    // C++ Chord.cpp lines 367-408 - voicing selection
    voicing(type) {
        if (this.notes.length === 0) return;
        
        // Store the voicing type so we can regenerate after note changes
        this.voicingType = type;
        
        this.noteVoicing = [];
        let baseVoicing = [];
        
        // Get base voicing based on type
        switch(type) {
            case 0: baseVoicing = [...this.voicing_1]; break;
            case 1: baseVoicing = [...this.voicing_2]; break;
            case 2: baseVoicing = [...this.voicing_3]; break;
            case 3: baseVoicing = [...this.voicing_4]; break;
            case 4: baseVoicing = [...this.voicing_5]; break;
            case 5: baseVoicing = [...this.voicing_6]; break;
            case 6: baseVoicing = [...this.voicing_7]; break;
            default: baseVoicing = [...this.voicing_1];
        }
        
        // Check and add ninth if appropriate (C++ Chord.cpp line 399)
        baseVoicing = this.checkAndAddNinth(baseVoicing);
        
        // Convert 1-indexed positions to actual note references
        for (let i = 0; i < baseVoicing.length; i++) {
            const pos = baseVoicing[i] - 1; // Convert to 0-indexed
            if (pos < this.notes.length) {
                this.noteVoicing.push(this.notes[pos].ft_note);
            }
        }
    }
    
    getNoteVoicing() {
        return this.noteVoicing;
    }
    
    // C++ Chord.cpp lines 280-338 - setInversion method  
    setInversion(interval) {
        //console.log(`    🎵 setInversion(${interval}) ENTRY - voicing:`, this.noteVoicing.length, 'notes:', this.notes.length);
        
        if (this.noteVoicing.length === 0 || this.notes.length === 0) {
            //console.log('    ❌ setInversion: No voicing or notes, returning');
            return;
        }
        
        // C++ lines 295-301: Find root reference in notes array
        let ref = -1;
        for (let i = 0; i < this.notes.length; i++) {
            if (this.root_53 && this.root_53.ft_note === this.notes[i].ft_note) {
                ref = i - 1;
                break;
            }
        }
        
        //console.log(`    🎵 setInversion: ref=${ref}, root_53.ft_note=${this.root_53?.ft_note}`);
        
        if (interval === 0) {
            // C++ line 312-314: Restore the original root
            this.noteVoicing[0] = this.root_53.ft_note;
            this.finalInfo = this.chordQuality.note + this.chordQuality.quality + '[' + this.chordQuality.function + ']';
            //console.log(`    ✅ setInversion: ROOT POSITION - finalInfo="${this.finalInfo}"`);
        } else if (interval > 0) {
            // C++ line 317-318: Replace bass note with the interval note
            // Note: ref can be -1 when root is at index 0, so ref+interval gives the correct position
            this.noteVoicing[0] = this.notes[ref + interval].ft_note;
            
            // C++ line 319: Get the new root name
            const newRoot = this.getNoteName(this.notes[ref + interval].ft_note);
            
            // C++ line 322: Remove octave number (e.g., "E1" -> "E")
            const newRootName = newRoot.substring(0, newRoot.length - 1);
            
            // C++ line 325: Update finalInfo with slash notation
            this.finalInfo = this.chordQuality.note + this.chordQuality.quality + '/' + newRootName + '[' + this.chordQuality.function + ']';
            //console.log(`    ✅ setInversion: INVERSION ${interval} - finalInfo="${this.finalInfo}"`);
        }
    }
    
    // C++ Chord.cpp lines 340-368 - handleInversions method
    handleInversions(inversion) {
        //console.log('🎵 handleInversions ENTRY - inversion:', inversion, 'notes:', this.notes.length, 'voicing:', this.noteVoicing.length);
        if (this.notes.length > 0 && this.noteVoicing.length > 0) {
            //console.log('✅ handleInversions proceeding');
            // Map inversion wheel positions to interval positions
            if (inversion === 0) {
                this.setInversion(0);  // Root position
            } else if (inversion === 1) {
                this.setInversion(3);  // Third
            } else if (inversion === 2) {
                this.setInversion(4);  // Fourth
            } else if (inversion === 3) {
                this.setInversion(5);  // Fifth
            } else if (inversion === 4) {
                this.setInversion(7);  // Seventh
            } else if (inversion === 5) {
                this.setInversion(2);  // Ninth
            }
        }
    }
    
    // C++: void Chord::draw() - lines 980-1025
    draw(p, x, y, sizeX, sizeY) {
        // Store position for hit testing
        this.pos = { x, y };
        this.size = { x: sizeX, y: sizeY };
        
        // Determine fill color based on state (C++ lines 983-1000)
        let fillColor;
        if (this.mouseHoverCheck && this.mouseClicked) {
            fillColor = this.chordClicked;
            // Draw pressed state outline
            p.stroke(250);
            p.strokeWeight(1);
            p.noFill();
            p.rect(x, y, sizeX, sizeY, this.rounded);
        } else if (this.mouseHoverCheck) {
            fillColor = this.hoverColor;
        } else {
            fillColor = this.defaultColor;
        }
        
        // Draw button with state-based color
        // Use alpha channel if present (fillColor[3]), otherwise default to 255 (opaque)
        if (fillColor.length > 3) {
            p.fill(fillColor[0], fillColor[1], fillColor[2], fillColor[3]);
        } else {
            p.fill(fillColor[0], fillColor[1], fillColor[2]);
        }
        p.stroke(255);
        p.strokeWeight(1);
        p.rect(x, y, sizeX, sizeY, this.rounded);
        
        // Draw chord quality text (C++ Chord.cpp lines 1010-1020)
        // Use info first (for "Empty", "Drop Here", "Clean"), then finalInfo (quality with function), then quality
        const displayText = (this.info && this.info.length > 0) ? this.info : (this.finalInfo || this.quality);
        
        // Use white text on dark backgrounds, black text on light backgrounds
        const textColor = this.needsWhiteText(fillColor) ? 255 : 0;
        p.fill(textColor);
        p.noStroke();
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(this.myTextSize);
        
        // Check if displayText contains function notation [I], [II], etc.
        const functionMatch = displayText.match(/^(.+)\[(.+)\]$/);
        if (functionMatch) {
            // Split chord quality and function
            const chordPart = functionMatch[1]; // e.g., "Cmaj7" or "Cmaj7/E"
            const functionPart = '[' + functionMatch[2] + ']'; // e.g., "[I]"
            
            // Draw chord quality slightly above center
            p.text(chordPart, x + sizeX / 2, y + sizeY / 2 - 5);
            
            // Draw function below in smaller text
            p.textSize(this.myTextSize * 0.75);
            p.text(functionPart, x + sizeX / 2, y + sizeY / 2 + 8);
        } else {
            // Single line text (for "Empty", "Drop Here", etc.)
            p.text(displayText, x + sizeX / 2, y + sizeY / 2);
        }
    }
    
    // C++ Chord.hpp line 202 - check if mouse is over button
    checkHover(mouseX, mouseY) {
        this.mouseHoverCheck = mouseX >= this.pos.x && 
                               mouseX <= this.pos.x + this.size.x &&
                               mouseY >= this.pos.y && 
                               mouseY <= this.pos.y + this.size.y;
        return this.mouseHoverCheck;
    }
    
    // C++ Chord.hpp line 92 - set clicked state
    setChordClicked(isClicked) {
        this.mouseClicked = isClicked;
    }
    
    // C++ Chord.hpp line 65 - get clicked state
    isClicked() {
        return this.mouseClicked;
    }
    
    // C++ Chord.cpp lines 103-118 - updateVoicing method
    updateVoicing(newVoicing, extTags) {
        // Store the new voicing positions
        this.noteVoicing = newVoicing;
        // Persist which positions are tagged 9/11/13 extensions (absoluteTET →
        // extType). This lives WITH the voicing so the flags survive a chord switch:
        // without it, leaving a chord and returning drops the flags and the 9/11/13
        // buttons stack infinite duplicates. extTags is recomputed on every edit, so
        // an empty/absent map correctly means "no button extensions".
        this.extTags = extTags || {};

        // Update root_53 if needed based on first note
        if (newVoicing.length > 0 && this.notes.length > 0) {
            for (const note of this.notes) {
                if (note.ft_note === newVoicing[0]) {
                    this.root = note;
                    break;
                }
            }
        }
        //console.log('Updated voicing:', newVoicing);
    }
    
    // C++ Chord.cpp lines 882-926 - setChordQualityFromVoicing method
    setChordQualityFromVoicing(voicing) {
        //console.log('--------------------------------');
        //console.log('Setting chord quality from voicing:', voicing);
        
        // Track if a valid voicing was provided
        const hasVoicing = voicing && voicing.length > 0;
        
        if (!this.root_53 || voicing.length === 0 || this.notes.length === 0) return;
        
        let theRootReference = this.root_53.ft_note % window.Temperament.active.N;
        if (theRootReference < 0) theRootReference += window.Temperament.active.N;
        
        // Normalize voicing to intervals from root
        let normalizedVoicing = [];
        for (let i = 0; i < voicing.length; i++) {
            let noteNum = voicing[i] % window.Temperament.active.N;
            let interval = noteNum - theRootReference;
            if (interval < 0) interval += window.Temperament.active.N;
            normalizedVoicing.push(interval);
        }
        
        //console.log('Normalized intervals:', normalizedVoicing);
        
        // Interval maps (same as in setChordQuality)
        const thirdIntervals = window.Temperament.active.thirdQualityMap;
        const fifthIntervals = window.Temperament.active.fifthQualityMap;
        const seventhIntervals = window.Temperament.active.seventhQualityMap;
        
        // Chord name lookup table (complete table from C++ Chord.hpp lines 287-485)
        const chordNames = window.Temperament.active.chordNameTable;
        
        let thirdQuality = "unknown";
        let fifthQuality = "perfect";
        let seventhQuality = "unknown";
        
        // Prefer the perfect 5th: a note at 26/27 alongside a perfect 5th is a #11
        // (an upper extension, named by qualityWithExtensions), NOT a diminished 5th.
        // Without this, Cmaj7#11 would mislabel as a b5 chord.
        // Classification windows are temperament-specific (53 fell outside in 31, collapsing
        // every name). VR.third/fifth/seventh/p5 come from the active temperament.
        const VR = window.Temperament.active.voicingRanges;
        const inR = (iv, r) => iv >= r[0] && iv <= r[1];
        const hasPerfectFifth = normalizedVoicing.some(iv => inR(iv, VR.p5));

        // Find qualities based on intervals
        for (const interval of normalizedVoicing) {
            if (inR(interval, VR.third) && thirdIntervals[interval]) {
                thirdQuality = thirdIntervals[interval];
            }
            if (inR(interval, VR.fifth) && fifthIntervals[interval]) {
                // If a perfect 5th exists, only let perfect-5th intervals set the 5th
                // quality; the in-between note is then the #11, not the 5th.
                if (!hasPerfectFifth || inR(interval, VR.p5)) {
                    fifthQuality = fifthIntervals[interval];
                }
            }
            if (VR.seventh.some(r => inR(interval, r)) && seventhIntervals[interval]) {
                seventhQuality = seventhIntervals[interval];
            }
        }
        
        //console.log(`Qualities - Third: ${thirdQuality}, Fifth: ${fifthQuality}, Seventh: ${seventhQuality}`);
        
        // Build quality key and lookup chord name (C++ lines 917-920). qualityCore()
        // fills in a triad name when the 7th-table lookup is empty; qualityWithExtensions()
        // reads 9/11/13 directly from the voiced intervals (normalizedVoicing).
        const qualityKey = `${thirdQuality}_${fifthQuality}_${seventhQuality}`;
        const coreQuality = this.qualityCore(chordNames[qualityKey] || "", thirdQuality, fifthQuality);
        const displayQuality = this.qualityWithExtensions(coreQuality, normalizedVoicing);

        // Get root note name without octave
        const rootName = this.root.name.slice(0, -1);

        // C++ Chord.cpp lines 686-717 - Determine chord function (Roman numeral)
        const localInterval = this.notes[0].localInterval;
        const functionMap = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII' };
        const idMap = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7 };
        this.chordFunction = functionMap[localInterval] || 'I';

        // this.quality keeps the CORE token (stable input for color tinting); the
        // displayed/stored name carries the extensions.
        this.quality = rootName + coreQuality;

        // Update ChordQuality struct (matching setChordQuality logic)
        this.chordQuality.note = rootName;
        this.chordQuality.quality = displayQuality;
        this.chordQuality.function = this.chordFunction;
        this.chordQuality.id = idMap[localInterval] || 1;
        this.chordQuality.notes = this.notes;
        this.chordQuality.inversion = this.globalInversion;
        this.chordQuality.name = rootName + displayQuality; // Full name

        // C++ Chord.cpp line 848 - Construct finalInfo with function in brackets (NO space before [)
        this.finalInfo = this.chordQuality.note + this.chordQuality.quality + '[' + this.chordQuality.function + ']';
        
        // C++ Chord.cpp lines 968-970: If no voicing is provided, generate the default one
        if (!hasVoicing) {
            this.selectVoicingBasedOnFunction(this.chordQuality.function);
        }
        
        // C++ Chord.cpp lines 837-851 - Set default color based on quality
        this.defaultColor = this.getChordColor();
        
        // C++ Chord.cpp lines 974-977: Restore original inversion if needed
        //console.log('🔍 Before handleInversions check - globalInversion:', this.globalInversion, 'noteVoicing.length:', this.noteVoicing.length);
        if (this.globalInversion !== 0) {
            //console.log('✅ Calling handleInversions with:', this.globalInversion);
            this.handleInversions(this.globalInversion);
        } else {
            //console.log('❌ SKIPPED handleInversions - globalInversion is 0');
        }
        //console.log('--------------------------------');
    }
    
    // Helper methods for Grid integration
    setColor(color) {
        if (Array.isArray(color)) {
            this.defaultColor = color;
        } else {
            // p5 color object - extract RGB
            this.defaultColor = [color.levels[0], color.levels[1], color.levels[2]];
        }
        // Keep the hover tint in sync with the new base color so EVERY recolor
        // path (clean, column-clear, copy/paste, session-load …) gets a live,
        // non-stale hover. Same brighten (x1.1, alpha 225) the quality tints use.
        this.hoverColor = this.deriveHoverColor(this.defaultColor);
    }

    // Brighten a base RGB into the hover tint (shared by setColor + tintForQuality).
    deriveHoverColor(base) {
        return [
            Math.min(255, base[0] * 1.1),
            Math.min(255, base[1] * 1.1),
            Math.min(255, base[2] * 1.1),
            225
        ];
    }
    
    getColor() {
        return this.defaultColor;
    }
    
    getNotes() {
        return this.notes;
    }
    
    getInfo() {
        return this.quality;
    }
    
    setInfo(text) {
        this.info = text;
        this.quality = text;
        // Also update chordFunction to match C++ behavior (Chord.cpp lines 590-596)
        this.chordFunction = text;
    }
    
    setRound(rounded) {
        this.rounded = rounded;
    }
    
    getGlobalInversion() {
        return this.globalInversion;
    }
    
    // C++ Chord.hpp line 125: int getChordId(){return chordQuality.id;}
    getChordId() {
        return this.chordQuality.id;
    }
    
    // C++ Chord.hpp line 99: void setPreviousVoicing(const vector<int> &prevVoicing)
    setPreviousVoicing(prevVoicing) {
        this.previousVoicing = prevVoicing || [];
    }
    
    // C++ Chord.cpp line 100: vector<int> getNoteVoicing()
    getNoteVoicing() {
        return this.noteVoicing || [];
    }
    
    setGlobalInversion(inversion) {
        this.globalInversion = inversion;
    }
}
