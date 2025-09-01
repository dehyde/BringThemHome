/**
 * Data Processor for Hostage Sankey Visualization
 * Transforms CSV data into 3-step Sankey flow structure
 */

class SankeyDataProcessor {
    constructor() {
        this.rawData = [];
        this.processedData = [];
        this.sankeyData = { nodes: [], links: [] };
        this.individualPaths = [];
        this.errors = [];
        
        // Color scheme matching CSS  
        this.colors = {
            'alive-oct7': '#3498db',
            'deceased-oct7': '#95a5a6', 
            'released-deal-living': '#27ae60',          // Living released via deal
            'released-deal-deceased': '#95a5a6',        // Deceased released via deal (gray)
            'released-military-living': '#2980b9',      // Living released via military
            'released-military-deceased': '#95a5a6',    // Deceased released via military (gray)
            'still-held-living': '#f39c12',             // Living still held
            'still-held-deceased': '#95a5a6'            // Deceased still held (gray)
        };
    }

    /**
     * Parse CSV data
     * @param {string} csvText - Raw CSV content
     */
    async parseCSV(csvText) {
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
                    
                    // Ensure critical fields exist as strings
                    record['Current Status'] = record['Current Status'] || '';
                    record['Context of Death'] = record['Context of Death'] || '';
                    record['Release/Death Circumstances'] = record['Release/Death Circumstances'] || '';
                    record['Civilian/Soldier Status'] = record['Civilian/Soldier Status'] || '';
                    record['Location Kidnapped (Hebrew)'] = record['Location Kidnapped (Hebrew)'] || '';
                    
                    record._lineNumber = index + 2;
                    return record;
                } catch (error) {
                    this.errors.push(`Line ${index + 2}: ${error.message}`);
                    return null;
                }
            }).filter(record => record !== null);
            
            console.log(`Parsed ${this.rawData.length} hostage records`);
            return this.rawData;
        } catch (error) {
            this.errors.push(`CSV parsing failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Parse single CSV line with proper quote handling
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
     * Process raw data into 2-step flow structure
     */
    processData() {
        this.processedData = this.rawData.map(record => {
            const processed = { ...record };
            
            // Parse dates
            processed.kidnappedDate = this.parseDate(record['Kidnapped Date']);
            processed.deathDate = this.parseDate(record['Date of Death']);
            processed.releaseDate = this.parseDate(record['Release Date']);
            
            // Classify into 2-step flow
            try {
                processed.step1 = this.classifyStep1(processed);
                processed.step2 = this.classifyStep2FinalOutcome(processed);
            } catch (error) {
                console.error('[SANKEY-DATA] Error processing record:', processed, error);
                this.errors.push(`Line ${processed._lineNumber}: Classification failed - ${error.message}`);
                processed.step1 = 'alive-oct7';
                processed.step2 = 'still-held-living';
            }
            
            return processed;
        });
        
        this.generateSankeyData();
        this.generateIndividualPaths();
        
        console.log(`🔍 TOPPATH-DATA: Generated links for ${this.processedData.length} hostages`);
        
        return {
            sankeyData: this.sankeyData,
            individualPaths: this.individualPaths,
            processedData: this.processedData
        };
    }

    /**
     * Classify Step 1: Oct 7th status
     */
    classifyStep1(record) {
        const deathDate = record.deathDate;
        const kidnappedDate = record.kidnappedDate;
        const deathContext = record['Context of Death'] || '';
        
        // Check if died on Oct 7th
        if (deathDate && kidnappedDate && 
            deathDate.getTime() === kidnappedDate.getTime() || 
            (deathContext && (deathContext.includes('Died Before/During Kidnapping') ||
            deathContext.includes('Killed during Oct 7 raids')))) {
            return 'deceased-oct7';
        }
        
        return 'alive-oct7';
    }

    /**
     * Classify Step 2: Final outcome with alive/dead specification
     */
    classifyStep2FinalOutcome(record) {
        const currentStatus = record['Current Status'] || '';
        const releaseCircumstances = record['Release/Death Circumstances'] || '';
        const step1 = record.step1;
        const deathDate = record.deathDate;
        const kidnappedDate = record.kidnappedDate;
        const deathContext = record['Context of Death'] || '';
        
        // Determine if hostage is currently alive or dead
        let isCurrentlyAlive = true;
        
        if (step1 === 'deceased-oct7') {
            isCurrentlyAlive = false;
        } else if (deathDate && kidnappedDate && deathDate.getTime() > kidnappedDate.getTime() &&
                   deathContext && (deathContext.includes('Died in Captivity') || deathContext.includes('Killed in captivity'))) {
            isCurrentlyAlive = false;
        }
        
        // Store alive/dead status for internal subdivision
        record.isAlive = isCurrentlyAlive;
        
        // Filter out future dates (bug in data)
        const now = new Date();
        const releaseDate = record.releaseDate;
        if (releaseDate && releaseDate.getTime() > now.getTime()) {
            // Treat future releases as still held
            return isCurrentlyAlive ? 'still-held-living' : 'still-held-deceased';
        }
        
        // Released/returned cases - specify living/deceased
        if (currentStatus && (currentStatus.includes('Released') || currentStatus.includes('Deceased - Returned'))) {
            if (releaseCircumstances && (releaseCircumstances.includes('Military') || releaseCircumstances.includes('Operation'))) {
                return isCurrentlyAlive ? 'released-military-living' : 'released-military-deceased';
            } else {
                return isCurrentlyAlive ? 'released-deal-living' : 'released-deal-deceased';
            }
        }
        
        // Still held
        if (currentStatus && currentStatus.includes('Held in Gaza')) {
            return isCurrentlyAlive ? 'still-held-living' : 'still-held-deceased';
        }
        
        // Default
        return isCurrentlyAlive ? 'still-held-living' : 'still-held-deceased';
    }

    /**
     * Generate Sankey data structure
     */
    generateSankeyData() {
        const nodes = [];
        const nodeMap = new Map();
        const links = [];
        const linkMap = new Map();
        
        // Create nodes for 2-step flow with full subdivisions
        const step1Nodes = ['alive-oct7', 'deceased-oct7'];
        const step2Nodes = [
            'released-deal-living', 'released-deal-deceased',
            'released-military-living', 'released-military-deceased', 
            'still-held-living', 'still-held-deceased'
        ];
        
        let nodeIndex = 0;
        
        // Add Step 1 nodes  
        step1Nodes.forEach(nodeId => {
            const node = {
                id: nodeId,
                name: this.getNodeLabel(nodeId),
                step: 1,
                index: nodeIndex++,
                color: this.colors[nodeId]
            };
            nodes.push(node);
            nodeMap.set(nodeId, node.index);
        });
        
        // Add Step 2 nodes as individual subdivisions
        step2Nodes.forEach(nodeId => {
            // Count hostages for this specific subdivision
            const hostageCount = this.processedData.filter(r => r.step2 === nodeId).length;
            
            // Log subdivision counts for critical nodes
            if (nodeId.includes('released-deal') || nodeId.includes('released-military')) {
                console.log(`🔍 TOPPATH-NODE: ${nodeId} = ${hostageCount} hostages`);
            }
            
            const node = {
                id: nodeId,
                name: this.getNodeLabel(nodeId),
                step: 2,
                index: nodeIndex++,
                color: this.colors[nodeId],
                hostageCount: hostageCount
            };
            nodes.push(node);
            nodeMap.set(nodeId, node.index);
        });
        
        // Generate links by counting flows (2 steps) - preserve full subdivisions
        this.processedData.forEach(record => {
            // Skip records with missing steps
            if (!record.step1 || !record.step2) {
                console.warn('[SANKEY-DATA] Skipping record with missing steps:', record);
                return;
            }
            
            // Use the full step2 classification (e.g., 'released-deal-living')
            const linkKey = `${record.step1}-${record.step2}`;
            
            // Check if both nodes exist
            if (!nodeMap.has(record.step1) || !nodeMap.has(record.step2)) {
                console.warn('[SANKEY-DATA] Missing nodes for link:', linkKey, record);
                return;
            }
            
            if (!linkMap.has(linkKey)) {
                linkMap.set(linkKey, {
                    source: nodeMap.get(record.step1),
                    target: nodeMap.get(record.step2),
                    value: 0,
                    hostages: []
                });
            }
            linkMap.get(linkKey).value++;
            linkMap.get(linkKey).hostages.push(record);
        });
        
        // 🔍 TOPPATH: Summary of critical living->released links (now with subdivisions)
        const criticalPaths = ['alive-oct7-released-deal-living', 'alive-oct7-released-military-living'];
        criticalPaths.forEach(path => {
            if (linkMap.has(path)) {
                console.log(`🔍 TOPPATH-DATA: ${path} = ${linkMap.get(path).value} hostages`);
            } else {
                console.error(`🔍 TOPPATH-ERROR: Missing ${path}`);
            }
        });
        
        // Convert links map to array
        links.push(...linkMap.values());
        
        // Add grouping metadata for visual pairing
        const nodeGroups = {
            'released-deal': ['released-deal-living', 'released-deal-deceased'],
            'released-military': ['released-military-living', 'released-military-deceased'],
            'still-held': ['still-held-living', 'still-held-deceased']
        };
        
        // Add group information to each node
        nodes.forEach(node => {
            // Find which group this node belongs to
            for (const [groupId, members] of Object.entries(nodeGroups)) {
                if (members.includes(node.id)) {
                    node.groupId = groupId;
                    node.isLiving = node.id.includes('-living');
                    node.subgroupIndex = node.isLiving ? 0 : 1; // 0 for top, 1 for bottom
                    break;
                }
            }
        });
        
        // Calculate group totals for proportional sizing
        Object.entries(nodeGroups).forEach(([groupId, memberIds]) => {
            const groupNodes = nodes.filter(n => memberIds.includes(n.id));
            const totalValue = groupNodes.reduce((sum, n) => sum + n.value, 0);
            
            groupNodes.forEach(node => {
                node.groupTotal = totalValue;
                node.proportionInGroup = totalValue > 0 ? node.value / totalValue : 0;
            });
            
            console.log(`🔍 GROUPING-DATA: ${groupId} total=${totalValue} (living: ${groupNodes.find(n => n.isLiving)?.value || 0}, deceased: ${groupNodes.find(n => !n.isLiving)?.value || 0})`);
        });
        
        // 🔍 TOPPATH: Calculate correct node values from connected links
        nodes.forEach(node => {
            node.value = 0;
            node.sourceLinks = [];
            node.targetLinks = [];
        });
        
        links.forEach(link => {
            const sourceNode = nodes[link.source];
            const targetNode = nodes[link.target];
            
            sourceNode.sourceLinks.push(link);
            targetNode.targetLinks.push(link);
            
            sourceNode.value += link.value;
            // Don't double-count for target nodes - they get value from incoming links
        });
        
        // For target nodes, calculate value from incoming links
        nodes.forEach(node => {
            if (node.sourceLinks.length === 0) { // Terminal nodes
                node.value = node.targetLinks.reduce((sum, link) => sum + link.value, 0);
            }
        });
        
        // 🔍 TOPPATH: Log corrected node values
        nodes.forEach(node => {
            if (node.id === 'alive-oct7' || node.id === 'released-deal' || node.id === 'released-military') {
                console.log(`🔍 TOPPATH-NODE-VALUE: ${node.id} = ${node.value} (from ${node.sourceLinks?.length || 0} source + ${node.targetLinks?.length || 0} target links)`);
            }
        });
        
        this.sankeyData = { nodes, links };
    }

    /**
     * Generate individual paths for highlighting
     */
    generateIndividualPaths() {
        this.individualPaths = this.processedData.map(record => ({
            id: record['Hebrew Name'] || `hostage-${record._lineNumber}`,
            name: record['Hebrew Name'] || 'ללא שם',
            age: record['Age at Kidnapping'],
            location: record['Location Kidnapped (Hebrew)'],
            path: [record.step1, record.step2], // 2-step path
            record: record
        }));
    }

    /**
     * Get node subgroup for positioning
     */
    getNodeSubgroup(nodeId) {
        if (!nodeId || typeof nodeId !== 'string') return 'none';
        if (nodeId.includes('-living')) return 'living';
        if (nodeId.includes('-deceased')) return 'deceased'; 
        return 'none';
    }

    /**
     * Get human-readable node label
     */
    getNodeLabel(nodeId) {
        const labels = {
            'alive-oct7': 'חיים ב-7.10',
            'deceased-oct7': 'נפטרו ב-7.10',
            'released-deal-living': 'שוחררו בעסקה - חיים',
            'released-deal-deceased': 'שוחררו בעסקה - נפטרו',
            'released-military-living': 'שוחררו במבצע - חיים',
            'released-military-deceased': 'שוחררו במבצע - נפטרו',
            'still-held-living': 'עדיין בשבי - חיים',
            'still-held-deceased': 'עדיין בשבי - נפטרו'
        };
        return labels[nodeId] || nodeId;
    }

    /**
     * Parse date string
     */
    parseDate(dateString) {
        if (!dateString || !dateString.trim()) return null;
        
        try {
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? null : date;
        } catch {
            return null;
        }
    }
}