// Simple gradient shader for Modal Studio editors
// Just draws radial gradients - keeping it simple!

class ShaderManager {
    constructor() {
        this.initialized = false;
    }
    
    // No initialization needed for simple p5 gradients!
    initShaders(p) {
        this.initialized = true;
        console.log('✓ Gradient manager ready');
    }
    
    // Draw simple radial gradient background
    drawEditorBackground(p, centerX, centerY, width, height, startColor, endColor, cornerRadius = 15) {
        if (!this.initialized) {
            return;
        }
        
        // Use native canvas gradient for smooth results
        p.push();
        
        // Set clipping to the rounded rectangle area
        p.drawingContext.save();
        p.drawingContext.beginPath();
        this.roundRect(p.drawingContext, centerX - width/2, centerY - height/2, width, height, cornerRadius);
        p.drawingContext.clip();
        
        // Create radial gradient matching C++ shader behavior
        // C++ uses distance to corner: length(vec2(0.5, 0.5))
        let maxRadius = Math.sqrt(0.5 * 0.5 + 0.5 * 0.5) * Math.max(width, height);
        let gradient = p.drawingContext.createRadialGradient(
            centerX, centerY, 0,           // Start circle: center, radius 0
            centerX, centerY, maxRadius    // End circle: center, max radius to corner
        );
        
        // Add color stops with smoothstep-like distribution
        let startR = startColor[0];
        let startG = startColor[1];
        let startB = startColor[2];
        let startA = startColor.length > 3 ? startColor[3] / 255 : 1.0;
        
        let endR = endColor[0];
        let endG = endColor[1];
        let endB = endColor[2];
        let endA = endColor.length > 3 ? endColor[3] / 255 : 1.0;
        
        // Use multiple color stops to simulate smoothstep easing (softer gradient like C++)
        gradient.addColorStop(0.0, `rgba(${startR}, ${startG}, ${startB}, ${startA})`);
        gradient.addColorStop(0.15, `rgba(${startR}, ${startG}, ${startB}, ${startA})`);  // Hold bright longer
        gradient.addColorStop(0.96, `rgba(${endR}, ${endG}, ${endB}, ${endA})`);
        
        // Apply gradient
        p.drawingContext.fillStyle = gradient;
        p.drawingContext.fillRect(centerX - width/2, centerY - height/2, width, height);
        
        p.drawingContext.restore();
        p.pop();
    }
    
    // Helper to draw rounded rectangle path
    roundRect(ctx, x, y, width, height, radius) {
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
}
