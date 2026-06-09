// ============================================================================
// MODAL STUDIO - P5.JS AUDIO GUI - ADSR Envelope Editor
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

let bgColor = 'rgba(237, 236, 236, 0.9)';
let buttonColor = 'rgba(220, 220, 220, 1)';
let buttonHoverColor = 'rgba(200, 200, 200, 1)';
let buttonActiveColor = 'rgba(93, 190, 255, 1)';
let adsrBackgroundColor = 'rgba(224, 224, 224, 1)';
let adsrGrid = 'rgba(207, 207, 207, 1)';

const round = 10;
const paddingWetDry = 100;

const pointSize = 10;

//Define the color
let textColor = 'rgba(20, 20, 20, 1)';

const textButtonSize = 10;
const textTitleSize = 12;

let darkMode = false;

// Audio mute button
let audioMuteButton = {
    x: W - 20,
    y: 20,
    size: 20,
    muted: false
};

// Wave type buttons
const waveTypes = ['sine', 'triangle', 'sawtooth', 'square'];
let buttons = [];

// ADSR envelope points
let adsrPoints = [
    { x: padding, y: H, label: 'Start', draggable: false },
    { x: 40, y: 60, label: 'A', draggable: true },
    { x: 200, y: 250, label: 'S', draggable: true },
    { x: W - padding, y: H, label: 'End', draggable: false }
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
        bgColor = 'rgba(20, 20, 20, 0.9)';
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
    const container = document.getElementById('audio-gui-container');
    return container && container.style.display !== 'none';
}

// ------------------------------------------------------------
function setup() {
    textFont('Fira Code');

    let canvas = createCanvas(W, H);
    canvas.parent('audio-gui-container');
    
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
    
    // Initialize Modal Studio with light mode
    setDark(false);
    
    console.log('Modal Studio ADSR setup complete!');
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
    drawMuteButton();
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

    // Draw filled area under envelope
    fill(0, 155, 255, 100);
    noStroke();

    beginShape();
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

    fill(textColor);
    textAlign(RIGHT);
    textSize(textButtonSize);
    text(`${totalTime.toFixed(1)}s`, W - padding - 2, valuesY - 30);
}

//--------------------------------------------------------------------
function drawWaveTypeButtons() {
    textAlign(CENTER, CENTER);
    textSize(textButtonSize);
    strokeWeight(1);
    for (let btn of buttons) {
        let isActive = audioParams.waveType === btn.type;
        let isHover = mouseX > btn.x && mouseX < btn.x + btn.w &&
            mouseY > btn.y && mouseY < btn.y + btn.h;

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

        fill(textColor);
        noStroke();
        text(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
    }
}

//--------------------------------------------------------------------
function drawKnob() {
    const knobX = dryWetKnob.x;
    const knobY = dryWetKnob.y;
    const knobR = dryWetKnob.radius;

    fill(textColor);
    textAlign(CENTER);
    textSize(textButtonSize);
    text('Dry/Wet', knobX, knobY - knobR - 10);

    fill(buttonColor);
    stroke(100, 100);
    strokeWeight(1);
    circle(knobX, knobY, knobR * 2);

    const percentage = 0.99;
    const minAngle = -PI * percentage;
    const maxAngle = PI * percentage;
    const startAngle = minAngle - HALF_PI;
    const endAngle = map(audioParams.dryWet, 0, 1, minAngle, maxAngle) - HALF_PI;
    fill(buttonActiveColor);
    noStroke();
    arc(knobX, knobY, knobR * 2, knobR * 2, startAngle, endAngle, PIE);

    const angle = map(audioParams.dryWet, 0, 1, minAngle, maxAngle) - HALF_PI;
    stroke(150);
    strokeWeight(1);
    const indicatorX = knobX + cos(angle) * (knobR - 3);
    const indicatorY = knobY + sin(angle) * (knobR - 3);
    line(knobX, knobY, indicatorX, indicatorY);
    
    fill(textColor);
    noStroke();
    textSize(textButtonSize);
    text(`${(audioParams.dryWet * 100).toFixed(0)}%`, knobX, knobY + knobR + 15);
}

//--------------------------------------------------------------------
function drawMuteButton() {
    const btn = audioMuteButton;
    const isHover = dist(mouseX, mouseY, btn.x, btn.y) < btn.size / 2;

    strokeWeight(1);

    if (btn.muted) {
        fill(buttonActiveColor);
        noStroke();
    } else if (isHover) {
        fill(buttonHoverColor);
        stroke(120);
    } else {
        fill(buttonColor);
        stroke(150);
    }
    strokeWeight(1);
    circle(btn.x, btn.y, btn.size);

    noStroke();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(10);
    
    if (btn.muted) {
        text('-', btn.x, btn.y);
    } else {
        text('x', btn.x, btn.y);
    }
}

//--------------------------------------------------------------------
function updateAudioParams() {
    const maxTime = 2.0;
    const totalWidth = W - 2 * padding;

    audioParams.attack = ((adsrPoints[1].x - adsrPoints[0].x) / totalWidth) * maxTime;
    audioParams.sustain = ((adsrPoints[2].x - adsrPoints[1].x) / totalWidth) * maxTime;
    audioParams.release = ((adsrPoints[3].x - adsrPoints[2].x) / totalWidth) * maxTime;

    audioParams.attackLevel = map(adsrPoints[1].y, 0, H, 1.0, 0.001);
    audioParams.sustainLevel = map(adsrPoints[2].y, 0, H, 1.0, 0.001);
}

//--------------------------------------------------------------------
function mousePressed() {
    if (!isAudioGuiVisible()) return;
    
    const muteBtnDist = dist(mouseX, mouseY, audioMuteButton.x, audioMuteButton.y);
    if (muteBtnDist < audioMuteButton.size / 2) {
        audioMuteButton.muted = !audioMuteButton.muted;
        window.audioMuted = audioMuteButton.muted;
        return;
    }

    const knobDist = dist(mouseX, mouseY, dryWetKnob.x, dryWetKnob.y);
    if (knobDist < dryWetKnob.radius) {
        dryWetKnob.dragging = true;
        return;
    }

    for (let btn of buttons) {
        if (mouseX > btn.x && mouseX < btn.x + btn.w &&
            mouseY > btn.y && mouseY < btn.y + btn.h) {
            audioParams.waveType = btn.type;
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
    if (!isAudioGuiVisible()) return;
    
    if (draggingPoint !== null && draggingPoint > 0 && draggingPoint < adsrPoints.length - 1) {
        let minX = draggingPoint === 1
            ? adsrPoints[draggingPoint - 1].x + 3
            : adsrPoints[draggingPoint - 1].x + pointSize;
        let maxX = adsrPoints[draggingPoint + 1].x - pointSize;
        adsrPoints[draggingPoint].x = constrain(mouseX, minX, maxX);

        let mappedY = map(mouseY, adsrTop, adsrTop + adsrHeight, 0, H);
        adsrPoints[draggingPoint].y = constrain(mappedY, 0, H);;
    }
    if (dryWetKnob.dragging) {
        const dx = mouseX - dryWetKnob.x;
        const dy = mouseY - dryWetKnob.y;
        let angle = atan2(dy, dx) + HALF_PI;

        while (angle > PI) angle -= TWO_PI;
        while (angle < -PI) angle += TWO_PI;

        const minAngle = -PI * 0.75;
        const maxAngle = PI * 0.75;
        angle = constrain(angle, minAngle, maxAngle);
        audioParams.dryWet = map(angle, minAngle, maxAngle, 0, 1);
    }
}

//--------------------------------------------------------------------
function mouseReleased() {
    if (!isAudioGuiVisible()) return;
    
    draggingPoint = null;
    draggingPoint = null;
    dryWetKnob.dragging = false;
}
