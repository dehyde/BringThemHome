/**
 * Color Manager System
 * Handles complex gradient transitions based on path geometry
 * Supports RTL layout with precise transition point calculations
 */

class ColorManager {
    constructor(timelineCore, laneManager) {
        this.timeline = timelineCore;
        this.laneManager = laneManager;
        
        // Color definitions - ALIGNED WITH CONFIG.JS
        this.colors = {
            // Base colors
            livingInCaptivity: '#ef4444', // Red for kidnapped living (from config)
            deadInCaptivity: '#7f1d1d', // Dark red for kidnapped deceased (from config)
            darkRed: '#8B0000', // Dark red for death transitions
            
            // Release colors - MATCH CONFIG.JS EXACTLY
            releasedDeal: '#22c55e', // Green for released deal (from config)
            releasedMilitary: '#3b82f6', // Blue for released military (from config)
            
            // Special states
            initialDeath: '#8B0000', // For those dead from beginning
            transitionGradientMid: '#A0522D' // Mid-point for living->dead transitions
        };
        
        // Debug: Log colors to verify
        console.log('[COLOR-MANAGER] Colors initialized:', this.colors);
        
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
        console.log('Color Manager initialized');
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
            console.log(`[PATH-DEBUG] Found ARC commands in path! Types: ${commandTypes.join(', ')}`);
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
                    console.log(`[PATH-WARNING] Unhandled path command: ${cmd.type}`, cmd);
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
            console.warn(`[GRADIENT-FIX] No path analysis for ${hostage['Hebrew Name']}`);
            return null;
        }
        
        // Determine hostage journey type
        const journeyType = this.determineJourneyType(hostage);
        
        
        // Debug logging for all hostages to identify color issues
        console.log(`[GRADIENT-DEBUG] ${hostage['Hebrew Name']}:`, {
            journeyType,
            finalLane: hostage.finalLane,
            currentStatus: hostage['Current Status'],
            corners: analysis.corners.length,
            transitions: analysis.transitions.length,
            releaseColor: this.getReleaseColor(hostage)
        });
        
        // Generate unique gradient ID - sanitize special characters for valid SVG IDs
        const sanitizedName = hostage['Hebrew Name']?.replace(/\s+/g, '-').replace(/'/g, '').replace(/[^\w\-א-ת]/g, '') || 'unknown';
        const gradientId = `gradient-${this.gradientIdCounter++}-${sanitizedName}`;
        
        // Create gradient based on journey type
        let gradientStops = [];
        
        switch (journeyType) {
            case 'dead-from-start':
                gradientStops = this.createDeadFromStartGradient(analysis, hostage);
                break;
                
            case 'died-in-captivity':
                gradientStops = this.createDiedInCaptivityGradient(analysis, hostage);
                break;
                
            case 'released-alive':
                gradientStops = this.createReleasedAliveGradient(analysis, hostage);
                break;
                
            case 'released-body':
                gradientStops = this.createReleasedBodyGradient(analysis, hostage);
                break;
                
            case 'still-captive':
                // Check if we should use solid color instead of gradient
                if (analysis.corners.length === 0) {
                    console.log(`[SOLID-COLOR] Using solid color for ${hostage['Hebrew Name']} (no transitions)`);
                    return null; // Return null to trigger solid color fallback
                }
                gradientStops = this.createStillCaptiveGradient(analysis, hostage);
                break;
                
            default:
                // Fallback to solid color
                gradientStops = [
                    { offset: '0%', color: this.colors.livingInCaptivity },
                    { offset: '100%', color: this.colors.livingInCaptivity }
                ];
        }
        
        // Create the gradient element
        this.createGradientElement(gradientId, gradientStops);
        
        return gradientId;
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
            // Living color until corner starts
            stops.push({ offset: '0%', color: this.colors.livingInCaptivity });
            stops.push({ offset: `${deathCorner.startPercent}%`, color: this.colors.livingInCaptivity });
            
            // Transition over 50% of the vertical transition line  
            const verticalStart = deathCorner.startPercent;
            const verticalEnd = deathCorner.endPercent;
            const verticalLength = verticalEnd - verticalStart;
            const deathTransitionEnd = verticalStart + (verticalLength * 0.5); // 50% of vertical line
            
            // The vertical line should transition from red to dark red over 50% of its length
            stops.push({ offset: `${verticalStart}%`, color: this.colors.livingInCaptivity });
            stops.push({ offset: `${deathTransitionEnd}%`, color: this.colors.deadInCaptivity });
            stops.push({ offset: `${verticalEnd}%`, color: this.colors.deadInCaptivity });
            
            // Check for release (body return)
            if (analysis.corners.length > 1 && hostage.releaseDate) {
                const releaseCorner = analysis.corners[1];
                const releaseColor = this.getReleaseColor(hostage);
                
                // Hold gray until release corner
                stops.push({ offset: `${releaseCorner.startPercent}%`, color: this.colors.deadInCaptivity });
                
                // Transition over 50% of the release vertical line
                const releaseVerticalLength = releaseCorner.endPercent - releaseCorner.startPercent;
                const releaseTransitionEnd = releaseCorner.startPercent + (releaseVerticalLength * 0.5);
                stops.push({ offset: `${releaseTransitionEnd}%`, color: releaseColor });
                // Continue with release color
                stops.push({ offset: '100%', color: releaseColor });
            } else {
                // No release, continue with gray
                stops.push({ offset: '100%', color: this.colors.deadInCaptivity });
            }
        } else {
            // Fallback if no corner found
            stops.push({ offset: '0%', color: this.colors.livingInCaptivity });
            stops.push({ offset: '100%', color: this.colors.deadInCaptivity });
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
            
            console.log(`[GRADIENT-STOPS] ${hostage['Hebrew Name']}: 0%→${releaseCorner.startPercent.toFixed(1)}% (red), ${releaseCorner.startPercent.toFixed(1)}%→${releaseCorner.endPercent.toFixed(1)}% (transition), ${releaseCorner.endPercent.toFixed(1)}%→100% (${releaseColor})`);
        } else {
            // Fallback if no corner found - create a simple gradient for released hostages
            console.log(`[GRADIENT-FALLBACK] No corners found for released hostage ${hostage['Hebrew Name']}, creating simple gradient`);
            stops.push({ offset: '0%', color: this.colors.livingInCaptivity });
            stops.push({ offset: '50%', color: this.colors.livingInCaptivity });
            stops.push({ offset: '100%', color: releaseColor });
        }
        
        return stops;
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
            console.log(`[CORNER-DEBUG] 2 corners: using corners 0-1`);
        } else if (analysis.corners.length === 4) {
            // Two transitions: use the LAST transition pair (corners 2-3)
            firstCorner = analysis.corners[2];
            secondCorner = analysis.corners[3];
            console.log(`[CORNER-DEBUG] 4 corners: using corners 2-3 (last pair)`);
        } else {
            // Fallback
            firstCorner = analysis.corners[0];
            secondCorner = analysis.corners[analysis.corners.length - 1];
            console.log(`[CORNER-DEBUG] ${analysis.corners.length} corners: using first and last`);
        }
        
        console.log(`[CORNER-DEBUG] First corner: start=${firstCorner.startPercent?.toFixed(1)}% end=${firstCorner.endPercent?.toFixed(1)}%`);
        console.log(`[CORNER-DEBUG] Second corner: start=${secondCorner.startPercent?.toFixed(1)}% end=${secondCorner.endPercent?.toFixed(1)}%`);
        
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
            console.log(`[COMPARE-DEBUG] === ${hostage['Hebrew Name']} ===`);
            console.log(`[COMPARE-DEBUG] Release date: ${hostage.releaseDate}`);
            console.log(`[COMPARE-DEBUG] Total path length: ${analysis.totalLength?.toFixed(1)}`);
            console.log(`[COMPARE-DEBUG] All corners:`);
            analysis.corners.forEach((corner, i) => {
                console.log(`  Corner ${i}: ${corner.startPercent?.toFixed(1)}%-${corner.endPercent?.toFixed(1)}% (length: ${corner.startLength?.toFixed(1)}-${corner.endLength?.toFixed(1)}, startX: ${corner.startX?.toFixed(1)}, startY: ${corner.startY?.toFixed(1)}, endX: ${corner.endX?.toFixed(1)}, endY: ${corner.endY?.toFixed(1)})`);
            });
            console.log(`[COMPARE-DEBUG] Using corners: ${analysis.corners.length === 2 ? '0-1' : '2-3'}`);
            console.log(`[COMPARE-DEBUG] Transition span: ${transitionStartPercent.toFixed(1)}%-${transitionEndPercent.toFixed(1)}%`);
        }
        
        console.log(`[TRANSITION-PRECISE] ${hostage['Hebrew Name']}: ${analysis.corners.length} corners, transition from ${transitionStartPercent.toFixed(1)}% to ${transitionEndPercent.toFixed(1)}% of path, release date: ${hostage.releaseDate}`);
        
        return {
            startPercent: transitionStartPercent,
            endPercent: transitionEndPercent
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
        console.log(`[STILL-CAPTIVE] Creating gradient for ${hostage['Hebrew Name']}`);
        console.log(`[STILL-CAPTIVE] Current Status: ${hostage['Current Status']}`);
        console.log(`[STILL-CAPTIVE] Analysis corners: ${analysis.corners.length}`);
        
        // Ensure we have valid colors
        const mustardColor = this.colors.livingInCaptivity || '#DAA520';
        const grayColor = this.colors.deadInCaptivity || '#808080';
        const redColor = this.colors.darkRed || '#8B0000';
        
        // Check if died in captivity but body not returned
        const isDead = hostage.deathDate || 
                       hostage['Current Status']?.toLowerCase().includes('deceased') ||
                       hostage.finalLane === 'kidnapped-deceased';
        
        console.log(`[STILL-CAPTIVE] Is dead: ${isDead}`);
        
        // Check if hostage has been in same status from beginning (no transitions)
        const hasTransitions = analysis.corners.length > 0;
        console.log(`[STILL-CAPTIVE] Has transitions: ${hasTransitions}`);
        
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
            
            console.log(`[STILL-CAPTIVE] Death transition stops:`, stops);
            return stops;
        } else if (isDead) {
            // Dead but no transitions - SOLID COLOR
            const stops = [
                { offset: '0%', color: grayColor },
                { offset: '100%', color: grayColor }
            ];
            
            console.log(`[STILL-CAPTIVE] Dead (solid color) stops:`, stops);
            return stops;
        } else {
            // Still alive in captivity - SOLID COLOR
            const stops = [
                { offset: '0%', color: mustardColor },
                { offset: '100%', color: mustardColor }
            ];
            
            console.log(`[STILL-CAPTIVE] Alive (solid color) stops:`, stops);
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
        
        let color;
        if (circumstances.includes('military') || circumstances.includes('operation') || 
            circumstances.includes('rescue')) {
            color = this.colors.releasedMilitary;
        } else {
            color = this.colors.releasedDeal;
        }
        
        // Debug logging for color assignment
        console.log(`[COLOR-ASSIGNMENT] ${hostage['Hebrew Name']}:`, {
            circumstances: hostage['Release/Death Circumstances'],
            finalLane: hostage.finalLane,
            assignedColor: color,
            isMilitary: circumstances.includes('military') || circumstances.includes('operation') || circumstances.includes('rescue')
        });
        
        return color;
    }

    /**
     * Create SVG gradient element
     * @param {string} gradientId - Unique gradient ID
     * @param {Array} stops - Array of gradient stops
     * @param {Object} coordinates - Optional XY coordinates for gradient positioning
     */
    createGradientElement(gradientId, stops) {
        // Debug: Log what we're creating
        console.log(`[GRADIENT-CREATE] Creating gradient: ${gradientId}`);
        console.log(`[GRADIENT-CREATE] Stops:`, stops);
        
        // Create linear gradient following the path direction (top to bottom)
        const gradient = this.defsElement
            .append('linearGradient')
            .attr('id', gradientId)
            .attr('x1', '0%')    // Same X position
            .attr('y1', '0%')    // Start from top
            .attr('x2', '0%')    // Same X position  
            .attr('y2', '100%'); // End at bottom
        
        // Add stops with debugging
        stops.forEach((stop, index) => {
            console.log(`[GRADIENT-CREATE] Stop ${index}: ${stop.offset} = ${stop.color}`);
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
            
            // Debug logging for specific hostages
            if (hostage['Hebrew Name'] === 'עפרי ברודץ\'' || hostage['Hebrew Name'] === 'אוהד יהלומי') {
                console.log(`[APPLY-DEBUG] ${hostage['Hebrew Name']} - Starting gradient application`);
            }
            
            // Create gradient for this hostage
            const gradientId = this.createGradientForHostage(hostage, pathString);
            
            if (gradientId) {
                // Apply gradient as stroke
                pathElement
                    .style('stroke', `url(#${gradientId})`)
                    .style('fill', 'none');
                    
                // Store gradient ID for reference
                pathElement.attr('data-gradient-id', gradientId);
                
                
                // Debug logging for specific hostages
                if (hostage['Hebrew Name'] === 'עפרי ברודץ\'' || hostage['Hebrew Name'] === 'אוהד יהלומי') {
                    console.log(`[APPLY-DEBUG] ${hostage['Hebrew Name']} - Applied gradient: ${gradientId}`);
                }
                
                // CRITICAL: Verify the gradient was actually applied
                setTimeout(() => {
                    const computedStroke = pathElement.style('stroke');
                    // Only apply fallback if stroke is completely missing or explicitly 'none'
                    // Don't override valid gradient URLs
                    if (!computedStroke || computedStroke === 'none') {
                        console.warn(`[COLOR-DEBUG] Gradient failed for ${hostage['Hebrew Name']}, applying fallback`);
                        const fallbackColor = this.getFallbackColor(hostage);
                        pathElement.style('stroke', fallbackColor);
                    } else if (computedStroke.includes('url(')) {
                        console.log(`[COLOR-DEBUG] Gradient successfully applied for ${hostage['Hebrew Name']}: ${computedStroke}`);
                    }
                }, 0);
                
                console.log(`[COLOR-DEBUG] Applied gradient ${gradientId} to ${hostage['Hebrew Name']}`);
            } else {
                // Fallback to solid color
                const fallbackColor = this.getFallbackColor(hostage);
                pathElement.style('stroke', fallbackColor);
                
                // Debug logging for specific hostages
                if (hostage['Hebrew Name'] === 'עפרי ברודץ\'' || hostage['Hebrew Name'] === 'אוהד יהלומי') {
                    console.log(`[APPLY-DEBUG] ${hostage['Hebrew Name']} - Using fallback color: ${fallbackColor}`);
                }
                
                console.log(`[COLOR-DEBUG] Applied fallback color ${fallbackColor} to ${hostage['Hebrew Name']}`);
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
        const currentStatus = hostage['Current Status'] || '';
        
        // Check if still in captivity
        if (currentStatus.includes('Held in Gaza')) {
            // Check if dead or alive
            if (hostage.deathDate || currentStatus.toLowerCase().includes('deceased')) {
                return this.colors.deadInCaptivity;
            } else {
                return this.colors.livingInCaptivity;
            }
        }
        
        // Check final lane
        if (hostage.finalLane?.includes('deceased')) {
            return this.colors.deadInCaptivity;
        } else if (hostage.finalLane?.includes('released')) {
            return this.getReleaseColor(hostage);
        } else {
            // Default for still captive
            return this.colors.livingInCaptivity;
        }
    }

    /**
     * Clear all cached data and gradients
     */
    clearCache() {
        this.pathAnalysisCache.clear();
        
        // Remove all gradient elements
        this.gradientDefs.forEach((def, id) => {
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
        
        console.log(`[COLOR-DEBUG] ${hostage['Hebrew Name']}:`, {
            journeyType,
            corners: analysis?.corners.length || 0,
            transitions: analysis?.transitions.length || 0,
            totalLength: analysis?.totalLength || 0,
            hasDeathDate: !!hostage.deathDate,
            hasReleaseDate: !!hostage.releaseDate,
            finalLane: hostage.finalLane,
            path: hostage.path?.map(p => `${p.lane}@${p.event}`)
        });
        
        if (analysis) {
            console.log('[COLOR-DEBUG] Path analysis:', {
                totalLength: analysis.totalLength,
                segments: analysis.segments.length,
                corners: analysis.corners.map(c => ({
                    start: `${c.startPercent.toFixed(1)}%`,
                    end: `${c.endPercent.toFixed(1)}%`,
                    direction: c.direction,
                    isTransition: c.isTransition
                })),
                transitions: analysis.transitions.map(t => ({
                    type: t.type,
                    start: `${t.startPercent.toFixed(1)}%`,
                    end: `${t.endPercent.toFixed(1)}%`,
                    direction: t.direction
                }))
            });
        }
    }
    
    /**
     * Debug: Verify gradient application for all hostages
     * @param {Array} hostages - Array of hostages with paths
     */
    debugAll(hostages) {
        console.log('[COLOR-DEBUG] Analyzing all hostages...');
        hostages.forEach((hostage, index) => {
            if (index < 5) { // Limit to first 5 for debugging
                console.log(`[COLOR-DEBUG] Hostage ${index + 1}:`, hostage['Hebrew Name']);
                this.debugGradient(hostage, hostage.path);
            }
        });
    }

    /**
     * Debug: Log hostage status information
     * @param {Object} hostage - Hostage data
     */
    debugHostageStatus(hostage) {
        console.log(`[COLOR-DEBUG] Hostage: ${hostage['Hebrew Name']}`);
        console.log(`  Current Status: ${hostage['Current Status']}`);
        console.log(`  Final Lane: ${hostage.finalLane}`);
        console.log(`  Has Death Date: ${!!hostage.deathDate}`);
        console.log(`  Has Release Date: ${!!hostage.releaseDate}`);
        console.log(`  Journey Type: ${this.determineJourneyType(hostage)}`);
        
        const pathString = hostage.path ? 'Has path' : 'No path';
        console.log(`  Path: ${pathString}`);
        
        if (hostage['Current Status']?.includes('Held in Gaza')) {
            console.log(`  >>> Still in captivity!`);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColorManager;
}