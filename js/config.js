/**
 * Centralized Configuration System
 * All hardcoded values moved here for easy customization and maintenance
 */

const AppConfig = {
    // Timeline Core Configuration
    timeline: {
        margins: { 
            top: 60, 
            right: 200, 
            bottom: 80, 
            left: 60 
        },
        minWidth: 1400,
        minHeight: window.innerHeight - 150, // Use viewport height minus header/footer
        defaultStart: '2023-10-07',
        axisHeight: 40,
        tickInterval: 2, // months
        
        // Spacing modes
        spacingMode: 'actualDates', // 'actualDates' or 'evenlySpaced'
        evenlySpacedMargins: {
            start: 0.05, // 5% from start
            end: 0.95    // 95% to end (leaves 5% margin on both sides)
        },
        
        // Date formatting
        hebrewMonths: {
            short: ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני',
                   'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'],
            full: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
                  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
        }
    },

    // Lane Management Configuration  
    lanes: {
        lineSpacing: 0,
        lanePadding: 12,
        sectionSpacing: 25,
        lineWidth: 1,
        turnRadius: 4,
        minLaneHeight: 20,
        
        // Lane definitions - centralized for easy modification
        definitions: {
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
        }
    },

    // Interaction Management Configuration
    interaction: {
        tooltipOffset: { x: 15, y: -10 },
        fadeTransitionDuration: 200,
        highlightOpacity: 1.0,
        dimmedOpacity: 0.3,
        highlightStrokeWidth: 3,
        normalStrokeWidth: 1.5,
        
        // Translation maps for tooltips
        statusTranslations: {
            'Released': 'שוחרר',
            'Held in Gaza': 'מוחזק בעזה',
            'Deceased - Returned': 'נפטר - הושב',
            'Deceased': 'נפטר'
        },
        
        releaseMethodTranslations: {
            'military': 'מבצע צבאי',
            'deal': 'עסקת שחרור',
            'operation': 'מבצע צבאי',
            'negotiation': 'עסקת שחרור'
        },
        
        transitionTypeTranslations: {
            'released': 'שחרור',
            'died': 'פטירה',
            'kidnapped': 'חטיפה'
        }
    },

    // Data Processing Configuration
    dataProcessing: {
        // Date estimation defaults
        defaultDates: {
            oct7: '2023-10-07',
            earlyCapitivity: '2023-11-15',
            midCaptivity: '2024-01-15',
            bodyReturnEstimate: '2024-06-01'
        },
        
        // Date format patterns
        dateFormats: [
            /^(\d{4})-(\d{2})-(\d{2})$/, // ISO: 2023-10-07
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/ // MM/DD/YYYY or DD/MM/YYYY
        ],
        
        // Release method detection keywords
        releaseMethodKeywords: {
            military: ['military operation', 'returned in military', 'operation'],
            deal: ['deal', 'returned in deal', 'released via deal', 'negotiation']
        },
        
        // Event-based transitions mapping
        eventDates: {
            "Oct 20, 2023 - Humanitarian Release": "2023-10-20",
            "Oct 23, 2023 - Humanitarian Release": "2023-10-23",
            "Oct 30, 2023 - IDF Rescue Operation": "2023-10-30", 
            "Nov 24-30, 2023 - 2023 Temporary Truce": "2023-11-27",
            "Dec 12-15, 2023 - Body Repatriation": "2023-12-13",
            "Feb 12, 2024 - Operation Golden Hand": "2024-02-12",
            "Jun 10, 2024 - Nuseirat Rescue Operation": "2024-06-10",
            "Jul-Aug 2024 - Body Repatriation": "2024-07-15",
            "Jan-Feb 2025 - 2025 Hostage Agreement": "2025-01-15",
            "Feb 20-27, 2025 - Body Repatriation (2025 deal)": "2025-02-23"
        }
    },

    // Visual Theme Configuration
    colors: {
        theme: {
            primary: '#2c3e50',
            secondary: '#34495e',
            background: '#f8fafc',
            text: '#1a202c'
        },
        
        // Grid and axis colors
        grid: {
            main: '#f1f5f9',
            divider: '#e2e8f0',
            section: '#cbd5e1'
        },
        
        // Debug colors
        debug: {
            boundary: 'rgba(255, 0, 0, 0.3)',
            highlight: '#fbbf24'
        }
    },

    // Performance Configuration
    performance: {
        resizeDebounce: 250, // ms
        renderTimeout: 100, // ms
        transitionDuration: 750 // ms
    },

    // Font Configuration
    fonts: {
        primary: 'Segoe UI, Arial Hebrew, Noto Sans Hebrew, Tahoma, sans-serif',
        sizes: {
            tooltip: '14px',
            label: '13px',
            count: '12px',
            debug: '10px'
        }
    },

    // Data File Configuration
    data: {
        defaultFile: 'data/hostages-with-rescue-events.csv',
        fallbackFile: 'data/hostages-from-kan-fixed.csv'
    },

    // UI Element Configuration
    ui: {
        elements: {
            loading: 'loading',
            errorPanel: 'error-panel',
            errorContent: 'error-content',
            headerStats: 'header-stats',
            visualizationContainer: 'visualization-container',
            liveCount: 'live-count',
            tooltip: 'tooltip',
            mainTimeline: 'main-timeline'
        }
    },

    // Debug Configuration
    debug: {
        enabled: true, // Set to false in production
        showBoundaries: true,
        logEvents: true,
        logStateChanges: true
    }
};

// Helper functions for configuration access
AppConfig.helpers = {
    /**
     * Get lane definition by ID with fallback
     */
    getLaneDefinition(laneId) {
        return AppConfig.lanes.definitions[laneId] || {
            type: 'unknown',
            section: 'kidnapped',
            label: 'לא ידוע',
            color: '#gray-400',
            priority: 99
        };
    },

    /**
     * Get translated status with fallback
     */
    translateStatus(status) {
        const translations = AppConfig.interaction.statusTranslations;
        for (const [english, hebrew] of Object.entries(translations)) {
            if (status && status.includes(english)) {
                return hebrew;
            }
        }
        return status || 'לא ידוע';
    },

    /**
     * Get Hebrew month name
     */
    getHebrewMonth(monthIndex, full = true) {
        const months = full ? 
            AppConfig.timeline.hebrewMonths.full : 
            AppConfig.timeline.hebrewMonths.short;
        return months[monthIndex] || 'לא ידוע';
    },

    /**
     * Format Hebrew date using config
     */
    formatHebrewDate(date) {
        if (!date || !(date instanceof Date)) return 'תאריך לא ידוע';
        
        const day = date.getDate();
        const month = this.getHebrewMonth(date.getMonth(), true);
        const year = date.getFullYear();
        
        return `${day} ב${month} ${year}`;
    },

    /**
     * Get configuration section with defaults
     */
    getConfig(section, defaults = {}) {
        return { ...defaults, ...(AppConfig[section] || {}) };
    },

    /**
     * Merge custom config with defaults
     */
    mergeConfig(section, customConfig) {
        return { ...AppConfig[section], ...customConfig };
    }
};

// Export for use in modules
if (typeof window !== 'undefined') {
    window.AppConfig = AppConfig;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppConfig;
}