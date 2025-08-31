/**
 * Main Application Controller
 * Orchestrates data loading, processing, and visualization
 */

class HostageSankeyApp {
    constructor() {
        this.dataProcessor = null;
        this.sankeyVisualization = null;
        this.interactionManager = null;
        this.isLoading = false;
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('[SANKEY-INIT] Initializing Hostage Sankey Visualization...');
            
            // Check for required libraries
            if (!this.checkRequiredLibraries()) {
                throw new Error('Required libraries (D3.js or d3-sankey) are not loaded');
            }
            
            // Show loading state
            this.showLoadingState(true);
            
            // Initialize data processor
            this.dataProcessor = new SankeyDataProcessor();
            
            // Load and process data
            await this.loadData();
            
            // Initialize visualization
            this.initializeVisualization();
            
            // Initialize interaction system
            this.initializeInteractions();
            
            // Setup responsive behavior
            this.setupResponsive();
            
            // Setup global keyboard shortcuts
            this.setupGlobalShortcuts();
            
            // Hide loading state
            this.showLoadingState(false);
            
            console.log('[SANKEY-INIT] Application initialized successfully!');
            this.updateStats();
            
        } catch (error) {
            console.error('[SANKEY-ERROR] Failed to initialize application:', error);
            console.error('[SANKEY-ERROR] Error stack:', error.stack);
            
            // Log additional debug information
            console.log('[SANKEY-DEBUG] Debug info:', {
                d3Available: typeof d3 !== 'undefined',
                d3SankeyAvailable: typeof d3 !== 'undefined' && typeof d3.sankey !== 'undefined',
                windowLocation: window.location.href,
                userAgent: navigator.userAgent,
                dataProcessorErrors: this.dataProcessor?.errors || []
            });
            
            this.showErrorState(error);
        }
    }

    /**
     * Load and process CSV data
     */
    async loadData() {
        try {
            console.log('Loading hostage data...');
            
            const response = await fetch('data/hostages-from-kan-fixed.csv');
            if (!response.ok) {
                throw new Error(`Failed to load data: ${response.status}`);
            }
            
            const csvText = await response.text();
            
            // Parse CSV
            await this.dataProcessor.parseCSV(csvText);
            
            // Process into Sankey format
            console.log('[SANKEY-DATA] Processing data into Sankey format...');
            const result = this.dataProcessor.processData();
            console.log('[SANKEY-DATA] Data processing result:', result);
            
            console.log('[SANKEY-DATA] Data processing complete:', {
                totalRecords: this.dataProcessor.processedData.length,
                sankeyNodes: result.sankeyData.nodes.length,
                sankeyLinks: result.sankeyData.links.length,
                individualPaths: result.individualPaths.length,
                errors: this.dataProcessor.errors.length
            });
            
            // Log any processing errors
            if (this.dataProcessor.errors.length > 0) {
                console.warn('[SANKEY-ERROR] Data processing errors:', this.dataProcessor.errors);
            }
            
        } catch (error) {
            console.error('[SANKEY-ERROR] Data loading failed:', error);
            throw error;
        }
    }

    /**
     * Initialize Sankey visualization
     */
    initializeVisualization() {
        console.log('[SANKEY-VIZ] Initializing Sankey visualization...');
        
        const container = document.getElementById('sankey-chart');
        const containerRect = container.getBoundingClientRect();
        
        // Initialize Sankey with responsive dimensions
        const options = {
            width: Math.max(1000, containerRect.width - 80),
            height: Math.max(600, window.innerHeight - 400),
            nodeWidth: 25,
            nodePadding: 20,
            margin: { top: 80, right: 80, bottom: 50, left: 80 }
        };
        
        this.sankeyVisualization = new SankeyRTL(container, options);
        
        // Render initial visualization
        try {
            console.log('[SANKEY-VIZ] Rendering Sankey visualization...');
            console.log('[SANKEY-VIZ] Sankey data:', this.dataProcessor.sankeyData);
            console.log('[SANKEY-VIZ] Individual paths:', this.dataProcessor.individualPaths);
            
            this.sankeyVisualization.render(
                this.dataProcessor.sankeyData,
                this.dataProcessor.individualPaths
            );
            
            console.log('[SANKEY-VIZ] Sankey visualization rendered successfully!');
        } catch (renderError) {
            console.error('[SANKEY-ERROR] Error rendering Sankey visualization:', renderError);
            throw renderError;
        }
        
        console.log('[SANKEY-VIZ] Sankey visualization setup complete');
    }

    /**
     * Initialize interaction system
     */
    initializeInteractions() {
        console.log('[SANKEY-INTERACT] Initializing interaction system...');
        
        this.interactionManager = new SankeyInteractionManager(
            this.sankeyVisualization,
            this.dataProcessor
        );
        
        console.log('[SANKEY-INTERACT] Interaction system initialized');
    }

    /**
     * Setup responsive behavior
     */
    setupResponsive() {
        let resizeTimeout;
        
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 250);
        });
        
        // Handle orientation change on mobile
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleResize();
            }, 500);
        });
    }

    /**
     * Handle window resize
     */
    handleResize() {
        if (!this.sankeyVisualization) return;
        
        const container = document.getElementById('sankey-chart');
        const containerRect = container.getBoundingClientRect();
        
        const newWidth = Math.max(800, containerRect.width - 40);
        const newHeight = Math.max(600, containerRect.height - 40);
        
        this.sankeyVisualization.resize(newWidth, newHeight);
        
        console.log(`Resized to ${newWidth}x${newHeight}`);
    }

    /**
     * Update header statistics
     */
    updateStats() {
        if (!this.dataProcessor) return;
        
        const totalHostages = this.dataProcessor.processedData.length;
        const released = this.dataProcessor.processedData.filter(r => 
            r.step2 && (r.step2.includes('released'))).length;
        const stillHeld = this.dataProcessor.processedData.filter(r => 
            r.step2 && r.step2 === 'still-held').length;
        
        // Update DOM elements
        const totalElement = document.getElementById('total-hostages');
        if (totalElement) {
            totalElement.textContent = `${totalHostages} חטופים`;
        }
        
        // Add more detailed stats
        const headerStats = document.querySelector('.header-stats');
        if (headerStats && !document.getElementById('detailed-stats')) {
            const detailedStats = document.createElement('div');
            detailedStats.id = 'detailed-stats';
            detailedStats.innerHTML = `
                <span>${released} שוחררו/הוחזרו</span>
                <span>${stillHeld} עדיין בשבי</span>
            `;
            headerStats.appendChild(detailedStats);
        }
    }

    /**
     * Show loading state
     */
    showLoadingState(show) {
        this.isLoading = show;
        
        let loadingElement = document.getElementById('loading-overlay');
        
        if (show && !loadingElement) {
            loadingElement = document.createElement('div');
            loadingElement.id = 'loading-overlay';
            loadingElement.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">טוען נתוני חטופים...</div>
                </div>
            `;
            loadingElement.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                font-family: inherit;
            `;
            
            const loadingContent = loadingElement.querySelector('.loading-content');
            loadingContent.style.cssText = `
                text-align: center;
                color: #2c3e50;
            `;
            
            const spinner = loadingElement.querySelector('.loading-spinner');
            spinner.style.cssText = `
                width: 40px;
                height: 40px;
                border: 4px solid #ecf0f1;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 1rem;
            `;
            
            // Add spinner animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
            
            document.body.appendChild(loadingElement);
        }
        
        if (loadingElement) {
            loadingElement.style.display = show ? 'flex' : 'none';
        }
    }

    /**
     * Show error state
     */
    showErrorState(error) {
        console.error('Application error:', error);
        
        const container = document.querySelector('.sankey-container');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <h2>שגיאה בטעינת הנתונים</h2>
                    <p>אירעה שגיאה בטעינת נתוני החטופים. אנא נסה שוב מאוחר יותר.</p>
                    <details>
                        <summary>פרטים טכניים</summary>
                        <pre>${error.message}</pre>
                    </details>
                    <button onclick="location.reload()">טען שוב</button>
                </div>
            `;
        }
        
        this.showLoadingState(false);
    }

    /**
     * Export current visualization
     */
    exportVisualization(format = 'png') {
        if (!this.sankeyVisualization) {
            console.error('No visualization to export');
            return;
        }
        
        const svg = document.getElementById('sankey-chart');
        
        if (format === 'svg') {
            // Export as SVG
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svg);
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            this.downloadBlob(blob, 'hostage-sankey.svg');
        } else {
            // Export as PNG
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const data = new XMLSerializer().serializeToString(svg);
            const img = new Image();
            
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                
                canvas.toBlob(blob => {
                    this.downloadBlob(blob, 'hostage-sankey.png');
                });
            };
            
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)));
        }
    }

    /**
     * Download blob as file
     */
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Check if required libraries are loaded
     */
    checkRequiredLibraries() {
        if (typeof d3 === 'undefined') {
            console.error('D3.js library not found');
            return false;
        }
        
        if (typeof d3.sankey === 'undefined') {
            console.error('d3-sankey library not found');
            return false;
        }
        
        console.log('All required libraries loaded successfully');
        return true;
    }

    /**
     * Setup global keyboard shortcuts
     */
    setupGlobalShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Escape key to clear selections
            if (event.key === 'Escape') {
                if (this.sankeyVisualization) {
                    this.sankeyVisualization.clearSelections();
                }
                console.log('Cleared all selections');
            }
            // 'C' key to clear filters and selections
            else if (event.key === 'c' || event.key === 'C') {
                if (this.interactionManager) {
                    this.interactionManager.clearFilters();
                }
                if (this.sankeyVisualization) {
                    this.sankeyVisualization.clearSelections();
                }
                console.log('Cleared filters and selections');
            }
        });
    }

    /**
     * Get application state for debugging
     */
    getDebugInfo() {
        return {
            dataProcessor: this.dataProcessor,
            visualization: this.sankeyVisualization,
            interactions: this.interactionManager,
            errors: this.dataProcessor?.errors || []
        };
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for external scripts to load
    setTimeout(() => {
        // Make app instance globally available for debugging
        window.hostageApp = new HostageSankeyApp();
        
        // Add development helpers
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('Development mode - app available as window.hostageApp');
            console.log('Use hostageApp.getDebugInfo() for debugging');
        }
    }, 100);
});