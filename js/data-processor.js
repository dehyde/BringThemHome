/**
 * Data Processor for Hostage Timeline Visualization
 * Phase 1: Data Foundation - CSV parsing, validation, and transformation
 */

class DataProcessor {
    constructor(customConfig = {}) {
        this.rawData = [];
        this.processedData = [];
        this.errors = [];
        this.eventTransitions = new Map(); // Store event-based transitions by Hebrew name
        
        // Use centralized configuration
        this.config = AppConfig.helpers.mergeConfig('dataProcessing', customConfig);
    }

    /**
     * Load event transitions from CSV file
     * @param {string} eventTransitionsPath - Path to event transitions CSV
     */
    async loadEventTransitions(eventTransitionsPath = 'data/event_transitions.csv') {
        try {
            const response = await fetch(eventTransitionsPath);
            if (!response.ok) {
                console.warn('Event transitions file not found, using date-based transitions');
                return;
            }
            
            const csvText = await response.text();
            const lines = csvText.trim().split('\n');
            const headers = this.parseCSVLine(lines[0]);
            
            lines.slice(1).forEach(line => {
                if (!line.trim()) return;
                
                const values = this.parseCSVLine(line);
                const record = {};
                headers.forEach((header, i) => {
                    record[header] = values[i] || '';
                });
                
                if (record.hebrew_name) {
                    this.eventTransitions.set(record.hebrew_name, {
                        eventOrder: parseInt(record.event_order),
                        eventTitle: record.event_title,
                        eventType: record.event_type,
                        dateRange: record.date_range,
                        englishName: record.english_name
                    });
                }
            });
            
            console.log(`Loaded ${this.eventTransitions.size} event transitions`);
        } catch (error) {
            console.warn('Failed to load event transitions:', error);
            this.errors.push(`Event transitions loading failed: ${error.message}`);
        }
    }

    /**
     * Parse CSV data and convert to JavaScript objects
     * @param {string} csvText - Raw CSV text content
     * @returns {Array} Array of hostage record objects
     */
    parseCSV(csvText) {
        try {
            const lines = csvText.trim().split('\n');
            const headers = this.parseCSVLine(lines[0]);
            
            this.rawData = lines.slice(1).map((line, index) => {
                try {
                    const values = this.parseCSVLine(line);
                    const record = {};
                    
                    headers.forEach((header, i) => {
                        record[header] = values[i] || '';
                    });
                    
                    record._lineNumber = index + 2; // +2 because of header and 0-based index
                    return record;
                } catch (error) {
                    this.errors.push(`Line ${index + 2}: Failed to parse - ${error.message}`);
                    return null;
                }
            }).filter(record => record !== null);
            
            console.log(`Parsed ${this.rawData.length} records from CSV`);
            return this.rawData;
        } catch (error) {
            this.errors.push(`CSV parsing failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Parse a single CSV line handling quoted values and commas
     * @param {string} line - CSV line to parse
     * @returns {Array} Array of field values
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }

    /**
     * Validate and normalize dates in the dataset
     * @param {Object} record - Individual hostage record
     * @returns {Object} Record with validated dates
     */
    validateDates(record) {
        const dateFields = {
            'Kidnapped Date': 'kidnappedDate',
            'Date of Death': 'deathDate', 
            'Release Date': 'releaseDate'
        };
        
        const validatedRecord = { ...record };
        
        Object.entries(dateFields).forEach(([originalField, normalizedField]) => {
            const dateValue = record[originalField];
            
            if (dateValue && dateValue.trim()) {
                try {
                    const parsedDate = this.parseDate(dateValue);
                    validatedRecord[normalizedField] = parsedDate;
                    validatedRecord[`${normalizedField}_valid`] = true;
                } catch (error) {
                    this.errors.push(`Line ${record._lineNumber}: Invalid ${originalField}: ${dateValue} - ${error.message}`);
                    validatedRecord[normalizedField] = null;
                    validatedRecord[`${normalizedField}_valid`] = false;
                }
            } else {
                validatedRecord[normalizedField] = null;
                validatedRecord[`${normalizedField}_valid`] = false;
            }
        });

        // Handle range dates for death date
        if (record['Date of Death'] && record['Date of Death'].includes('-')) {
            validatedRecord.deathDateRange = this.parseRangeDate(record['Date of Death']);
        }
        
        
        // CRITICAL FIX: Calculate missing release dates from Hebrew "שוחרר אחרי XX יום בשבי" text
        if (!validatedRecord.releaseDate_valid || !validatedRecord.releaseDate) {
            const hebrewSummary = record['Kidnapping Summary (Hebrew)'] || '';
            const daysInCaptivityMatch = hebrewSummary.match(/שוחרר אחרי (\d+) יום[ים]?/);
            
            if (daysInCaptivityMatch && validatedRecord.kidnappedDate) {
                const daysInCaptivity = parseInt(daysInCaptivityMatch[1]);
                const calculatedReleaseDate = new Date(validatedRecord.kidnappedDate);
                calculatedReleaseDate.setDate(calculatedReleaseDate.getDate() + daysInCaptivity);
                
                console.warn(`Calculated release date for ${record['Hebrew Name']}: ${daysInCaptivity} days after kidnapping = ${calculatedReleaseDate.toISOString().split('T')[0]}`);
                
                validatedRecord.releaseDate = calculatedReleaseDate;
                validatedRecord.releaseDate_valid = true;
            }
        }
        
        
        return validatedRecord;
    }

    /**
     * Parse various date formats to Date object
     * @param {string} dateStr - Date string to parse
     * @returns {Date} Parsed date object
     */
    parseDate(dateStr) {
        // Remove any extra whitespace
        dateStr = dateStr.trim();
        
        // Handle contextual date patterns first using config
        if (dateStr.toLowerCase().includes('killed during oct 7') || 
            dateStr.toLowerCase().includes('died before/during kidnapping')) {
            return new Date(this.config.defaultDates.oct7);
        }
        
        if (dateStr.toLowerCase().includes('killed in captivity - first months')) {
            // Estimate early captivity death
            return new Date(this.config.defaultDates.earlyCapitivity);
        }
        
        if (dateStr.toLowerCase().includes('killed in captivity by captors')) {
            // Estimate mid-captivity death 
            return new Date(this.config.defaultDates.midCaptivity);
        }
        
        // CRITICAL FIX: Handle incorrect 2025 dates that should be 2024
        // The CSV has wrong year calculations for body returns
        if (dateStr.includes('2025-') && 
            (dateStr.startsWith('2025-01') || dateStr.startsWith('2025-02') || 
             dateStr.startsWith('2025-03') || dateStr.startsWith('2025-04') || 
             dateStr.startsWith('2025-05') || dateStr.startsWith('2025-06') || 
             dateStr.startsWith('2025-07') || dateStr.startsWith('2025-08'))) {
            // These should be 2024 dates, not 2025
            const correctedDate = dateStr.replace('2025-', '2024-');
            console.warn(`Correcting wrong 2025 date to 2024: ${dateStr} -> ${correctedDate}`);
            dateStr = correctedDate;
        }
        
        // Handle different date formats using config
        const formats = this.config.dateFormats;
        
        // Try ISO format first
        const isoMatch = dateStr.match(formats[0]);
        if (isoMatch) {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
        
        // Try MM/DD/YYYY format
        const usMatch = dateStr.match(formats[1]);
        if (usMatch) {
            const [, month, day, year] = usMatch;
            const date = new Date(year, month - 1, day);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
        
        // Fallback to JavaScript Date parsing
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date;
        }
        
        throw new Error(`Unable to parse date: ${dateStr}`);
    }

    /**
     * Parse range dates and return average with metadata
     * @param {string} rangeStr - Date range string
     * @returns {Object} Object with averageDate and range info
     */
    parseRangeDate(rangeStr) {
        // This is a placeholder - implement based on actual range format in data
        // For now, return the original string as metadata
        return {
            originalRange: rangeStr,
            averageDate: null, // Will need actual parsing logic
            isRange: true
        };
    }

    /**
     * Calculate event chronology using rescue events for sorting purposes
     * @param {Array} records - Array of validated records
     * @returns {Array} Records with event order metadata
     */
    calculateEventOrder(records) {
        return records.map(record => {
            const events = [];
            
            // Kidnapping event (all hostages have this)
            if (record.kidnappedDate) {
                events.push({
                    type: 'kidnapped',
                    date: record.kidnappedDate,
                    timestamp: record.kidnappedDate.getTime(),
                    eventOrder: 0 // Kidnapping is always first
                });
            }

            // Check for rescue event
            const rescueEvent = record['Rescue Event'];
            let transitionEvent = null;
            let eventOrder = Infinity; // Default for hostages with no transitions
            
            if (rescueEvent && rescueEvent.trim()) {
                // Use rescue event with mapped date
                const eventDateString = this.config.eventDates[rescueEvent];
                
                if (eventDateString) {
                    const eventDate = new Date(eventDateString);
                    const originalReleaseDate = record.releaseDate; // Keep original for sorting within event
                    
                    // Create chronological order based on event dates
                    const eventDates = Object.values(this.config.eventDates).sort();
                    const eventOrderIndex = eventDates.indexOf(eventDateString);
                    
                    transitionEvent = {
                        type: 'released',
                        date: eventDate, // Use event date for timeline positioning
                        timestamp: eventDate.getTime(),
                        eventOrder: eventOrderIndex + 1, // +1 because kidnapping is 0
                        rescueEvent: rescueEvent,
                        originalReleaseDate: originalReleaseDate, // Keep for sub-sorting
                        isEventBased: true
                    };
                    
                    events.push(transitionEvent);
                    eventOrder = transitionEvent.eventOrder;
                    
                    console.log(`Event-based transition for ${record['Hebrew Name']}: ${rescueEvent} (Order: ${eventOrder}, Date: ${eventDateString})`);
                } else {
                    console.warn(`No date mapping found for rescue event: "${rescueEvent}" for ${record['Hebrew Name']}`);
                }
            }
            
            // For hostages without rescue events, fall back to date-based logic
            if (!rescueEvent || !rescueEvent.trim()) {
                // Death event
                if (record.deathDate && record.deathDate_valid) {
                    events.push({
                        type: 'died',
                        date: record.deathDate,
                        timestamp: record.deathDate.getTime()
                    });
                }
                
                // Release event (only for hostages without rescue events)
                if (record.releaseDate && record.releaseDate_valid) {
                    transitionEvent = {
                        type: 'released',
                        date: record.releaseDate,
                        timestamp: record.releaseDate.getTime(),
                        isEventBased: false
                    };
                    events.push(transitionEvent);
                    eventOrder = transitionEvent.timestamp;
                } else if ((record['Current Status']?.includes('Released') || 
                           record['Current Status']?.includes('Deceased - Returned'))) {
                    // Fallback for hostages with release status but no rescue event and no valid release date
                    let estimatedDate = new Date(this.config.defaultDates.bodyReturnEstimate);
                    console.warn(`Using fallback date for ${record['Hebrew Name']} - no rescue event or release date`);
                    
                    transitionEvent = {
                        type: 'released',
                        date: estimatedDate,
                        timestamp: estimatedDate.getTime(),
                        isEventBased: false
                    };
                    events.push(transitionEvent);
                    eventOrder = transitionEvent.timestamp;
                }
                
                // If no transition event found, use first non-kidnapping event
                if (!transitionEvent) {
                    transitionEvent = events.find(e => e.type !== 'kidnapped');
                    if (transitionEvent) {
                        eventOrder = transitionEvent.eventOrder || transitionEvent.timestamp;
                    }
                }
            }
            
            // Sort events by timestamp/order
            events.sort((a, b) => {
                if (a.eventOrder !== undefined && b.eventOrder !== undefined) {
                    return a.eventOrder - b.eventOrder;
                }
                return a.timestamp - b.timestamp;
            });
            
            // Use the transition event we already found
            if (!transitionEvent) {
                transitionEvent = events.find(e => e.type !== 'kidnapped');
                if (transitionEvent) {
                    eventOrder = transitionEvent.eventOrder || transitionEvent.timestamp;
                }
            }
            
            return {
                ...record,
                events,
                transitionEvent,
                eventOrder,
                hasRescueEvent: !!(rescueEvent && rescueEvent.trim())
            };
        });
    }

    /**
     * Determine release method from circumstances
     * @param {Object} record - Hostage record
     * @returns {string} Release method: 'military', 'deal', or 'unknown'
     */
    determineReleaseMethod(record) {
        const circumstances = (record['Release/Death Circumstances'] || '').toLowerCase();
        
        // Check for military operation indicators using config
        for (const keyword of this.config.releaseMethodKeywords.military) {
            if (circumstances.includes(keyword)) {
                return 'military';
            }
        }
        
        // Check for deal/negotiation indicators using config
        for (const keyword of this.config.releaseMethodKeywords.deal) {
            if (circumstances.includes(keyword)) {
                return 'deal';
            }
        }
        
        // Special case: if it's just country names, try to infer from other data
        const countriesOnly = /^[a-z\/\s]+$/i.test(circumstances.trim()) && 
                             !circumstances.includes('returned') && 
                             !circumstances.includes('released');
        
        if (countriesOnly) {
            console.warn(`Unclear release method for ${record['Hebrew Name']}: "${circumstances}" - defaulting to deal`);
            return 'deal'; // Most releases were via deals
        }
        
        console.warn(`Unknown release method for ${record['Hebrew Name']}: "${circumstances}"`);
        return 'unknown';
    }

    /**
     * Determine current lane assignment for hostage
     * @param {Object} record - Processed hostage record
     * @returns {string} Lane identifier
     */
    determineLane(record) {
        const status = record['Current Status'] || '';
        const releaseDate = record['Release Date'] || '';
        const hasReleaseDate = record.releaseDate_valid;
        
        // Released hostages
        if (status.includes('Released')) {
            const method = this.determineReleaseMethod(record);
            const isLiving = !record.deathDate_valid || record.releaseDate_valid;
            
            if (method === 'military') {
                return isLiving ? 'released-military-living' : 'released-military-deceased';
            } else if (method === 'deal') {
                return isLiving ? 'released-deal-living' : 'released-deal-deceased';  
            } else {
                // Unknown method - default to deal (most releases were deals)
                console.warn(`Unknown release method for ${record['Hebrew Name']}, defaulting to deal`);
                return isLiving ? 'released-deal-living' : 'released-deal-deceased';
            }
        }
        
        // Deceased and returned - these are released (bodies returned)
        if (status.includes('Deceased - Returned')) {
            const method = this.determineReleaseMethod(record);
            // Always deceased since bodies were returned
            if (method === 'military') {
                return 'released-military-deceased';
            } else if (method === 'deal') {
                return 'released-deal-deceased';
            } else {
                // Unknown method - default to deal for deceased returns
                console.warn(`Unknown return method for deceased ${record['Hebrew Name']}, defaulting to deal`);
                return 'released-deal-deceased';
            }
        }
        
        // Handle "Deceased" status with release date - these are bodies returned via deals/operations
        if (status === 'Deceased' && hasReleaseDate) {
            const method = this.determineReleaseMethod(record);
            if (method === 'military') {
                return 'released-military-deceased';
            } else {
                return 'released-deal-deceased';
            }
        }
        
        // Handle "Deceased" status without release date - still held bodies
        if (status === 'Deceased' && !hasReleaseDate) {
            return 'kidnapped-deceased';
        }
        
        // Still held hostages or bodies
        if (status.includes('Held in Gaza')) {
            const isDead = record.deathDate_valid;
            return isDead ? 'kidnapped-deceased' : 'kidnapped-living';
        }
        
        // Default handling with better logic
        if (status.includes('Deceased')) {
            // If has release date, it's returned
            if (hasReleaseDate) {
                const method = this.determineReleaseMethod(record);
                return method === 'military' ? 'released-military-deceased' : 'released-deal-deceased';
            } else {
                // Still held body
                return 'kidnapped-deceased';
            }
        }
        
        // Fallback for unclear cases
        console.warn(`Unclear status for hostage: ${record['Hebrew Name']}: "${status}"`);
        return 'kidnapped-living';
    }

    /**
     * Generate transition paths for hostages
     * @param {Array} records - Array of processed records
     * @returns {Array} Records with path data for visualization
     */
    generateTransitionPaths(records) {
        return records.map(record => {
            const path = [];
            const finalLane = this.determineLane(record);
            
            // DEBUG: Log עדן ירושלמי's lane assignment
            if (record['Hebrew Name'] === 'עדן ירושלמי') {
                console.log(`[EDEN_DEBUG] Final lane: ${finalLane}`);
                console.log(`[EDEN_DEBUG] Status: ${record['Current Status']}`);
                console.log(`[EDEN_DEBUG] Circumstances: ${record['Release/Death Circumstances']}`);
            }
            
            // All hostages start in kidnapped lanes
            const initialLane = record.deathDate_valid && 
                               record.deathDate.getTime() === record.kidnappedDate.getTime() 
                               ? 'kidnapped-deceased' 
                               : 'kidnapped-living';
            
            // Starting point
            path.push({
                lane: initialLane,
                date: record.kidnappedDate,
                timestamp: record.kidnappedDate.getTime(),
                event: 'kidnapped'
            });
            
            // CRITICAL FIX: Add living-to-deceased transitions for hostages who died in captivity
            const isDeceased = record.deathDate && record.deathDate_valid;
            const diedAfterKidnapping = isDeceased && record.deathDate.getTime() > record.kidnappedDate.getTime();
            
            if (initialLane === 'kidnapped-living' && isDeceased && diedAfterKidnapping) {
                // Add death transition: kidnapped-living → kidnapped-deceased
                path.push({
                    lane: 'kidnapped-deceased',
                    date: record.deathDate,
                    timestamp: record.deathDate.getTime(),
                    event: 'died'
                });
            }
            
            // Add final transition event (release/body return)
            if (record.transitionEvent) {
                const transitionLane = finalLane;
                const currentLane = path[path.length - 1].lane; // Use current lane, not initial lane
                
                // Only add transition if moving to a different lane
                if (transitionLane !== currentLane) {
                    path.push({
                        lane: transitionLane,
                        date: record.transitionEvent.date,
                        timestamp: record.transitionEvent.timestamp,
                        event: record.transitionEvent.type
                    });
                }
            }
            
            return {
                ...record,
                path,
                initialLane,
                finalLane,
                hasTransition: path.length > 1
            };
        });
    }

    /**
     * Main processing pipeline
     * @param {string} csvText - Raw CSV content
     * @returns {Array} Fully processed hostage data
     */
    process(csvText) {
        try {
            // Reset state
            this.errors = [];
            
            // Phase 1a: Parse CSV
            console.log('Phase 1a: Parsing CSV data...');
            this.parseCSV(csvText);
            
            // DEBUG: Check if עדן ירושלמי is in the raw data
            
            // DEBUG: Check for specific hostages
            const itaiChen = this.rawData.find(record => record['Hebrew Name'] === 'איתי חן');
            const maximHarkin = this.rawData.find(record => record['Hebrew Name'] === 'מקסים הרקין');
            
            if (itaiChen) {
                console.log(`[VISIBILITY-DEBUG] Found איתי חן in raw data:`, {
                    name: itaiChen['Hebrew Name'],
                    status: itaiChen['Current Status'],
                    deathDate: itaiChen['Date of Death'],
                    releaseDate: itaiChen['Release Date']
                });
            } else {
                console.log(`[VISIBILITY-DEBUG] איתי חן NOT FOUND in raw data!`);
            }
            
            if (maximHarkin) {
                console.log(`[VISIBILITY-DEBUG] Found מקסים הרקין in raw data:`, {
                    name: maximHarkin['Hebrew Name'],
                    status: maximHarkin['Current Status'],
                    deathDate: maximHarkin['Date of Death'],
                    releaseDate: maximHarkin['Release Date']
                });
            } else {
                console.log(`[VISIBILITY-DEBUG] מקסים הרקין NOT FOUND in raw data!`);
            }
            
            // Phase 1b: Validate and normalize dates
            console.log('Phase 1b: Validating dates...');
            const validatedData = this.rawData.map(record => this.validateDates(record));
            
            // Phase 1c: Calculate event order
            console.log('Phase 1c: Calculating event chronology...');
            const chronologicalData = this.calculateEventOrder(validatedData);
            
            // Phase 1d: Generate transition paths
            console.log('Phase 1d: Generating transition paths...');
            this.processedData = this.generateTransitionPaths(chronologicalData);
            
            // Log processing summary
            console.log(`Processing complete: ${this.processedData.length} records processed`);
            if (this.errors.length > 0) {
                console.warn(`${this.errors.length} validation errors encountered:`, this.errors);
            }
            
            // Journey types will be set later when color manager is available
            
            // DEBUG: Check if hostages made it through processing
            const itaiChenProcessed = this.processedData.find(record => record['Hebrew Name'] === 'איתי חן');
            const maximHarkinProcessed = this.processedData.find(record => record['Hebrew Name'] === 'מקסים הרקין');
            
            if (itaiChenProcessed) {
                console.log(`[VISIBILITY-DEBUG] איתי חן made it through processing:`, {
                    name: itaiChenProcessed['Hebrew Name'],
                    status: itaiChenProcessed['Current Status'],
                    finalLane: itaiChenProcessed.finalLane,
                    journeyType: itaiChenProcessed.journeyType
                });
            } else {
                console.log(`[VISIBILITY-DEBUG] איתי חן LOST during processing!`);
            }
            
            if (maximHarkinProcessed) {
                console.log(`[VISIBILITY-DEBUG] מקסים הרקין made it through processing:`, {
                    name: maximHarkinProcessed['Hebrew Name'],
                    status: maximHarkinProcessed['Current Status'],
                    finalLane: maximHarkinProcessed.finalLane,
                    journeyType: maximHarkinProcessed.journeyType
                });
            } else {
                console.log(`[VISIBILITY-DEBUG] מקסים הרקין LOST during processing!`);
            }
            
            return this.processedData;
            
        } catch (error) {
            console.error('Data processing failed:', error);
            throw error;
        }
    }

    /**
     * Get processing errors
     * @returns {Array} Array of error messages
     */
    getErrors() {
        return [...this.errors];
    }

    /**
     * Get processing statistics
     * @returns {Object} Processing statistics
     */
    getStats() {
        if (!this.processedData.length) {
            return { processed: 0, errors: this.errors.length };
        }
        
        const stats = {
            total: this.processedData.length,
            errors: this.errors.length,
            byLane: {},
            withTransitions: 0,
            dateValidation: {
                validKidnapped: 0,
                validRelease: 0,
                validDeath: 0
            }
        };
        
        this.processedData.forEach(record => {
            // Count by final lane
            const lane = record.finalLane;
            stats.byLane[lane] = (stats.byLane[lane] || 0) + 1;
            
            // Count transitions
            if (record.hasTransition) {
                stats.withTransitions++;
            }
            
            // Count valid dates
            if (record.kidnappedDate_valid) stats.dateValidation.validKidnapped++;
            if (record.releaseDate_valid) stats.dateValidation.validRelease++;
            if (record.deathDate_valid) stats.dateValidation.validDeath++;
        });
        
        return stats;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataProcessor;
}