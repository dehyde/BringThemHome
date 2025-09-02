/**
 * Main Application Controller
 * Coordinates all modules and handles application lifecycle
 */

class HostageTimelineApp {
    constructor(customConfig = {}) {
        // Use centralized configuration
        this.config = AppConfig.helpers.getConfig('ui', customConfig);
        
        // Initialize core systems
        this.eventBus = new EventBus();
        this.stateManager = new StateManager({
            // Initial state
            data: [],
            isLoading: false,
            hasError: false,
            errorMessage: null,
            selectedHostage: null,
            filters: {},
            view: 'timeline',
            zoom: 1,
            timeRange: null,
            processedDataCount: 0,
            laneStats: {},
            currentHoveredHostage: null
        }, this.eventBus);
        
        // Enable debug mode for development
        if (AppConfig.debug?.enabled) {
            this.eventBus.setDebugMode(true);
            this.stateManager.setDebugMode(true);
        }
        
        this.dataProcessor = new DataProcessor();
        this.timelineCore = null;
        this.laneManager = null;
        this.transitionEngine = null;
        this.interactionManager = null;
        
        // UI elements using centralized config
        this.elements = {
            loading: document.getElementById(AppConfig.ui.elements.loading),
            errorPanel: document.getElementById(AppConfig.ui.elements.errorPanel),
            errorContent: document.getElementById(AppConfig.ui.elements.errorContent),
            headerStats: document.getElementById(AppConfig.ui.elements.headerStats),
            visualizationContainer: document.getElementById(AppConfig.ui.elements.visualizationContainer),
            liveCount: document.getElementById(AppConfig.ui.elements.liveCount)
        };

        // Setup state subscriptions
        this.setupStateSubscriptions();
        
        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Setup state subscriptions to react to state changes
     */
    setupStateSubscriptions() {
        // Subscribe to loading state changes
        this.stateManager.subscribe((newState, prevState) => {
            if (newState.isLoading !== prevState.isLoading) {
                if (newState.isLoading) {
                    this.showLoading();
                } else if (!newState.hasError) {
                    this.showVisualization();
                }
            }
        }, 'isLoading', 'loading-ui');

        // Subscribe to error state changes
        this.stateManager.subscribe((newState, prevState) => {
            if (newState.hasError !== prevState.hasError || newState.errorMessage !== prevState.errorMessage) {
                if (newState.hasError) {
                    this.showError(newState.errorMessage || 'Unknown error', null);
                }
            }
        }, 'hasError', 'error-ui');

        // Subscribe to data changes
        this.stateManager.subscribe((newState, prevState) => {
            if (newState.processedDataCount !== prevState.processedDataCount) {
                this.updateLiveCount();
                this.showStats();
            }
        }, 'processedDataCount', 'data-ui');
    }

    /**
     * Setup application-wide event listeners
     */
    setupEventListeners() {
        // Listen for data processing events
        this.eventBus.on('dataLoaded', (data) => {
            console.log('📊 Main: Data loaded, updating state');
            this.stateManager.setState({ 
                data: data, 
                processedDataCount: data.length 
            }, 'dataLoad');
        });

        // Listen for visualization events
        this.eventBus.on('visualizationReady', () => {
            console.log('🎨 Main: Visualization ready');
            this.stateManager.setState({ isLoading: false }, 'visualizationReady');
        });

        // Listen for error events
        this.eventBus.on('error', ({ message, error }) => {
            console.error('❌ Main: Error received:', message, error);
            this.stateManager.setState({ 
                hasError: true, 
                errorMessage: message,
                isLoading: false 
            }, 'error');
        });

        // Listen for lane calculation events
        this.eventBus.on('lanesCalculated', (laneData) => {
            console.log('📏 Main: Lanes calculated');
            this.stateManager.setState({ 
                laneStats: laneData.stats || {} 
            }, 'lanesCalculated');
        });

        // Setup resize handling with event system
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                this.eventBus.emit('windowResized', {
                    width: window.innerWidth,
                    height: window.innerHeight
                });
            }, AppConfig.performance.resizeDebounce);
        });

        // Handle window resize events
        this.eventBus.on('windowResized', () => {
            this.handleResize();
        });

        // Handle spacing mode toggle
        this.eventBus.on('spacingModeChanged', (spacingMode) => {
            this.handleSpacingModeChange(spacingMode);
        });

        // Setup spacing toggle event listener
        const spacingToggle = document.getElementById('spacing-mode-toggle');
        if (spacingToggle) {
            spacingToggle.addEventListener('change', (event) => {
                const spacingMode = event.target.checked ? 'evenlySpaced' : 'actualDates';
                console.log('🎛️ Spacing mode changed to:', spacingMode);
                this.eventBus.emit('spacingModeChanged', spacingMode);
            });
        }
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            console.log('[EDEN_DEBUG] Starting application initialization...');
            console.log('Initializing Hostage Timeline Application...');
            
            // Set loading state via state manager
            this.stateManager.setState({ isLoading: true }, 'initialize');
            
            // Load and process data
            console.log('[EDEN_DEBUG] Loading data...');
            await this.loadData();
            
            // Initialize visualization components
            console.log('[EDEN_DEBUG] Initializing visualization...');
            this.initializeVisualization();
            
            // Process data through pipeline
            console.log('[EDEN_DEBUG] About to call processData...');
            this.processData();
            
            // Render initial visualization
            console.log('[EDEN_DEBUG] Rendering visualization...');
            this.renderVisualization();
            
            // Emit visualization ready event
            this.eventBus.emit('visualizationReady');
            
            console.log('[EDEN_DEBUG] Application initialized successfully');
            console.log('Application initialized successfully');
            
        } catch (error) {
            console.error('[EDEN_DEBUG] Application initialization failed:', error);
            console.error('Application initialization failed:', error);
            this.eventBus.emit('error', { 
                message: 'Application initialization failed', 
                error 
            });
        }
    }

    /**
     * Load CSV data from file
     */
    async loadData() {
        try {
            console.log('[EDEN_DEBUG] Starting data load...');
            console.log('Loading CSV data...');
            
            const response = await fetch(AppConfig.data.defaultFile);
            if (!response.ok) {
                throw new Error(`Failed to load CSV file: ${response.status} ${response.statusText}`);
            }
            
            const csvText = await response.text();
            console.log('[EDEN_DEBUG] CSV loaded, processing...');
            console.log(`Loaded CSV file: ${csvText.length} characters`);
            
            // Process data through data processor  
            const processedData = this.dataProcessor.process(csvText);
            
            console.log('[EDEN_DEBUG] Data processor complete:', processedData.length, 'records');
            console.log(`Data processing complete: ${processedData.length} records`);
            
            // Emit data loaded event instead of direct assignment
            this.eventBus.emit('dataLoaded', processedData);
            
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
            this.timelineCore = new TimelineCore(AppConfig.ui.elements.mainTimeline);
            this.timelineCore.initialize();
            
            // Initialize lane manager
            console.log('[EDEN_DEBUG] Creating LaneManager instance...');
            this.laneManager = new LaneManager(this.timelineCore);
            console.log('[EDEN_DEBUG] LaneManager created:', typeof this.laneManager);
            console.log('[EDEN_DEBUG] LaneManager has processData method:', typeof this.laneManager.processData);
            
            // Initialize transition engine, color manager, and interaction manager
            this.transitionEngine = new TransitionEngine(this.timelineCore, this.laneManager);
            this.colorManager = new ColorManager(this.timelineCore);
            this.interactionManager = new InteractionManager(this.timelineCore, this.laneManager);
            this.interactionManager.initialize();
            
            // TODO: Pass EventBus and StateManager to components once they support it
            // For now, components will be gradually updated in the next steps
            
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
            console.log('[EDEN_DEBUG] Starting processData pipeline...');
            console.log('Processing data for visualization...');
            
            // Get data from state
            const data = this.stateManager.getState('data');
            console.log('[EDEN_DEBUG] Retrieved data from state:', data ? data.length : 'null', 'records');
            if (!data || data.length === 0) {
                throw new Error('No data available for processing');
            }
            
            // Update timeline with processed data
            console.log('[EDEN_DEBUG] Updating timeline core...');
            this.timelineCore.updateTimeline(data);
            
            // Process data through lane manager
            console.log('[EDEN_DEBUG] Calling lane manager processData...');
            const sortedData = this.laneManager.processData(data);
            console.log('[EDEN_DEBUG] Lane manager returned:', sortedData ? sortedData.length : 'null', 'records');
            
            console.log('[EDEN_DEBUG] Data processing pipeline complete');
            console.log('Data processing pipeline complete');
            return sortedData;
            
        } catch (error) {
            console.error('[EDEN_DEBUG] Data processing pipeline failed:', error);
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
        
        // Render lines for each hostage with advanced coloring
        const lines = layerGroups.lines
            .selectAll('.hostage-line')
            .data(optimizedPaths)
            .enter()
            .append('path')
            .attr('class', d => `hostage-line ${d.hostage.finalLane}`)
            .attr('data-name', d => d.hostage['Hebrew Name'])
            .attr('d', d => d.path)
            .style('stroke-width', 1.5)
            .style('fill', 'none')
            .style('stroke-linecap', 'round')
            .style('stroke-linejoin', 'round');
        
        // Apply advanced coloring using color manager
        const app = this;
        lines.each(function(d) {
            try {
                const colorConfig = app.colorManager.getHostageColorConfig(d.hostage);
                console.log('Applying color config for', d.hostage['Hebrew Name'], ':', colorConfig);
                
                // Apply colors directly to the current element
                const element = d3.select(this);
                if (colorConfig.type === 'gradient') {
                    element
                        .style('stroke', `url(#${colorConfig.gradientId})`)
                        .style('stroke-opacity', colorConfig.opacity);
                } else {
                    element
                        .style('stroke', colorConfig.color)
                        .style('stroke-opacity', colorConfig.opacity);
                }
            } catch (error) {
                console.error('Error applying color to', d.hostage['Hebrew Name'], ':', error);
                // Fallback to original color
                d3.select(this).style('stroke', d.hostage.laneDef.color);
            }
        });
        
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
     * Legacy method - now handled in setupEventListeners during construction
     * Kept for compatibility but functionality moved to constructor
     */

    /**
     * Handle window resize
     */
    handleResize() {
        try {
            console.log('Handling window resize...');
            
            if (this.timelineCore) {
                this.timelineCore.resize();
                
                // Re-render if we have data in state
                const data = this.stateManager.getState('data');
                if (data && data.length > 0) {
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
     * Handle spacing mode change between actual dates and evenly spaced
     * @param {string} spacingMode - 'actualDates' or 'evenlySpaced'
     */
    handleSpacingModeChange(spacingMode) {
        try {
            console.log('🎛️ Handling spacing mode change to:', spacingMode);
            
            // Update config
            AppConfig.timeline.spacingMode = spacingMode;
            
            // Update state
            this.stateManager.setState({ spacingMode }, 'spacingModeChange');
            
            // Re-render visualization if we have data
            if (this.timelineCore) {
                const data = this.stateManager.getState('data');
                if (data && data.length > 0) {
                    // Update timeline with new spacing mode (if method exists)
                    if (typeof this.timelineCore.updateSpacingMode === 'function') {
                        this.timelineCore.updateSpacingMode(spacingMode);
                    } else {
                        console.log('⚠️ updateSpacingMode not implemented yet, scheduling for next update');
                    }
                    
                    // Re-render everything
                    this.laneManager.calculateLaneHeights();
                    this.laneManager.renderLanes();
                    this.renderHostageLines();
                    
                    console.log('✅ Visualization updated for spacing mode:', spacingMode);
                }
            }
            
        } catch (error) {
            console.error('❌ Spacing mode change failed:', error);
            this.eventBus.emit('error', { 
                message: 'Failed to change spacing mode', 
                error 
            });
        }
    }

    /**
     * Update live hostage count in banner
     */
    updateLiveCount() {
        const data = this.stateManager.getState('data');
        if (!data || !data.length) return;
        
        // Count hostages still in captivity
        const stillCaptive = data.filter(h => 
            h.finalLane === 'kidnapped-living' || 
            (h.finalLane === 'kidnapped-deceased' && h['Current Status']?.includes('Held'))
        ).length;
        
        const released = data.filter(h => 
            h.finalLane?.includes('released')
        ).length;
        
        const total = data.length;
        
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
        
        // Convert stats to header format
        const headerStatsHTML = `
            <div class="stat">
                <div class="stat-value">${stats.total}</div>
                <div class="stat-label">סך הכל</div>
            </div>
            <div class="stat">
                <div class="stat-value">${Object.values(stats.byLane).reduce((sum, count) => sum + count, 0)}</div>
                <div class="stat-label">מעובד</div>
            </div>
            <div class="stat">
                <div class="stat-value">${stats.withTransitions}</div>
                <div class="stat-label">עם מעברים</div>
            </div>
            <div class="stat">
                <div class="stat-value">${stats.errors}</div>
                <div class="stat-label">שגיאות</div>
            </div>
        `;
        
        this.elements.headerStats.innerHTML = headerStatsHTML;
        this.elements.headerStats.style.display = 'flex';
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
        // Update state is handled by the state subscription
        
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
        const appState = this.stateManager.getState();
        return {
            ...appState,
            dataCount: appState.data ? appState.data.length : 0,
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