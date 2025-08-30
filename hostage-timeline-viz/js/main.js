/**
 * Main Application Controller
 * Coordinates all modules and handles application lifecycle
 */

class HostageTimelineApp {
    constructor() {
        this.dataProcessor = new DataProcessor();
        this.timelineCore = null;
        this.laneManager = null;
        this.transitionEngine = null;
        this.interactionManager = null;
        
        this.data = [];
        this.isLoading = false;
        this.hasError = false;
        
        // UI elements
        this.elements = {
            loading: document.getElementById('loading'),
            errorPanel: document.getElementById('error-panel'),
            errorContent: document.getElementById('error-content'),
            statsPanel: document.getElementById('stats-panel'),
            statsContent: document.getElementById('stats-content'),
            visualizationContainer: document.getElementById('visualization-container'),
            liveCount: document.getElementById('live-count')
        };
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            console.log('Initializing Hostage Timeline Application...');
            
            // Show loading state
            this.showLoading();
            
            // Load and process data
            await this.loadData();
            
            // Initialize visualization components
            this.initializeVisualization();
            
            // Process data through pipeline
            this.processData();
            
            // Render initial visualization
            this.renderVisualization();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Hide loading, show visualization
            this.showVisualization();
            
            console.log('Application initialized successfully');
            
        } catch (error) {
            console.error('Application initialization failed:', error);
            this.showError('Application initialization failed', error);
        }
    }

    /**
     * Load CSV data from file
     */
    async loadData() {
        try {
            console.log('Loading CSV data...');
            
            const response = await fetch('data/hostages-from-kan-fixed.csv');
            if (!response.ok) {
                throw new Error(`Failed to load CSV file: ${response.status} ${response.statusText}`);
            }
            
            const csvText = await response.text();
            console.log(`Loaded CSV file: ${csvText.length} characters`);
            
            // Process data through data processor
            this.data = this.dataProcessor.process(csvText);
            
            console.log(`Data processing complete: ${this.data.length} records`);
            
            // Update live count
            this.updateLiveCount();
            
            // Show processing stats
            this.showStats();
            
        } catch (error) {
            console.error('Data loading failed:', error);
            throw new Error(`Data loading failed: ${error.message}`);
        }
    }

    /**
     * Initialize visualization components
     */
    initializeVisualization() {
        try {
            console.log('Initializing visualization components...');
            
            // Initialize timeline core
            this.timelineCore = new TimelineCore('main-timeline');
            this.timelineCore.initialize();
            
            // Initialize lane manager
            this.laneManager = new LaneManager(this.timelineCore);
            
            // Initialize transition engine and interaction manager
            this.transitionEngine = new TransitionEngine(this.timelineCore, this.laneManager);
            this.interactionManager = new InteractionManager(this.timelineCore, this.laneManager);
            this.interactionManager.initialize();
            
            console.log('Visualization components initialized');
            
        } catch (error) {
            console.error('Visualization initialization failed:', error);
            throw error;
        }
    }

    /**
     * Process data through the visualization pipeline
     */
    processData() {
        try {
            console.log('Processing data for visualization...');
            
            // Update timeline with processed data
            this.timelineCore.updateTimeline(this.data);
            
            // Process data through lane manager
            const sortedData = this.laneManager.processData(this.data);
            
            console.log('Data processing pipeline complete');
            return sortedData;
            
        } catch (error) {
            console.error('Data processing pipeline failed:', error);
            throw error;
        }
    }

    /**
     * Render the visualization
     */
    renderVisualization() {
        try {
            console.log('Rendering visualization...');
            
            // Render lanes and labels
            this.laneManager.renderLanes();
            
            // Add background grid for better readability
            this.timelineCore.addBackgroundGrid();
            
            // Debug: Log lane statistics and show boundaries
            this.laneManager.logLaneStats();
            this.laneManager.debugLaneLayout();
            
            // Render hostage lines
            this.renderHostageLines();
            
            console.log('Visualization rendered');
            
        } catch (error) {
            console.error('Visualization rendering failed:', error);
            throw error;
        }
    }

    /**
     * Render hostage lines using advanced transition engine (Phase 3 implementation)
     */
    renderHostageLines() {
        const layerGroups = this.timelineCore.getLayerGroups();
        const sortedData = this.laneManager.getSortedData();
        
        // Clear existing lines
        layerGroups.lines.selectAll('*').remove();
        
        // Generate optimized paths using transition engine
        const optimizedPaths = this.transitionEngine.generateOptimizedPaths(sortedData);
        
        // Render lines for each hostage
        const lines = layerGroups.lines
            .selectAll('.hostage-line')
            .data(optimizedPaths)
            .enter()
            .append('path')
            .attr('class', d => `hostage-line ${d.hostage.finalLane}`)
            .attr('data-name', d => d.hostage['Hebrew Name'])
            .attr('d', d => d.path)
            .style('stroke', d => d.hostage.laneDef.color)
            .style('stroke-width', 1.5)
            .style('fill', 'none')
            .style('stroke-linecap', 'round')
            .style('stroke-linejoin', 'round');
        
        // Add hover effects using interaction manager
        lines.on('mouseenter', (event, d) => {
                d3.select(event.currentTarget).style('stroke-width', 3);
                this.interactionManager.showTooltip(d.hostage, event);
            })
            .on('mouseleave', (event, d) => {
                d3.select(event.currentTarget).style('stroke-width', 1.5);
                this.interactionManager.hideTooltip();
            });
        
        // Log transition statistics
        console.log('Transition statistics:', this.transitionEngine.getTransitionStats(sortedData));
    }

    // generateHostagePath method removed - now handled by TransitionEngine

    /**
     * Setup event listeners for responsive behavior
     */
    setupEventListeners() {
        // Window resize handler
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                this.handleResize();
            }, 250);
        });
        
        // Handle potential future controls
        // TODO: Add controls for filtering, animation, etc.
    }

    /**
     * Handle window resize
     */
    handleResize() {
        try {
            console.log('Handling window resize...');
            
            if (this.timelineCore) {
                this.timelineCore.resize();
                
                // Re-render if we have data
                if (this.data.length > 0) {
                    this.laneManager.calculateLaneHeights();
                    this.laneManager.renderLanes();
                    this.renderHostageLines();
                }
            }
            
        } catch (error) {
            console.error('Resize handling failed:', error);
        }
    }

    /**
     * Update live hostage count in banner
     */
    updateLiveCount() {
        if (!this.data.length) return;
        
        // Count hostages still in captivity
        const stillCaptive = this.data.filter(h => 
            h.finalLane === 'kidnapped-living' || 
            (h.finalLane === 'kidnapped-deceased' && h['Current Status']?.includes('Held'))
        ).length;
        
        const released = this.data.filter(h => 
            h.finalLane?.includes('released')
        ).length;
        
        const total = this.data.length;
        
        this.elements.liveCount.innerHTML = `
            <div>סה"כ ${total} חטופים | ${stillCaptive} עדיין בשבי | ${released} שוחררו</div>
        `;
    }

    /**
     * Show processing statistics
     */
    showStats() {
        const stats = this.dataProcessor.getStats();
        const laneStats = this.laneManager ? this.laneManager.getStats() : null;
        
        let statsHTML = `
            <h4>עיבוד נתונים</h4>
            <p>סה"כ רשומות: ${stats.total}</p>
            <p>שגיאות: ${stats.errors}</p>
            <p>מעברים בין שכבות: ${stats.withTransitions}</p>
        `;
        
        if (laneStats) {
            statsHTML += `
                <h4>חלוקה לפי שכבות</h4>
            `;
            Object.entries(laneStats.lanes).forEach(([laneId, lane]) => {
                statsHTML += `<p>${lane.label}: ${lane.count}</p>`;
            });
        }
        
        this.elements.statsContent.innerHTML = statsHTML;
        this.elements.statsPanel.style.display = 'block';
    }

    /**
     * Show loading state
     */
    showLoading() {
        this.elements.loading.style.display = 'block';
        this.elements.visualizationContainer.style.display = 'none';
        this.elements.errorPanel.style.display = 'none';
    }

    /**
     * Show visualization
     */
    showVisualization() {
        this.elements.loading.style.display = 'none';
        this.elements.visualizationContainer.style.display = 'block';
        this.elements.errorPanel.style.display = 'none';
    }

    /**
     * Show error state
     * @param {string} message - Error message
     * @param {Error} error - Error object
     */
    showError(message, error) {
        this.hasError = true;
        
        let errorHTML = `
            <h4>${message}</h4>
            <p>יש שגיאה בטעינת הנתונים או בעיבוד שלהם. אנא בדוק את הקונסול למידע נוסף.</p>
        `;
        
        if (error) {
            errorHTML += `
                <details>
                    <summary>פרטים טכניים</summary>
                    <pre>${error.stack || error.message}</pre>
                </details>
            `;
        }
        
        // Show processing errors if any
        const processingErrors = this.dataProcessor.getErrors();
        if (processingErrors.length > 0) {
            errorHTML += `
                <details>
                    <summary>שגיאות עיבוד נתונים (${processingErrors.length})</summary>
                    <div class="error-list">
                        ${processingErrors.map(err => `<div>${err}</div>`).join('')}
                    </div>
                </details>
            `;
        }
        
        this.elements.errorContent.innerHTML = errorHTML;
        this.elements.errorPanel.style.display = 'block';
        this.elements.loading.style.display = 'none';
        this.elements.visualizationContainer.style.display = 'none';
    }

    /**
     * Get current application state
     * @returns {Object} Application state
     */
    getState() {
        return {
            isLoading: this.isLoading,
            hasError: this.hasError,
            dataCount: this.data.length,
            initialized: !!this.timelineCore
        };
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing application...');
    
    window.app = new HostageTimelineApp();
    window.app.initialize().catch(error => {
        console.error('Failed to initialize application:', error);
    });
});