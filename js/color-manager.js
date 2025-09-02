/**
 * Color Manager System
 * Advanced coloring system with gradient support for hostage timeline visualization
 * Supports complex color logic based on hostage states, transitions, and circumstances
 */

class ColorManager {
    constructor(timelineCore, customConfig = {}) {
        this.timeline = timelineCore;
        this.config = {
            // Base colors for different states
            baseColors: {
                living: '#fbbf24',        // Mustard for living in captivity
                releasedDeal: '#3b82f6',  // Blue for released via deal
                releasedMilitary: '#22c55e', // Olive green for released via military operation
                deceased: '#6b7280',      // Gray for deceased
                deceasedReturned: 'rgba(107, 114, 128, 0.3)', // 30% opacity gray for returned bodies
                transitionDeath: '#dc2626', // Dark red for death transitions
                kidnappedDead: '#7f1d1d'   // Dark red for those kidnapped dead
            },
            
            // Opacity levels
            opacity: {
                normal: 1.0,
                deceased: 0.3,
                transition: 0.7
            },
            
            // Gradient settings
            gradient: {
                enabled: true,
                transitionDuration: 50, // pixels before transition point to start gradient
                transitionEnd: 50, // pixels after transition point to end gradient
                smoothness: 0.8 // 0-1, how smooth the gradient transition is
            },
            
            // Color logic rules
            rules: {
                // Anyone who is dead should appear with gray at 30% opacity
                // but if they were living before, should have gradient from living color to dark red to gray
                deceasedWithLivingHistory: true,
                
                // Living in captivity should be mustard until gradient needs to appear
                livingInCaptivity: 'mustard',
                
                // Released in deal: 30% opacity blue
                releasedInDeal: 'blue_30',
                
                // Released in military operation: 30% opacity olive green  
                releasedInMilitary: 'olive_30',
                
                // Those kidnapped dead: line should begin with dark red before turning to gray
                kidnappedDead: 'dark_red_to_gray'
            }
        };
        
        // Merge with custom config
        this.config = { ...this.config, ...customConfig };
        
        // Cache for generated gradients
        this.gradientCache = new Map();
        
        // Initialize gradient definitions
        this.initializeGradients();
    }
    
    /**
     * Initialize SVG gradient definitions
     */
    initializeGradients() {
        const defs = this.timeline.svg.select('defs');
        if (defs.empty()) {
            this.timeline.svg.append('defs');
        }
        
        // Create gradient definitions for common transitions
        // Note: Gradients go from start (right) to end (left) of the timeline
        // Transition zones are focused at the end (left) where state changes occur
        this.createGradientDefinition('living-to-death', this.config.baseColors.living, this.config.baseColors.transitionDeath, 0.85, 1.0);
        this.createGradientDefinition('living-to-deceased', this.config.baseColors.living, this.config.baseColors.deceased, 0.85, 1.0);
        this.createGradientDefinition('death-to-deceased', this.config.baseColors.transitionDeath, this.config.baseColors.deceased, 0.85, 1.0);
        this.createGradientDefinition('living-to-released-deal', this.config.baseColors.living, this.config.baseColors.releasedDeal, 0.85, 1.0);
        this.createGradientDefinition('living-to-released-military', this.config.baseColors.living, this.config.baseColors.releasedMilitary, 0.85, 1.0);
        this.createGradientDefinition('kidnapped-dead-to-deceased', this.config.baseColors.kidnappedDead, this.config.baseColors.deceased, 0.85, 1.0);
    }
    
    /**
     * Create a linear gradient definition
     * @param {string} id - Gradient ID
     * @param {string} startColor - Starting color
     * @param {string} endColor - Ending color
     */
    createGradientDefinition(id, startColor, endColor, transitionStart = 0.8, transitionEnd = 1.0) {
        const defs = this.timeline.svg.select('defs');
        
        // Remove existing gradient if it exists
        defs.select(`#${id}`).remove();
        
        const gradient = defs.append('linearGradient')
            .attr('id', id)
            .attr('x1', '100%')
            .attr('y1', '0%')
            .attr('x2', '0%')
            .attr('y2', '0%')
            .attr('gradientUnits', 'objectBoundingBox');
            
        // Start with solid color until transition point
        gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', startColor);
            
        gradient.append('stop')
            .attr('offset', `${transitionStart * 100}%`)
            .attr('stop-color', startColor);
            
        // Transition zone
        gradient.append('stop')
            .attr('offset', `${transitionEnd * 100}%`)
            .attr('stop-color', endColor);
            
        // End with solid color
        gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', endColor);
    }
    
    /**
     * Get color configuration for a hostage based on their state and history
     * @param {Object} hostage - Hostage record
     * @param {Object} pathSegment - Current path segment (optional)
     * @returns {Object} Color configuration object
     */
    getHostageColorConfig(hostage, pathSegment = null) {
        const config = {
            type: 'solid', // 'solid' or 'gradient'
            color: this.config.baseColors.living,
            opacity: this.config.opacity.normal,
            gradientId: null,
            gradientStops: null
        };
        
        // Determine hostage's final state
        const finalState = this.determineHostageState(hostage);
        const hasTransition = hostage.path && hostage.path.length > 1;
        
        // Apply color logic based on rules
        if (finalState === 'deceased') {
            if (this.config.rules.deceasedWithLivingHistory && hasTransition) {
                // Check if they were living before death
                const wasLiving = this.wasHostageLivingBeforeDeath(hostage);
                if (wasLiving) {
                    config.type = 'gradient';
                    config.gradientId = 'living-to-deceased';
                    config.opacity = this.config.opacity.deceased;
                } else {
                    // Kidnapped dead - start with dark red, transition to gray
                    config.type = 'gradient';
                    config.gradientId = 'kidnapped-dead-to-deceased';
                    config.opacity = this.config.opacity.deceased;
                }
            } else {
                // Simple deceased coloring
                config.color = this.config.baseColors.deceasedReturned;
                config.opacity = this.config.opacity.deceased;
            }
        } else if (finalState === 'released') {
            const releaseMethod = this.determineReleaseMethod(hostage);
            if (hasTransition) {
                // Gradient from living to release color
                if (releaseMethod === 'deal') {
                    config.type = 'gradient';
                    config.gradientId = 'living-to-released-deal';
                    config.opacity = this.config.opacity.normal;
                } else if (releaseMethod === 'military') {
                    config.type = 'gradient';
                    config.gradientId = 'living-to-released-military';
                    config.opacity = this.config.opacity.normal;
                }
            } else {
                // No transition, use solid color
                if (releaseMethod === 'deal') {
                    config.color = this.config.baseColors.releasedDeal;
                } else if (releaseMethod === 'military') {
                    config.color = this.config.baseColors.releasedMilitary;
                }
            }
        } else {
            // Living in captivity
            config.color = this.config.baseColors.living;
            config.opacity = this.config.opacity.normal;
        }
        
        return config;
    }
    
    /**
     * Determine the final state of a hostage
     * @param {Object} hostage - Hostage record
     * @returns {string} State: 'living', 'deceased', 'released'
     */
    determineHostageState(hostage) {
        const currentStatus = hostage['Current Status'] || '';
        
        if (currentStatus.includes('Deceased') || currentStatus.includes('deceased')) {
            return 'deceased';
        } else if (currentStatus.includes('Released') || currentStatus.includes('released')) {
            return 'released';
        } else {
            return 'living';
        }
    }
    
    /**
     * Check if hostage was living before death
     * @param {Object} hostage - Hostage record
     * @returns {boolean} True if was living before death
     */
    wasHostageLivingBeforeDeath(hostage) {
        if (!hostage.path || hostage.path.length <= 1) {
            return false;
        }
        
        // Check if first path point was in living state
        const firstPoint = hostage.path[0];
        return firstPoint.lane === 'kidnapped-living';
    }
    
    /**
     * Determine release method
     * @param {Object} hostage - Hostage record
     * @returns {string} Release method: 'deal', 'military', 'unknown'
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
     * Generate dynamic gradient for complex transitions
     * @param {Object} hostage - Hostage record
     * @param {Array} pathSegments - Array of path segments
     * @returns {string} Gradient ID or null
     */
    generateDynamicGradient(hostage, pathSegments) {
        if (!this.config.gradient.enabled || pathSegments.length <= 1) {
            return null;
        }
        
        // Find transition points
        const transitions = pathSegments.filter(segment => segment.isTransition);
        if (transitions.length === 0) {
            return null;
        }
        
        // Create unique gradient ID based on hostage and transitions
        const gradientId = `dynamic-${hostage['Hebrew Name'].replace(/\s+/g, '-')}-${Date.now()}`;
        
        // Determine gradient stops based on transitions
        const stops = this.calculateGradientStops(hostage, transitions);
        if (stops.length < 2) {
            return null;
        }
        
        // Create gradient definition
        this.createDynamicGradientDefinition(gradientId, stops);
        
        return gradientId;
    }
    
    /**
     * Create a precise transition gradient based on actual transition points
     * @param {Object} hostage - Hostage record
     * @param {Object} transitionPoint - The specific transition point
     * @param {number} totalLength - Total path length in pixels
     * @returns {string} Gradient ID
     */
    createPreciseTransitionGradient(hostage, transitionPoint, totalLength) {
        const gradientId = `precise-${hostage['Hebrew Name'].replace(/\s+/g, '-')}-${Date.now()}`;
        
        // Calculate transition zone in percentage
        const transitionStartPercent = Math.max(0, (transitionPoint.position - this.config.gradient.transitionDuration) / totalLength);
        const transitionEndPercent = Math.min(1, (transitionPoint.position + this.config.gradient.transitionEnd) / totalLength);
        
        // Get colors for before and after transition
        const beforeColor = this.getStateColor(transitionPoint.fromState);
        const afterColor = this.getStateColor(transitionPoint.toState);
        
        // Create gradient with precise positioning
        this.createGradientDefinition(gradientId, beforeColor, afterColor, transitionStartPercent, transitionEndPercent);
        
        return gradientId;
    }
    
    /**
     * Calculate gradient stops for complex transitions
     * @param {Object} hostage - Hostage record
     * @param {Array} transitions - Array of transition segments
     * @returns {Array} Array of gradient stops
     */
    calculateGradientStops(hostage, transitions) {
        const stops = [];
        
        // Start with initial color
        const initialState = this.determineInitialState(hostage);
        stops.push({
            offset: '0%',
            color: this.getStateColor(initialState)
        });
        
        // Add stops for each transition
        transitions.forEach((transition, index) => {
            const progress = ((index + 1) / transitions.length) * 100;
            const state = this.determineTransitionState(transition);
            stops.push({
                offset: `${progress}%`,
                color: this.getStateColor(state)
            });
        });
        
        return stops;
    }
    
    /**
     * Determine initial state of hostage
     * @param {Object} hostage - Hostage record
     * @returns {string} Initial state
     */
    determineInitialState(hostage) {
        if (hostage.path && hostage.path.length > 0) {
            const firstPoint = hostage.path[0];
            if (firstPoint.lane === 'kidnapped-living') {
                return 'living';
            } else if (firstPoint.lane.includes('deceased')) {
                return 'kidnapped-dead';
            }
        }
        return 'living';
    }
    
    /**
     * Determine state from transition
     * @param {Object} transition - Transition segment
     * @returns {string} State
     */
    determineTransitionState(transition) {
        if (transition.toLane.includes('deceased')) {
            return 'deceased';
        } else if (transition.toLane.includes('released')) {
            if (transition.toLane.includes('military')) {
                return 'released-military';
            } else {
                return 'released-deal';
            }
        }
        return 'living';
    }
    
    /**
     * Get color for a specific state
     * @param {string} state - State name
     * @returns {string} Color value
     */
    getStateColor(state) {
        switch (state) {
            case 'living':
                return this.config.baseColors.living;
            case 'deceased':
                return this.config.baseColors.deceased;
            case 'released-deal':
                return this.config.baseColors.releasedDeal;
            case 'released-military':
                return this.config.baseColors.releasedMilitary;
            case 'kidnapped-dead':
                return this.config.baseColors.kidnappedDead;
            default:
                return this.config.baseColors.living;
        }
    }
    
    /**
     * Create dynamic gradient definition with multiple stops
     * @param {string} id - Gradient ID
     * @param {Array} stops - Array of gradient stops
     */
    createDynamicGradientDefinition(id, stops) {
        const defs = this.timeline.svg.select('defs');
        
        // Remove existing gradient if it exists
        defs.select(`#${id}`).remove();
        
        const gradient = defs.append('linearGradient')
            .attr('id', id)
            .attr('x1', '100%')
            .attr('y1', '0%')
            .attr('x2', '0%')
            .attr('y2', '0%')
            .attr('gradientUnits', 'objectBoundingBox');
            
        stops.forEach(stop => {
            gradient.append('stop')
                .attr('offset', stop.offset)
                .attr('stop-color', stop.color);
        });
    }
    
    /**
     * Apply color configuration to a D3 selection
     * @param {d3.selection} selection - D3 selection of path elements
     * @param {Object} colorConfig - Color configuration object
     */
    applyColorConfig(selection, colorConfig) {
        // Safety check for valid selection
        if (!selection || !selection.node || !selection.node()) {
            console.warn('ColorManager: Invalid D3 selection provided to applyColorConfig');
            return;
        }
        
        // Safety check for valid color config
        if (!colorConfig) {
            console.warn('ColorManager: Invalid color config provided to applyColorConfig');
            return;
        }
        
        try {
            if (colorConfig.type === 'gradient') {
                selection
                    .style('stroke', `url(#${colorConfig.gradientId})`)
                    .style('stroke-opacity', colorConfig.opacity);
            } else {
                selection
                    .style('stroke', colorConfig.color)
                    .style('stroke-opacity', colorConfig.opacity);
            }
        } catch (error) {
            console.error('ColorManager: Error applying color config:', error, { selection, colorConfig });
        }
    }
    
    /**
     * Update configuration
     * @param {Object} newConfig - Configuration updates
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.initializeGradients();
    }
    
    /**
     * Get current configuration
     * @returns {Object} Current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    
    /**
     * Clear gradient cache
     */
    clearCache() {
        this.gradientCache.clear();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColorManager;
}
