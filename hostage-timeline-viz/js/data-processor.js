/**
 * Data Processor for Hostage Timeline Visualization
 * Phase 1: Data Foundation - CSV parsing, validation, and transformation
 */

class DataProcessor {
    constructor() {
        this.rawData = [];
        this.processedData = [];
        this.errors = [];
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
        
        // Handle contextual date patterns first
        if (dateStr.toLowerCase().includes('killed during oct 7') || 
            dateStr.toLowerCase().includes('died before/during kidnapping')) {
            return new Date('2023-10-07');
        }
        
        if (dateStr.toLowerCase().includes('killed in captivity - first months')) {
            // Estimate early captivity death (Nov-Dec 2023)
            return new Date('2023-11-15');
        }
        
        if (dateStr.toLowerCase().includes('killed in captivity by captors')) {
            // Estimate mid-captivity death 
            return new Date('2024-01-15');
        }
        
        // Handle different date formats
        const formats = [
            // ISO format: 2023-10-07
            /^(\d{4})-(\d{2})-(\d{2})$/,
            // MM/DD/YYYY format
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
            // DD/MM/YYYY format  
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
        ];
        
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
     * Calculate event chronology for sorting purposes
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
                    timestamp: record.kidnappedDate.getTime()
                });
            }
            
            // Death event
            if (record.deathDate && record.deathDate_valid) {
                events.push({
                    type: 'died',
                    date: record.deathDate,
                    timestamp: record.deathDate.getTime()
                });
            }
            
            // Release event
            if (record.releaseDate && record.releaseDate_valid) {
                events.push({
                    type: 'released',
                    date: record.releaseDate,
                    timestamp: record.releaseDate.getTime()
                });
            } else if (record['Current Status']?.includes('Released') || 
                      record['Current Status']?.includes('Deceased - Returned')) {
                // Create release event for hostages with release status but invalid dates
                // Use death date if available, otherwise reasonable estimated date
                let estimatedDate;
                
                if (record.deathDate && record.deathDate_valid) {
                    // For deceased who were returned, use death date as the logical transition point
                    estimatedDate = record.deathDate;
                } else {
                    // Try to parse context from release circumstances or death context
                    const releaseCircumstances = record['Release/Death Circumstances'] || '';
                    const deathContext = record['Context of Death'] || '';
                    
                    if (deathContext.toLowerCase().includes('killed during oct 7') ||
                        releaseCircumstances.toLowerCase().includes('oct 7')) {
                        estimatedDate = new Date('2023-10-07');
                    } else if (deathContext.toLowerCase().includes('killed in captivity')) {
                        estimatedDate = new Date('2024-01-15'); // Mid-captivity estimate
                    } else {
                        // Last resort: use current date but this should be rare now
                        estimatedDate = new Date();
                        console.warn(`Using current date for ${record['Hebrew Name']} - no better date available`);
                    }
                }
                
                events.push({
                    type: 'released',
                    date: estimatedDate,
                    timestamp: estimatedDate.getTime()
                });
            }
            
            // Sort events by timestamp
            events.sort((a, b) => a.timestamp - b.timestamp);
            
            // Calculate lane transition event
            // For deceased hostages whose bodies were returned, use the release event, not death event
            let transitionEvent = null;
            
            const hasReleaseDate = record.releaseDate && record.releaseDate_valid;
            const isDeceased = record.deathDate && record.deathDate_valid;
            
            if (isDeceased && hasReleaseDate) {
                // Deceased with body returned - transition should be on release date
                transitionEvent = events.find(e => e.type === 'released');
            } else {
                // All other cases - use first non-kidnapping event  
                transitionEvent = events.find(e => e.type !== 'kidnapped');
            }
            
            return {
                ...record,
                events,
                transitionEvent,
                eventOrder: transitionEvent ? transitionEvent.timestamp : Infinity // No transition = lowest priority
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
        
        // Check for military operation indicators
        if (circumstances.includes('military operation') || 
            circumstances.includes('returned in military')) {
            return 'military';
        }
        
        // Check for deal/negotiation indicators
        if (circumstances.includes('deal') || 
            circumstances.includes('returned in deal') ||
            circumstances.includes('released via deal') ||
            circumstances.includes('negotiation')) {
            return 'deal';
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
            
            // Add intermediate death transition for deceased hostages whose bodies were returned
            const hasReleaseDate = record.releaseDate && record.releaseDate_valid;
            const isDeceased = record.deathDate && record.deathDate_valid;
            const diedAfterKidnapping = isDeceased && record.deathDate.getTime() > record.kidnappedDate.getTime();
            
            if (isDeceased && hasReleaseDate && diedAfterKidnapping && initialLane === 'kidnapped-living') {
                // Add death transition: kidnapped-living → kidnapped-deceased
                path.push({
                    lane: 'kidnapped-deceased',
                    date: record.deathDate,
                    timestamp: record.deathDate.getTime(),
                    event: 'died'
                });
            }
            
            // Add final transition event
            if (record.transitionEvent) {
                const transitionLane = finalLane;
                const currentLane = path[path.length - 1].lane;
                
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