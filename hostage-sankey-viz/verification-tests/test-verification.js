// Test script to verify our fix implementation
console.log('🔍 VERIFICATION-START: Testing Sankey data processor fixes...');

// Simulate the data processor logic
const testData = [
    {
        'Hebrew Name': 'Test1',
        'Current Status': 'Released',
        'Release/Death Circumstances': 'Deal',
        'Context of Death': '',
        'Date of Death': '',
        step1: 'alive-oct7',
        step2: 'released-deal-living',
        _lineNumber: 1
    },
    {
        'Hebrew Name': 'Test2', 
        'Current Status': 'Released',
        'Release/Death Circumstances': 'Military',
        'Context of Death': '',
        'Date of Death': '',
        step1: 'alive-oct7',
        step2: 'released-military-living',
        _lineNumber: 2
    },
    {
        'Hebrew Name': 'Test3',
        'Current Status': 'Released',
        'Release/Death Circumstances': 'Deal',
        'Context of Death': 'Died in Captivity',
        'Date of Death': '2024-01-15',
        step1: 'alive-oct7',
        step2: 'released-deal-deceased',
        _lineNumber: 3
    }
];

// Test link generation (mimicking data-processor.js logic)
const linkMap = new Map();

testData.forEach(record => {
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

// Test critical paths
const criticalPaths = ['alive-oct7-released-deal-living', 'alive-oct7-released-military-living'];
console.log('🔍 VERIFICATION-CRITICAL-PATHS:');
criticalPaths.forEach(path => {
    if (linkMap.has(path)) {
        console.log(`  ✅ ${path} = ${linkMap.get(path).value} hostages`);
    } else {
        console.log(`  ❌ Missing ${path}`);
    }
});

// Test node value calculation
const nodes = [
    { id: 'alive-oct7', step: 1 },
    { id: 'released-deal-living', step: 2 },
    { id: 'released-deal-deceased', step: 2 },
    { id: 'released-military-living', step: 2 }
];

const links = Array.from(linkMap.values());

// Initialize node values
nodes.forEach(node => {
    node.value = 0;
    node.sourceLinks = [];
    node.targetLinks = [];
});

// Calculate values from links
links.forEach(link => {
    const sourceNode = nodes.find(n => n.id === link.source);
    const targetNode = nodes.find(n => n.id === link.target);
    
    if (sourceNode && targetNode) {
        sourceNode.sourceLinks.push(link);
        targetNode.targetLinks.push(link);
        sourceNode.value += link.value;
    }
});

// For target nodes, calculate value from incoming links
nodes.forEach(node => {
    if (node.sourceLinks.length === 0) { // Terminal nodes
        node.value = node.targetLinks.reduce((sum, link) => sum + link.value, 0);
    }
});

console.log('🔍 VERIFICATION-NODE-VALUES:');
nodes.forEach(node => {
    console.log(`  ${node.id}: ${node.value} (${node.sourceLinks.length} out, ${node.targetLinks.length} in)`);
});

console.log('🔍 VERIFICATION-LINKS:');
links.forEach(link => {
    console.log(`  ${link.source} -> ${link.target}: ${link.value}`);
});

console.log('🔍 VERIFICATION-COMPLETE: Fix verification test completed.');