/**
 * Interaction Manager
 * Phase 4: Tooltips, hover effects, and user interactions
 * Implements PRD specifications for interactive features
 */

class InteractionManager {
    constructor(timelineCore, laneManager, customConfig = {}) {
        this.timeline = timelineCore;
        this.laneManager = laneManager;
        this.tooltip = d3.select(`#${AppConfig.ui.elements.tooltip}`);
        this.isActive = false;
        this.currentHoveredHostage = null;
        
        // Use centralized configuration
        this.config = AppConfig.helpers.mergeConfig('interaction', customConfig);
    }

    /**
     * Initialize interaction handlers
     */
    initialize() {
        // Setup global hover state management
        this.setupGlobalHoverState();
        
        // Initialize tooltip positioning
        this.initializeTooltip();
        
        console.log('Interaction manager initialized');
    }

    /**
     * Setup global hover state for dimming non-hovered lines
     */
    setupGlobalHoverState() {
        const timelineElement = this.timeline.container.node();
        
        if (timelineElement) {
            // Global mouse leave to reset hover state
            d3.select(timelineElement).on('mouseleave', () => {
                this.resetHoverState();
            });
        }
    }

    /**
     * Initialize tooltip element
     */
    initializeTooltip() {
        // Ensure tooltip exists and is properly configured
        if (this.tooltip.empty()) {
            console.warn('Tooltip element #tooltip not found');
            return;
        }
        
        this.tooltip
            .style('position', 'absolute')
            .style('pointer-events', 'none')
            .style('z-index', 1000)
            .style('display', 'none');
    }

    /**
     * Show tooltip for hostage with Hebrew/English content
     * @param {Object} hostage - Hostage record
     * @param {Event} event - Mouse event
     */
    showTooltip(hostage, event) {
        if (!hostage || this.tooltip.empty()) return;
        
        // Build tooltip content
        const tooltipContent = this.buildTooltipContent(hostage);
        
        // Update tooltip content
        this.tooltip.html(tooltipContent);
        
        // Position tooltip
        this.positionTooltip(event);
        
        // Show tooltip with fade in
        this.tooltip
            .style('display', 'block')
            .style('opacity', 0)
            .transition()
            .duration(this.config.fadeTransitionDuration)
            .style('opacity', 1);
        
        // Set hover state
        this.setHoverState(hostage, event);
    }

    /**
     * Build tooltip content with Hebrew and English information
     * @param {Object} hostage - Hostage record
     * @returns {string} HTML content for tooltip
     */
    buildTooltipContent(hostage) {
        const hebrewName = hostage['Hebrew Name'] || 'שם לא ידוע';
        const age = hostage['Age at Kidnapping'] || 'לא ידוע';
        const status = this.translateStatus(hostage['Current Status']);
        const circumstances = hostage['Kidnapping Circumstances (Hebrew)'] || '';
        
        // Format dates
        const kidnappedDate = this.formatHebrewDate(hostage.kidnappedDate);
        const releaseDate = hostage.releaseDate ? this.formatHebrewDate(hostage.releaseDate) : null;
        const deathDate = hostage.deathDate ? this.formatHebrewDate(hostage.deathDate) : null;
        
        let content = `
            <div class="name">${hebrewName}</div>
            <div class="status">${status}</div>
            <div class="date">גיל בעת החטיפה: ${age}</div>
            <div class="date">נחטף: ${kidnappedDate}</div>
        `;
        
        // Add release information
        if (releaseDate) {
            const releaseMethod = this.translateReleaseMethod(hostage['Release/Death Circumstances']);
            content += `<div class="date">שוחרר: ${releaseDate} (${releaseMethod})</div>`;
        }
        
        // Add death information
        if (deathDate) {
            content += `<div class="date">נפטר: ${deathDate}</div>`;
        }
        
        // Add circumstances if available
        if (circumstances && circumstances.trim()) {
            content += `<div class="circumstances">${circumstances}</div>`;
        }
        
        // Add transition information
        if (hostage.hasTransition) {
            const transitionDate = this.formatHebrewDate(hostage.transitionEvent.date);
            const transitionType = this.translateTransitionType(hostage.transitionEvent.type);
            content += `<div class="date">מעבר: ${transitionDate} (${transitionType})</div>`;
        }
        
        return content;
    }

    /**
     * Translate status to Hebrew
     * @param {string} status - English status
     * @returns {string} Hebrew status
     */
    translateStatus(status) {
        return AppConfig.helpers.translateStatus(status);
    }

    /**
     * Translate release method to Hebrew
     * @param {string} circumstances - Release circumstances
     * @returns {string} Hebrew release method
     */
    translateReleaseMethod(circumstances) {
        if (!circumstances) return 'לא ידוע';
        
        const lowerCircumstances = circumstances.toLowerCase();
        const translations = this.config.releaseMethodTranslations;
        
        for (const [keyword, hebrew] of Object.entries(translations)) {
            if (lowerCircumstances.includes(keyword)) {
                return hebrew;
            }
        }
        
        return 'לא ידוע';
    }

    /**
     * Translate transition type to Hebrew
     * @param {string} type - Transition type
     * @returns {string} Hebrew transition type
     */
    translateTransitionType(type) {
        const translations = this.config.transitionTypeTranslations;
        return translations[type] || type;
    }

    /**
     * Format date in Hebrew
     * @param {Date} date - Date to format
     * @returns {string} Hebrew formatted date
     */
    formatHebrewDate(date) {
        return AppConfig.helpers.formatHebrewDate(date);
    }

    /**
     * Position tooltip near mouse cursor with improved boundary detection
     * @param {Event} event - Mouse event
     */
    positionTooltip(event) {
        if (this.tooltip.empty()) return;
        
        // Make tooltip visible first to get accurate measurements
        this.tooltip.style('display', 'block').style('opacity', 0);
        
        const tooltipNode = this.tooltip.node();
        const rect = tooltipNode.getBoundingClientRect();
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        
        // Account for scroll position
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        
        // Calculate initial position
        let x = event.pageX + this.config.tooltipOffset.x;
        let y = event.pageY + this.config.tooltipOffset.y;
        
        // Convert to client coordinates for boundary checking
        const clientX = x - scrollX;
        const clientY = y - scrollY;
        
        // Adjust horizontal position if tooltip would go off screen
        if (clientX + rect.width > viewport.width - 20) {
            x = event.pageX - rect.width - Math.abs(this.config.tooltipOffset.x);
        }
        
        // Adjust vertical position if tooltip would go off screen
        if (clientY + rect.height > viewport.height - 20) {
            y = event.pageY - rect.height - Math.abs(this.config.tooltipOffset.y);
        }
        
        // Final bounds checking with margins
        const margin = 10;
        const minX = scrollX + margin;
        const maxX = scrollX + viewport.width - rect.width - margin;
        const minY = scrollY + margin;
        const maxY = scrollY + viewport.height - rect.height - margin;
        
        x = Math.max(minX, Math.min(x, maxX));
        y = Math.max(minY, Math.min(y, maxY));
        
        this.tooltip
            .style('left', `${x}px`)
            .style('top', `${y}px`);
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        if (this.tooltip.empty()) return;
        
        this.tooltip
            .transition()
            .duration(this.config.fadeTransitionDuration)
            .style('opacity', 0)
            .on('end', () => {
                this.tooltip.style('display', 'none');
            });
        
        // Reset hover state
        this.resetHoverState();
    }

    /**
     * Set hover state with line highlighting and dimming
     * @param {Object} hostage - Hostage record
     * @param {Event} event - Mouse event
     */
    setHoverState(hostage, event) {
        this.currentHoveredHostage = hostage;
        
        // Get hostage ID for unique identification
        const hostageId = hostage['Hebrew Name'] || `hostage_${hostage._lineNumber || 0}`;
        
        // Highlight current line by adding unique class
        const currentLine = d3.select(event.currentTarget);
        currentLine
            .classed('hovered-line', true)
            .attr('data-hostage-id', hostageId)
            .style('stroke-width', this.config.highlightStrokeWidth)
            .style('opacity', this.config.highlightOpacity);
        
        // Dim other lines (those without the hovered-line class)
        const layerGroups = this.timeline.getLayerGroups();
        layerGroups.lines.selectAll('.hostage-line:not(.hovered-line)')
            .transition()
            .duration(100)
            .style('opacity', this.config.dimmedOpacity);
    }

    /**
     * Reset hover state
     */
    resetHoverState() {
        this.currentHoveredHostage = null;
        
        // Reset all lines to normal state and remove hover classes
        const layerGroups = this.timeline.getLayerGroups();
        layerGroups.lines.selectAll('.hostage-line')
            .classed('hovered-line', false)
            .attr('data-hostage-id', null)
            .transition()
            .duration(this.config.fadeTransitionDuration)
            .style('opacity', 1)
            .style('stroke-width', this.config.normalStrokeWidth);
    }

    /**
     * Handle hover effects
     * @param {Object} hostage - Hostage record
     * @param {boolean} isHovering - Hover state
     */
    handleHover(hostage, isHovering) {
        if (isHovering) {
            this.currentHoveredHostage = hostage;
        } else if (this.currentHoveredHostage === hostage) {
            this.resetHoverState();
        }
    }

    /**
     * Update configuration
     * @param {Object} newConfig - Configuration updates
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get current configuration
     * @returns {Object} Current configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Get current hover state
     * @returns {Object|null} Currently hovered hostage or null
     */
    getCurrentHoveredHostage() {
        return this.currentHoveredHostage;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InteractionManager;
}