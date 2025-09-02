/**
 * Color Manager System
 * Handles complex gradient transitions based on path geometry
 * Supports RTL layout with precise transition point calculations
 */

class ColorManager {
    constructor(timelineCore, laneManager) {
        this.timeline = timelineCore;
        this.laneManager = laneManager;
        
        // Color definitions
        this.colors = {
            // Base colors
            livingInCaptivity: '#DAA520', // Mustard color
            deadInCaptivity: '#808080', // 50% Gray
            darkRed: '#8B0000', // Dark red for death transitions
            
            // Release colors
            releasedDeal: '#87CEEB', // Light blue
            releasedMilitary: '#8FBC8F', // Light olive green
            
            // Special states
            initialDeath: '#8B0000', // For those dead from beginning
            transitionGradientMid: '#A0522D' // Mid-point for living->dead transitions
        };
        
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
                    
                    // Calculate curve length more accurately using bezier approximation
                    const q1x = currentX + 2/3 * (cmd.cx - currentX);
                    const q1y = currentY + 2/3 * (cmd.cy - currentY);
                    const q2x = cmd.x + 2/3 * (cmd.cx - cmd.x);
                    const q2y = cmd.y + 2/3 * (cmd.cy - cmd.y);
                    
                    // Approximate length using multiple segments
                    const steps = 10;
                    let curveLength = 0;
                    let prevX = currentX;
                    let prevY = currentY;
                    
                    for (let i = 1; i <= steps; i++) {
                        const t = i / steps;
                        const t2 = t * t;
                        const mt = 1 - t;
                        const mt2 = mt * mt;
                        
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
        if (!analysis) return null;
        
        // Determine hostage journey type
        const journeyType = this.determineJourneyType(hostage);
        
        // Generate unique gradient ID
        const gradientId = `gradient-${this.gradientIdCounter++}-${hostage['Hebrew Name']?.replace(/\s+/g, '-')}`;
        
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
        const hasDeathTransition = hostage.path?.some(p => p.event === 'died');
        const hasReleaseTransition = hostage.path?.some(p => p.event === 'released');
        
        // Safely handle deathDate - it might be a string, Date object, or null
        let diedOnOct7 = false;
        if (hostage.deathDate) {
            try {
                const deathDate = hostage.deathDate instanceof Date ? 
                    hostage.deathDate : 
                    new Date(hostage.deathDate);
                
                if (!isNaN(deathDate.getTime())) {
                    diedOnOct7 = deathDate.getTime() === new Date('2023-10-07').getTime();
                }
            } catch (error) {
                console.warn('Error parsing death date for hostage:', hostage['Hebrew Name'], error);
            }
        }
        
        // Use the correct field name for status
        const currentStatus = hostage['Current Status'] || '';
        
        if (diedOnOct7) {
            return 'dead-from-start';
        } else if (hasDeathTransition && hasReleaseTransition) {
            return 'released-body';
        } else if (hasDeathTransition && !hasReleaseTransition) {
            return 'died-in-captivity';
        } else if (hasReleaseTransition) {
            return 'released-alive';
        } else if (currentStatus.includes('Held in Gaza') || currentStatus.includes('Deceased') && !hostage.releaseDate) {
            return 'still-captive';
        } else {
            return 'still-captive';
        }
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
        
        // Find death transition corner (should be first corner)
        const deathCorner = analysis.corners[0];
        
        if (deathCorner) {
            // Living color until after first corner
            stops.push({ offset: '0%', color: this.colors.livingInCaptivity });
            stops.push({ offset: `${deathCorner.startPercent}%`, color: this.colors.livingInCaptivity });
            
            // Gradient during transition: living → dark red → gray
            const midPoint = (deathCorner.startPercent + deathCorner.endPercent) / 2;
            stops.push({ offset: `${midPoint}%`, color: this.colors.darkRed });
            stops.push({ offset: `${deathCorner.endPercent}%`, color: this.colors.deadInCaptivity });
            
            // Check for release (body return)
            if (analysis.corners.length > 1 && hostage.releaseDate) {
                const releaseCorner = analysis.corners[1];
                const releaseColor = this.getReleaseColor(hostage);
                
                // Hold gray until release corner
                stops.push({ offset: `${releaseCorner.startPercent}%`, color: this.colors.deadInCaptivity });
                // Gradient during release corner
                stops.push({ offset: `${releaseCorner.endPercent}%`, color: releaseColor });
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
        
        // Find release corner (should be last corner)
        const releaseCorner = analysis.corners[analysis.corners.length - 1];
        
        if (releaseCorner) {
            // Living color until release corner starts
            stops.push({ offset: '0%', color: this.colors.livingInCaptivity });
            stops.push({ offset: `${releaseCorner.startPercent}%`, color: this.colors.livingInCaptivity });
            
            // Gradient during corner
            stops.push({ offset: `${releaseCorner.endPercent}%`, color: releaseColor });
            
            // Continue with release color for rest of line
            stops.push({ offset: '100%', color: releaseColor });
        } else {
            // Fallback - gradient across entire line
            stops.push({ offset: '0%', color: this.colors.livingInCaptivity });
            stops.push({ offset: '50%', color: releaseColor });
            stops.push({ offset: '100%', color: releaseColor });
        }
        
        return stops;
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
        // Typically: living → dead (first corner) → released (second corner)
        
        if (analysis.corners.length >= 2) {
            const deathCorner = analysis.corners[0];
            const releaseCorner = analysis.corners[1];
            
            // Living until death corner
            stops.push({ offset: '0%', color: this.colors.livingInCaptivity });
            stops.push({ offset: `${deathCorner.startPercent}%`, color: this.colors.livingInCaptivity });
            
            // Death transition
            const deathMidPoint = (deathCorner.startPercent + deathCorner.endPercent) / 2;
            stops.push({ offset: `${deathMidPoint}%`, color: this.colors.darkRed });
            stops.push({ offset: `${deathCorner.endPercent}%`, color: this.colors.deadInCaptivity });
            
            // Hold gray until release
            stops.push({ offset: `${releaseCorner.startPercent}%`, color: this.colors.deadInCaptivity });
            
            // Release transition
            stops.push({ offset: `${releaseCorner.endPercent}%`, color: releaseColor });
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
        // Check if died in captivity but body not returned
        const isDead = hostage.deathDate || hostage.finalLane?.includes('deceased');
        
        if (isDead && analysis.corners.length > 0) {
            // Has death transition
            const deathCorner = analysis.corners[0];
            
            return [
                { offset: '0%', color: this.colors.livingInCaptivity },
                { offset: `${deathCorner.startPercent}%`, color: this.colors.livingInCaptivity },
                { offset: `${(deathCorner.startPercent + deathCorner.endPercent) / 2}%`, color: this.colors.darkRed },
                { offset: `${deathCorner.endPercent}%`, color: this.colors.deadInCaptivity },
                { offset: '100%', color: this.colors.deadInCaptivity }
            ];
        } else if (isDead) {
            // Dead but no visible transition
            return [
                { offset: '0%', color: this.colors.deadInCaptivity },
                { offset: '100%', color: this.colors.deadInCaptivity }
            ];
        } else {
            // Still alive in captivity
            return [
                { offset: '0%', color: this.colors.livingInCaptivity },
                { offset: '100%', color: this.colors.livingInCaptivity }
            ];
        }
    }

    /**
     * Get release color based on release method
     * @param {Object} hostage - Hostage data
     * @returns {string} Color hex code
     */
    getReleaseColor(hostage) {
        const circumstances = (hostage['Release/Death Circumstances'] || '').toLowerCase();
        
        if (circumstances.includes('military') || circumstances.includes('operation') || 
            circumstances.includes('rescue')) {
            return this.colors.releasedMilitary;
        } else {
            return this.colors.releasedDeal;
        }
    }

    /**
     * Create SVG gradient element
     * @param {string} gradientId - Unique gradient ID
     * @param {Array} stops - Array of gradient stops
     */
    createGradientElement(gradientId, stops) {
        // Create linear gradient
        const gradient = this.defsElement
            .append('linearGradient')
            .attr('id', gradientId)
            .attr('x1', '100%')  // RTL: Start from right
            .attr('y1', '0%')
            .attr('x2', '0%')    // RTL: End at left
            .attr('y2', '0%');
        
        // Add stops
        stops.forEach(stop => {
            gradient.append('stop')
                .attr('offset', stop.offset)
                .attr('stop-color', stop.color)
                .attr('stop-opacity', 1);
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
            // Create gradient for this hostage
            const gradientId = this.createGradientForHostage(hostage, pathString);
            
            if (gradientId) {
                // Apply gradient as stroke
                pathElement
                    .style('stroke', `url(#${gradientId})`)
                    .style('fill', 'none');
                    
                // Store gradient ID for reference
                pathElement.attr('data-gradient-id', gradientId);
                
                // Debug: Log successful gradient application
                console.log(`[COLOR-DEBUG] Applied gradient ${gradientId} to ${hostage['Hebrew Name']}`);
            } else {
                // Fallback to solid color
                const fallbackColor = this.getFallbackColor(hostage);
                pathElement.style('stroke', fallbackColor);
                console.log(`[COLOR-DEBUG] Applied fallback color ${fallbackColor} to ${hostage['Hebrew Name']}`);
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
        if (hostage.finalLane?.includes('deceased')) {
            return this.colors.deadInCaptivity;
        } else if (hostage.finalLane?.includes('released')) {
            return this.getReleaseColor(hostage);
        } else {
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColorManager;
}