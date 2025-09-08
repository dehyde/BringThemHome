/**
 * Color Manager System
 * Handles complex gradient transitions based on path geometry
 * Supports RTL layout with precise transition point calculations
 */

class ColorManager {
    constructor(timelineCore, laneManager) {
        this.timeline = timelineCore;
        this.laneManager = laneManager;
        
        // Color definitions - SIMPLIFIED ARCHITECTURE
        this.colors = {
            // Base lane colors
            living: '#DAA520', // Mustard orange
            dead: 'rgba(128, 128, 128, 0.6)', // Semi-transparent gray
            deathEvent: '#8B0000', // Dark red for death transitions
            
            // Released colors - living
            releasedDealLiving: '#E6F3FF', // Very light blue for released in deal - living
            releasedOpLiving: '#F0F8E8', // Very light olive green for released in operation - living
            
            // Released colors - dead  
            releasedDealDead: '#F5F5F5', // Light gray for released in deal - dead
            releasedOpDead: '#F5F5F5', // Light gray for released in operation - dead
            
            // Legacy support (will be removed)
            livingInCaptivity: '#DAA520',
            deadInCaptivity: 'rgba(128, 128, 128, 0.6)', 
            deadInCaptivityTransparent: 'rgba(128, 128, 128, 0.6)',
            darkRed: '#8B0000',
            releasedDeal: '#E6F3FF',
            releasedMilitary: '#F0F8E8'
        };
        
        // Debug: Log colors to verify
        
        // Gradient definitions storage
        this.gradientDefs = new Map();
        this.gradientIdCounter = 0;
        
        // Path analysis cache
        this.pathAnalysisCache = new Map();
    }

    /**
     * Initialize the color system and create SVG defs for gradients
     */
    initialize() {
        // Get or create defs element in SVG
        const svg = this.timeline.svg;
        let defs = svg.select('defs');
        
        if (defs.empty()) {
            defs = svg.append('defs');
        }
        
        this.defsElement = defs;
    }

    /**
     * Analyze a path string to extract geometric information
     * @param {string} pathString - SVG path string
     * @returns {Object} Path analysis with segments and key points
     */
    analyzePath(pathString) {
        if (!pathString) return null;
        
        // Check cache first
        if (this.pathAnalysisCache.has(pathString)) {
            return this.pathAnalysisCache.get(pathString);
        }
        
        const analysis = {
            totalLength: 0,
            segments: [],
            corners: [],
            keyPoints: [],
            transitions: [] // Track transition points
        };
        
        try {
        
        // Parse path commands
        const commands = this.parsePathCommands(pathString);
        let currentX = 0, currentY = 0;
        let pathLength = 0;
        let startX = 0, startY = 0; // Track path start for Z command
        
        // Debug: Log all command types to see if we're missing any
        const commandTypes = [...new Set(commands.map(cmd => cmd.type))];
        if (commandTypes.includes('A')) {
        }
        
        commands.forEach((cmd, index) => {
            const segment = {
                type: cmd.type,
                startX: currentX,
                startY: currentY,
                startLength: pathLength,
                commandIndex: index
            };
            
            switch (cmd.type) {
                case 'M': // Move to
                    startX = currentX = cmd.x;
                    startY = currentY = cmd.y;
                    segment.startX = currentX;  // Fix: Update segment start to match move destination
                    segment.startY = currentY;
                    segment.endX = currentX;
                    segment.endY = currentY;
                    segment.length = 0;
                    
                    // Mark as key point
                    analysis.keyPoints.push({
                        type: 'start',
                        x: currentX,
                        y: currentY,
                        length: pathLength
                    });
                    break;
                    
                case 'L': // Line to
                    const dx = cmd.x - currentX;
                    const dy = cmd.y - currentY;
                    segment.length = Math.sqrt(dx * dx + dy * dy);
                    segment.endX = cmd.x;
                    segment.endY = cmd.y;
                    
                    // Detect vertical transitions (significant Y change with minimal X change)
                    const isVertical = Math.abs(dy) > Math.abs(dx) * 2;
                    const isTransition = Math.abs(dy) > 10; // At least 10px vertical movement
                    
                    if (isVertical && isTransition) {
                        // This might be a transition between lanes
                        analysis.transitions.push({
                            type: 'vertical',
                            startLength: pathLength,
                            endLength: pathLength + segment.length,
                            startY: currentY,
                            endY: cmd.y,
                            direction: dy > 0 ? 'down' : 'up'
                        });
                    }
                    
                    currentX = cmd.x;
                    currentY = cmd.y;
                    pathLength += segment.length;
                    break;
                    
                case 'Q': // Quadratic curve (corner)
                    segment.controlX = cmd.cx;
                    segment.controlY = cmd.cy;
                    segment.endX = cmd.x;
                    segment.endY = cmd.y;
                    
                    // Calculate curve length more accurately using bezier approximation with more steps
                    const steps = 20; // Increased from 10 to 20 for better accuracy
                    let curveLength = 0;
                    let prevX = currentX;
                    let prevY = currentY;
                    
                    for (let i = 1; i <= steps; i++) {
                        const t = i / steps;
                        const t2 = t * t;
                        const mt = 1 - t;
                        const mt2 = mt * mt;
                        
                        // Quadratic bezier curve formula: (1-t)²P₀ + 2(1-t)tP₁ + t²P₂
                        const x = mt2 * currentX + 2 * mt * t * cmd.cx + t2 * cmd.x;
                        const y = mt2 * currentY + 2 * mt * t * cmd.cy + t2 * cmd.y;
                        
                        const segDx = x - prevX;
                        const segDy = y - prevY;
                        curveLength += Math.sqrt(segDx * segDx + segDy * segDy);
                        
                        prevX = x;
                        prevY = y;
                    }
                    
                    segment.length = curveLength;
                    
                    // Determine if this is a transition corner
                    const yChange = Math.abs(cmd.y - currentY);
                    const xChange = Math.abs(cmd.x - currentX);
                    const isCornerTransition = yChange > 5; // Significant Y change indicates lane transition
                    
                    // Mark this as a corner
                    const corner = {
                        index: analysis.segments.length,
                        startLength: pathLength,
                        endLength: pathLength + segment.length,
                        startX: currentX,
                        startY: currentY,
                        endX: cmd.x,
                        endY: cmd.y,
                        controlX: cmd.cx,
                        controlY: cmd.cy,
                        isTransition: isCornerTransition,
                        direction: cmd.y > currentY ? 'down' : 'up'
                    };
                    
                    analysis.corners.push(corner);
                    
                    if (isCornerTransition) {
                        analysis.transitions.push({
                            type: 'corner',
                            startLength: pathLength,
                            endLength: pathLength + segment.length,
                            startY: currentY,
                            endY: cmd.y,
                            direction: corner.direction,
                            cornerIndex: analysis.corners.length - 1
                        });
                    }
                    
                    currentX = cmd.x;
                    currentY = cmd.y;
                    pathLength += segment.length;
                    break;
                    
                case 'C': // Cubic Bezier curve
                    segment.c1x = cmd.c1x;
                    segment.c1y = cmd.c1y;
                    segment.c2x = cmd.c2x;
                    segment.c2y = cmd.c2y;
                    segment.endX = cmd.x;
                    segment.endY = cmd.y;
                    
                    // Approximate cubic curve length
                    const cubicSteps = 10;
                    let cubicLength = 0;
                    let cubicPrevX = currentX;
                    let cubicPrevY = currentY;
                    
                    for (let i = 1; i <= cubicSteps; i++) {
                        const t = i / cubicSteps;
                        const t2 = t * t;
                        const t3 = t2 * t;
                        const mt = 1 - t;
                        const mt2 = mt * mt;
                        const mt3 = mt2 * mt;
                        
                        const x = mt3 * currentX + 3 * mt2 * t * cmd.c1x + 
                                 3 * mt * t2 * cmd.c2x + t3 * cmd.x;
                        const y = mt3 * currentY + 3 * mt2 * t * cmd.c1y + 
                                 3 * mt * t2 * cmd.c2y + t3 * cmd.y;
                        
                        const segDx = x - cubicPrevX;
                        const segDy = y - cubicPrevY;
                        cubicLength += Math.sqrt(segDx * segDx + segDy * segDy);
                        
                        cubicPrevX = x;
                        cubicPrevY = y;
                    }
                    
                    segment.length = cubicLength;
                    currentX = cmd.x;
                    currentY = cmd.y;
                    pathLength += segment.length;
                    break;
                    
                case 'A': // Elliptical arc
                    // Arc parameters: rx ry x-axis-rotation large-arc-flag sweep-flag x y
                    const rx = cmd.rx;
                    const ry = cmd.ry;
                    const xAxisRotation = cmd.xAxisRotation * Math.PI / 180; // Convert to radians
                    const largeArcFlag = cmd.largeArcFlag;
                    const sweepFlag = cmd.sweepFlag;
                    const endX = cmd.x;
                    const endY = cmd.y;
                    
                    // Calculate arc length using ellipse perimeter approximation
                    const arcLength = this.calculateArcLength(
                        currentX, currentY, 
                        endX, endY,
                        rx, ry, xAxisRotation, largeArcFlag, sweepFlag
                    );
                    
                    segment.length = arcLength;
                    segment.endX = endX;
                    segment.endY = endY;
                    
                    // Determine if this is a transition corner (similar logic to curves)
                    const arcYChange = Math.abs(endY - currentY);
                    const isArcTransition = arcYChange > 5; // Significant Y change indicates lane transition
                    
                    // Mark this as a corner
                    const arcCorner = {
                        index: analysis.segments.length,
                        startLength: pathLength,
                        endLength: pathLength + segment.length,
                        startX: currentX,
                        startY: currentY,
                        endX: endX,
                        endY: endY,
                        isTransition: isArcTransition,
                        direction: endY > currentY ? 'down' : 'up',
                        type: 'arc'
                    };
                    
                    analysis.corners.push(arcCorner);
                    
                    if (isArcTransition) {
                        analysis.transitions.push({
                            type: 'arc',
                            startLength: pathLength,
                            endLength: pathLength + segment.length,
                            startY: currentY,
                            endY: endY,
                            direction: arcCorner.direction,
                            cornerIndex: analysis.corners.length - 1
                        });
                    }
                    
                    currentX = endX;
                    currentY = endY;
                    pathLength += segment.length;
                    break;
                    
                case 'Z': // Close path
                    const closeDx = startX - currentX;
                    const closeDy = startY - currentY;
                    segment.length = Math.sqrt(closeDx * closeDx + closeDy * closeDy);
                    segment.endX = startX;
                    segment.endY = startY;
                    currentX = startX;
                    currentY = startY;
                    pathLength += segment.length;
                    break;
                    
                default:
                    segment.length = 0; // Skip unhandled commands
                    segment.endX = currentX;
                    segment.endY = currentY;
                    break;
            }
            
            segment.endLength = pathLength;
            analysis.segments.push(segment);
        });
        
        analysis.totalLength = pathLength;
        
        // Calculate relative positions for corners
        analysis.corners.forEach(corner => {
            corner.startPercent = (corner.startLength / analysis.totalLength) * 100;
            corner.endPercent = (corner.endLength / analysis.totalLength) * 100;
        });
        
        // Calculate relative positions for transitions
        analysis.transitions.forEach(transition => {
            transition.startPercent = (transition.startLength / analysis.totalLength) * 100;
            transition.endPercent = (transition.endLength / analysis.totalLength) * 100;
        });
        
            // Sort transitions by position
            analysis.transitions.sort((a, b) => a.startLength - b.startLength);
            
            // Cache the analysis
            this.pathAnalysisCache.set(pathString, analysis);
            
            return analysis;
        } catch (error) {
            console.error('[COLOR-DEBUG] Error analyzing path:', error, 'Path:', pathString);
            // Return null instead of empty analysis to avoid caching bad results
            return null;
        }
    }

    /**
     * Calculate the length of an elliptical arc
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y  
     * @param {number} x2 - End X
     * @param {number} y2 - End Y
     * @param {number} rx - X radius
     * @param {number} ry - Y radius
     * @param {number} xAxisRotation - X-axis rotation in radians
     * @param {boolean} largeArcFlag - Large arc flag
     * @param {boolean} sweepFlag - Sweep flag
     * @returns {number} Arc length
     */
    calculateArcLength(x1, y1, x2, y2, rx, ry, xAxisRotation, largeArcFlag, sweepFlag) {
        // Handle degenerate cases
        if (rx === 0 || ry === 0) {
            // If either radius is 0, this is a straight line
            const dx = x2 - x1;
            const dy = y2 - y1;
            return Math.sqrt(dx * dx + dy * dy);
        }
        
        if (x1 === x2 && y1 === y2) {
            // Same start and end point
            return 0;
        }
        
        // For simplicity, use the chord length as a baseline and apply a correction factor
        const chordLength = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
        
        // Estimate arc length using the average radius and chord length
        const avgRadius = (rx + ry) / 2;
        const chordDistance = chordLength;
        
        if (chordDistance >= 2 * avgRadius) {
            // Chord is longer than diameter - use chord length
            return chordLength;
        }
        
        // Calculate the central angle approximation
        const centralAngleApprox = 2 * Math.asin(chordDistance / (2 * avgRadius));
        
        // Arc length = radius * angle, but adjust for ellipse
        const arcLength = avgRadius * centralAngleApprox;
        
        // Apply correction for large arc flag (if large arc, it's the longer way around)
        return largeArcFlag ? (2 * Math.PI * avgRadius - arcLength) : arcLength;
    }

    /**
     * Parse SVG path commands into structured data
     * @param {string} pathString - SVG path string
     * @returns {Array} Array of parsed commands
     */
    parsePathCommands(pathString) {
        const commands = [];
        
        // More comprehensive regex to handle all path commands
        const commandRegex = /([MmLlHhVvCcSsQqTtAaZz])((?:\s*,?\s*[-+]?\d*\.?\d+)*)/g;
        let match;
        let currentX = 0;
        let currentY = 0;
        
        while ((match = commandRegex.exec(pathString)) !== null) {
            const type = match[1];
            const coordString = match[2].trim();
            
            // Parse coordinates
            const coords = coordString ? coordString.split(/[\s,]+/).map(str => {
                const num = parseFloat(str);
                return isNaN(num) ? 0 : num;
            }).filter(n => !isNaN(n)) : [];
            
            // Process based on command type
            switch (type.toUpperCase()) {
                case 'M': // Move to
                    if (coords.length >= 2) {
                        currentX = coords[0];
                        currentY = coords[1];
                        commands.push({ type: 'M', x: currentX, y: currentY });
                        
                        // Handle implicit line-to commands after move-to
                        for (let i = 2; i < coords.length; i += 2) {
                            if (coords[i + 1] !== undefined) {
                                currentX = coords[i];
                                currentY = coords[i + 1];
                                commands.push({ type: 'L', x: currentX, y: currentY });
                            }
                        }
                    }
                    break;
                    
                case 'L': // Line to
                    for (let i = 0; i < coords.length; i += 2) {
                        if (coords[i + 1] !== undefined) {
                            currentX = coords[i];
                            currentY = coords[i + 1];
                            commands.push({ type: 'L', x: currentX, y: currentY });
                        }
                    }
                    break;
                    
                case 'H': // Horizontal line to
                    for (let i = 0; i < coords.length; i++) {
                        currentX = coords[i];
                        commands.push({ type: 'L', x: currentX, y: currentY });
                    }
                    break;
                    
                case 'V': // Vertical line to
                    for (let i = 0; i < coords.length; i++) {
                        currentY = coords[i];
                        commands.push({ type: 'L', x: currentX, y: currentY });
                    }
                    break;
                    
                case 'Q': // Quadratic Bezier curve
                    for (let i = 0; i < coords.length; i += 4) {
                        if (coords[i + 3] !== undefined) {
                            const cx = coords[i];
                            const cy = coords[i + 1];
                            currentX = coords[i + 2];
                            currentY = coords[i + 3];
                            commands.push({ 
                                type: 'Q', 
                                cx: cx, 
                                cy: cy,
                                x: currentX, 
                                y: currentY 
                            });
                        }
                    }
                    break;
                    
                case 'C': // Cubic Bezier curve
                    for (let i = 0; i < coords.length; i += 6) {
                        if (coords[i + 5] !== undefined) {
                            currentX = coords[i + 4];
                            currentY = coords[i + 5];
                            commands.push({ 
                                type: 'C', 
                                c1x: coords[i], 
                                c1y: coords[i + 1],
                                c2x: coords[i + 2],
                                c2y: coords[i + 3],
                                x: currentX, 
                                y: currentY 
                            });
                        }
                    }
                    break;
                    
                case 'Z': // Close path
                    commands.push({ type: 'Z' });
                    break;
            }
        }
        
        return commands;
    }

    /**
     * Create gradient definition for a hostage based on their journey
     * @param {Object} hostage - Hostage data
     * @param {string} pathString - SVG path string
     * @returns {string} Gradient ID to use
     */
    createGradientForHostage(hostage, pathString) {
        const analysis = this.analyzePath(pathString);
        if (!analysis) {
            // Create fallback for paths we can't analyze
            const fallbackStops = [
                { offset: '0%', color: this.colors.living },
                { offset: '100%', color: this.colors.living }
            ];
            const fallbackGradientId = `gradient-fallback-${this.gradientIdCounter++}`;
            this.createGradientElement(fallbackGradientId, fallbackStops);
            return fallbackGradientId;
        }

        // Generate unique gradient ID
        const sanitizedName = hostage['Hebrew Name']?.replace(/\s+/g, '-').replace(/'/g, '').replace(/[^\w\-א-ת]/g, '') || 'unknown';
        const gradientId = `gradient-${this.gradientIdCounter++}-${sanitizedName}`;
        
        // Determine start point and transitions
        const startPoint = this.getStartPoint(hostage);
        const transitions = this.getTransitions(hostage, analysis);
        
        // Build gradient stops based on simplified architecture
        const gradientStops = this.buildGradientStops(startPoint, transitions, analysis);
        
        // Process for RTL direction
        const processedStops = this.processGradientStopsForDirection(gradientStops, analysis, hostage);
        
        // Create the gradient element
        this.createGradientElement(gradientId, processedStops);
        
        return gradientId;
    }

    /**
     * Determine start point for hostage (living or dead from start)
     * @param {Object} hostage - Hostage data
     * @returns {string} 'living' or 'dead'
     */
    getStartPoint(hostage) {
        // Check if died on Oct 7 specifically
        if (hostage.deathDate) {
            try {
                const deathDate = hostage.deathDate instanceof Date ? 
                    hostage.deathDate : new Date(hostage.deathDate);
                
                if (!isNaN(deathDate.getTime())) {
                    const oct7 = new Date('2023-10-07');
                    const diedOnOct7 = Math.abs(deathDate.getTime() - oct7.getTime()) < 86400000; // Within 24 hours
                    if (diedOnOct7) {
                        return 'dead';
                    }
                }
            } catch (error) {
                console.warn('Error parsing death date for hostage:', hostage['Hebrew Name'], error);
            }
        }
        
        return 'living'; // Default: start as living
    }

    /**
     * Get transitions for a hostage based on their path
     * @param {Object} hostage - Hostage data
     * @param {Object} analysis - Path analysis
     * @returns {Array} Array of transition objects
     */
    getTransitions(hostage, analysis) {
        const transitions = [];
        
        // Check hostage path for transitions
        if (hostage.path && hostage.path.length > 1) {
            for (let i = 1; i < hostage.path.length; i++) {
                const fromEvent = hostage.path[i-1].event;
                const toEvent = hostage.path[i].event;
                const fromLane = hostage.path[i-1].lane;
                const toLane = hostage.path[i].lane;
                
                // Find corresponding corner in analysis
                const corner = analysis.corners[i-1];
                
                if (corner) {
                    transitions.push({
                        type: this.getTransitionType(fromEvent, toEvent, fromLane, toLane),
                        corner: corner,
                        fromEvent,
                        toEvent,
                        fromLane,
                        toLane
                    });
                }
            }
        }
        
        return transitions;
    }

    /**
     * Determine transition type between two events/lanes
     * @param {string} fromEvent - Source event
     * @param {string} toEvent - Target event  
     * @param {string} fromLane - Source lane
     * @param {string} toLane - Target lane
     * @returns {string} Transition type
     */
    getTransitionType(fromEvent, toEvent, fromLane, toLane) {
        // Living to Dead transition (unique)
        if (toEvent === 'died' || toLane.includes('deceased')) {
            return 'living-to-dead';
        }
        
        // Released transitions based on target lane
        if (toLane.includes('released-deal-living')) {
            return 'living-to-released-deal';
        }
        if (toLane.includes('released-military-living')) {
            return 'living-to-released-op';
        }
        if (toLane.includes('released-deal-deceased')) {
            return 'dead-to-released-deal';
        }
        if (toLane.includes('released-military-deceased')) {
            return 'dead-to-released-op';
        }
        
        return 'unknown';
    }

    /**
     * Build gradient stops based on start point and transitions
     * @param {string} startPoint - 'living' or 'dead'
     * @param {Array} transitions - Array of transitions
     * @param {Object} analysis - Path analysis
     * @returns {Array} Gradient stops
     */
    buildGradientStops(startPoint, transitions, analysis) {
        const stops = [];
        let currentColor;
        
        // Set initial color based on start point
        if (startPoint === 'dead') {
            // Start as dead: red immediately → gradient to gray
            stops.push({ offset: '0%', color: this.colors.deathEvent });
            stops.push({ offset: '5%', color: this.colors.dead }); // Quick transition to gray
            currentColor = this.colors.dead;
        } else {
            // Start as living: mustard orange
            stops.push({ offset: '0%', color: this.colors.living });
            currentColor = this.colors.living;
        }
        
        // Process each transition
        transitions.forEach((transition, index) => {
            const corner = transition.corner;
            const startPercent = corner.startPercent;
            const endPercent = corner.endPercent;
            
            if (transition.type === 'living-to-dead') {
                // Unique transition: living → red (at first corner) → gray (at second corner)
                stops.push({ offset: `${startPercent}%`, color: currentColor });
                stops.push({ offset: `${startPercent}%`, color: this.colors.deathEvent }); // Start red at first corner
                stops.push({ offset: `${endPercent}%`, color: this.colors.dead }); // End gray at second corner
                currentColor = this.colors.dead;
            } else {
                // Standard transition: maintain current color until start, then transition to target
                const targetColor = this.getTargetColor(transition.type);
                stops.push({ offset: `${startPercent}%`, color: currentColor });
                stops.push({ offset: `${endPercent}%`, color: targetColor });
                currentColor = targetColor;
            }
        });
        
        // End with current color
        stops.push({ offset: '100%', color: currentColor });
        
        return stops;
    }

    /**
     * Get target color for a transition type
     * @param {string} transitionType - Type of transition
     * @returns {string} Target color
     */
    getTargetColor(transitionType) {
        switch (transitionType) {
            case 'living-to-released-deal':
                return this.colors.releasedDealLiving;
            case 'living-to-released-op':
                return this.colors.releasedOpLiving;
            case 'dead-to-released-deal':
                return this.colors.releasedDealDead;
            case 'dead-to-released-op':
                return this.colors.releasedOpDead;
            default:
                return this.colors.living;
        }
    }

    /**
     * Determine the journey type of a hostage
     * @param {Object} hostage - Hostage data
     * @returns {string} Journey type identifier
     */
    determineJourneyType(hostage) {
        // Check final lane first - this is the most reliable indicator
        const finalLane = hostage.finalLane || '';
        const currentStatus = hostage['Current Status'] || '';
        const hasReleaseDate = hostage.releaseDate && hostage.releaseDate_valid;
        
        // Check if died on Oct 7 specifically
        let diedOnOct7 = false;
        if (hostage.deathDate) {
            try {
                const deathDate = hostage.deathDate instanceof Date ? 
                    hostage.deathDate : 
                    new Date(hostage.deathDate);
                
                if (!isNaN(deathDate.getTime())) {
                    // Check if death date is Oct 7, 2023
                    const oct7 = new Date('2023-10-07');
                    diedOnOct7 = Math.abs(deathDate.getTime() - oct7.getTime()) < 86400000; // Within 24 hours
                }
            } catch (error) {
                console.warn('Error parsing death date for hostage:', hostage['Hebrew Name'], error);
            }
        }
        
        // Determine based on final lane first, then status and dates
        if (finalLane.includes('released-deal-living') || finalLane.includes('released-military-living')) {
            // Released alive - use final lane as primary indicator
            return 'released-alive';
        } else if (finalLane.includes('released-deal-deceased') || finalLane.includes('released-military-deceased')) {
            // Released body - use final lane as primary indicator
            return 'released-body';
        } else if (finalLane.includes('kidnapped-deceased')) {
            // Check if body was returned
            if (hasReleaseDate) {
                return 'released-body';
            } else {
                // Still held (body not returned)
                return 'still-captive';
            }
        } else if (currentStatus.includes('Held in Gaza')) {
            // Still in captivity
            return 'still-captive';
        } else if (currentStatus.includes('Released')) {
            // Released alive
            return 'released-alive';
        } else if (currentStatus.includes('Deceased - Returned')) {
            // Body returned
            return 'released-body';
        } else if (currentStatus.includes('Deceased')) {
            // Check if body was returned
            if (hasReleaseDate) {
                return 'released-body';
            } else {
                // Still held (body not returned)
                return 'still-captive';
            }
        } else if (diedOnOct7 && !hasReleaseDate) {
            // Died on Oct 7, body still held
            return 'still-captive';
        } else if (diedOnOct7 && hasReleaseDate) {
            // Died on Oct 7, body returned
            return 'dead-from-start';
        }
        
        // Check path for transitions
        const hasDeathTransition = hostage.path?.some(p => p.event === 'died');
        const hasReleaseTransition = hostage.path?.some(p => p.event === 'released');
        
        if (hasDeathTransition && hasReleaseTransition) {
            return 'released-body';
        } else if (hasDeathTransition && !hasReleaseTransition) {
            return 'still-captive'; // Died but body not returned
        } else if (hasReleaseTransition) {
            return 'released-alive';
        }
        
        // Default: still captive
        return 'still-captive';
    }

    /**
     * Create gradient stops for hostages dead from the start
     * @param {Object} analysis - Path analysis
     * @param {Object} hostage - Hostage data
     * @returns {Array} Gradient stops
     */
    createDeadFromStartGradient(analysis, hostage) {
        const stops = [];
        
        // RTL: Start from right with dark red transitioning to gray
        // First 20px (convert to percentage)
        const transitionPercent = Math.min(5, (20 / analysis.totalLength) * 100);
        
        stops.push({ offset: '0%', color: this.colors.darkRed });
        stops.push({ offset: `${transitionPercent}%`, color: this.colors.deadInCaptivity });
        
        // Check for release
        if (analysis.corners.length > 0 && hostage.releaseDate) {
            const releaseCorner = analysis.corners[analysis.corners.length - 1];
            const releaseColor = this.getReleaseColor(hostage);
            
            // Hold gray until release corner starts
            stops.push({ offset: `${releaseCorner.startPercent}%`, color: this.colors.deadInCaptivity });
            // Gradient during corner
            stops.push({ offset: `${releaseCorner.endPercent}%`, color: releaseColor });
            // Continue with release color
            stops.push({ offset: '100%', color: releaseColor });
        } else {
            // No release, continue with gray
            stops.push({ offset: '100%', color: this.colors.deadInCaptivity });
        }
        
        return stops;
    }

    /**
     * Create gradient stops for hostages who died in captivity
     * @param {Object} analysis - Path analysis
     * @param {Object} hostage - Hostage data
     * @returns {Array} Gradient stops
     */
    createDiedInCaptivityGradient(analysis, hostage) {
        const stops = [];
        
        // Find death transition corner using intelligent selection
        const deathCorner = this.findReleaseTransitionCorner(analysis, hostage);
        
        if (deathCorner) {
            // Living color until death transition starts (same as living releases)
            stops.push({ offset: '0%', color: this.colors.livingInCaptivity });
            stops.push({ offset: `${deathCorner.startPercent}%`, color: this.colors.livingInCaptivity });
            
            // Transition through red to semi-transparent gray during the death transition
            // This follows the same logic as living releases but uses red as transition color
            const transitionMidPoint = (deathCorner.startPercent + deathCorner.endPercent) / 2;
            stops.push({ offset: `${transitionMidPoint}%`, color: this.colors.darkRed });
            stops.push({ offset: `${deathCorner.endPercent}%`, color: this.colors.deadInCaptivityTransparent });
            
            // Check for release (body return)
            if (analysis.corners.length > 1 && hostage.releaseDate) {
                const releaseCorner = analysis.corners[1];
                const releaseColor = this.getReleaseColor(hostage);
                
                // Hold semi-transparent gray until release corner starts
                stops.push({ offset: `${releaseCorner.startPercent}%`, color: this.colors.deadInCaptivityTransparent });
                // Transition to release color (same pattern as living releases)
                stops.push({ offset: `${releaseCorner.endPercent}%`, color: releaseColor });
                stops.push({ offset: '100%', color: releaseColor });
            } else {
                // No release, continue with semi-transparent gray
                stops.push({ offset: '100%', color: this.colors.deadInCaptivityTransparent });
            }
        } else {
            // Fallback if no corner found
            stops.push({ offset: '0%', color: this.colors.livingInCaptivity });
            stops.push({ offset: '100%', color: this.colors.deadInCaptivityTransparent });
        }
        
        return stops;
    }

    /**
     * Create gradient stops for released alive hostages
     * @param {Object} analysis - Path analysis
     * @param {Object} hostage - Hostage data
     * @returns {Array} Gradient stops
     */
    createReleasedAliveGradient(analysis, hostage) {
        const stops = [];
        const releaseColor = this.getReleaseColor(hostage);
        
        // Find the appropriate corner for the release transition
        const releaseCorner = this.findReleaseTransitionCorner(analysis, hostage);
        
        if (releaseCorner) {
            // Use the full span from first point of first corner to second point of second corner
            // This creates a gradual transition across the entire corner pair
            stops.push({ offset: '0%', color: this.colors.livingInCaptivity });
            stops.push({ offset: `${releaseCorner.startPercent}%`, color: this.colors.livingInCaptivity });
            stops.push({ offset: `${releaseCorner.endPercent}%`, color: releaseColor });
            stops.push({ offset: '100%', color: releaseColor });
            
        } else {
            // Fallback if no corner found - create a simple gradient for released hostages
            stops.push({ offset: '0%', color: this.colors.livingInCaptivity });
            stops.push({ offset: '50%', color: this.colors.livingInCaptivity });
            stops.push({ offset: '100%', color: releaseColor });
        }
        
        return stops;
    }

    /**
     * Check if path flows right-to-left and flip gradient stops if needed
     * @param {Array} stops - Original gradient stops
     * @param {Object} analysis - Path analysis
     * @param {Object} hostage - Hostage data
     * @returns {Array} Processed gradient stops (flipped if RTL)
     */
    processGradientStopsForDirection(stops, analysis, hostage) {
        const coordinates = this.getPathGradientCoordinates(analysis, hostage);
        if (!coordinates) {
            return stops; // Return original stops if no coordinates
        }
        
        const isRightToLeft = coordinates.startX > coordinates.endX;
        
        if (isRightToLeft) {
            
            // Flip the percentages and reverse colors
            const flippedStops = stops.map(stop => ({
                ...stop,
                offset: `${100 - parseFloat(stop.offset.replace('%', ''))}%`
            })).reverse();
            return flippedStops;
        }
        
        return stops; // Return original stops for LTR paths
    }

    /**
     * Get transition information for gradient positioning
     * @param {Object} analysis - Path analysis
     * @param {Object} hostage - Hostage data  
     * @param {string} journeyType - Journey type
     * @returns {Object|null} Transition info with start/end percentages
     */
    getTransitionInfo(analysis, hostage, journeyType) {
        if (!analysis || !analysis.corners || analysis.corners.length === 0) {
            return null;
        }
        
        let transitionStart = 0;  // Start of first transition
        let transitionEnd = 100;  // End of last transition
        
        // Find the actual transition boundaries based on corners
        if (analysis.corners.length > 0) {
            transitionStart = analysis.corners[0].startPercent;
            transitionEnd = analysis.corners[analysis.corners.length - 1].endPercent;
        }
        return {
            startPercent: transitionStart,
            endPercent: transitionEnd,
            hasTransitions: analysis.corners.length > 0
        };
    }

    /**
     * Get gradient coordinates spanning the full path from start to end
     * @param {Object} analysis - Path analysis
     * @param {Object} hostage - Hostage data
     * @returns {Object|null} Coordinates object with startX, startY, endX, endY
     */
    getPathGradientCoordinates(analysis, hostage) {
        if (!analysis) {
            console.warn(`[PATH-COORDINATES] ${hostage['Hebrew Name']}: No analysis available`);
            return null;
        }
        
        if (!analysis.segments || analysis.segments.length === 0) {
            console.warn(`[PATH-COORDINATES] ${hostage['Hebrew Name']}: No segments found`);
            return null;
        }
        
        // Get the absolute start point of the path (first segment start)
        const firstSegment = analysis.segments[0];
        const startX = firstSegment.startX;
        const startY = firstSegment.startY;
        
        // Get the absolute end point of the path (last segment end)
        const lastSegment = analysis.segments[analysis.segments.length - 1];
        const endX = lastSegment.endX;
        const endY = lastSegment.endY;
        
        // Validate coordinates
        if (isNaN(startX) || isNaN(startY) || isNaN(endX) || isNaN(endY)) {
            console.warn(`[PATH-COORDINATES] ${hostage['Hebrew Name']}: Invalid coordinates`, {
                startX, startY, endX, endY
            });
            return null;
        }
        
        // Check if start and end points are the same (would create invalid gradient)
        if (Math.abs(startX - endX) < 0.1 && Math.abs(startY - endY) < 0.1) {
            console.warn(`[PATH-COORDINATES] ${hostage['Hebrew Name']}: Start and end points are too close, using fallback`);
            return null;
        }
        
        const coordinates = {
            startX: startX,
            startY: startY, 
            endX: endX,
            endY: endY
        };
        return coordinates;
    }

    /**
     * Find the corner that represents the release transition
     * Corners come in pairs: each transition has 2 corners (start/end of curve)
     * - 0 corners: no transitions (straight line)
     * - 2 corners: 1 transition (use first corner as transition start)
     * - 4 corners: 2 transitions (use first corner of LAST transition for releases)
     * @param {Object} analysis - Path analysis  
     * @param {Object} hostage - Hostage data
     * @returns {Object|null} The corner representing the release transition
     */
    findReleaseTransitionCorner(analysis, hostage) {
        if (!analysis.corners || analysis.corners.length === 0) {
            return null;
        }
        
        let firstCorner, secondCorner;
        
        if (analysis.corners.length === 2) {
            // Single transition: from start of first corner to end of second corner
            firstCorner = analysis.corners[0];
            secondCorner = analysis.corners[1];
        } else if (analysis.corners.length === 4) {
            // Two transitions: use the LAST transition pair (corners 2-3)
            firstCorner = analysis.corners[2];
            secondCorner = analysis.corners[3];
        } else {
            // Fallback
            firstCorner = analysis.corners[0];
            secondCorner = analysis.corners[analysis.corners.length - 1];
        }
        // Calculate focused transition around the vertical segments
        // Use a tighter span - from start of first corner to end of first corner, 
        // then from start of second corner to end of second corner
        const firstVerticalStart = firstCorner.startPercent;
        const firstVerticalEnd = firstCorner.endPercent;
        const secondVerticalStart = secondCorner.startPercent; 
        const secondVerticalEnd = secondCorner.endPercent;
        
        // For gradient, use the middle of the transition zone
        const transitionStartPercent = firstVerticalStart;
        const transitionEndPercent = secondVerticalEnd;
        
        // Special debug for comparison cases
        const isComparisonCase = hostage['Hebrew Name'].includes('שני גורן') || hostage['Hebrew Name'].includes('עופר קלדרון');
        if (isComparisonCase) {
            analysis.corners.forEach((corner, i) => {
            });
        }
        return {
            startPercent: transitionStartPercent,
            endPercent: transitionEndPercent,
            // Add actual coordinates for gradient positioning
            startX: firstCorner.startX,
            startY: firstCorner.startY,
            endX: secondCorner.endX,
            endY: secondCorner.endY,
            firstCorner: firstCorner,
            secondCorner: secondCorner
        };
    }

    /**
     * Create gradient stops for released bodies
     * @param {Object} analysis - Path analysis
     * @param {Object} hostage - Hostage data
     * @returns {Array} Gradient stops
     */
    createReleasedBodyGradient(analysis, hostage) {
        const stops = [];
        const releaseColor = this.getReleaseColor(hostage);
        
        // This combines died-in-captivity with release
        // Find the most appropriate corners for death and release transitions
        
        if (analysis.corners.length >= 2) {
            // For released body, use intelligent selection for the main transition
            const mainCorner = this.findReleaseTransitionCorner(analysis, hostage);
            // Use first corner as death transition if different from main
            const deathCorner = mainCorner === analysis.corners[0] ? analysis.corners[1] : analysis.corners[0];
            const releaseCorner = mainCorner;
            
            // Living until death corner
            stops.push({ offset: '0%', color: this.colors.livingInCaptivity });
            stops.push({ offset: `${deathCorner.startPercent}%`, color: this.colors.livingInCaptivity });
            
            // Death transition over 50% of vertical line
            const deathVerticalLength = deathCorner.endPercent - deathCorner.startPercent;
            const deathTransitionEnd = deathCorner.startPercent + (deathVerticalLength * 0.5);
            stops.push({ offset: `${deathTransitionEnd}%`, color: this.colors.deadInCaptivity });
            stops.push({ offset: `${deathCorner.endPercent}%`, color: this.colors.deadInCaptivity });
            
            // Hold gray until release
            stops.push({ offset: `${releaseCorner.startPercent}%`, color: this.colors.deadInCaptivity });
            
            // Release transition over 50% of vertical line
            const releaseVerticalLength = releaseCorner.endPercent - releaseCorner.startPercent;
            const releaseTransitionEnd = releaseCorner.startPercent + (releaseVerticalLength * 0.5);
            stops.push({ offset: `${releaseTransitionEnd}%`, color: releaseColor });
            stops.push({ offset: '100%', color: releaseColor });
        } else if (analysis.corners.length === 1) {
            // Only one corner - assume it's release
            const releaseCorner = analysis.corners[0];
            
            stops.push({ offset: '0%', color: this.colors.deadInCaptivity });
            stops.push({ offset: `${releaseCorner.startPercent}%`, color: this.colors.deadInCaptivity });
            stops.push({ offset: `${releaseCorner.endPercent}%`, color: releaseColor });
            stops.push({ offset: '100%', color: releaseColor });
        } else {
            // Fallback
            stops.push({ offset: '0%', color: this.colors.deadInCaptivity });
            stops.push({ offset: '100%', color: releaseColor });
        }
        
        return stops;
    }

    /**
     * Create gradient stops for still captive hostages
     * @param {Object} analysis - Path analysis
     * @param {Object} hostage - Hostage data
     * @returns {Array} Gradient stops
     */
    createStillCaptiveGradient(analysis, hostage) {
        // Debug log
        
        // Ensure we have valid colors
        const mustardColor = this.colors.livingInCaptivity || '#DAA520';
        const grayColor = this.colors.deadInCaptivity || '#808080';
        const redColor = this.colors.darkRed || '#8B0000';
        
        // Check if died in captivity but body not returned
        const isDead = hostage.deathDate || 
                       hostage['Current Status']?.toLowerCase().includes('deceased') ||
                       hostage.finalLane === 'kidnapped-deceased';
        // Check if hostage has been in same status from beginning (no transitions)
        const hasTransitions = analysis.corners.length > 0;
        
        if (isDead && hasTransitions) {
            // Has death transition - create gradient
            const deathCorner = analysis.corners[0];
            
            const stops = [
                { offset: '0%', color: mustardColor },
                { offset: `${deathCorner.startPercent}%`, color: mustardColor },
                { offset: `${(deathCorner.startPercent + deathCorner.endPercent) / 2}%`, color: redColor },
                { offset: `${deathCorner.endPercent}%`, color: grayColor },
                { offset: '100%', color: grayColor }
            ];
            
            return stops;
        } else if (isDead) {
            // Dead but no transitions - use semi-transparent gray
            const stops = [
                { offset: '0%', color: this.colors.deadInCaptivityTransparent },
                { offset: '100%', color: this.colors.deadInCaptivityTransparent }
            ];
            
            return stops;
        } else {
            // Still alive in captivity - SOLID COLOR
            const stops = [
                { offset: '0%', color: mustardColor },
                { offset: '100%', color: mustardColor }
            ];
            
            return stops;
        }
    }

    /**
     * Get release color based on release method
     * @param {Object} hostage - Hostage data
     * @returns {string} Color hex code
     */
    getReleaseColor(hostage) {
        const circumstances = (hostage['Release/Death Circumstances'] || '').toLowerCase();
        const finalLane = hostage.finalLane || '';
        const isDeceased = finalLane.includes('deceased');
        
        // Determine operation vs deal
        const isOperation = circumstances.includes('military') || 
                           circumstances.includes('operation') || 
                           circumstances.includes('rescue');
        
        // Return appropriate color based on living/dead and operation/deal
        if (isDeceased) {
            return isOperation ? this.colors.releasedOpDead : this.colors.releasedDealDead;
        } else {
            return isOperation ? this.colors.releasedOpLiving : this.colors.releasedDealLiving;
        }
    }

    /**
     * Create SVG gradient element
     * @param {string} gradientId - Unique gradient ID
     * @param {Array} stops - Array of gradient stops
     * @param {Object} transitionInfo - Transition positioning info
     */
    createGradientElement(gradientId, stops, transitionInfo = null) {
        // Debug: Log what we're creating
        
        // Create linear gradient with coordinates if provided, otherwise use default
        const gradient = this.defsElement
            .append('linearGradient')
            .attr('id', gradientId);
            
        // ALWAYS use 0% to 100% for the gradient vector with objectBoundingBox
        // The gradient positioning is controlled by the STOPS, not the vector
        gradient
            .attr('x1', '0%')    // Always start at beginning of path
            .attr('y1', '0%')    
            .attr('x2', '100%')  // Always end at end of path
            .attr('y2', '0%')    
            .attr('gradientUnits', 'objectBoundingBox');
        // Add stops with debugging
        stops.forEach((stop, index) => {
            gradient.append('stop')
                .attr('offset', stop.offset)
                .attr('stop-color', stop.color)
                .attr('stop-opacity', 1);  // Ensure opacity is 1
        });
        
        // Store gradient definition
        this.gradientDefs.set(gradientId, {
            id: gradientId,
            stops: stops,
            element: gradient
        });
    }

    /**
     * Apply gradient to a path element
     * @param {d3.selection} pathElement - D3 selection of path element
     * @param {Object} hostage - Hostage data
     * @param {string} pathString - SVG path string
     */
    applyGradientToPath(pathElement, hostage, pathString) {
        try {
            // First check if this path actually needs a gradient
            const analysis = this.analyzePath(pathString);
            const hasTransitions = analysis && analysis.corners.length > 0;
            
            // If no transitions, apply solid color directly
            if (!hasTransitions) {
                const solidColor = this.getFallbackColor(hostage);
                pathElement
                    .style('stroke', solidColor)
                    .style('fill', 'none');
                
                console.warn(`[SOLID-COLOR] ${hostage['Hebrew Name']}: No transitions, applied solid color: ${solidColor}`);
                return; // Exit early - no need for gradients
            }
            
            // Create gradient for this hostage
            const gradientId = this.createGradientForHostage(hostage, pathString);
            
            // Debug squares removed - gradient positioning now fixed
            
            if (gradientId) {
                // Apply gradient as stroke
                pathElement
                    .style('stroke', `url(#${gradientId})`)
                    .style('fill', 'none');
                    
                // Store gradient ID for reference
                pathElement.attr('data-gradient-id', gradientId);
                
                // CRITICAL: Verify the gradient was actually applied
                setTimeout(() => {
                    const computedStroke = pathElement.style('stroke');
                    // Only apply fallback if stroke is completely missing or explicitly 'none'
                    // Don't override valid gradient URLs
                    if (!computedStroke || computedStroke === 'none') {
                        console.warn(`[GRADIENT-FAILED] ${hostage['Hebrew Name']}: Gradient ${gradientId} failed to render, applying solid fallback`);
                        const fallbackColor = this.getFallbackColor(hostage);
                        pathElement.style('stroke', fallbackColor);
                    }
                }, 0);
                
            } else {
                // Fallback to solid color
                const fallbackColor = this.getFallbackColor(hostage);
                pathElement.style('stroke', fallbackColor);
                
                console.warn(`[NO-GRADIENT] ${hostage['Hebrew Name']}: No gradient created, using solid fallback color: ${fallbackColor}`);
                
            }
            
            // Ensure stroke is always visible - never set to none
            const currentStroke = pathElement.style('stroke');
            if (!currentStroke || currentStroke === 'none') {
                const fallbackColor = this.getFallbackColor(hostage);
                pathElement.style('stroke', fallbackColor);
                console.warn(`[COLOR-DEBUG] Stroke was none for ${hostage['Hebrew Name']}, applied fallback: ${fallbackColor}`);
            }
        } catch (error) {
            console.error(`[COLOR-DEBUG] Error applying gradient to ${hostage['Hebrew Name']}:`, error);
            // Fallback to solid color on error
            const fallbackColor = this.getFallbackColor(hostage);
            pathElement.style('stroke', fallbackColor);
        }
    }

    /**
     * Get fallback color for a hostage
     * @param {Object} hostage - Hostage data
     * @returns {string} Color hex code
     */
    getFallbackColor(hostage) {
        // Use simplified architecture for fallback colors
        const startPoint = this.getStartPoint(hostage);
        
        if (startPoint === 'dead') {
            return this.colors.dead;
        }
        
        // Check current status for living hostages
        const currentStatus = hostage['Current Status'] || '';
        const finalLane = hostage.finalLane || '';
        
        // Dead in captivity
        if (currentStatus.toLowerCase().includes('deceased') || finalLane.includes('deceased')) {
            return this.colors.dead;
        } else if (hostage.finalLane?.includes('released')) {
            return this.getReleaseColor(hostage);
        } else {
            // Default for still captive living
            return this.colors.living;
        }
    }

    /**
     * Debug: Add purple squares at path points for specific hostages
     * @param {Object} hostage - Hostage data
     * @param {string} pathString - SVG path string
     * @param {string} gradientId - The actual gradient ID that was created
     */
    addDebugSquares(hostage, pathString, gradientId = null) {
        const targetNames = ['נגמה וייס', 'עופר קלדרון'];
        if (!targetNames.includes(hostage['Hebrew Name'])) {
            return; // Only debug these specific hostages
        }
        const analysis = this.analyzePath(pathString);
        if (!analysis || !analysis.segments) {
            console.warn(`[DEBUG-SQUARES] No analysis for ${hostage['Hebrew Name']}`);
            return;
        }
        // Get SVG container
        const svg = this.timeline.svg;
        
        // Clear any previous debug markers for this hostage
        svg.selectAll(`.debug-${hostage['Hebrew Name'].replace(/\s+/g, '-')}`).remove();
        
        // First, highlight the path itself with a thick colored outline
        const pathColor = hostage['Hebrew Name'] === 'נגמה וייס' ? '#ff6b6b' : '#4ecdc4'; // Red for Nechama, Teal for Ofer
        const debugPath = svg.append('path')
            .attr('d', pathString)
            .attr('fill', 'none')
            .attr('stroke', pathColor)
            .attr('stroke-width', 4)
            .attr('stroke-opacity', 0.7)
            .attr('class', `debug-path-highlight debug-${hostage['Hebrew Name'].replace(/\s+/g, '-')}`);
            
        // If we have a gradient, also create a second debug path with the actual gradient applied
        if (gradientId) {
            svg.append('path')
                .attr('d', pathString)
                .attr('fill', 'none')
                .attr('stroke', `url(#${gradientId})`)  // Use the actual gradient
                .attr('stroke-width', 8)  // Thicker to show gradient effect
                .attr('stroke-opacity', 0.9)
                .attr('class', `debug-path-gradient debug-${hostage['Hebrew Name'].replace(/\s+/g, '-')}`);
                
        }
            
        // Add name label near the start of the path
        if (analysis.segments.length > 0) {
            const firstSegment = analysis.segments[0];
            svg.append('text')
                .attr('x', firstSegment.startX + 10)
                .attr('y', firstSegment.startY - 10)
                .attr('fill', pathColor)
                .attr('font-size', '14px')
                .attr('font-weight', 'bold')
                .attr('class', `debug-name-label debug-${hostage['Hebrew Name'].replace(/\s+/g, '-')}`)
                .text(hostage['Hebrew Name']);
                
            // Add label for gradient path if present
            if (gradientId) {
                svg.append('text')
                    .attr('x', firstSegment.startX + 10)
                    .attr('y', firstSegment.startY + 25)
                    .attr('fill', 'purple')
                    .attr('font-size', '12px')
                    .attr('font-weight', 'bold')
                    .attr('class', `debug-gradient-label debug-${hostage['Hebrew Name'].replace(/\s+/g, '-')}`)
                    .text(`GRADIENT: ${gradientId}`);
            }
        }
        
        // Add squares for all segment start and end points with percentage labels
        analysis.segments.forEach((segment, index) => {
            // Start point
            if (segment.startX !== undefined && segment.startY !== undefined) {
                svg.append('rect')
                    .attr('x', segment.startX - 2)
                    .attr('y', segment.startY - 2)
                    .attr('width', 4)
                    .attr('height', 4)
                    .attr('fill', 'purple')
                    .attr('stroke', 'white')
                    .attr('stroke-width', 0.5)
                    .attr('class', `debug-square debug-${hostage['Hebrew Name'].replace(/\s+/g, '-')}`);
                
                // Add percentage label for start point
                const startPercent = (segment.startLength / analysis.totalLength) * 100;
                svg.append('text')
                    .attr('x', segment.startX + 6)
                    .attr('y', segment.startY - 2)
                    .attr('fill', 'black')
                    .attr('font-size', '10px')
                    .attr('font-weight', 'bold')
                    .attr('class', `debug-percent-label debug-${hostage['Hebrew Name'].replace(/\s+/g, '-')}`)
                    .text(`${startPercent.toFixed(1)}%`);
                
            }
            
            // End point (avoid duplicates by only adding if different from next segment's start)
            if (segment.endX !== undefined && segment.endY !== undefined) {
                const nextSegment = analysis.segments[index + 1];
                const isDifferentFromNext = !nextSegment || 
                    Math.abs(segment.endX - nextSegment.startX) > 0.1 || 
                    Math.abs(segment.endY - nextSegment.startY) > 0.1;
                    
                if (isDifferentFromNext) {
                    svg.append('rect')
                        .attr('x', segment.endX - 2)
                        .attr('y', segment.endY - 2)
                        .attr('width', 4)
                        .attr('height', 4)
                        .attr('fill', 'purple')
                        .attr('stroke', 'white')
                        .attr('stroke-width', 0.5)
                        .attr('class', `debug-square debug-${hostage['Hebrew Name'].replace(/\s+/g, '-')}`);
                    
                    // Add percentage label for end point
                    const endPercent = (segment.endLength / analysis.totalLength) * 100;
                    svg.append('text')
                        .attr('x', segment.endX + 6)
                        .attr('y', segment.endY - 2)
                        .attr('fill', 'black')
                        .attr('font-size', '10px')
                        .attr('font-weight', 'bold')
                        .attr('class', `debug-percent-label debug-${hostage['Hebrew Name'].replace(/\s+/g, '-')}`)
                        .text(`${endPercent.toFixed(1)}%`);
                    
                }
            }
        });
        
        // Add special markers for corners
        if (analysis.corners) {
            analysis.corners.forEach((corner, index) => {
                // Corner start - red square
                svg.append('rect')
                    .attr('x', corner.startX - 3)
                    .attr('y', corner.startY - 3)
                    .attr('width', 6)
                    .attr('height', 6)
                    .attr('fill', 'red')
                    .attr('stroke', 'white')
                    .attr('stroke-width', 1)
                    .attr('class', `debug-corner debug-${hostage['Hebrew Name'].replace(/\s+/g, '-')}`);
                
                // Corner start percentage label
                svg.append('text')
                    .attr('x', corner.startX + 8)
                    .attr('y', corner.startY + 2)
                    .attr('fill', 'red')
                    .attr('font-size', '12px')
                    .attr('font-weight', 'bold')
                    .attr('class', `debug-corner-label debug-${hostage['Hebrew Name'].replace(/\s+/g, '-')}`)
                    .text(`${corner.startPercent.toFixed(1)}%`);
                
                // Corner end - green square  
                svg.append('rect')
                    .attr('x', corner.endX - 3)
                    .attr('y', corner.endY - 3)
                    .attr('width', 6)
                    .attr('height', 6)
                    .attr('fill', 'green')
                    .attr('stroke', 'white')
                    .attr('stroke-width', 1)
                    .attr('class', `debug-corner debug-${hostage['Hebrew Name'].replace(/\s+/g, '-')}`);
                
                // Corner end percentage label
                svg.append('text')
                    .attr('x', corner.endX + 8)
                    .attr('y', corner.endY + 2)
                    .attr('fill', 'green')
                    .attr('font-size', '12px')
                    .attr('font-weight', 'bold')
                    .attr('class', `debug-corner-label debug-${hostage['Hebrew Name'].replace(/\s+/g, '-')}`)
                    .text(`${corner.endPercent.toFixed(1)}%`);
                
            });
        }
        
        // Show actual gradient information if gradient was created
        if (gradientId) {
            const gradientDef = this.gradientDefs.get(gradientId);
            if (gradientDef) {
                
                // Get actual gradient element from DOM to see its attributes
                const gradientElement = this.defsElement.select(`#${gradientId}`);
                if (!gradientElement.empty()) {
                    const x1 = gradientElement.attr('x1');
                    const y1 = gradientElement.attr('y1'); 
                    const x2 = gradientElement.attr('x2');
                    const y2 = gradientElement.attr('y2');
                    const gradientUnits = gradientElement.attr('gradientUnits');
                    
                    
                    // Convert gradient vector percentages to actual coordinates for visualization
                    if (gradientUnits === 'objectBoundingBox') {
                        // For objectBoundingBox, the x1,x2 percentages relate to the path's bounding box
                        const startPercent = parseFloat(x1.replace('%', ''));
                        const endPercent = parseFloat(x2.replace('%', ''));
                        
                        // Find coordinates that correspond to these percentages
                        let actualStartCoord = null;
                        let actualEndCoord = null;
                        
                        analysis.segments.forEach(segment => {
                            const segmentStartPercent = (segment.startLength / analysis.totalLength) * 100;
                            const segmentEndPercent = (segment.endLength / analysis.totalLength) * 100;
                            
                            if (!actualStartCoord && segmentStartPercent <= startPercent && segmentEndPercent >= startPercent) {
                                // Interpolate position within segment
                                const ratio = (startPercent - segmentStartPercent) / (segmentEndPercent - segmentStartPercent);
                                actualStartCoord = { 
                                    x: segment.startX + (segment.endX - segment.startX) * ratio,
                                    y: segment.startY + (segment.endY - segment.startY) * ratio,
                                    percent: startPercent 
                                };
                            }
                            
                            if (!actualEndCoord && segmentStartPercent <= endPercent && segmentEndPercent >= endPercent) {
                                // Interpolate position within segment
                                const ratio = (endPercent - segmentStartPercent) / (segmentEndPercent - segmentStartPercent);
                                actualEndCoord = { 
                                    x: segment.startX + (segment.endX - segment.startX) * ratio,
                                    y: segment.startY + (segment.endY - segment.startY) * ratio,
                                    percent: endPercent 
                                };
                            }
                        });
            
                        // Draw ACTUAL gradient markers with purple backgrounds
                        if (actualStartCoord) {
                            // Purple background rectangle for actual gradient start
                            svg.append('rect')
                                .attr('x', actualStartCoord.x - 20)
                                .attr('y', actualStartCoord.y - 20)
                                .attr('width', 40)
                                .attr('height', 14)
                                .attr('fill', 'purple')
                                .attr('stroke', 'yellow')
                                .attr('stroke-width', 2)
                                .attr('class', `debug-actual-gradient debug-${hostage['Hebrew Name'].replace(/\s+/g, '-')}`);
                                
                            // White text label for actual gradient start
                            svg.append('text')
                                .attr('x', actualStartCoord.x)
                                .attr('y', actualStartCoord.y - 8)
                                .attr('fill', 'white')
                                .attr('font-size', '11px')
                                .attr('font-weight', 'bold')
                                .attr('text-anchor', 'middle')
                                .attr('class', `debug-actual-gradient debug-${hostage['Hebrew Name'].replace(/\s+/g, '-')}`)
                                .text(`ACTUAL-START ${actualStartCoord.percent.toFixed(1)}%`);
                        }
                        
                        if (actualEndCoord) {
                            // Purple background rectangle for actual gradient end
                            svg.append('rect')
                                .attr('x', actualEndCoord.x - 20)
                                .attr('y', actualEndCoord.y + 8)
                                .attr('width', 40)
                                .attr('height', 14)
                                .attr('fill', 'purple')
                                .attr('stroke', 'yellow')
                                .attr('stroke-width', 2)
                                .attr('class', `debug-actual-gradient debug-${hostage['Hebrew Name'].replace(/\s+/g, '-')}`);
                                
                            // White text label for actual gradient end
                            svg.append('text')
                                .attr('x', actualEndCoord.x)
                                .attr('y', actualEndCoord.y + 18)
                                .attr('fill', 'white')
                                .attr('font-size', '11px')
                                .attr('font-weight', 'bold')
                                .attr('text-anchor', 'middle')
                                .attr('class', `debug-actual-gradient debug-${hostage['Hebrew Name'].replace(/\s+/g, '-')}`)
                                .text(`ACTUAL-END ${actualEndCoord.percent.toFixed(1)}%`);
                        }
                    }
                }
            }
        }
    }

    /**
     * Clear all cached data and gradients
     */
    clearCache() {
        this.pathAnalysisCache.clear();
        
        // Remove all gradient elements
        this.gradientDefs.forEach((def) => {
            def.element.remove();
        });
        this.gradientDefs.clear();
        
        this.gradientIdCounter = 0;
    }

    /**
     * Update colors configuration
     * @param {Object} newColors - New color definitions
     */
    updateColors(newColors) {
        this.colors = { ...this.colors, ...newColors };
        this.clearCache();
    }

    /**
     * Debug: Log gradient analysis for a hostage
     * @param {Object} hostage - Hostage data
     * @param {string} pathString - SVG path string
     */
    debugGradient(hostage, pathString) {
        const analysis = this.analyzePath(pathString);
        const journeyType = this.determineJourneyType(hostage);
        
        
        if (analysis) {
        }
    }
    
    /**
     * Debug: Verify gradient application for all hostages
     * @param {Array} hostages - Array of hostages with paths
     */
    debugAll(hostages) {
        hostages.forEach((hostage, index) => {
            if (index < 5) { // Limit to first 5 for debugging
                this.debugGradient(hostage, hostage.path);
            }
        });
    }

    /**
     * Debug: Log hostage status information
     * @param {Object} hostage - Hostage data
     */
    debugHostageStatus(hostage) {
        
        const pathString = hostage.path ? 'Has path' : 'No path';
        
        if (hostage['Current Status']?.includes('Held in Gaza')) {
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColorManager;
}