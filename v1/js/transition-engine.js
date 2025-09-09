/**
 * Transition Engine
 * Phase 3: State transition system with Bezier curves and parallel turning
 * Implements PRD specifications for smooth hostage lane transitions
 */

class TransitionEngine {
    constructor(timelineCore, laneManager) {
        this.timeline = timelineCore;
        this.laneManager = laneManager;
        this.config = {
            baseTurnRadius: 4, // 4px base radius for smoother corners
            curveType: 'cubic-bezier',
            minSpacing: 2, // Minimum spacing between parallel transitions
            transitionBuffer: 1 // Additional buffer for transition calculations
        };
        
        // Cache for transition groups to optimize parallel turning
        this.transitionGroups = new Map();
    }

    /**
     * Generate complete transition path for a hostage journey
     * @param {Object} hostage - Hostage record with path data
     * @returns {string} SVG path string with proper Bezier curves
     */
    generateTransitionPath(hostage) {
        if (!hostage.path || hostage.path.length === 0) {
            return '';
        }

        const path = d3.path();
        const segments = this.calculatePathSegments(hostage);
        
        if (segments.length === 0) {
            return '';
        }

        // Validate all segments before creating path
        const validSegments = segments.filter(segment => {
            const isValid = !isNaN(segment.startX) && !isNaN(segment.startY) && 
                           !isNaN(segment.endX) && !isNaN(segment.endY);
            if (!isValid) {
                console.warn('🚨 TRANSITION-ENGINE: Filtering invalid segment:', segment);
            }
            return isValid;
        });
        
        if (validSegments.length === 0) {
            console.warn('🚨 TRANSITION-ENGINE: No valid segments for', hostage['Hebrew Name']);
            return '';
        }

        // Start the path with pixel-aligned coordinates
        const firstSegment = validSegments[0];
        path.moveTo(Math.round(firstSegment.startX), Math.round(firstSegment.startY));

        // Generate each segment
        validSegments.forEach((segment, index) => {
            if (segment.isTransition) {
                this.addTransitionSegment(path, segment);
            } else {
                this.addHorizontalSegment(path, segment);
            }
        });

        return path.toString();
    }

    /**
     * Calculate path segments for a hostage journey
     * @param {Object} hostage - Hostage record
     * @returns {Array} Array of path segments
     */
    calculatePathSegments(hostage) {
        const segments = [];
        const pathPoints = hostage.path;

        for (let i = 0; i < pathPoints.length; i++) {
            const currentPoint = pathPoints[i];
            const nextPoint = pathPoints[i + 1];

            // Get Y coordinates for the specific lane at this point
            // Use NEW API to get position in the specific lane
            const currentY = this.laneManager.getHostageY(hostage, currentPoint.lane);
            
            // Validate Y coordinate - use fallback instead of skipping
            let safeCurrentY = currentY;
            if (isNaN(currentY)) {
                console.warn('🚨 TRANSITION-ENGINE: Invalid currentY coordinate for', hostage['Hebrew Name'], 'in lane', currentPoint.lane, 'using fallback');
                safeCurrentY = 100; // Fallback Y coordinate
            }

            // Ensure currentPoint.date is valid
            let currentDate = currentPoint.date;
            if (!(currentDate instanceof Date)) {
                if (typeof currentDate === 'string') {
                    currentDate = new Date(currentDate);
                } else {
                    console.warn('🚨 TRANSITION-ENGINE: Invalid currentPoint date:', currentPoint);
                    currentDate = new Date(); // Fallback
                }
            }
            
            const currentX = this.timeline.dateToX(currentDate);
            
            // Debug logging for specific hostages
            if (hostage['Hebrew Name'] === 'איתי חן' || hostage['Hebrew Name'] === 'מקסים הרקין') {
                console.log(`[VISIBILITY-DEBUG] ${hostage['Hebrew Name']} path coordinates:`, {
                    currentDate: currentDate,
                    currentX: currentX,
                    timelineDomain: this.timeline.scales.x.domain(),
                    timelineRange: this.timeline.scales.x.range(),
                    timelineWidth: this.timeline.dimensions.width,
                    svgWidth: Math.max(this.timeline.dimensions.containerWidth, this.timeline.config.minWidth)
                });
            }
            
            // Validate X coordinate - use fallback instead of skipping
            let safeCurrentX = currentX;
            if (isNaN(currentX)) {
                console.warn('🚨 TRANSITION-ENGINE: Invalid currentX coordinate from date:', currentDate, 'using fallback');
                safeCurrentX = 0; // Fallback X coordinate (timeline start)
            }

            if (!nextPoint) {
                // Final segment - horizontal line extending to timeline end
                // ALL hostages should have lines that extend to current date
                const endX = this.timeline.dateToX(new Date());
                
                // Validate endX coordinate - use fallback instead of skipping
                let safeEndX = endX;
                if (isNaN(endX)) {
                    console.warn('🚨 TRANSITION-ENGINE: Invalid endX coordinate, using fallback');
                    safeEndX = safeCurrentX + 100; // Fallback: extend a bit from current position
                }
                
                segments.push({
                    isTransition: false,
                    startX: safeCurrentX,
                    startY: safeCurrentY,
                    endX: safeEndX,
                    endY: safeCurrentY,
                    lane: currentPoint.lane
                });
                
                console.log(`[SEGMENTS] Final segment for ${hostage['Hebrew Name']}: startY=${currentY}, endY=${currentY}, lane=${currentPoint.lane}`);
                // This ensures all lines extend to timeline end
            } else {
                // Calculate transition
                const nextY = this.laneManager.getTransitionY(nextPoint.lane, hostage);
                
                // Validate nextY coordinate - use fallback instead of skipping
                let safeNextY = nextY;
                if (isNaN(nextY)) {
                    console.warn('🚨 TRANSITION-ENGINE: Invalid nextY coordinate for', hostage['Hebrew Name'], 'in lane', nextPoint.lane, 'using fallback');
                    safeNextY = safeCurrentY + 50; // Fallback: move down a bit from current position
                }
                
                // Ensure nextPoint.date is a valid Date object
                let transitionDate = nextPoint.date;
                if (!transitionDate) {
                    console.warn('🚨 TRANSITION-ENGINE: No date in nextPoint:', nextPoint);
                    transitionDate = new Date(); // Fallback to current date
                } else if (!(transitionDate instanceof Date)) {
                    // Try to convert string dates back to Date objects
                    if (typeof transitionDate === 'string') {
                        transitionDate = new Date(transitionDate);
                        if (isNaN(transitionDate.getTime())) {
                            console.warn('🚨 TRANSITION-ENGINE: Invalid date string in nextPoint:', nextPoint.date);
                            transitionDate = new Date(); // Fallback to current date
                        }
                    } else {
                        console.warn('🚨 TRANSITION-ENGINE: Invalid date type in nextPoint:', typeof transitionDate, nextPoint);
                        transitionDate = new Date(); // Fallback to current date
                    }
                }
                
                const nextX = this.timeline.dateToX(transitionDate);
                
                // Validate X coordinate - use fallback instead of skipping
                let safeNextX = nextX;
                if (isNaN(nextX)) {
                    console.warn('🚨 TRANSITION-ENGINE: Invalid nextX coordinate from date:', transitionDate, 'using fallback');
                    safeNextX = safeCurrentX + 50; // Fallback: move right a bit from current position
                }

                // Determine turn radius for this transition, passing the specific transition context
                const turnRadius = this.calculateTransitionRadius(transitionDate, hostage, currentPoint, nextPoint);

                // Calculate adjusted X position for corner radius logic (RTL-aware)
                const adjustedNextX = safeNextX - turnRadius;

                // Transition segment handles the curve from current lane to next lane
                segments.push({
                    isTransition: true,
                    startX: safeCurrentX,
                    startY: safeCurrentY,
                    endX: safeCurrentX, // Transition doesn't extend horizontally
                    endY: safeNextY,
                    transitionDate: transitionDate,
                    fromLane: currentPoint.lane,
                    toLane: nextPoint.lane,
                    turnRadius: turnRadius,
                    hostage: hostage
                });
                
                // Add horizontal segment after transition
                const isLastTransition = (i === pathPoints.length - 2);
                
                if (isLastTransition) {
                    // Last transition - extend to timeline end
                    const endX = this.timeline.dateToX(new Date());
                    const safeEndX = isNaN(endX) ? adjustedNextX + 100 : endX;
                    
                    segments.push({
                        isTransition: false,
                        startX: adjustedNextX, // Start from adjusted position after corner radius
                        startY: safeNextY,
                        endX: safeEndX,
                        endY: safeNextY,
                        lane: nextPoint.lane
                    });
                    
                    console.log(`[SEGMENTS] Post-transition segment for ${hostage['Hebrew Name']}: startY=${nextY}, endY=${nextY}, lane=${nextPoint.lane}`);
                } else {
                    // Intermediate transition - add horizontal segment to next transition
                    const followingPoint = pathPoints[i + 2];
                    let horizontalEndX = followingPoint ? this.timeline.dateToX(followingPoint.date) : adjustedNextX;
                    if (isNaN(horizontalEndX)) {
                        horizontalEndX = adjustedNextX + 50; // Fallback
                    }
                    
                    segments.push({
                        isTransition: false,
                        startX: adjustedNextX, // Start from adjusted position after corner radius
                        startY: safeNextY,
                        endX: horizontalEndX,
                        endY: safeNextY,
                        lane: nextPoint.lane
                    });
                    
                    console.log(`[SEGMENTS] Intermediate segment for ${hostage['Hebrew Name']}: startY=${nextY}, endY=${nextY}, lane=${nextPoint.lane}`);
                }
            }
        }

        return segments;
    }

    /**
     * Add horizontal line segment to path
     * @param {d3.path} path - D3 path object
     * @param {Object} segment - Segment data
     */
    addHorizontalSegment(path, segment) {
        // Final validation before adding to path
        if (isNaN(segment.endX) || isNaN(segment.endY)) {
            console.error('🚨 TRANSITION-ENGINE: Invalid coordinates in addHorizontalSegment:', segment);
            return;
        }
        // Round coordinates for pixel-perfect rendering
        path.lineTo(Math.round(segment.endX), Math.round(segment.endY));
    }

    /**
     * Add transition segment with rectangular corner turns using SVG arcs
     * Creates smooth rounded corners for lane transitions
     * @param {d3.path} path - D3 path object  
     * @param {Object} segment - Transition segment data
     */
    addTransitionSegment(path, segment) {
        const { startX, startY, endX, endY, transitionDate, turnRadius, hostage, fromLane, toLane } = segment;
        
        // Final validation before adding to path
        if (isNaN(startX) || isNaN(startY) || isNaN(endX) || isNaN(endY) || isNaN(turnRadius)) {
            console.error('🚨 TRANSITION-ENGINE: Invalid coordinates in addTransitionSegment:', segment);
            return;
        }
        
        // Get the actual transition date X coordinate
        let transitionX = this.timeline.dateToX(transitionDate);
        
        // Validate transitionX
        if (isNaN(transitionX)) {
            console.error('🚨 TRANSITION-ENGINE: Invalid transitionX from date:', transitionDate);
            return;
        }
        
        // Calculate inverted radius for second corner using MaxR + MinR - SourceCornerRadius
        const firstCornerRadius = turnRadius; // Source corner radius
        const secondCornerRadius = this.calculateInvertedRadius(transitionDate, fromLane, toLane, firstCornerRadius);
        
        // Determine movement direction
        const isMovingUp = endY < startY;
        
        // Calculate the 4 corner points for rectangular turns (RTL-aware)
        // Use firstCornerRadius for X positioning to maintain original corner shape
        const adjustedTransitionX = transitionX - firstCornerRadius;
        
        // Point 1: Exactly at transitionX, original Y
        const point1X = transitionX;
        const point1Y = startY;
        
        // Point 2: Adjusted X position, original Y ± firstCornerRadius  
        const point2X = adjustedTransitionX;
        const point2Y = isMovingUp ? startY - firstCornerRadius : startY + firstCornerRadius;
        
        // Point 3: Adjusted X position, new Y ± secondCornerRadius
        const point3X = adjustedTransitionX;
        const point3Y = isMovingUp ? endY + secondCornerRadius : endY - secondCornerRadius;
        
        // Point 4: Should be further left for proper horizontal continuation
        const point4X = adjustedTransitionX - secondCornerRadius; // Use second corner radius for final positioning
        const point4Y = endY;
        
        // Create smooth corner transitions with different radii for each corner
        // Don't round coordinates in curves - let geometricPrecision handle it
        // 1. Line to corner start
        path.lineTo(point1X, point1Y);
        
        // 2. First smooth corner: horizontal to vertical turn using firstCornerRadius
        const control1X = adjustedTransitionX;
        const control1Y = startY;
        path.quadraticCurveTo(control1X, control1Y, point2X, point2Y);
        
        // 3. Vertical line segment
        path.lineTo(point3X, point3Y);
        
        // 4. Second smooth corner: vertical to horizontal turn using secondCornerRadius
        const control2X = adjustedTransitionX;
        const control2Y = endY;
        path.quadraticCurveTo(control2X, control2Y, point4X, point4Y);
        
        // Path now ends at point4, ready for next segment
    }

    /**
     * Calculate turn radius for a specific transition, accounting for parallel transitions
     * @param {Date} transitionDate - Date of transition
     * @param {Object} hostage - Hostage record
     * @param {Object} fromPoint - Source path point
     * @param {Object} toPoint - Destination path point
     * @returns {number} Turn radius in pixels
     */
    calculateTransitionRadius(transitionDate, hostage, fromPoint, toPoint) {
        // Get all simultaneous transitions for this specific transition type
        const simultaneousTransitions = this.getSimultaneousTransitionsForPathTransition(transitionDate, fromPoint.lane, toPoint.lane);
        
        if (simultaneousTransitions.length <= 1) {
            return this.config.baseTurnRadius;
        }

        // Find this hostage's position in the simultaneous transition group
        const hostageIndex = simultaneousTransitions.findIndex(t => 
            t.hostage['Hebrew Name'] === hostage['Hebrew Name']
        );

        // Calculate adjusted radius based on position
        // First transition uses base radius, subsequent ones get larger radii for parallel turning
        const radiusMultiplier = 1 + (hostageIndex * 0.3); // 30% increase per additional transition
        return this.config.baseTurnRadius * radiusMultiplier;
    }

    /**
     * Calculate inverted radius for second corner using MaxR + MinR - SourceCornerRadius formula
     * @param {Date} transitionDate - Date of transition
     * @param {string} fromLane - Source lane
     * @param {string} toLane - Destination lane
     * @param {number} firstCornerRadius - Original radius for first corner
     * @returns {number} Inverted radius for second corner
     */
    calculateInvertedRadius(transitionDate, fromLane, toLane, firstCornerRadius) {
        // Get all simultaneous transitions to find the range
        const simultaneousTransitions = this.getSimultaneousTransitionsForPathTransition(transitionDate, fromLane, toLane);
        
        if (simultaneousTransitions.length <= 1) {
            // Single transition - just return base radius for second corner
            return this.config.baseTurnRadius;
        }

        // Calculate the range of radii for this group
        const maxIndex = simultaneousTransitions.length - 1;
        const minRadius = this.config.baseTurnRadius; // First index (base radius)
        const maxRadius = this.config.baseTurnRadius * (1 + (maxIndex * 0.3)); // Last index gets largest radius
        
        // Apply inversion formula: MaxR + MinR - SourceCornerRadius
        const invertedRadius = maxRadius + minRadius - firstCornerRadius;
        
        // Ensure we don't go below base radius
        return Math.max(invertedRadius, this.config.baseTurnRadius);
    }

    /**
     * Get all transitions happening on the same date for a specific path transition
     * This includes death transitions (kidnapped-living → kidnapped-deceased) and release transitions
     * @param {Date} transitionDate - Date to check
     * @param {string} fromLane - Source lane
     * @param {string} toLane - Destination lane
     * @returns {Array} Array of simultaneous transitions
     */
    getSimultaneousTransitionsForPathTransition(transitionDate, fromLane, toLane) {
        // Safety check for date object
        if (!transitionDate || !(transitionDate instanceof Date) || isNaN(transitionDate.getTime())) {
            console.warn('🚨 TRANSITION-ENGINE: Invalid date passed to getSimultaneousTransitionsForPathTransition:', transitionDate);
            return [];
        }
        
        const dateKey = transitionDate.toDateString();
        // CHANGE: Group ALL transitions on the same date together, not by specific lane pairs
        const cacheKey = `${dateKey}-ALL-TRANSITIONS`;
        
        if (!this.transitionGroups.has(cacheKey)) {
            // Build transition group for ALL transitions on this date
            const sortedData = this.laneManager.getSortedData();
            const simultaneousTransitions = [];

            sortedData.forEach(hostage => {
                // Check ALL path transitions, not just the final transitionEvent
                if (hostage.path && Array.isArray(hostage.path)) {
                    hostage.path.forEach((pathPoint, index) => {
                        // Skip the first point (kidnapping) - only check actual transitions
                        if (index === 0) return;
                        
                        const previousPoint = hostage.path[index - 1];
                        
                        let eventDate = pathPoint.date;
                        if (!(eventDate instanceof Date)) {
                            if (typeof eventDate === 'string') {
                                eventDate = new Date(eventDate);
                            } else {
                                return; // Skip invalid dates
                            }
                        }
                        
                        // Include ALL transitions on this date, regardless of lane types
                        if (!isNaN(eventDate.getTime()) && eventDate.toDateString() === dateKey) {
                            simultaneousTransitions.push({
                                hostage: hostage,
                                date: transitionDate,
                                fromLane: previousPoint.lane,
                                toLane: pathPoint.lane,
                                event: pathPoint.event
                            });
                        }
                    });
                }
            });

            // Sort by lane priority to ensure consistent ordering
            simultaneousTransitions.sort((a, b) => {
                const priorityA = this.laneManager.laneDefinitions[a.toLane]?.priority || 999;
                const priorityB = this.laneManager.laneDefinitions[b.toLane]?.priority || 999;
                return priorityA - priorityB;
            });

            this.transitionGroups.set(cacheKey, simultaneousTransitions);
        }

        // Filter the cached results to only return transitions matching the specific lane change we're calculating
        const allTransitions = this.transitionGroups.get(cacheKey);
        return allTransitions.filter(t => t.fromLane === fromLane && t.toLane === toLane);
    }

    /**
     * Get all transitions happening on the same date (legacy method for final transitions only)
     * @param {Date} transitionDate - Date to check
     * @returns {Array} Array of simultaneous transitions
     */
    getSimultaneousTransitions(transitionDate) {
        // Safety check for date object
        if (!transitionDate || !(transitionDate instanceof Date) || isNaN(transitionDate.getTime())) {
            console.warn('🚨 TRANSITION-ENGINE: Invalid date passed to getSimultaneousTransitions:', transitionDate);
            return [];
        }
        
        const dateKey = transitionDate.toDateString();
        
        if (!this.transitionGroups.has(dateKey)) {
            // Build transition group for this date
            const sortedData = this.laneManager.getSortedData();
            const simultaneousTransitions = [];

            sortedData.forEach(hostage => {
                if (hostage.transitionEvent && hostage.transitionEvent.date) {
                    // Ensure hostage.transitionEvent.date is a proper Date object
                    let eventDate = hostage.transitionEvent.date;
                    if (!(eventDate instanceof Date)) {
                        if (typeof eventDate === 'string') {
                            eventDate = new Date(eventDate);
                        } else {
                            return; // Skip invalid dates
                        }
                    }
                    
                    if (!isNaN(eventDate.getTime()) && eventDate.toDateString() === dateKey) {
                        simultaneousTransitions.push({
                            hostage: hostage,
                            date: transitionDate,
                            fromLane: hostage.initialLane,
                            toLane: hostage.finalLane
                        });
                    }
                }
            });

            // Sort by lane priority to ensure consistent ordering
            simultaneousTransitions.sort((a, b) => {
                const priorityA = this.laneManager.laneDefinitions[a.toLane]?.priority || 999;
                const priorityB = this.laneManager.laneDefinitions[b.toLane]?.priority || 999;
                return priorityA - priorityB;
            });

            this.transitionGroups.set(dateKey, simultaneousTransitions);
        }

        return this.transitionGroups.get(dateKey);
    }

    /**
     * Generate optimized paths for multiple hostages to prevent overlapping
     * @param {Array} hostages - Array of hostage records
     * @returns {Array} Array of optimized path strings
     */
    generateOptimizedPaths(hostages) {
        // Clear transition group cache
        this.transitionGroups.clear();

        // Generate paths for all hostages
        return hostages.map(hostage => ({
            hostage: hostage,
            path: this.generateTransitionPath(hostage)
        }));
    }

    /**
     * Handle multiple simultaneous transitions
     * @param {Array} transitions - Array of simultaneous transitions
     * @returns {Array} Array of optimized paths
     */
    handleSimultaneousTransitions(transitions) {
        return this.generateOptimizedPaths(transitions.map(t => t.hostage));
    }

    /**
     * Calculate turn radius for transition group
     * @param {number} transitionCount - Number of simultaneous transitions
     * @returns {number} Turn radius in pixels
     */
    calculateTurnRadius(transitionCount) {
        return this.calculateTransitionRadius(new Date(), { 'Hebrew Name': 'default' });
    }

    /**
     * Clear caches (useful for data updates)
     */
    clearCaches() {
        this.transitionGroups.clear();
    }

    /**
     * Update configuration
     * @param {Object} newConfig - Configuration updates
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.clearCaches();
    }

    /**
     * Get current configuration
     * @returns {Object} Current configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Get transition statistics for debugging
     * @param {Array} hostages - Array of hostage records
     * @returns {Object} Transition statistics
     */
    getTransitionStats(hostages) {
        const stats = {
            totalHostages: hostages.length,
            withTransitions: 0,
            simultaneousGroups: 0,
            maxSimultaneous: 0,
            transitionDates: new Set()
        };

        hostages.forEach(hostage => {
            if (hostage.hasTransition && hostage.transitionEvent && hostage.transitionEvent.date) {
                stats.withTransitions++;
                
                // Safely handle date conversion
                let eventDate = hostage.transitionEvent.date;
                if (!(eventDate instanceof Date)) {
                    if (typeof eventDate === 'string') {
                        eventDate = new Date(eventDate);
                    }
                }
                
                if (eventDate instanceof Date && !isNaN(eventDate.getTime())) {
                    stats.transitionDates.add(eventDate.toDateString());
                } else {
                    console.warn('🚨 TRANSITION-ENGINE: Invalid date in stats for', hostage['Hebrew Name'], hostage.transitionEvent.date);
                }
            }
        });

        stats.simultaneousGroups = this.transitionGroups.size;
        
        this.transitionGroups.forEach(group => {
            stats.maxSimultaneous = Math.max(stats.maxSimultaneous, group.length);
        });

        return stats;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TransitionEngine;
}