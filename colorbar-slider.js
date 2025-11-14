// ============================================================================
// P5.JS COLOR BAR + SLIDER (Instance Mode to avoid conflicts with adsr.js)
// ============================================================================

// Create a separate P5 instance for the colorbar to avoid conflicts
const colorbarSketch = (p) => {
    // Dimensions (responsive to screen size)
    const BAR_WIDTH = 50;
    let BAR_HEIGHT = window.innerHeight * 0.5;  // 50% of screen height
    const CANVAS_WIDTH = 110;
    let CANVAS_HEIGHT = window.innerHeight * 0.54;
    const PADDING = 35;

    // Slider state
    let sliderPos = 1; // 0 to 1 (top to bottom)
    let isDragging = false;
    let numSteps = 0;
    let currentStep = 0;

    // Thresholds from the main visualization
    let thresholds = [];
    let windowSize = 0;

    // Color gradient - matching myColor colorscale
    // P5 coordinates: top (y=0) to bottom (y=height)
    // Top should be RED (high dissonance), bottom should be BLUE (low dissonance)
    const gradientColors = [
        [255, 0, 0],         // Red (high dissonance - TOP)
        [255, 200, 0],       // Orange
        [255, 255, 255],     // White (mid)
        [0, 200, 255],       // Cyan
        [0, 0, 255]          // Blue (low dissonance - BOTTOM)
    ];

    p.setup = function () {
        let canvas = p.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
        canvas.parent('colorbar-container');
        p.textFont('Source Code Pro');
    };

    p.draw = function () {
        p.noStroke();
        p.fill(0,);
        p.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 10);

        // Calculate bar position
        const barX = PADDING;
        const barY = (CANVAS_HEIGHT - BAR_HEIGHT) / 2;

        // Draw color gradient bar
        drawGradientBar(barX, barY);

        // Draw slider handle
        drawSliderHandle(barX, barY);

        // Draw labels
        drawLabels(barX, barY);
    };

    function drawGradientBar(x, y) {
        const cornerRadius = 5;
        // Border
        p.fill(0);
        p.noStroke();
        p.rect(x, y, BAR_WIDTH, BAR_HEIGHT, cornerRadius);

        // Save drawing context and apply clipping with rounded corners
        p.push();
        p.drawingContext.save();
        p.drawingContext.beginPath();
        p.drawingContext.roundRect(x, y, BAR_WIDTH, BAR_HEIGHT, cornerRadius);
        p.drawingContext.clip();

        // Draw gradient using rectangles
        for (let i = 0; i < BAR_HEIGHT; i+=2) {
            let t = i / BAR_HEIGHT;
            let col = getGradientColor(t);
            p.stroke(col[0], col[1], col[2]);
            p.rect(x, y + i, BAR_WIDTH, 1);
        }

        // Restore context
        p.drawingContext.restore();
        p.pop();

        
    }

    function drawSliderHandle(x, y) {
        const handleY = y + sliderPos * BAR_HEIGHT;
        const handleWidth = BAR_WIDTH + 20;
        const handleHeight = 9;

        // Handle background
        p.fill(255, 200);
        p.stroke(255);
        p.strokeWeight(1);
        p.rect(x - 10, handleY - handleHeight / 2, handleWidth, handleHeight, 5);

        // Hover/drag state
        if (isDragging) {
            p.stroke(255, 200, 0);
            p.strokeWeight(1);
            p.noFill();
            p.rect(x - 10, handleY - handleHeight / 2, handleWidth, handleHeight, 5);
        }

        // Handle lines (grip)
        p.stroke(100);
        p.strokeWeight(1);
        for (let i = -3; i <= 3; i++) {
            p.line(x + BAR_WIDTH / 2 + i * 5, handleY - 2, x + BAR_WIDTH / 2 + i * 5, handleY + 2);
        }
    }

    function drawLabels(x, y) {
        p.fill(255);
        p.noStroke();
        p.textSize(12);
        p.textAlign(p.LEFT, p.CENTER);

        // Title
        p.textAlign(p.CENTER);
        p.text('Dissonance', x + BAR_WIDTH / 2, y - 10);

        // Max value (top)
        p.textAlign(p.RIGHT, p.CENTER);
        p.textSize(11);
        p.text('High', x - 5, y + 10);

        // Min value (bottom)
        p.text('Low', x - 5, y + BAR_HEIGHT - 10);

        // Current range
        // if (thresholds.length > 0 && currentStep < thresholds.length) {
        //     const threshold = thresholds[currentStep];
        //     const lowerBound = threshold - windowSize / 2;
        //     const upperBound = threshold + windowSize / 2;

        //     p.textAlign(p.CENTER);
        //     p.textSize(10);
        //     p.fill(255);
        //     p.text(`${lowerBound.toFixed(3)}`, x + BAR_WIDTH / 2, y + BAR_HEIGHT + 10);
        //     p.text(`${upperBound.toFixed(3)}`, x + BAR_WIDTH / 2, y + BAR_HEIGHT + 21);
        // }
    }

    function getGradientColor(t) {
        // t is 0 (top) to 1 (bottom)
        const numColors = gradientColors.length;
        const scaledT = t * (numColors - 1);
        const idx1 = Math.floor(scaledT);
        const idx2 = Math.min(idx1 + 1, numColors - 1);
        const localT = scaledT - idx1;

        const c1 = gradientColors[idx1];
        const c2 = gradientColors[idx2];

        return [
            p.lerp(c1[0], c2[0], localT),
            p.lerp(c1[1], c2[1], localT),
            p.lerp(c1[2], c2[2], localT)
        ];
    }

    p.mousePressed = function () {
        const barX = PADDING;
        const barY = (CANVAS_HEIGHT - BAR_HEIGHT) / 2;

        // Check if clicking anywhere on the color bar (not just the handle)
        if (p.mouseX >= barX && p.mouseX <= barX + BAR_WIDTH &&
            p.mouseY >= barY && p.mouseY <= barY + BAR_HEIGHT) {
            isDragging = true;
            updateSliderPosition();
            return;
        }

        // Also allow clicking the handle specifically
        if (isOverSlider()) {
            isDragging = true;
            updateSliderPosition();
        }
    };

    p.mouseDragged = function () {
        if (isDragging) {
            updateSliderPosition();
        }
    };

    p.mouseReleased = function () {
        isDragging = false;
    };

    function isOverSlider() {
        const barX = PADDING;
        const barY = (CANVAS_HEIGHT - BAR_HEIGHT) / 2;
        const handleY = barY + sliderPos * BAR_HEIGHT;
        const handleWidth = BAR_WIDTH + 20;
        const handleHeight = 20; // Larger hit area

        return p.mouseX >= barX - 10 &&
            p.mouseX <= barX + handleWidth &&
            p.mouseY >= handleY - handleHeight / 2 &&
            p.mouseY <= handleY + handleHeight / 2;
    }

    function updateSliderPosition() {
        const barY = (CANVAS_HEIGHT - BAR_HEIGHT) / 2;
        let newPos = (p.mouseY - barY) / BAR_HEIGHT;
        newPos = p.constrain(newPos, 0, 1);
        sliderPos = newPos;

        // Calculate which step we're at
        // REVERSED: top (sliderPos=0) = last step (high dissonance)
        //           bottom (sliderPos=1) = first step (low dissonance)
        if (numSteps > 0) {
            currentStep = Math.floor((1 - sliderPos) * numSteps);
            currentStep = p.constrain(currentStep, 0, numSteps - 1);

            // Update the Plotly visualization
            if (typeof updatePlotlyLayer === 'function') {
                updatePlotlyLayer(currentStep);
            }
        }
    }

    // Public API to set thresholds from main code
    p.setThresholds = function (thresholdsArray, windowSizeValue, initialStep = 0) {
        thresholds = thresholdsArray;
        windowSize = windowSizeValue;
        numSteps = thresholds.length;
        currentStep = initialStep;
        // REVERSED: start at bottom (sliderPos=1) for step 0 (low dissonance)
        sliderPos = 1 - (currentStep / Math.max(1, numSteps - 1));
    };

    // Public API to get current step
    p.getCurrentStep = function () {
        return currentStep;
    };

    // Handle window resize
    p.windowResized = function () {
        // Update dimensions based on new window size
        BAR_HEIGHT = window.innerHeight * 0.5;
        CANVAS_HEIGHT = window.innerHeight * 0.55;
        
        // Resize the canvas
        p.resizeCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    };
};

// Create the instance
let colorbarP5 = new p5(colorbarSketch);