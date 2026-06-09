// ============================================================================
// P5.JS AUDIO GUI - ADSR Envelope Editor (GLOBAL MODE)
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

const W = 320;
const H = 250;
const padding = 10;

// ADSR Section
const adsrTop = 100;
const adsrHeight = 140;

// Create wave type buttons
const btnW = 59;
const btnH = 25;
const spacing = 2;

let bgColor = 'rgba(55, 55, 55, 0.9)';
let buttonColor = 'rgba(15, 15, 15, 1)';
let buttonHoverColor = 'rgba(40, 40, 40, 1)';
let buttonActiveColor = 'rgba(0, 111, 229, 1)';
let adsrBackgroundColor = 'rgba(5, 5, 5, 1)';
let adsrGrid = 'rgba(70, 70, 70, 1)';

const round = 10;
const paddingWetDry = 100;

const pointSize = 10;

//Define the color
let textColor = 'rgba(250, 250, 250, 1)';

const textButtonSize = 10;
const textTitleSize = 12;

let darkMode = true;

// Top-right control buttons: close (×) hides the panel, mute (m) toggles audio.
// Close sits in the corner; mute immediately to its left.
const ctrlSize = 20;
let closeButton = { x: W - 20, y: 20, size: ctrlSize };
let muteButton  = { x: W - 20 - ctrlSize - 6, y: 20, size: ctrlSize, muted: false };

// Wave type buttons
const waveTypes = ['sine', 'triangle', 'sawtooth', 'square'];
let buttons = [];

// ADSR envelope points
let adsrPoints = [
    { x: padding, y: H, label: 'Start', draggable: false },  // NEW - at true bottom
    { x: 40, y: 60, label: 'A', draggable: true },
    { x: 200, y: 250, label: 'S', draggable: true },
    { x: W - padding, y: H, label: 'End', draggable: false }  // NEW - at true bottom
];

let draggingPoint = null;

let dryWetKnob = {
    x: W - paddingWetDry,
    y: 45,
    radius: 22,
    dragging: false
};

// ------------------------------------------------------------
function setDark(mode){
    darkMode = mode;
    if (darkMode) {
        bgColor = 'rgba(25, 25, 25, 0.9)';
        textColor = 'rgba(230, 230, 230, 1)';
        buttonColor = 'rgba(15, 15, 15, 1)';
        buttonHoverColor = 'rgba(40, 40, 40, 1)';
        buttonActiveColor = 'rgba(0, 111, 229, 1)';
        adsrBackgroundColor = 'rgba(5, 5, 5, 1)';
        adsrGrid = 'rgba(70, 70, 70, 1)';

    } else {
        bgColor = 'rgba(237, 236, 236, 0.9)';
        textColor = 'rgba(20, 20, 20, 1)';
        buttonColor = 'rgba(220, 220, 220, 1)';
        buttonHoverColor = 'rgba(200, 200, 200, 1)';
        buttonActiveColor = 'rgba(93, 190, 255, 1)';
        adsrBackgroundColor = 'rgba(224, 224, 224, 1)';
        adsrGrid = 'rgba(207, 207, 207, 1)';
    }
}

// ------------------------------------------------------------
function getCanvasSize(){
    return { width: W, height: H };
}

// ------------------------------------------------------------
// Check if audio GUI is visible
function isAudioGuiVisible() {
    // Check which scene we're in and verify the corresponding container is visible
    const eigenContainer = document.getElementById('eigenspace-audio-gui');
    const modalContainer = document.getElementById('modalstudio-audio-gui');
    const keyboardContainer = document.getElementById('keyboard-audio-gui');

    // Check EigenSpace container
    if (eigenContainer && eigenContainer.style.display !== 'none') {
        return true;
    }

    // Check Modal Studio container
    if (modalContainer && modalContainer.style.display !== 'none') {
        return true;
    }

    // Check Keyboard container
    if (keyboardContainer && keyboardContainer.style.display !== 'none') {
        return true;
    }

    return false;
}

// ------------------------------------------------------------
function setup() {

    textFont('Fira Code');
    smooth();

    let canvas = createCanvas(W, H);
    canvas.parent('eigenspace-audio-gui'); // Start in EigenSpace container
    
    // Expose canvas globally so it can be reparented between scenes
    window.adsrCanvas = canvas;
    
    // Initialize dark mode colors for EigenSpace
    setDark(true);
    
    // Setup wave type buttons
    const startX = padding;
    const startY = padding + 15;

    for (let i = 0; i < waveTypes.length; i++) {
        buttons.push({
            x: startX + (i % 2) * (btnW + spacing),
            y: startY + Math.floor(i / 2) * (btnH + spacing),
            w: btnW,
            h: btnH,
            type: waveTypes[i],
            label: waveTypes[i].substring(0, 4)
        });
    }
    console.log('Setup complete!');
    window.adsrReady = true;
}

// ------------------------------------------------------------
function draw() {
    clear();
    fill(bgColor);
    noStroke();
    rect(0, 0, W, H, round);

    drawWaveTypeButtons();
    drawADSR();
    drawKnob();
    drawControlButtons();
    updateAudioParams();
}

// ------------------------------------------------------------
function drawADSR() {
    // Title
    fill(textColor);
    noStroke();
    textSize(textTitleSize);
    textAlign(LEFT);
    text('Audio Settings', padding, 12);

    fill(textColor);
    textAlign(LEFT);
    text('Envelope', padding, adsrTop - 10);

    // ADSR background
    fill(adsrBackgroundColor);
    stroke(80);
    strokeWeight(0.5);
    rect(padding, adsrTop, W - 2 * padding, adsrHeight, round, round, 0, 0);

    // Grid
    stroke(adsrGrid);
    for (let i = 1; i < 8; i++) {
        let x = padding + i * (W - 2 * padding) / 8;
        line(x, adsrTop, x, adsrTop + adsrHeight);
    }
    for (let i = 1; i < 8; i++) {
        let y = adsrTop + i * adsrHeight / 8;
        line(padding, y, W - padding, y);
    }

    // Convert points to ADSR drawing coordinates
    let drawPoints = adsrPoints.map(pt => ({
        x: pt.x,
        y: map(pt.y, 0, H, adsrTop, adsrTop + adsrHeight)
    }));

    // Draw filled area under envelope with rounded corners
    fill(0, 155, 255, 100);
    noStroke();

    beginShape();
    // Envelope line
    for (let i = drawPoints.length - 1; i >= 0; i--) {
        vertex(drawPoints[i].x, drawPoints[i].y);
    }
    endShape(CLOSE);

    // Draw envelope line
    stroke(5, 213, 255);
    strokeWeight(0.5);
    noFill();
    beginShape();
    for (let pt of drawPoints) {
        vertex(pt.x, pt.y);
    }
    endShape();

    // Draw control points
    for (let i = 0; i < adsrPoints.length; i++) {
        let pt = adsrPoints[i];
        if (!pt.draggable) continue;

        let drawY = map(pt.y, 0, H, adsrTop, adsrTop + adsrHeight);
        let d = dist(mouseX, mouseY, pt.x, drawY);
        let isHover = d < 15;

        noStroke();
        if (draggingPoint === i || isHover) {
            fill(255, 200, 0);
        } else {
            fill(0, 111, 229);
        }
        circle(pt.x, drawY, pointSize);
    }

    // Display timing values
    fill(255);
    noStroke();
    textSize(textButtonSize);
    textAlign(LEFT);
    const valuesY = adsrTop + adsrHeight + 25;

    let totalTime = audioParams.attack + audioParams.sustain + audioParams.release;
    // text(`Attack: ${audioParams.attack.toFixed(2)}s`, padding, valuesY);
    // text(`Sustain: ${audioParams.sustain.toFixed(2)}s`, padding, valuesY + 18);
    // text(`Release: ${audioParams.release.toFixed(2)}s`, padding, valuesY + 36);

    // // ADD AMPLITUDE DISPLAY
    // text(`A.Level: ${audioParams.attackLevel.toFixed(2)}`, padding + 160, valuesY);
    // text(`S.Level: ${audioParams.sustainLevel.toFixed(2)}`, padding + 160, valuesY + 18);


    fill(textColor);
    textAlign(RIGHT);
    textSize(textButtonSize);
    text(`${totalTime.toFixed(1)}s`, W - padding - 2, valuesY - 30);
}

//--------------------------------------------------------------------
function drawWaveTypeButtons() {
    // Draw wave type buttons
    textAlign(CENTER, CENTER);
    textSize(textButtonSize);
    strokeWeight(1);
    for (let btn of buttons) {
        let isActive = audioParams.waveType === btn.type;
        let isHover = mouseX > btn.x && mouseX < btn.x + btn.w &&
            mouseY > btn.y && mouseY < btn.y + btn.h;

        // Button background
        if (isActive) {
            fill(buttonActiveColor);
            noStroke();
        } else if (isHover) {
            fill(buttonHoverColor);
            stroke(100);
        } else {
            fill(buttonColor);
            stroke(80);
        }
        strokeWeight(0.5);
        rect(btn.x, btn.y, btn.w, btn.h, 5);

        // Button text
        fill(textColor);
        noStroke();
        text(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
    }
}

//--------------------------------------------------------------------
function drawKnob() {
    // Dry/Wet knob
    const knobX = dryWetKnob.x;
    const knobY = dryWetKnob.y;
    const knobR = dryWetKnob.radius;

    fill(textColor);
    textAlign(CENTER);
    textSize(textButtonSize);
    text('Dry/Wet', knobX, knobY - knobR - 10);

        // 0.8 → the dial sweeps 80% of the circle: new 0% at the old 10% position
        // (lower-left), new 100% at the old 90% (lower-right), ~72° gap at the
        // bottom. MUST match the drag mapping (±PI*0.8).
        const percentage = 0.8;
        const minAngle = -PI * percentage;
        const maxAngle = PI * percentage;
        const startAngle = minAngle - HALF_PI;

    // Knob body (filled disk, no outline)
    noStroke();
    fill(buttonColor);
    circle(knobX, knobY, knobR * 2);

    // Frame: stroke only the 80% arc we actually use (open gap at the bottom)
    noFill();
    stroke(100, 100);
    strokeWeight(1);
    arc(knobX, knobY, knobR * 2, knobR * 2, startAngle, maxAngle - HALF_PI);
        const endAngle = map(audioParams.dryWet, 0, 1, minAngle, maxAngle) - HALF_PI;

        const thickness = 5;
        const outerR = knobR;
        const innerR = Math.max(1, knobR - thickness);

        // Use raw canvas path to draw an annular wedge
        push();
        noStroke();
        fill(buttonActiveColor);
        const ctx = drawingContext;
        ctx.beginPath();
        // Outer arc from start → end
        ctx.arc(knobX, knobY, outerR, startAngle, endAngle, false);
        // Inner arc from end → start (reverse), closing the ring wedge
        ctx.arc(knobX, knobY, innerR, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fill();
        pop();

    // Indicator line (restore this!)
    const angle = map(audioParams.dryWet, 0, 1, minAngle, maxAngle) - HALF_PI;
    stroke(150);
    strokeWeight(1);
    const indicatorX = knobX + cos(angle) * (knobR - 3);
    const indicatorY = knobY + sin(angle) * (knobR - 3);
    line(knobX, knobY, indicatorX, indicatorY);
    // Value display (restore this!)
    fill(textColor);
    noStroke();
    textSize(textButtonSize);
    text(`${(audioParams.dryWet * 100).toFixed(0)}%`, knobX, knobY + knobR);
}

//--------------------------------------------------------------------
function drawControlButtons() {
    // Close (×) — never "active"; Mute (m) — active fill when muted.
    drawControlButton(closeButton, 'x', false);
    drawControlButton(muteButton, 'm', muteButton.muted);
}

//--------------------------------------------------------------------
function drawControlButton(btn, glyph, active) {
    const isHover = dist(mouseX, mouseY, btn.x, btn.y) < btn.size / 2;

    if (active) {
        fill(buttonActiveColor);
        noStroke();
    } else if (isHover) {
        fill(buttonHoverColor);
        stroke(255);
    } else {
        fill(buttonColor);
        stroke(180, 150);
    }
    strokeWeight(2);
    ellipse(btn.x, btn.y, btn.size, btn.size);

    // Glyph
    noStroke();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(11);
    text(glyph, btn.x, btn.y);
}

//--------------------------------------------------------------------
function updateAudioParams() {
    const maxTime = 2.0;
    const totalWidth = W - 2 * padding;

    // Time from X positions
    const attack = ((adsrPoints[1].x - adsrPoints[0].x) / totalWidth) * maxTime;
    const sustain = ((adsrPoints[2].x - adsrPoints[1].x) / totalWidth) * maxTime;
    const release = ((adsrPoints[3].x - adsrPoints[2].x) / totalWidth) * maxTime;

    // Amplitude from Y positions (inverted: lower Y = higher amplitude)
    const attackLevel = map(adsrPoints[1].y, 0, H, 1.0, 0.001);
    const sustainLevel = map(adsrPoints[2].y, 0, H, 1.0, 0.001);
    
    // Update both EigenSpace (local audioParams) and Modal Studio (window.audioParams)
    audioParams.attack = attack;
    audioParams.sustain = sustain;
    audioParams.release = release;
    audioParams.attackLevel = attackLevel;
    audioParams.sustainLevel = sustainLevel;
    
    // Also update window.audioParams for Modal Studio
    if (window.audioParams) {
        window.audioParams.attack = attack;
        window.audioParams.sustain = sustain;
        window.audioParams.release = release;
        window.audioParams.attackLevel = attackLevel;
        window.audioParams.sustainLevel = sustainLevel;
    }
}

//--------------------------------------------------------------------
function mousePressed() {
    // Ignore mouse events if audio GUI is hidden
    if (!isAudioGuiVisible()) return;
    
    // Close (×) — hide whichever container currently hosts the ADSR canvas
    // (EigenSpace / Modal Studio / Keyboard). Reopen from that scene's menu.
    if (dist(mouseX, mouseY, closeButton.x, closeButton.y) < closeButton.size / 2) {
        const host = window.adsrCanvas && window.adsrCanvas.elt
            ? window.adsrCanvas.elt.parentElement : null;
        if (host) host.style.display = 'none';
        return;
    }

    // Mute (m) — toggle global audio mute.
    if (dist(mouseX, mouseY, muteButton.x, muteButton.y) < muteButton.size / 2) {
        muteButton.muted = !muteButton.muted;
        window.audioMuted = muteButton.muted;
        return;
    }

    // Check dry/wet knob
    const knobDist = dist(mouseX, mouseY, dryWetKnob.x, dryWetKnob.y);
    if (knobDist < dryWetKnob.radius) {
        dryWetKnob.dragging = true;
        return;
    }

    for (let btn of buttons) {
        if (mouseX > btn.x && mouseX < btn.x + btn.w &&
            mouseY > btn.y && mouseY < btn.y + btn.h) {
            audioParams.waveType = btn.type;
            // Also update window.audioParams for Modal Studio
            if (window.audioParams) {
                window.audioParams.waveType = btn.type;
            }
            return;
        }
    }

    for (let i = 0; i < adsrPoints.length; i++) {
        let pt = adsrPoints[i];
        if (!pt.draggable) continue;

        let drawY = map(pt.y, 0, H, adsrTop, adsrTop + adsrHeight);
        let d = dist(mouseX, mouseY, pt.x, drawY);

        if (d < pointSize+1) {
            draggingPoint = i;
            return;
        }
    }
}

//--------------------------------------------------------------------
function mouseDragged() {
    // Ignore mouse events if audio GUI is hidden
    if (!isAudioGuiVisible()) return;
    
    if (draggingPoint !== null && draggingPoint > 0 && draggingPoint < adsrPoints.length - 1) {

        let minX = draggingPoint === 1
            ? adsrPoints[draggingPoint - 1].x + 3   // Attack: allow down to ~0.01s
            : adsrPoints[draggingPoint - 1].x + pointSize; // Sustain: keep 20px spacing
        let maxX = adsrPoints[draggingPoint + 1].x - pointSize;
        adsrPoints[draggingPoint].x = constrain(mouseX, minX, maxX);

        let mappedY = map(mouseY, adsrTop, adsrTop + adsrHeight, 0, H);
        adsrPoints[draggingPoint].y = constrain(mappedY, 0, H);;
    }
    if (dryWetKnob.dragging) {
        const dx = mouseX - dryWetKnob.x;
        const dy = mouseY - dryWetKnob.y;
        let angle = atan2(dy, dx) + HALF_PI;

        // Normalize angle to -PI to PI range
        while (angle > PI) angle -= TWO_PI;
        while (angle < -PI) angle += TWO_PI;

        const minAngle = -PI * 0.8; // must match the draw sweep (percentage 0.8)
        const maxAngle = PI * 0.8;
        angle = constrain(angle, minAngle, maxAngle);
        const dryWetValue = map(angle, minAngle, maxAngle, 0, 1);
        audioParams.dryWet = dryWetValue;
        // Also update window.audioParams for Modal Studio
        if (window.audioParams) {
            window.audioParams.dryWet = dryWetValue;
        }
    }
}

//--------------------------------------------------------------------
function mouseReleased() {
    // Ignore mouse events if audio GUI is hidden
    if (!isAudioGuiVisible()) return;
    
    draggingPoint = null;
    draggingPoint = null;
    dryWetKnob.dragging = false;
}
