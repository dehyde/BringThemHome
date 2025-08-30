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
            baseTurnRadius: 4, // 4px base radius as specified in PRD
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

        // Start the path
        const firstSegment = segments[0];
        path.moveTo(firstSegment.startX, firstSegment.startY);

        // Generate each segment
        segments.forEach((segment, index) => {
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

            const currentX = this.timeline.dateToX(currentPoint.date);

            if (!nextPoint) {
                // Final segment - horizontal line extending to timeline end
                // ALL hostages should have lines that extend to current date
                const endX = this.timeline.dateToX(new Date());
                
                segments.push({
                    isTransition: false,
                    startX: currentX,
                    startY: currentY,
                    endX: endX,
                    endY: currentY,
                    lane: currentPoint.lane
                });
                
                console.log(`[SEGMENTS] Final segment for ${hostage['Hebrew Name']}: startY=${currentY}, endY=${currentY}, lane=${currentPoint.lane}`);
                // This ensures all lines extend to timeline end
            } else {
                // Calculate transition
                const nextY = this.laneManager.getTransitionY(nextPoint.lane, hostage);
                const nextX = this.timeline.dateToX(nextPoint.date);

                // Determine turn radius for this transition
                const turnRadius = this.calculateTransitionRadius(nextPoint.date, hostage);

                // Transition segment handles the curve from current lane to next lane
                segments.push({
                    isTransition: true,
                    startX: currentX,
                    startY: currentY,
                    endX: currentX, // Transition doesn't extend horizontally
                    endY: nextY,
                    transitionDate: nextPoint.date,
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
                    
                    segments.push({
                        isTransition: false,
                        startX: nextX - turnRadius, // Start after turn
                        startY: nextY,
                        endX: endX,
                        endY: nextY,
                        lane: nextPoint.lane
                    });
                    
                    console.log(`[SEGMENTS] Post-transition segment for ${hostage['Hebrew Name']}: startY=${nextY}, endY=${nextY}, lane=${nextPoint.lane}`);
                } else {
                    // Intermediate transition - add horizontal segment to next transition
                    const followingPoint = pathPoints[i + 2];
                    const horizontalEndX = followingPoint ? this.timeline.dateToX(followingPoint.date) : nextX;
                    
                    segments.push({
                        isTransition: false,
                        startX: nextX - turnRadius, // Start after turn
                        startY: nextY,
                        endX: horizontalEndX,
                        endY: nextY,
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
        path.lineTo(segment.endX, segment.endY);
    }

    /**
     * Add transition segment with rectangular corner turns using SVG arcs
     * Creates smooth rounded corners for lane transitions
     * @param {d3.path} path - D3 path object  
     * @param {Object} segment - Transition segment data
     */
    addTransitionSegment(path, segment) {
        const { startX, startY, endX, endY, transitionDate, turnRadius } = segment;
        
        // Get the actual transition date X coordinate
        const transitionX = this.timeline.dateToX(transitionDate);
        
        // Determine movement direction
        const isMovingUp = endY < startY;
        
        // Calculate the 4 corner points for rectangular turns (RTL-aware)
        // Based on the working fixes from conversation summary
        
        // Point 1: X + radius, original Y (rightmost - earlier in RTL) 
        const point1X = transitionX + turnRadius;
        const point1Y = startY;
        
        // Point 2: X, original Y ± radius (FIXED: subtract for upward movement)
        const point2X = transitionX;
        const point2Y = isMovingUp ? startY - turnRadius : startY + turnRadius;
        
        // Point 3: X, new Y ± radius
        const point3X = transitionX;
        const point3Y = isMovingUp ? endY + turnRadius : endY - turnRadius;
        
        // Point 4: X - radius, new Y (leftmost - later in RTL)
        const point4X = transitionX - turnRadius; 
        const point4Y = endY;
        
        // Create the rectangular corner path using SVG arcs
        // 1. Line to corner start
        path.lineTo(point1X, point1Y);
        
        // 2. First arc: horizontal to vertical turn
        path.arcTo(transitionX, startY, point2X, point2Y, turnRadius);
        
        // 3. Vertical line segment
        path.lineTo(point3X, point3Y);
        
        // 4. Second arc: vertical to horizontal turn  
        path.arcTo(transitionX, endY, point4X, point4Y, turnRadius);
        
        // Path now ends at point4, ready for next segment
    }

    /**
     * Calculate turn radius for a specific transition, accounting for parallel transitions
     * @param {Date} transitionDate - Date of transition
     * @param {Object} hostage - Hostage record
     * @returns {number} Turn radius in pixels
     */
    calculateTransitionRadius(transitionDate, hostage) {
        // Get all simultaneous transitions
        const simultaneousTransitions = this.getSimultaneousTransitions(transitionDate);
        
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
     * Get all transitions happening on the same date
     * @param {Date} transitionDate - Date to check
     * @returns {Array} Array of simultaneous transitions
     */
    getSimultaneousTransitions(transitionDate) {
        const dateKey = transitionDate.toDateString();
        
        if (!this.transitionGroups.has(dateKey)) {
            // Build transition group for this date
            const sortedData = this.laneManager.getSortedData();
            const simultaneousTransitions = [];

            sortedData.forEach(hostage => {
                if (hostage.transitionEvent && 
                    hostage.transitionEvent.date.toDateString() === dateKey) {
                    simultaneousTransitions.push({
                        hostage: hostage,
                        date: transitionDate,
                        fromLane: hostage.initialLane,
                        toLane: hostage.finalLane
                    });
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
            if (hostage.hasTransition) {
                stats.withTransitions++;
                stats.transitionDates.add(hostage.transitionEvent.date.toDateString());
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