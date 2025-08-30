/**
 * Lane Manager System
 * Phase 2: Lane management, sorting, and dynamic height calculation
 */

class LaneManager {
    constructor(timelineCore) {
        this.timeline = timelineCore;
        this.lanes = new Map();
        this.sortedData = [];
        this.config = {
            lineSpacing: 4, // Base spacing between lines
            lanePadding: 8, // Internal lane padding
            sectionSpacing: 20, // Space between major sections
            lineWidth: 1.5,
            turnRadius: 4 // For transitions
        };
        
        // Lane definitions based on PRD
        this.laneDefinitions = {
            'released-military-living': {
                type: 'release',
                section: 'released',
                method: 'military',
                status: 'living',
                label: 'חולצו במבצע - חיים',
                color: '#3b82f6',
                priority: 1
            },
            'released-military-deceased': {
                type: 'release', 
                section: 'released',
                method: 'military',
                status: 'deceased',
                label: 'חולצו במבצע - נפטרו',
                color: 'rgba(59, 130, 246, 0.7)',
                priority: 2
            },
            'released-deal-living': {
                type: 'release',
                section: 'released',
                method: 'deal',
                status: 'living',
                label: 'שוחררו בעסקה - חיים',
                color: '#22c55e',
                priority: 3
            },
            'released-deal-deceased': {
                type: 'release',
                section: 'released', 
                method: 'deal',
                status: 'deceased',
                label: 'שוחררו בעסקה - נפטרו',
                color: 'rgba(34, 197, 94, 0.7)',
                priority: 4
            },
            'kidnapped-living': {
                type: 'captivity',
                section: 'kidnapped',
                status: 'living',
                label: 'חטופים חיים',
                color: '#ef4444',
                priority: 5
            },
            'kidnapped-deceased': {
                type: 'captivity',
                section: 'kidnapped',
                status: 'deceased',
                label: 'חטופים מתים',
                color: 'rgba(127, 29, 29, 0.7)',
                priority: 6
            }
        };
    }

    /**
     * Process and sort hostage data according to lane requirements
     * @param {Array} processedData - Array of processed hostage records
     * @returns {Array} Sorted data with lane assignments
     */
    processData(processedData) {
        try {
            // Sort data according to PRD requirements
            this.sortedData = this.sortHostagesByEventOrder(processedData);
            
            // Assign positions within lanes
            this.assignLanePositions();
            
            // Calculate lane heights dynamically
            this.calculateLaneHeights();
            
            // Update timeline Y-scale
            this.updateTimelineScale();
            
            console.log(`Lane manager processed ${this.sortedData.length} records`);
            this.logLaneStats();
            
            return this.sortedData;
            
        } catch (error) {
            console.error('Lane manager processing failed:', error);
            throw error;
        }
    }

    /**
     * Sort hostages by event order as specified in PRD
     * Key rule: Earlier lane-changing events appear higher in their lanes
     * @param {Array} data - Raw processed data
     * @returns {Array} Sorted data
     */
    sortHostagesByEventOrder(data) {
        return data.map(hostage => {
            // Assign to final lane
            const laneId = hostage.finalLane;
            const laneDef = this.laneDefinitions[laneId];
            
            if (!laneDef) {
                console.warn(`Unknown lane: ${laneId} for hostage:`, hostage['Hebrew Name']);
                return { ...hostage, laneId: 'kidnapped-living', laneDef: this.laneDefinitions['kidnapped-living'] };
            }
            
            return {
                ...hostage,
                laneId,
                laneDef
            };
        }).sort((a, b) => {
            // First sort by lane priority (released lanes first)
            if (a.laneDef.priority !== b.laneDef.priority) {
                return a.laneDef.priority - b.laneDef.priority;
            }
            
            // Within each lane, sort by event order
            // Earlier transitions appear higher (lower eventOrder value = higher position)
            if (a.eventOrder !== b.eventOrder) {
                return a.eventOrder - b.eventOrder;
            }
            
            // For same event timing, maintain consistent order by name
            const nameA = a['Hebrew Name'] || '';
            const nameB = b['Hebrew Name'] || '';
            return nameA.localeCompare(nameB, 'he');
        });
    }

    /**
     * Assign specific positions within lanes
     */
    assignLanePositions() {
        // Group by lane
        const laneGroups = d3.group(this.sortedData, d => d.laneId);
        
        // Reset lanes map
        this.lanes.clear();
        
        // Only create lanes that have hostages (no empty lanes)
        laneGroups.forEach((hostages, laneId) => {
            const laneDef = this.laneDefinitions[laneId];
            
            if (!laneDef) {
                console.warn(`Unknown lane definition: ${laneId}`);
                return;
            }
            
            // Assign positions within the lane (0 = top of lane)
            hostages.forEach((hostage, index) => {
                hostage.lanePosition = index;
            });
            
            // Store lane info - only for non-empty lanes
            this.lanes.set(laneId, {
                id: laneId,
                definition: laneDef,
                hostages: hostages,
                count: hostages.length,
                height: this.calculateSingleLaneHeight(hostages.length),
                yStart: 0, // Will be set by calculateLaneHeights
                yEnd: 0    // Will be set by calculateLaneHeights
            });
        });
        
        console.log(`Created ${this.lanes.size} non-empty lanes`);
    }

    /**
     * Calculate height needed for a single lane
     * @param {number} hostageCount - Number of hostages in lane
     * @returns {number} Height in pixels
     */
    calculateSingleLaneHeight(hostageCount) {
        if (hostageCount === 0) return 20; // Minimum lane height even if empty
        
        // Each hostage takes lineWidth + lineSpacing (except the last one)
        const hostageSpaceNeeded = (hostageCount - 1) * (this.config.lineWidth + this.config.lineSpacing) + this.config.lineWidth;
        
        return hostageSpaceNeeded + (2 * this.config.lanePadding);
    }

    /**
     * Calculate dynamic lane heights and positions
     */
    calculateLaneHeights() {
        const dimensions = this.timeline.getDimensions();
        const availableHeight = dimensions.height - this.timeline.getConfig().axisHeight;
        
        // Group lanes by section
        const sections = {
            released: [],
            kidnapped: []
        };
        
        this.lanes.forEach(lane => {
            sections[lane.definition.section].push(lane);
        });
        
        // Calculate section heights
        let currentY = 0;
        
        // Released section (top) - sort by priority
        if (sections.released.length > 0) {
            sections.released.sort((a, b) => a.definition.priority - b.definition.priority);
            sections.released.forEach(lane => {
                lane.yStart = currentY;
                lane.yEnd = currentY + lane.height;
                currentY = lane.yEnd;
            });
            
            currentY += this.config.sectionSpacing;
        }
        
        // Kidnapped section (bottom) - sort by priority
        if (sections.kidnapped.length > 0) {
            sections.kidnapped.sort((a, b) => a.definition.priority - b.definition.priority);
            sections.kidnapped.forEach(lane => {
                lane.yStart = currentY;
                lane.yEnd = currentY + lane.height;
                currentY = lane.yEnd;
            });
        }
        
        // Store total height needed
        this.totalHeight = currentY;
        
        console.log(`Total timeline height needed: ${this.totalHeight}px`);
    }

    /**
     * Update timeline Y-scale based on calculated lane heights
     */
    updateTimelineScale() {
        const scales = this.timeline.getScales();
        scales.y.domain([0, this.totalHeight]);
        
        // Update timeline dimensions if needed
        const dimensions = this.timeline.getDimensions();
        const axisHeight = this.timeline.getConfig().axisHeight;
        const neededHeight = this.totalHeight + axisHeight;
        
        // Always update dimensions to match calculated height
        console.log(`Setting timeline height: ${dimensions.height}px → ${neededHeight}px`);
        
        // Update timeline dimensions
        dimensions.height = neededHeight;
        dimensions.containerHeight = neededHeight + this.timeline.getConfig().margins.top + this.timeline.getConfig().margins.bottom;
        
        // Resize SVG
        this.timeline.svg
            .attr('height', dimensions.containerHeight);
        
        // Update Y scale range
        scales.y.range([0, this.totalHeight]);
        
        // Reposition the axis to the correct bottom
        this.repositionAxis();
    }

    /**
     * Reposition timeline axis to correct bottom position
     */
    repositionAxis() {
        const layerGroups = this.timeline.getLayerGroups();
        const axisHeight = this.timeline.getConfig().axisHeight;
        
        // Move axis to bottom of content
        layerGroups.axis.select('.timeline-axis')
            .attr('transform', `translate(0, ${this.totalHeight})`);
        
        console.log(`Repositioned axis to Y: ${this.totalHeight}px`);
    }

    /**
     * Get Y coordinate for a specific hostage
     * @param {Object} hostage - Hostage record
     * @returns {number} Y coordinate
     */
    getHostageY(hostage) {
        const lane = this.lanes.get(hostage.laneId);
        if (!lane) {
            console.warn(`Lane not found: ${hostage.laneId}`);
            return 0;
        }
        
        const lineY = lane.yStart + this.config.lanePadding + 
                     (hostage.lanePosition * (this.config.lineWidth + this.config.lineSpacing));
        
        return lineY;
    }

    /**
     * Get Y coordinate for lane transition
     * @param {string} laneId - Target lane ID
     * @param {number} position - Position within lane
     * @returns {number} Y coordinate
     */
    getTransitionY(laneId, position) {
        const lane = this.lanes.get(laneId);
        if (!lane) return 0;
        
        return lane.yStart + this.config.lanePadding + 
               (position * (this.config.lineWidth + this.config.lineSpacing));
    }

    /**
     * Render lane labels and dividers
     */
    renderLanes() {
        const layerGroups = this.timeline.getLayerGroups();
        const dimensions = this.timeline.getDimensions();
        
        // Clear existing labels
        layerGroups.labels.selectAll('*').remove();
        layerGroups.background.selectAll('.lane-divider').remove();
        
        // Render lane labels
        this.lanes.forEach(lane => {
            // Lane label
            layerGroups.labels
                .append('text')
                .attr('class', `lane-label ${lane.definition.section}`)
                .attr('x', dimensions.width + 10) // Right side for RTL
                .attr('y', lane.yStart + (lane.height / 2))
                .attr('text-anchor', 'start')
                .text(lane.definition.label)
                .style('font-family', 'Segoe UI, Arial Hebrew, Noto Sans Hebrew, Tahoma, sans-serif');
            
            // Lane count indicator
            layerGroups.labels
                .append('text')
                .attr('class', 'lane-count')
                .attr('x', dimensions.width + 10)
                .attr('y', lane.yStart + (lane.height / 2) + 15)
                .attr('text-anchor', 'start')
                .text(`(${lane.count})`)
                .style('font-size', '12px')
                .style('fill', '#666')
                .style('font-family', 'Segoe UI, Arial Hebrew, Noto Sans Hebrew, Tahoma, sans-serif');
        });
        
        // Render lane dividers
        this.lanes.forEach(lane => {
            if (lane.yStart > 0) { // Don't draw divider above first lane
                layerGroups.background
                    .append('line')
                    .attr('class', 'lane-divider')
                    .attr('x1', 0)
                    .attr('x2', dimensions.width)
                    .attr('y1', lane.yStart)
                    .attr('y2', lane.yStart);
            }
        });
        
        // Section divider between released and kidnapped
        const releasedLanes = Array.from(this.lanes.values()).filter(l => l.definition.section === 'released');
        const kidnappedLanes = Array.from(this.lanes.values()).filter(l => l.definition.section === 'kidnapped');
        
        if (releasedLanes.length > 0 && kidnappedLanes.length > 0) {
            const dividerY = Math.max(...releasedLanes.map(l => l.yEnd)) + (this.config.sectionSpacing / 2);
            
            layerGroups.background
                .append('line')
                .attr('class', 'section-divider')
                .attr('x1', 0)
                .attr('x2', dimensions.width)
                .attr('y1', dividerY)
                .attr('y2', dividerY);
        }
    }

    /**
     * Get lane information for external use
     * @returns {Map} Map of lane data
     */
    getLanes() {
        return this.lanes;
    }

    /**
     * Get sorted data
     * @returns {Array} Processed and sorted hostage data
     */
    getSortedData() {
        return this.sortedData;
    }

    /**
     * Get turn radius for transitions
     * @returns {number} Turn radius in pixels
     */
    getTurnRadius() {
        return this.config.turnRadius;
    }

    /**
     * Update configuration
     * @param {Object} newConfig - Configuration updates
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        // Recalculate if we have data
        if (this.sortedData.length > 0) {
            this.assignLanePositions();
            this.calculateLaneHeights();
            this.updateTimelineScale();
        }
    }

    /**
     * Get current configuration
     * @returns {Object} Current configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Log lane statistics for debugging
     */
    logLaneStats() {
        console.log('Lane Statistics:');
        this.lanes.forEach(lane => {
            console.log(`  ${lane.definition.label}: ${lane.count} hostages, height: ${lane.height}px, yStart: ${lane.yStart}px, yEnd: ${lane.yEnd}px`);
        });
        console.log(`Total height: ${this.totalHeight}px`);
        console.log(`Timeline dimensions:`, this.timeline.getDimensions());
    }

    /**
     * Debug lane layout - render visible lane boundaries
     */
    debugLaneLayout() {
        const layerGroups = this.timeline.getLayerGroups();
        const dimensions = this.timeline.getDimensions();
        
        // Remove existing debug elements
        layerGroups.background.selectAll('.debug-lane-boundary').remove();
        
        // Draw lane boundaries for debugging
        this.lanes.forEach(lane => {
            // Lane boundary rectangle
            layerGroups.background
                .append('rect')
                .attr('class', 'debug-lane-boundary')
                .attr('x', 0)
                .attr('y', lane.yStart)
                .attr('width', dimensions.width)
                .attr('height', lane.height)
                .style('fill', 'none')
                .style('stroke', lane.definition.color)
                .style('stroke-width', 2)
                .style('stroke-dasharray', '5,5')
                .style('opacity', 0.3);
            
            // Lane label for debugging
            layerGroups.background
                .append('text')
                .attr('class', 'debug-lane-boundary')
                .attr('x', 10)
                .attr('y', lane.yStart + 15)
                .style('font-size', '10px')
                .style('fill', lane.definition.color)
                .style('font-weight', 'bold')
                .text(`${lane.definition.label} (${lane.count}) [${lane.yStart}-${lane.yEnd}]`);
        });
        
        console.log('Debug lane boundaries rendered');
    }

    /**
     * Get lane statistics for UI display
     * @returns {Object} Statistics object
     */
    getStats() {
        const stats = {
            totalHostages: this.sortedData.length,
            lanes: {},
            sections: {
                released: { count: 0, lanes: 0 },
                kidnapped: { count: 0, lanes: 0 }
            }
        };
        
        this.lanes.forEach(lane => {
            stats.lanes[lane.id] = {
                label: lane.definition.label,
                count: lane.count,
                height: lane.height
            };
            
            stats.sections[lane.definition.section].count += lane.count;
            stats.sections[lane.definition.section].lanes += 1;
        });
        
        return stats;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LaneManager;
}