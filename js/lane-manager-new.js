/**
 * Lane Manager System
 * Phase 2: Lane management, sorting, and dynamic height calculation
 */

console.log('[EDEN_DEBUG] Lane manager script loaded successfully - version 20250902-3');

class LaneManager {
    constructor(timelineCore, customConfig = {}) {
        this.timeline = timelineCore;
        this.lanes = new Map();
        this.sortedData = [];
        this.lanePositionMap = new Map(); // NEW: Track position per hostage per lane
        
        // Use centralized configuration
        this.config = AppConfig.helpers.mergeConfig('lanes', customConfig);
        
        // Use centralized lane definitions
        this.laneDefinitions = AppConfig.lanes.definitions;
    }

    /**
     * Process and sort hostage data according to lane requirements
     * @param {Array} processedData - Array of processed hostage records
     * @returns {Array} Sorted data with lane assignments
     */
    processData(processedData) {
        console.log(`[EDEN_DEBUG] ========== LANE MANAGER ENTRY POINT ==========`);
        console.log(`[EDEN_DEBUG] Lane manager processing ${processedData.length} hostages`);
        
        try {
            // DEBUG: Check if עדן ירושלמי made it to lane manager
            const edenFound = processedData.find(record => record['Hebrew Name'] === 'עדן ירושלמי');
            if (edenFound) {
                console.log(`[EDEN_DEBUG] Reached lane manager with status: ${edenFound['Current Status']}`);
                console.log(`[EDEN_DEBUG] Eden's path:`, edenFound.path?.map(p => `${p.lane}@${p.date instanceof Date ? p.date.toISOString().split('T')[0] : p.date}`));
            } else {
                console.log(`[EDEN_DEBUG] NOT FOUND in lane manager input!`);
            }
            
            // Sort data according to PRD requirements
            console.log(`[EDEN_DEBUG] About to sort hostages by event order...`);
            this.sortedData = this.sortHostagesByEventOrder(processedData);
            console.log(`[EDEN_DEBUG] Sorted ${this.sortedData.length} hostages`);
            
            // Assign positions within lanes
            console.log(`[EDEN_DEBUG] Assigning lane positions...`);
            this.assignLanePositions();
            
            // Calculate lane heights dynamically
            console.log(`[EDEN_DEBUG] Calculating lane heights...`);
            this.calculateLaneHeights();
            
            // Update timeline Y-scale
            console.log(`[EDEN_DEBUG] Updating timeline scale...`);
            this.updateTimelineScale();
            
            console.log(`[EDEN_DEBUG] Lane manager processing complete`);
            console.log(`Lane manager processed ${this.sortedData.length} records`);
            this.logLaneStats();
            
            return this.sortedData;
            
        } catch (error) {
            console.error('[EDEN_DEBUG] Lane manager processing failed:', error);
            console.error('Lane manager processing failed:', error);
            console.error('Stack trace:', error.stack);
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
            
            // DEBUG: Log עדן ירושלמי specifically
            if (hostage['Hebrew Name'] === 'עדן ירושלמי') {
                console.log(`[EDEN_DEBUG] Lane Manager - Final lane: ${laneId}`);
                console.log(`[EDEN_DEBUG] Lane Manager - Path:`, hostage.path);
            }
            
            return {
                ...hostage,
                laneId,
                laneDef
            };
        }).sort((a, b) => {
            // DEBUG: Log when we're sorting עדן ירושלמי
            if (a['Hebrew Name'] === 'עדן ירושלמי' || b['Hebrew Name'] === 'עדן ירושלמי') {
                console.log(`[EDEN_DEBUG] Sorting: ${a['Hebrew Name']} (${a.laneId}) vs ${b['Hebrew Name']} (${b.laneId})`);
            }
            
            // First sort by lane priority (released lanes first)
            if (a.laneDef.priority !== b.laneDef.priority) {
                return a.laneDef.priority - b.laneDef.priority;
            }
            
            // Within same lane, use specific sorting logic for each lane type
            return this.sortWithinSameLane(a, b);
        });
    }

    /**
     * Sort hostages within the same lane based on lane type and transition dates
     * @param {Object} a - First hostage record
     * @param {Object} b - Second hostage record
     * @returns {number} Sort comparison result
     */
    sortWithinSameLane(a, b) {
        // DEBUG: Log when עדן ירושלמי is involved
        if (a['Hebrew Name'] === 'עדן ירושלמי' || b['Hebrew Name'] === 'עדן ירושלמי') {
            console.log(`[EDEN_DEBUG] Within lane sort: ${a['Hebrew Name']} vs ${b['Hebrew Name']} in ${a.laneId}`);
        }
        
        // Special handling for kidnapped-living lane (complex mixed categories)
        if (a.laneId === 'kidnapped-living' && b.laneId === 'kidnapped-living') {
            if (a['Hebrew Name'] === 'עדן ירושלמי' || b['Hebrew Name'] === 'עדן ירושלמי') {
                console.log(`[EDEN_DEBUG] Using kidnapped-living lane sorting`);
            }
            return this.sortWithinKidnappedLivingLane(a, b);
        }
        
        // For released lanes (both living and deceased), sort by release/return date
        if (a.laneId.startsWith('released-')) {
            return this.sortReleasedHostages(a, b);
        }
        
        // For kidnapped-deceased lane, sort by death date (latest death first)
        if (a.laneId === 'kidnapped-deceased') {
            return this.sortDeceasedHostages(a, b);
        }
        
        // Fallback: sort by event order then name
        if (a.eventOrder !== b.eventOrder) {
            return a.eventOrder - b.eventOrder;
        }
        
        const nameA = a['Hebrew Name'] || '';
        const nameB = b['Hebrew Name'] || '';
        return nameA.localeCompare(nameB, 'he');
    }

    /**
     * Sort released hostages by release/return date (earliest first)
     * @param {Object} a - First hostage record
     * @param {Object} b - Second hostage record
     * @returns {number} Sort comparison result
     */
    sortReleasedHostages(a, b) {
        // Use release date if available, otherwise use event order
        const getReleaseDateKey = (hostage) => {
            if (hostage.releaseDate_valid && hostage.releaseDate instanceof Date) {
                return hostage.releaseDate.getTime();
            }
            // Fallback to transition event date if available
            if (hostage.transitionEvent && hostage.transitionEvent.date && hostage.transitionEvent.date instanceof Date) {
                return hostage.transitionEvent.date.getTime();
            }
            // Last fallback to event order
            return hostage.eventOrder || 999999;
        };
        
        const dateA = getReleaseDateKey(a);
        const dateB = getReleaseDateKey(b);
        
        console.log(`[DEBUG] Release dates: ${a['Hebrew Name']} = ${new Date(dateA).toISOString().split('T')[0]}, ${b['Hebrew Name']} = ${new Date(dateB).toISOString().split('T')[0]}`);
        
        if (dateA !== dateB) {
            return dateA - dateB; // Earliest release first
        }
        
        // Same release date, sort by name
        const nameA = a['Hebrew Name'] || '';
        const nameB = b['Hebrew Name'] || '';
        return nameA.localeCompare(nameB, 'he');
    }

    /**
     * Sort deceased hostages by death date (latest death first, closest to living)
     * @param {Object} a - First hostage record  
     * @param {Object} b - Second hostage record
     * @returns {number} Sort comparison result
     */
    sortDeceasedHostages(a, b) {
        const getSortingData = (hostage) => {
            const isStillInCaptivity = hostage['Current Status']?.includes('Held') || 
                                      hostage.laneId === 'kidnapped-deceased';
            
            // DEBUG: Show available data for deceased hostages  
            if (hostage['Hebrew Name']?.includes('עדן') || hostage['Hebrew Name']?.includes('איתי')) {
                console.log(`[EDEN_DEBUG] Deceased data for ${hostage['Hebrew Name']}:`, {
                    status: hostage['Current Status'],
                    laneId: hostage.laneId,
                    stillInCaptivity: isStillInCaptivity,
                    path: hostage.path?.map(p => `${p.lane}@${p.date instanceof Date ? p.date.toISOString().split('T')[0] : p.date}`),
                    releaseDate: hostage.releaseDate instanceof Date ? hostage.releaseDate.toISOString().split('T')[0] : hostage.releaseDate,
                    deathDate: hostage.deathDate instanceof Date ? hostage.deathDate.toISOString().split('T')[0] : hostage.deathDate
                });
            }
            
            // If still in captivity (body not returned), sort to bottom
            if (isStillInCaptivity) {
                return {
                    priority: 2, // Bottom priority
                    date: hostage.deathDate instanceof Date ? hostage.deathDate.getTime() : 
                          (hostage.kidnappedDate instanceof Date ? hostage.kidnappedDate.getTime() : new Date('2023-10-07').getTime())
                };
            }
            
            // For returned bodies, find the very first transition/event date
            let firstTransitionDate = null;
            
            // Check path for the very first transition (any transition, not just to deceased)
            if (hostage.path && Array.isArray(hostage.path) && hostage.path.length > 0) {
                // Sort path by date to find the earliest transition
                const sortedPath = hostage.path
                    .filter(p => p.date instanceof Date)
                    .sort((a, b) => a.date.getTime() - b.date.getTime());
                
                if (sortedPath.length > 0) {
                    firstTransitionDate = sortedPath[0].date;
                }
            }
            
            // If no path transitions found, check for body release date
            if (!firstTransitionDate && hostage.releaseDate_valid && hostage.releaseDate instanceof Date) {
                firstTransitionDate = hostage.releaseDate;
            }
            
            // If no release date, check death date
            if (!firstTransitionDate && hostage.deathDate_valid && hostage.deathDate instanceof Date) {
                firstTransitionDate = hostage.deathDate;
            }
            
            // Fallback to kidnapping date
            if (!firstTransitionDate && hostage.kidnappedDate_valid && hostage.kidnappedDate instanceof Date) {
                firstTransitionDate = hostage.kidnappedDate;
            }
            
            // Final fallback to Oct 7
            if (!firstTransitionDate) {
                firstTransitionDate = new Date('2023-10-07');
            }
            
            return {
                priority: 1, // Top priority (returned bodies)
                date: firstTransitionDate.getTime()
            };
        };
        
        const dataA = getSortingData(a);
        const dataB = getSortingData(b);
        
        console.log(`[EDEN_DEBUG] Deceased sorting: ${a['Hebrew Name']} (priority=${dataA.priority}, ${new Date(dataA.date).toISOString().split('T')[0]}) vs ${b['Hebrew Name']} (priority=${dataB.priority}, ${new Date(dataB.date).toISOString().split('T')[0]})`);
        
        // First sort by priority (returned bodies first, then still in captivity)
        if (dataA.priority !== dataB.priority) {
            return dataA.priority - dataB.priority;
        }
        
        // Within same priority, sort by date
        if (dataA.date !== dataB.date) {
            return dataA.date - dataB.date; // Earlier dates first
        }
        
        // Same priority and date, sort by name
        const nameA = a['Hebrew Name'] || '';
        const nameB = b['Hebrew Name'] || '';
        return nameA.localeCompare(nameB, 'he');
    }

    /**
     * Sort hostages within the kidnapped-living lane according to specific requirements
     * Order: 1) Direction (released=up, stayed=middle, died=down), 2) Date (releases: early→late, deaths: late→early), 3) Method
     * @param {Object} a - First hostage record
     * @param {Object} b - Second hostage record  
     * @returns {number} Sort comparison result
     */
    sortWithinKidnappedLivingLane(a, b) {
        // Only log when עדן ירושלמי is involved to reduce noise
        if (a['Hebrew Name'] === 'עדן ירושלמי' || b['Hebrew Name'] === 'עדן ירושלמי') {
            console.log(`[EDEN_DEBUG] Kidnapped-living sort: ${a['Hebrew Name']} vs ${b['Hebrew Name']}`);
        }
        
        // Helper function to determine hostage direction and get sort data
        const getHostageData = (hostage) => {
            // Look at the transition path to understand what happens FROM the kidnapped-living lane
            const hasTransition = hostage.path && hostage.path.length > 1;
            
            if (hasTransition) {
                // Find the first transition OUT of kidnapped-living lane
                const firstTransition = hostage.path.find((pathPoint, index) => {
                    return index > 0 && hostage.path[index - 1].lane === 'kidnapped-living' && pathPoint.lane !== 'kidnapped-living';
                });
                
                if (firstTransition) {
                    if (firstTransition.event === 'died') {
                        // Transitioned to death (direction: down)
                        return {
                            direction: 3, // down
                            date: firstTransition.timestamp,
                            method: this.determineReleaseMethod(hostage), // method of eventual body return if applicable
                            name: hostage['Hebrew Name'] || ''
                        };
                    } else if (firstTransition.event === 'released') {
                        // Transitioned to release alive (direction: up)
                        return {
                            direction: 1, // up
                            date: firstTransition.timestamp,
                            method: this.determineReleaseMethod(hostage),
                            name: hostage['Hebrew Name'] || ''
                        };
                    }
                }
            }
            
            // No transition or couldn't determine - check current status
            const isDead = hostage.deathDate_valid || 
                          (hostage['Current Status'] && hostage['Current Status'].toLowerCase().includes('deceased'));
            const isReleased = hostage.releaseDate_valid;
            
            if (isReleased && !isDead) {
                // Released alive (direction: up)
                return {
                    direction: 1, // up
                    date: hostage.releaseDate instanceof Date ? hostage.releaseDate.getTime() : new Date('2023-10-07').getTime(),
                    method: this.determineReleaseMethod(hostage),
                    name: hostage['Hebrew Name'] || ''
                };
            } else if (isDead) {
                // Died in captivity (direction: down)
                const deathDate = (hostage.deathDate_valid && hostage.deathDate instanceof Date) ? 
                    hostage.deathDate.getTime() : 
                    ((hostage.kidnappedDate_valid && hostage.kidnappedDate instanceof Date) ? hostage.kidnappedDate.getTime() : new Date('2023-10-07').getTime());
                return {
                    direction: 3, // down
                    date: deathDate,
                    method: this.determineReleaseMethod(hostage),
                    name: hostage['Hebrew Name'] || ''
                };
            } else {
                // Still alive in captivity (direction: stay)
                return {
                    direction: 2, // stay/middle
                    date: (hostage.kidnappedDate_valid && hostage.kidnappedDate instanceof Date) ? hostage.kidnappedDate.getTime() : new Date('2023-10-07').getTime(),
                    method: 'none',
                    name: hostage['Hebrew Name'] || ''
                };
            }
        };
        
        const dataA = getHostageData(a);
        const dataB = getHostageData(b);
        
        console.log(`[DEBUG] ${a['Hebrew Name']}: direction=${dataA.direction}, date=${new Date(dataA.date).toISOString().split('T')[0]}, method=${dataA.method}`);
        console.log(`[DEBUG] ${b['Hebrew Name']}: direction=${dataB.direction}, date=${new Date(dataB.date).toISOString().split('T')[0]}, method=${dataB.method}`);
        
        // 1. First sort by direction (released=1, stayed=2, died=3)
        if (dataA.direction !== dataB.direction) {
            return dataA.direction - dataB.direction;
        }
        
        // 2. Within same direction, sort by date
        if (dataA.direction === 1) {
            // Released: earliest release first → latest release last
            if (dataA.date !== dataB.date) {
                return dataA.date - dataB.date;
            }
        } else if (dataA.direction === 3) {
            // Died: latest death first → earliest death last  
            if (dataA.date !== dataB.date) {
                return dataB.date - dataA.date; // reverse chronological
            }
        } else {
            // Still alive: sort by kidnapping date (earliest first)
            if (dataA.date !== dataB.date) {
                return dataA.date - dataB.date;
            }
        }
        
        // 3. Within same date, sort by method
        const methodOrder = { 'military': 1, 'deal': 2, 'none': 3, 'unknown': 4 };
        const methodA = methodOrder[dataA.method] || 4;
        const methodB = methodOrder[dataB.method] || 4;
        
        if (methodA !== methodB) {
            return methodA - methodB;
        }
        
        // 4. Finally, sort by name for consistency
        return dataA.name.localeCompare(dataB.name, 'he');
    }

    /**
     * Helper method to determine release method from hostage record
     * @param {Object} hostage - Hostage record
     * @returns {string} Release method: 'military', 'deal', or 'unknown'
     */
    determineReleaseMethod(hostage) {
        const circumstances = (hostage['Release/Death Circumstances'] || '').toLowerCase();
        
        if (circumstances.includes('military') || circumstances.includes('operation') || 
            circumstances.includes('rescue') || circumstances.includes('מבצע')) {
            return 'military';
        } else if (circumstances.includes('deal') || circumstances.includes('exchange') || 
                   circumstances.includes('עסקה') || circumstances.includes('שחרור')) {
            return 'deal';
        }
        
        return 'unknown';
    }

    /**
     * Assign specific positions within lanes
     */
    assignLanePositions() {
        // Reset state
        this.lanes.clear();
        this.lanePositionMap.clear();
        
        // STEP 1: Collect all lanes that will be used and all hostages in each lane
        const allLanesUsed = new Map(); // laneId -> Set of hostageIds
        
        this.sortedData.forEach(hostage => {
            const hostageId = hostage['Hebrew Name'] || `hostage_${hostage._lineNumber || 0}`;
            
            // Add final lane
            if (!allLanesUsed.has(hostage.laneId)) {
                allLanesUsed.set(hostage.laneId, new Set());
            }
            allLanesUsed.get(hostage.laneId).add(hostageId);
            
            // Add all intermediate lanes from path
            if (hostage.path && hostage.path.length > 0) {
                hostage.path.forEach(pathPoint => {
                    if (!allLanesUsed.has(pathPoint.lane)) {
                        allLanesUsed.set(pathPoint.lane, new Set());
                    }
                    allLanesUsed.get(pathPoint.lane).add(hostageId);
                });
            }
        });
        
        // STEP 2: Assign positions per lane based on lane-specific sorting
        const lanePositionCounters = new Map(); // Track next available position per lane
        
        // For each lane, create a sorted list of hostages that appear in that lane
        allLanesUsed.forEach((hostageIds, laneId) => {
            // Get all hostages that appear in this specific lane
            const hostagesInThisLane = this.sortedData.filter(hostage => {
                const hostageId = hostage['Hebrew Name'] || `hostage_${hostage._lineNumber || 0}`;
                return hostageIds.has(hostageId);
            });
            
            // Sort hostages specifically for this lane using appropriate sorting method
            let laneSortedHostages;
            
            // DEBUG: Log which lanes עדן ירושלמי appears in
            const edenInThisLane = hostagesInThisLane.find(h => h['Hebrew Name'] === 'עדן ירושלמי');
            if (edenInThisLane) {
                console.log(`[EDEN_DEBUG] Found in lane: ${laneId} (${hostagesInThisLane.length} total hostages)`);
            }
            
            if (laneId === 'kidnapped-living') {
                // Use our special sorting for kidnapped-living lane
                laneSortedHostages = hostagesInThisLane.sort((a, b) => this.sortWithinKidnappedLivingLane(a, b));
                
                // DEBUG: Log עדן ירושלמי's position in kidnapped-living
                const edenIndex = laneSortedHostages.findIndex(h => h['Hebrew Name'] === 'עדן ירושלמי');
                if (edenIndex >= 0) {
                    console.log(`[EDEN_DEBUG] Position in kidnapped-living lane: ${edenIndex} out of ${laneSortedHostages.length}`);
                    console.log(`[EDEN_DEBUG] Hostages around her:`, laneSortedHostages.slice(Math.max(0, edenIndex-2), edenIndex+3).map(h => h['Hebrew Name']));
                }
            } else if (laneId === 'kidnapped-deceased') {
                // Use deceased sorting for kidnapped-deceased lane
                laneSortedHostages = hostagesInThisLane.sort((a, b) => this.sortDeceasedHostages(a, b));
            } else if (laneId.startsWith('released-')) {
                // Use release sorting for all released lanes
                laneSortedHostages = hostagesInThisLane.sort((a, b) => this.sortReleasedHostages(a, b));
            } else {
                // Fallback: use the existing sorted order
                laneSortedHostages = hostagesInThisLane;
            }
            
            // Assign positions based on sorted order
            laneSortedHostages.forEach((hostage, index) => {
                const hostageId = hostage['Hebrew Name'] || `hostage_${hostage._lineNumber || 0}`;
                const positionKey = `${hostageId}-${laneId}`;
                this.lanePositionMap.set(positionKey, index);
                
                if (hostage['Hebrew Name'] === 'עדן ירושלמי') {
                    console.log(`[EDEN_DEBUG] Assigned position ${index} in lane ${laneId}`);
                }
            });
            
            lanePositionCounters.set(laneId, laneSortedHostages.length);
        });
        
        // Set lanePosition for backward compatibility (use final lane position)
        this.sortedData.forEach(hostage => {
            const hostageId = hostage['Hebrew Name'] || `hostage_${hostage._lineNumber || 0}`;
            const finalLaneKey = `${hostageId}-${hostage.laneId}`;
            hostage.lanePosition = this.lanePositionMap.get(finalLaneKey) || 0;
        });
        
        // STEP 3: Create lane info grouped by final lane
        const laneGroups = d3.group(this.sortedData, d => d.laneId);
        
        laneGroups.forEach((hostages, laneId) => {
            const laneDef = this.laneDefinitions[laneId];
            
            if (!laneDef) {
                console.warn(`Unknown lane definition: ${laneId}`);
                return;
            }
            
            // Calculate actual count in this lane (including transitioning hostages)
            const hostagesToInThisLane = allLanesUsed.get(laneId) || new Set();
            const maxPosition = lanePositionCounters.get(laneId) || 0;
            const actualCount = maxPosition + 1;
            
            this.lanes.set(laneId, {
                id: laneId,
                definition: laneDef,
                hostages: hostages,
                count: actualCount, // Use actual count including transitioning hostages
                height: this.calculateSingleLaneHeight(actualCount),
                yStart: 0, // Will be set by calculateLaneHeights
                yEnd: 0,   // Will be set by calculateLaneHeights
                allHostagesInLane: hostagesToInThisLane
            });
        });
        
        console.log(`[LANES] Created ${this.lanes.size} non-empty lanes with consistent position tracking`);
        console.log(`[LANES] Position map contains ${this.lanePositionMap.size} position entries`);
        console.log('[LANES] Lane position counters:', Object.fromEntries(lanePositionCounters));
        console.log('[LANES] Position map keys (first 10):', Array.from(this.lanePositionMap.keys()).slice(0, 10));
    }

    /**
     * Calculate height needed for a single lane
     * @param {number} hostageCount - Number of hostages in lane
     * @returns {number} Height in pixels
     */
    calculateSingleLaneHeight(hostageCount) {
        if (hostageCount === 0) return this.config.minLaneHeight; // Configurable minimum
        
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
        
        // Resize SVG to accommodate content
        const svgWidth = Math.max(dimensions.containerWidth, this.timeline.getConfig().minWidth);
        this.timeline.svg
            .attr('width', svgWidth)
            .attr('height', dimensions.containerHeight)
            .style('width', svgWidth + 'px')
            .style('height', dimensions.containerHeight + 'px');
        
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
     * Get Y coordinate for a specific hostage in a specific lane
     * @param {Object} hostage - Hostage record
     * @param {string} specificLane - Optional: specific lane to get position for
     * @returns {number} Y coordinate
     */
    getHostageY(hostage, specificLane = null) {
        const targetLane = specificLane || hostage.laneId;
        const lane = this.lanes.get(targetLane);
        if (!lane) {
            console.warn(`Lane not found: ${targetLane}`);
            return 0;
        }
        
        // Get hostage ID
        const hostageId = hostage['Hebrew Name'] || `hostage_${hostage._lineNumber || 0}`;
        
        // Look up position for this hostage in this specific lane
        const positionKey = `${hostageId}-${targetLane}`;
        let position = this.lanePositionMap.get(positionKey);
        

        
        if (position === undefined) {
            // Fallback: assign next available position in this lane
            const existingPositions = Array.from(this.lanePositionMap.entries())
                .filter(([key]) => key.endsWith(`-${targetLane}`))
                .map(([, pos]) => pos);
            position = existingPositions.length > 0 ? Math.max(...existingPositions) + 1 : 0;
            this.lanePositionMap.set(positionKey, position);
            
            console.warn(`Assigned fallback position ${position} for ${hostageId} in lane ${targetLane}`);
        }
        
        const spacing = this.config.lineWidth + this.config.lineSpacing;
        const lineY = lane.yStart + this.config.lanePadding + (position * spacing);
        
        // Round to whole pixels to prevent subpixel rendering issues
        return Math.round(lineY);
    }

    /**
     * Get Y coordinate for lane transition
     * @param {string} laneId - Target lane ID
     * @param {Object} hostage - Hostage record for position lookup
     * @returns {number} Y coordinate
     */
    getTransitionY(laneId, hostage) {
        const lane = this.lanes.get(laneId);
        if (!lane) return 0;
        
        // Get hostage ID
        const hostageId = hostage['Hebrew Name'] || `hostage_${hostage._lineNumber || 0}`;
        
        // Look up position for this hostage in this specific lane
        const positionKey = `${hostageId}-${laneId}`;
        let position = this.lanePositionMap.get(positionKey);
        
        if (position === undefined) {
            // Fallback: assign next available position in this lane
            const existingPositions = Array.from(this.lanePositionMap.entries())
                .filter(([key]) => key.endsWith(`-${laneId}`))
                .map(([, pos]) => pos);
            position = existingPositions.length > 0 ? Math.max(...existingPositions) + 1 : 0;
            this.lanePositionMap.set(positionKey, position);
            
            console.warn(`Assigned fallback transition position ${position} for ${hostageId} in lane ${laneId}`);
        }
        
        const spacing = this.config.lineWidth + this.config.lineSpacing;
        const transitionY = lane.yStart + this.config.lanePadding + (position * spacing);
        
        console.log(`[Y-COORD] getTransitionY: ${hostageId} in ${laneId}, position=${position}, transitionY=${transitionY}, spacing=${spacing}`);
        
        // Round to whole pixels to prevent subpixel rendering issues
        return Math.round(transitionY);
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
                .style('font-family', AppConfig.fonts.primary);
            
            // Lane count indicator
            layerGroups.labels
                .append('text')
                .attr('class', 'lane-count')
                .attr('x', dimensions.width + 10)
                .attr('y', lane.yStart + (lane.height / 2) + 15)
                .attr('text-anchor', 'start')
                .text(`(${lane.count})`)
                .style('font-size', AppConfig.fonts.sizes.count)
                .style('fill', '#666')
                .style('font-family', AppConfig.fonts.primary);
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