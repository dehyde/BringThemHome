/**
 * Timeline Core Engine
 * Phase 2: Core Visualization Engine - SVG timeline foundation, coordinate system
 */

class TimelineCore {
    constructor(containerId, customConfig = {}) {
        this.containerId = containerId;
        this.container = d3.select(`#${containerId}`);
        this.svg = null;
        this.dimensions = {};
        this.scales = {};
        this.data = [];
        
        // Use centralized configuration
        this.config = AppConfig.helpers.mergeConfig('timeline', customConfig);
        
        // Convert string dates to Date objects
        this.config.timelineStart = new Date(this.config.defaultStart);
        this.config.timelineEnd = new Date(); // Current date
        
        this.initialized = false;
    }

    /**
     * Initialize the SVG container and coordinate system
     */
    initialize() {
        try {
            // Clear any existing content
            this.container.selectAll('*').remove();
            
            // Calculate dimensions
            this.calculateDimensions();
            
            // Create SVG container
            this.createSVGContainer();
            
            // Set up coordinate system
            this.setupCoordinateSystem();
            
            // Create timeline axis
            this.createTimelineAxis();
            
            this.initialized = true;
            console.log('Timeline core initialized successfully');
            
        } catch (error) {
            console.error('Timeline core initialization failed:', error);
            throw error;
        }
    }

    /**
     * Calculate responsive dimensions based on container
     */
    calculateDimensions() {
        const containerNode = this.container.node();
        const rect = containerNode.getBoundingClientRect();
        
        // Use viewport dimensions for better centering
        const viewportHeight = window.innerHeight - 100; // Account for header/footer
        const viewportWidth = window.innerWidth;
        
        console.log('Container rect:', rect);
        console.log('Viewport dimensions:', { width: viewportWidth, height: viewportHeight });
        
        this.dimensions = {
            containerWidth: Math.max(rect.width || viewportWidth, this.config.minWidth),
            containerHeight: Math.max(rect.height || viewportHeight, this.config.minHeight),
            width: Math.max((rect.width || viewportWidth) - this.config.margins.left - this.config.margins.right, 600),
            height: Math.max((rect.height || viewportHeight) - this.config.margins.top - this.config.margins.bottom, 400)
        };
        
        console.log('Timeline dimensions calculated:', this.dimensions);
    }

    /**
     * Create the main SVG container with proper RTL setup
     */
    createSVGContainer() {
        // Use minimum width to ensure horizontal scrolling works
        const svgWidth = Math.max(this.dimensions.containerWidth, this.config.minWidth);
        
        this.svg = this.container
            .append('svg')
            .attr('class', 'timeline-svg')
            .attr('width', svgWidth)
            .attr('height', this.dimensions.containerHeight)
            .attr('dir', 'rtl')
            .style('display', 'block')
            .style('min-width', svgWidth + 'px')
            .style('min-height', '100%');
        
        // Create main group for timeline content
        this.timelineGroup = this.svg
            .append('g')
            .attr('class', 'timeline-group')
            .attr('transform', `translate(${this.config.margins.left}, ${this.config.margins.top})`);
        
        // Create groups for different layers
        this.layerGroups = {
            background: this.timelineGroup.append('g').attr('class', 'background-layer'),
            lanes: this.timelineGroup.append('g').attr('class', 'lanes-layer'),
            lines: this.timelineGroup.append('g').attr('class', 'lines-layer'),
            labels: this.timelineGroup.append('g').attr('class', 'labels-layer'),
            axis: this.timelineGroup.append('g').attr('class', 'axis-layer')
        };
    }

    /**
     * Set up coordinate system and scales for RTL timeline
     */
    setupCoordinateSystem() {
        // X-scale: RTL timeline (right = past, left = present)  
        // For RTL: early dates (Oct 7) on right (large X), recent dates on left (small X)
        this.scales.x = d3.scaleTime()
            .domain([this.config.timelineStart, this.config.timelineEnd]) // Normal domain: start to end
            .range([this.dimensions.width, 0]); // Reversed range for RTL: right=max, left=0
        
        // Y-scale will be set by lane manager based on data
        this.scales.y = d3.scaleLinear()
            .domain([0, 100]) // Placeholder, will be updated by lane manager
            .range([0, this.dimensions.height - this.config.axisHeight]);
        
        console.log('Coordinate system established');
        console.log('X-scale domain:', this.scales.x.domain());
        console.log('X-scale range:', this.scales.x.range());
    }

    /**
     * Create timeline axis with Hebrew date formatting
     */
    createTimelineAxis() {
        // Hebrew date formatter using centralized config
        const hebrewFormatter = (date) => {
            const day = date.getDate();
            const month = AppConfig.helpers.getHebrewMonth(date.getMonth(), false);
            const year = date.getFullYear();
            
            return `${day} ${month} ${year}`;
        };
        
        // Create axis
        const xAxis = d3.axisBottom(this.scales.x)
            .tickFormat(hebrewFormatter)
            .ticks(d3.timeMonth.every(this.config.tickInterval)) // Configurable interval
            .tickSizeInner(-this.dimensions.height + this.config.axisHeight)
            .tickSizeOuter(0);
        
        // Position axis at bottom
        const axisGroup = this.layerGroups.axis
            .append('g')
            .attr('class', 'timeline-axis')
            .attr('transform', `translate(0, ${this.dimensions.height - this.config.axisHeight})`);
        
        // Apply axis
        axisGroup.call(xAxis);
        
        // Style axis for RTL
        axisGroup.selectAll('text')
            .attr('text-anchor', 'middle')
            .attr('direction', 'rtl')
            .style('font-family', AppConfig.fonts.primary);
    }

    /**
     * Update timeline with new data
     * @param {Array} processedData - Array of processed hostage data
     */
    updateTimeline(processedData) {
        if (!this.initialized) {
            throw new Error('Timeline core not initialized');
        }
        
        this.data = processedData;
        
        // Update time scale domain based on actual data
        this.updateTimeScale();
        
        console.log(`Timeline updated with ${processedData.length} records`);
    }

    /**
     * Update time scale based on actual data range
     */
    updateTimeScale() {
        if (!this.data.length) return;
        
        // Find actual date range in data
        let minDate = new Date('2023-10-07'); // October 7th start
        let maxDate = new Date(); // Today
        
        this.data.forEach(record => {
            if (record.kidnappedDate && record.kidnappedDate < minDate) {
                minDate = record.kidnappedDate;
            }
            
            record.events?.forEach(event => {
                if (event.date > maxDate) {
                    maxDate = event.date;
                }
            });
        });
        
        // Add padding to date range
        const padding = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
        minDate = new Date(minDate.getTime() - padding);
        maxDate = new Date(maxDate.getTime() + padding);
        
        // Update scale for RTL (start date first, range handles RTL positioning)
        this.scales.x.domain([minDate, maxDate]);
        
        // Refresh axis
        this.refreshAxis();
        
        console.log('Time scale updated:', { minDate, maxDate });
    }

    /**
     * Refresh the timeline axis
     */
    refreshAxis() {
        const hebrewFormatter = (date) => {
            const day = date.getDate();
            const month = AppConfig.helpers.getHebrewMonth(date.getMonth(), false);
            const year = date.getFullYear();
            
            return `${day} ${month} ${year}`;
        };
        
        const xAxis = d3.axisBottom(this.scales.x)
            .tickFormat(hebrewFormatter)
            .ticks(d3.timeMonth.every(this.config.tickInterval))
            .tickSizeInner(-this.dimensions.height + this.config.axisHeight)
            .tickSizeOuter(0);
        
        this.layerGroups.axis.select('.timeline-axis')
            .transition()
            .duration(750)
            .call(xAxis);
    }

    /**
     * Convert date to x-coordinate
     * @param {Date} date - Date to convert
     * @returns {number} X-coordinate
     */
    dateToX(date) {
        return this.scales.x(date);
    }

    /**
     * Convert value to y-coordinate
     * @param {number} value - Value to convert
     * @returns {number} Y-coordinate  
     */
    valueToY(value) {
        return this.scales.y(value);
    }

    /**
     * Get timeline dimensions
     * @returns {Object} Dimensions object
     */
    getDimensions() {
        return { ...this.dimensions };
    }

    /**
     * Get timeline scales
     * @returns {Object} Scales object
     */
    getScales() {
        return { ...this.scales };
    }

    /**
     * Get layer groups for other modules
     * @returns {Object} Layer groups
     */
    getLayerGroups() {
        return this.layerGroups;
    }

    /**
     * Resize timeline responsively
     */
    resize() {
        // Recalculate dimensions
        this.calculateDimensions();
        
        // Update SVG size
        this.svg
            .attr('width', this.dimensions.containerWidth)
            .attr('height', this.dimensions.containerHeight);
        
        // Update scales (maintain RTL range)
        this.scales.x.range([this.dimensions.width, 0]); // RTL: right=max, left=0
        this.scales.y.range([0, this.dimensions.height - this.config.axisHeight]);
        
        // Refresh axis
        this.refreshAxis();
        
        console.log('Timeline resized:', this.dimensions);
    }

    /**
     * Add background grid for better readability
     */
    addBackgroundGrid() {
        const gridGroup = this.layerGroups.background
            .append('g')
            .attr('class', 'background-grid');
        
        // Vertical grid lines (monthly)
        const months = this.scales.x.ticks(d3.timeMonth);
        
        gridGroup.selectAll('.grid-line-vertical')
            .data(months)
            .enter()
            .append('line')
            .attr('class', 'grid-line-vertical')
            .attr('x1', d => this.scales.x(d))
            .attr('x2', d => this.scales.x(d))
            .attr('y1', 0)
            .attr('y2', this.dimensions.height - this.config.axisHeight)
            .style('stroke', AppConfig.colors.grid.main)
            .style('stroke-width', 1);
    }

    /**
     * Get configuration
     * @returns {Object} Current configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Update configuration
     * @param {Object} newConfig - Configuration updates
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        // Reinitialize if already initialized
        if (this.initialized) {
            this.initialize();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimelineCore;
}