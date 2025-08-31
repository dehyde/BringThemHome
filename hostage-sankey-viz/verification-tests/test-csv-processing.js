// Test CSV processing with actual data to verify the architecture fix
const fs = require('fs');

console.log('🔍 CSV-TEST-START: Processing actual CSV data...');

// Read the CSV file
let csvContent;
try {
    csvContent = fs.readFileSync('/Users/tombar-gal/BringThemHome/hostages-from-kan.csv', 'utf-8');
} catch (error) {
    console.error('❌ Failed to read CSV file:', error.message);
    process.exit(1);
}

// Simple CSV parser (mimicking data-processor.js logic)
function parseCSVLine(line) {
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

// Parse CSV
const lines = csvContent.trim().split('\n');
const headers = parseCSVLine(lines[0]);
const records = [];

console.log(`🔍 CSV-TEST-HEADERS: Found ${headers.length} columns`);
console.log(`🔍 CSV-TEST-LINES: Processing ${lines.length - 1} data lines`);

for (let i = 1; i < lines.length; i++) { // Process all records
    const values = parseCSVLine(lines[i]);
    const record = {};
    
    headers.forEach((header, idx) => {
        record[header] = values[idx] || '';
    });
    
    record._lineNumber = i + 1;
    records.push(record);
}

console.log(`🔍 CSV-TEST-PARSED: Successfully parsed ${records.length} records`);

// Classification logic (simplified from data-processor.js)
function classifyStep1(record) {
    const deathContext = record['Context of Death'] || '';
    if (deathContext.includes('Died Before/During Kidnapping') || 
        deathContext.includes('Killed during Oct 7 raids')) {
        return 'deceased-oct7';
    }
    return 'alive-oct7';
}

function classifyStep2(record) {
    const currentStatus = record['Current Status'] || '';
    const releaseCircumstances = record['Release/Death Circumstances'] || '';
    const deathContext = record['Context of Death'] || '';
    const step1 = record.step1;
    
    // Determine if currently alive or dead
    let isCurrentlyAlive = true;
    
    if (step1 === 'deceased-oct7') {
        isCurrentlyAlive = false;
    } else if (deathContext.includes('Died in Captivity') || deathContext.includes('Killed in captivity')) {
        isCurrentlyAlive = false;
    }
    
    // Released/returned cases
    if (currentStatus.includes('Released') || currentStatus.includes('Deceased - Returned')) {
        if (releaseCircumstances.includes('Military') || releaseCircumstances.includes('Operation')) {
            return isCurrentlyAlive ? 'released-military-living' : 'released-military-deceased';
        } else {
            return isCurrentlyAlive ? 'released-deal-living' : 'released-deal-deceased';
        }
    }
    
    // Still held
    if (currentStatus.includes('Held in Gaza')) {
        return isCurrentlyAlive ? 'still-held-living' : 'still-held-deceased';
    }
    
    return isCurrentlyAlive ? 'still-held-living' : 'still-held-deceased';
}

// Process records
records.forEach(record => {
    record.step1 = classifyStep1(record);
    record.step2 = classifyStep2(record);
});

// Generate link statistics
const linkMap = new Map();

records.forEach(record => {
    const linkKey = `${record.step1}-${record.step2}`;
    
    if (!linkMap.has(linkKey)) {
        linkMap.set(linkKey, {
            source: record.step1,
            target: record.step2,
            value: 0,
            hostages: []
        });
    }
    linkMap.get(linkKey).value++;
    linkMap.get(linkKey).hostages.push(record);
});

console.log('🔍 CSV-TEST-CRITICAL-PATHS:');
const criticalPaths = ['alive-oct7-released-deal-living', 'alive-oct7-released-military-living'];
criticalPaths.forEach(path => {
    if (linkMap.has(path)) {
        const link = linkMap.get(path);
        console.log(`  ✅ ${path} = ${link.value} hostages`);
        
        // Log some example names for verification
        const exampleNames = link.hostages.slice(0, 3).map(h => h['Hebrew Name']).join(', ');
        console.log(`    Examples: ${exampleNames}${link.hostages.length > 3 ? '...' : ''}`);
    } else {
        console.log(`  ❌ Missing ${path}`);
    }
});

console.log('🔍 CSV-TEST-ALL-LINKS:');
const sortedLinks = Array.from(linkMap.entries()).sort((a, b) => b[1].value - a[1].value);
sortedLinks.forEach(([key, link]) => {
    console.log(`  ${key}: ${link.value} hostages`);
});

// Node value verification
const nodes = [
    { id: 'alive-oct7', step: 1 },
    { id: 'deceased-oct7', step: 1 },
    { id: 'released-deal-living', step: 2 },
    { id: 'released-deal-deceased', step: 2 },
    { id: 'released-military-living', step: 2 },
    { id: 'released-military-deceased', step: 2 },
    { id: 'still-held-living', step: 2 },
    { id: 'still-held-deceased', step: 2 }
];

const links = Array.from(linkMap.values());

nodes.forEach(node => {
    node.value = 0;
    node.sourceLinks = [];
    node.targetLinks = [];
});

links.forEach(link => {
    const sourceNode = nodes.find(n => n.id === link.source);
    const targetNode = nodes.find(n => n.id === link.target);
    
    if (sourceNode && targetNode) {
        sourceNode.sourceLinks.push(link);
        targetNode.targetLinks.push(link);
        sourceNode.value += link.value;
    }
});

nodes.forEach(node => {
    if (node.sourceLinks.length === 0) {
        node.value = node.targetLinks.reduce((sum, link) => sum + link.value, 0);
    }
});

console.log('🔍 CSV-TEST-NODE-VALUES:');
nodes.forEach(node => {
    const outgoing = node.sourceLinks.reduce((sum, link) => sum + link.value, 0);
    const incoming = node.targetLinks.reduce((sum, link) => sum + link.value, 0);
    console.log(`  ${node.id}: value=${node.value} (out=${outgoing}, in=${incoming})`);
});

console.log('🔍 CSV-TEST-COMPLETE: CSV processing verification completed.');
console.log(`🔍 CSV-TEST-SUMMARY: Processed ${records.length} records, generated ${links.length} links`);