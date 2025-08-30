/**
 * Debug hostage properties after lane processing
 * Check what properties are available for transition engine
 */

const puppeteer = require('puppeteer');

async function debugHostageProperties() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        await page.goto('http://localhost:8080/', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        await page.waitForTimeout(8000);
        
        const propertyAnalysis = await page.evaluate(() => {
            const app = window.app;
            const sortedData = app?.laneManager?.getSortedData() || [];
            
            // Analyze first 3 hostages in detail
            const testHostages = sortedData.slice(0, 3);
            
            const propertyTests = testHostages.map(hostage => {
                return {
                    name: hostage['Hebrew Name'],
                    hasLaneId: hostage.hasOwnProperty('laneId'),
                    laneId: hostage.laneId,
                    hasLanePosition: hostage.hasOwnProperty('lanePosition'),
                    lanePosition: hostage.lanePosition,
                    hasFinalLane: hostage.hasOwnProperty('finalLane'),
                    finalLane: hostage.finalLane,
                    hasLaneDef: hostage.hasOwnProperty('laneDef'),
                    laneDef: hostage.laneDef ? hostage.laneDef.label : null,
                    hasPath: hostage.hasOwnProperty('path'),
                    pathLength: hostage.path ? hostage.path.length : 0,
                    allProperties: Object.keys(hostage).sort()
                };
            });
            
            // Check lane manager state
            const laneManagerState = {
                lanesCount: app?.laneManager?.lanes?.size || 0,
                sortedDataCount: sortedData.length,
                hasLanes: !!app?.laneManager?.lanes
            };
            
            return {
                propertyTests,
                laneManagerState,
                totalHostages: sortedData.length
            };
        });
        
        console.log('\n=== HOSTAGE PROPERTIES DEBUG ===');
        console.log(`Total hostages in sorted data: ${propertyAnalysis.totalHostages}`);
        
        console.log('\n=== LANE MANAGER STATE ===');
        console.log(`Lanes count: ${propertyAnalysis.laneManagerState.lanesCount}`);
        console.log(`Sorted data count: ${propertyAnalysis.laneManagerState.sortedDataCount}`);
        console.log(`Has lanes map: ${propertyAnalysis.laneManagerState.hasLanes}`);
        
        console.log('\n=== HOSTAGE PROPERTY ANALYSIS ===');
        propertyAnalysis.propertyTests.forEach(test => {
            console.log(`\n📍 ${test.name}:`);
            console.log(`   Has laneId: ${test.hasLaneId} (value: ${test.laneId})`);
            console.log(`   Has lanePosition: ${test.hasLanePosition} (value: ${test.lanePosition})`);
            console.log(`   Has finalLane: ${test.hasFinalLane} (value: ${test.finalLane})`);
            console.log(`   Has laneDef: ${test.hasLaneDef} (label: ${test.laneDef})`);
            console.log(`   Has path: ${test.hasPath} (length: ${test.pathLength})`);
            
            console.log(`   All properties (${test.allProperties.length}): ${test.allProperties.slice(0, 10).join(', ')}...`);
            
            // Identify missing critical properties
            const missing = [];
            if (!test.hasLaneId) missing.push('laneId');
            if (!test.hasLanePosition) missing.push('lanePosition');
            if (!test.hasLaneDef) missing.push('laneDef');
            
            if (missing.length > 0) {
                console.log(`   ❌ MISSING: ${missing.join(', ')}`);
            } else {
                console.log(`   ✅ All critical properties present`);
            }
        });
        
        return propertyAnalysis;
        
    } catch (error) {
        console.error('Hostage properties debug failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

debugHostageProperties();