/**
 * Debug lane ordering issues and specific hostage positioning
 */

const puppeteer = require('puppeteer');

async function debugLaneOrdering() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        await page.goto('http://localhost:8080/', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        await page.waitForTimeout(8000);
        
        const results = await page.evaluate(() => {
            const app = window.app;
            const sortedData = app?.laneManager?.getSortedData() || [];
            const laneManager = app?.laneManager;
            
            // Check specific hostages mentioned by user
            const specificHostages = ['יפה אדר', 'איתן יהלומי'];
            const specificAnalysis = [];
            
            specificHostages.forEach(name => {
                const hostage = sortedData.find(h => h['Hebrew Name'] === name);
                if (hostage) {
                    const y = laneManager.getHostageY ? laneManager.getHostageY(hostage) : 'unknown';
                    specificAnalysis.push({
                        name,
                        status: hostage['Current Status'],
                        initialLane: hostage.initialLane,
                        finalLane: hostage.finalLane,
                        lanePosition: hostage.lanePosition,
                        yCoordinate: y,
                        hasTransition: hostage.hasTransition,
                        pathLength: hostage.path ? hostage.path.length : 0
                    });
                } else {
                    specificAnalysis.push({
                        name,
                        error: 'Hostage not found'
                    });
                }
            });
            
            // Get lane definitions and their order
            const laneDefinitions = laneManager.laneDefinitions || {};
            const laneOrder = Object.keys(laneDefinitions).map(laneId => ({
                laneId,
                label: laneDefinitions[laneId].label,
                priority: laneDefinitions[laneId].priority,
                yStart: laneDefinitions[laneId].yStart,
                height: laneDefinitions[laneId].height,
                hostageCount: sortedData.filter(h => h.finalLane === laneId).length
            })).sort((a, b) => a.priority - b.priority);
            
            // Check for living hostages in wrong positions
            const livingHostages = sortedData.filter(h => 
                h.finalLane?.includes('living') || 
                h['Current Status']?.includes('Released')
            );
            
            const deceasedInCaptivity = sortedData.filter(h => 
                h.finalLane === 'kidnapped-deceased'
            );
            
            // Find living hostages that appear below deceased-in-captivity
            const problematicPositions = [];
            const deceasedInCaptivityMaxY = Math.max(...deceasedInCaptivity.map(h => {
                const y = laneManager.getHostageY ? laneManager.getHostageY(h) : 0;
                return typeof y === 'number' ? y : 0;
            }));
            
            livingHostages.forEach(hostage => {
                const y = laneManager.getHostageY ? laneManager.getHostageY(hostage) : 0;
                if (typeof y === 'number' && y > deceasedInCaptivityMaxY) {
                    problematicPositions.push({
                        name: hostage['Hebrew Name'],
                        status: hostage['Current Status'],
                        finalLane: hostage.finalLane,
                        yPosition: y,
                        deceasedMaxY: deceasedInCaptivityMaxY
                    });
                }
            });
            
            // Check for actual deceased → released transitions
            const deceasedToReleasedTransitions = sortedData.filter(h => 
                h.hasTransition &&
                h.initialLane?.includes('deceased') &&
                h.finalLane?.includes('released') &&
                h.finalLane?.includes('deceased')
            );
            
            return {
                specificAnalysis,
                laneOrder,
                livingCount: livingHostages.length,
                deceasedInCaptivityCount: deceasedInCaptivity.length,
                deceasedInCaptivityMaxY,
                problematicPositions: problematicPositions.slice(0, 10), // First 10
                deceasedToReleasedCount: deceasedToReleasedTransitions.length,
                deceasedToReleasedSample: deceasedToReleasedTransitions.slice(0, 5).map(h => ({
                    name: h['Hebrew Name'],
                    initialLane: h.initialLane,
                    finalLane: h.finalLane,
                    hasTransition: h.hasTransition,
                    pathLength: h.path?.length || 0
                }))
            };
        });
        
        console.log('\n=== LANE ORDERING DEBUG ===');
        
        console.log('\n=== SPECIFIC HOSTAGES ANALYSIS ===');
        results.specificAnalysis.forEach(hostage => {
            if (hostage.error) {
                console.log(`❌ ${hostage.name}: ${hostage.error}`);
            } else {
                console.log(`\n🔍 ${hostage.name}:`);
                console.log(`   Status: ${hostage.status}`);
                console.log(`   Lane Path: ${hostage.initialLane} → ${hostage.finalLane}`);
                console.log(`   Y Coordinate: ${hostage.yCoordinate}`);
                console.log(`   Has Transition: ${hostage.hasTransition}`);
                console.log(`   Path Length: ${hostage.pathLength}`);
            }
        });
        
        console.log('\n=== LANE ORDER ===');
        results.laneOrder.forEach(lane => {
            console.log(`${lane.priority}: ${lane.laneId} (${lane.label})`);
            console.log(`     Y: ${lane.yStart}, Height: ${lane.height}, Count: ${lane.hostageCount}`);
        });
        
        console.log('\n=== POSITIONING ISSUES ===');
        console.log(`Living hostages: ${results.livingCount}`);
        console.log(`Deceased in captivity: ${results.deceasedInCaptivityCount}`);
        console.log(`Deceased-in-captivity max Y: ${results.deceasedInCaptivityMaxY}`);
        console.log(`Living hostages appearing below deceased: ${results.problematicPositions.length}`);
        
        if (results.problematicPositions.length > 0) {
            console.log('\n❌ LIVING HOSTAGES IN WRONG POSITIONS:');
            results.problematicPositions.forEach(hostage => {
                console.log(`   ${hostage.name} (${hostage.finalLane}) at Y=${hostage.yPosition} > deceased max Y=${hostage.deceasedMaxY}`);
            });
        }
        
        console.log('\n=== DECEASED → RELEASED TRANSITIONS ===');
        console.log(`Total deceased → released transitions: ${results.deceasedToReleasedCount}`);
        
        if (results.deceasedToReleasedCount > 0) {
            console.log('\nSample deceased → released transitions:');
            results.deceasedToReleasedSample.forEach(hostage => {
                console.log(`   ${hostage.name}: ${hostage.initialLane} → ${hostage.finalLane} (${hostage.pathLength} path points)`);
            });
        } else {
            console.log('❌ NO deceased → released transitions found!');
            console.log('This explains why you don\'t see these transitions');
        }
        
        console.log('\n=== ROOT CAUSE ANALYSIS ===');
        
        if (results.problematicPositions.length > 0) {
            console.log('🎯 LANE ORDERING ISSUE CONFIRMED:');
            console.log(`   ${results.problematicPositions.length} living hostages appear below deceased-in-captivity`);
            console.log('   This suggests lane priority or Y-coordinate calculation issues');
            console.log('   Location: lane-manager.js lane ordering or Y-coordinate calculation');
        }
        
        if (results.deceasedToReleasedCount === 0) {
            console.log('🎯 MISSING TRANSITIONS ISSUE CONFIRMED:');
            console.log('   No deceased → released transitions found');
            console.log('   This explains why you don\'t see deceased transitioning to released');
            console.log('   Location: data-processor.js lane determination or transition path generation');
        }
        
        return results;
        
    } catch (error) {
        console.error('Lane ordering debug failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

debugLaneOrdering();