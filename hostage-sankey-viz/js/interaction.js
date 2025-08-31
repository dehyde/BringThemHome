/**
 * Advanced Interaction System
 * Handles individual path highlighting, filtering, and detailed interactions
 */

class SankeyInteractionManager {
    constructor(sankeyInstance, dataProcessor) {
        this.sankey = sankeyInstance;
        this.dataProcessor = dataProcessor;
        this.individualPaths = [];
        this.activeFilters = new Set();
        this.highlightedPaths = new Set();
        this.isIndividualMode = false;
        
        this.initializeControls();
    }

    /**
     * Initialize interaction controls
     */
    initializeControls() {
        this.createModeToggle();
        this.createFilterControls();
        this.setupKeyboardShortcuts();
    }

    /**
     * Create mode toggle between aggregated and individual paths
     */
    createModeToggle() {
        const header = document.querySelector('.app-header');
        
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'mode-toggle';
        toggleContainer.innerHTML = `
            <label class="toggle-label">
                <input type="checkbox" id="individual-mode-toggle" />
                <span class="toggle-text">מצב נתיבים פרטיים</span>
            </label>
        `;
        
        header.appendChild(toggleContainer);
        
        const toggle = document.getElementById('individual-mode-toggle');
        toggle.addEventListener('change', (e) => {
            this.toggleIndividualMode(e.target.checked);
        });
    }

    /**
     * Create filter controls
     */
    createFilterControls() {
        const container = document.querySelector('.legend-container');
        
        const filterSection = document.createElement('div');
        filterSection.className = 'filter-controls';
        filterSection.innerHTML = `
            <h3>סינון נתונים</h3>
            <div class="filter-groups">
                <div class="filter-group">
                    <label>גיל:</label>
                    <select id="age-filter" multiple>
                        <option value="0-18">0-18</option>
                        <option value="19-30">19-30</option>
                        <option value="31-50">31-50</option>
                        <option value="51-70">51-70</option>
                        <option value="71+">71+</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>מיקום חטיפה:</label>
                    <select id="location-filter" multiple>
                        <option value="">הכל</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>סטטוס:</label>
                    <select id="status-filter" multiple>
                        <option value="">הכל</option>
                        <option value="civilian">אזרח</option>
                        <option value="soldier">חייל</option>
                    </select>
                </div>
            </div>
            <div class="filter-actions">
                <button id="apply-filters">החל מסננים</button>
                <button id="clear-filters">נקה מסננים</button>
            </div>
        `;
        
        container.appendChild(filterSection);
        
        this.setupFilterEvents();
    }

    /**
     * Setup filter event listeners
     */
    setupFilterEvents() {
        document.getElementById('apply-filters').addEventListener('click', () => {
            this.applyFilters();
        });
        
        document.getElementById('clear-filters').addEventListener('click', () => {
            this.clearFilters();
        });
        
        // Populate location filter options
        this.populateLocationFilter();
    }

    /**
     * Populate location filter with unique values
     */
    populateLocationFilter() {
        const locations = new Set();
        this.dataProcessor.processedData.forEach(record => {
            const location = record['Location Kidnapped (Hebrew)'];
            if (location && location.trim()) {
                locations.add(location.trim());
            }
        });
        
        const locationSelect = document.getElementById('location-filter');
        Array.from(locations).sort().forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            locationSelect.appendChild(option);
        });
    }

    /**
     * Toggle between aggregated and individual path modes
     */
    toggleIndividualMode(enabled) {
        this.isIndividualMode = enabled;
        
        if (enabled) {
            this.renderIndividualPaths();
        } else {
            this.renderAggregatedPaths();
        }
        
        console.log(`Switched to ${enabled ? 'individual' : 'aggregated'} mode`);
    }

    /**
     * Render individual paths overlay
     */
    renderIndividualPaths() {
        // This will be implemented to show individual hostage paths
        // Similar to the WaPo example the user referenced
        
        const svg = this.sankey.svg;
        const paths = this.dataProcessor.individualPaths;
        
        // Remove existing individual paths
        svg.selectAll('.individual-path').remove();
        
        // Create individual path elements
        const pathGroups = svg.selectAll('.individual-path-group')
            .data(paths)
            .enter()
            .append('g')
            .attr('class', 'individual-path-group');
        
        // For each individual path, create multiple segments
        pathGroups.each((d, i) => {
            this.createIndividualPathSegments(d3.select(this), d, i);
        });
        
        // Reduce opacity of main sankey links
        svg.selectAll('.sankey-link')
            .transition()
            .duration(300)
            .style('opacity', 0.1);
    }

    /**
     * Create individual path segments for a single hostage
     */
    createIndividualPathSegments(group, pathData, index) {
        const { path, record } = pathData;
        const svg = this.sankey.svg;
        
        // Get node positions for this path
        const nodes = this.sankey.data.nodes;
        const step1Node = nodes.find(n => n.id === path[0]);
        const step2Node = nodes.find(n => n.id === path[1]);
        const step3Node = nodes.find(n => n.id === path[2]);
        
        if (!step1Node || !step2Node || !step3Node) return;
        
        // Calculate individual path positions with slight offset for visibility
        const offset = (index % 20 - 10) * 2; // Spread paths vertically
        
        const pathPoints = [
            { x: (step1Node.x0 + step1Node.x1) / 2, y: (step1Node.y0 + step1Node.y1) / 2 + offset },
            { x: (step2Node.x0 + step2Node.x1) / 2, y: (step2Node.y0 + step2Node.y1) / 2 + offset },
            { x: (step3Node.x0 + step3Node.x1) / 2, y: (step3Node.y0 + step3Node.y1) / 2 + offset }
        ];
        
        // Create path line
        const line = d3.line()
            .x(d => d.x)
            .y(d => d.y)
            .curve(d3.curveBasis);
        
        const pathElement = group
            .append('path')
            .attr('class', 'individual-path')
            .attr('d', line(pathPoints))
            .style('fill', 'none')
            .style('stroke', this.getIndividualPathColor(pathData))
            .style('stroke-width', 1.5)
            .style('opacity', 0.7)
            .style('cursor', 'pointer');
        
        // Add interactions for individual paths
        this.setupIndividualPathInteractions(pathElement, pathData);
    }

    /**
     * Get color for individual path based on outcome
     */
    getIndividualPathColor(pathData) {
        const step2 = pathData.path[1]; // Captivity status
        const finalOutcome = pathData.path[2];
        
        // If deceased, use gray color
        if (step2 === 'died-captivity' || step2 === 'already-deceased') {
            return '#95a5a6'; // Gray for deceased
        }
        
        // Otherwise use category colors for living
        const colors = {
            'released-deal': '#27ae60',           // Combined deal releases
            'released-military': '#2980b9',       // Combined military releases
            'still-held-living': '#f39c12',
            'still-held-deceased': '#d35400'
        };
        
        return colors[finalOutcome] || '#7f8c8d';
    }

    /**
     * Setup interactions for individual paths
     */
    setupIndividualPathInteractions(pathElement, pathData) {
        pathElement
            .on('mouseover', (event) => {
                pathElement.style('stroke-width', 3).style('opacity', 1);
                this.showIndividualTooltip(event, pathData);
            })
            .on('mouseout', (event) => {
                if (!this.highlightedPaths.has(pathData.id)) {
                    pathElement.style('stroke-width', 1.5).style('opacity', 0.7);
                }
                this.sankey.hideTooltip();
            })
            .on('click', (event) => {
                this.togglePathHighlight(pathElement, pathData);
            });
    }

    /**
     * Show detailed tooltip for individual path
     */
    showIndividualTooltip(event, pathData) {
        const { record } = pathData;
        const content = `
            <div class="name">${pathData.name}</div>
            <div class="details">
                גיל: ${record['Age at Kidnapping'] || 'לא ידוע'}<br>
                מיקום חטיפה: ${record['Location Kidnapped (Hebrew)'] || 'לא ידוע'}<br>
                סטטוס: ${record['Civilian/Soldier Status'] || 'לא ידוע'}<br>
                נתיב: ${pathData.path.map(step => this.dataProcessor.getNodeLabel(step)).join(' → ')}
            </div>
        `;
        
        const tooltip = d3.select('#tooltip');
        tooltip.select('.tooltip-content').html(content);
        tooltip.classed('hidden', false);
        
        const [x, y] = d3.pointer(event, document.body);
        tooltip
            .style('left', (x + 10) + 'px')
            .style('top', (y - 10) + 'px');
    }

    /**
     * Toggle path highlight
     */
    togglePathHighlight(pathElement, pathData) {
        if (this.highlightedPaths.has(pathData.id)) {
            this.highlightedPaths.delete(pathData.id);
            pathElement.classed('highlighted', false);
        } else {
            this.highlightedPaths.add(pathData.id);
            pathElement.classed('highlighted', true);
        }
        
        this.updatePathHighlighting();
    }

    /**
     * Update visual highlighting
     */
    updatePathHighlighting() {
        const svg = this.sankey.svg;
        const hasHighlighted = this.highlightedPaths.size > 0;
        
        svg.selectAll('.individual-path')
            .classed('dimmed', function(d) {
                return hasHighlighted && !this.classList.contains('highlighted');
            });
    }

    /**
     * Render aggregated paths (normal Sankey mode)
     */
    renderAggregatedPaths() {
        const svg = this.sankey.svg;
        
        // Remove individual paths
        svg.selectAll('.individual-path-group').remove();
        
        // Restore main sankey links opacity
        svg.selectAll('.sankey-link')
            .transition()
            .duration(300)
            .style('opacity', 0.6);
    }

    /**
     * Apply selected filters
     */
    applyFilters() {
        const ageFilter = Array.from(document.getElementById('age-filter').selectedOptions)
            .map(option => option.value);
        const locationFilter = Array.from(document.getElementById('location-filter').selectedOptions)
            .map(option => option.value);
        const statusFilter = Array.from(document.getElementById('status-filter').selectedOptions)
            .map(option => option.value);
        
        // Filter data based on selected criteria
        const filteredData = this.dataProcessor.processedData.filter(record => {
            // Age filter
            if (ageFilter.length > 0) {
                const age = parseInt(record['Age at Kidnapping']);
                const ageGroup = this.getAgeGroup(age);
                if (!ageFilter.includes(ageGroup)) return false;
            }
            
            // Location filter
            if (locationFilter.length > 0 && !locationFilter.includes('')) {
                const location = record['Location Kidnapped (Hebrew)'] || '';
                if (!locationFilter.includes(location)) return false;
            }
            
            // Status filter
            if (statusFilter.length > 0 && !statusFilter.includes('')) {
                const status = record['Civilian/Soldier Status'] || '';
                const statusType = status && status.includes('Civilian') ? 'civilian' : 'soldier';
                if (!statusFilter.includes(statusType)) return false;
            }
            
            return true;
        });
        
        // Re-render with filtered data
        this.renderWithFilteredData(filteredData);
        
        console.log(`Applied filters, showing ${filteredData.length} of ${this.dataProcessor.processedData.length} hostages`);
    }

    /**
     * Get age group for filtering
     */
    getAgeGroup(age) {
        if (age <= 18) return '0-18';
        if (age <= 30) return '19-30';
        if (age <= 50) return '31-50';
        if (age <= 70) return '51-70';
        return '71+';
    }

    /**
     * Render with filtered data
     */
    renderWithFilteredData(filteredData) {
        // Create temporary data processor with filtered data
        const tempProcessor = new SankeyDataProcessor();
        tempProcessor.processedData = filteredData;
        tempProcessor.generateSankeyData();
        tempProcessor.generateIndividualPaths();
        
        // Re-render sankey with filtered data
        this.sankey.render(tempProcessor.sankeyData, tempProcessor.individualPaths);
        
        // Update individual paths if in individual mode
        if (this.isIndividualMode) {
            this.renderIndividualPaths();
        }
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        // Clear select elements
        document.getElementById('age-filter').selectedIndex = -1;
        document.getElementById('location-filter').selectedIndex = -1;
        document.getElementById('status-filter').selectedIndex = -1;
        
        // Re-render with full data
        this.sankey.render(this.dataProcessor.sankeyData, this.dataProcessor.individualPaths);
        
        if (this.isIndividualMode) {
            this.renderIndividualPaths();
        }
        
        console.log('Filters cleared, showing all data');
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            if (event.key === 'i' || event.key === 'I') {
                const toggle = document.getElementById('individual-mode-toggle');
                toggle.checked = !toggle.checked;
                this.toggleIndividualMode(toggle.checked);
            } else if (event.key === 'c' || event.key === 'C') {
                this.clearFilters();
            } else if (event.key === 'Escape') {
                this.highlightedPaths.clear();
                this.sankey.clearSelections();
                this.updatePathHighlighting();
            }
        });
    }

    /**
     * Update with new data
     */
    updateData(dataProcessor) {
        this.dataProcessor = dataProcessor;
        this.individualPaths = dataProcessor.individualPaths;
        
        // Repopulate filters
        this.populateLocationFilter();
        
        // Re-render current mode
        if (this.isIndividualMode) {
            this.renderIndividualPaths();
        }
    }
}