/**
 * Debug actual Y coordinates being assigned to lanes and hostages
 */

const puppeteer = require('puppeteer');

async function debugYCoordinates() {
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
            
            // Get lane information with actual Y coordinates
            const laneInfo = [];
            if (laneManager.lanes) {
                laneManager.lanes.forEach(lane => {
                    laneInfo.push({
                        laneId: lane.laneId,
                        label: lane.definition?.label || 'Unknown',
                        priority: lane.definition?.priority || 999,
                        section: lane.definition?.section || 'Unknown',
                        yStart: lane.yStart,
                        yEnd: lane.yEnd,
                        height: lane.height,
                        hostageCount: lane.hostages?.length || 0
                    });
                });
            }
            
            // Sort by priority to see expected order
            laneInfo.sort((a, b) => a.priority - b.priority);
            
            // Get specific hostages and their Y coordinates
            const specificHostages = ['יפה אדר', 'איתן יהלומי'];
            const hostageYCoords = [];
            
            specificHostages.forEach(name => {
                const hostage = sortedData.find(h => h['Hebrew Name'] === name);
                if (hostage) {
                    let actualY = 'unknown';
                    if (laneManager.getHostageY) {
                        try {
                            actualY = laneManager.getHostageY(hostage);
                        } catch (e) {
                            actualY = `error: ${e.message}`;
                        }
                    }
                    
                    hostageYCoords.push({
                        name,
                        finalLane: hostage.finalLane,
                        lanePosition: hostage.lanePosition,
                        calculatedY: actualY
                    });
                }
            });
            
            // Find the lane Y coordinates for kidnapped-deceased for comparison
            const kidnappedDeceasedLane = laneInfo.find(l => l.laneId === 'kidnapped-deceased');
            
            return {
                totalHeight: laneManager.totalHeight,
                laneInfo,
                specificHostages: hostageYCoords,
                kidnappedDeceasedLane
            };
        });
        
        console.log('\n=== Y-COORDINATE DEBUG ===');
        console.log(`Total timeline height: ${results.totalHeight}px`);
        
        console.log('\n=== LANE Y-COORDINATES (by priority) ===');
        results.laneInfo.forEach(lane => {
            console.log(`${lane.priority}: ${lane.laneId} (${lane.section})`);
            console.log(`     Label: ${lane.label}`);
            console.log(`     Y: ${lane.yStart} → ${lane.yEnd} (height: ${lane.height})`);
            console.log(`     Hostages: ${lane.hostageCount}`);
            console.log('');
        });
        
        console.log('\n=== SPECIFIC HOSTAGES Y-COORDINATES ===');
        results.specificHostages.forEach(hostage => {
            console.log(`${hostage.name}:`);
            console.log(`     Lane: ${hostage.finalLane}`);
            console.log(`     Lane Position: ${hostage.lanePosition}`);
            console.log(`     Calculated Y: ${hostage.calculatedY}`);
            console.log('');
        });
        
        // Analysis
        console.log('\n=== ANALYSIS ===');
        
        const releasedDealLivingLane = results.laneInfo.find(l => l.laneId === 'released-deal-living');
        const kidnappedDeceasedLane = results.kidnappedDeceasedLane;
        
        if (releasedDealLivingLane && kidnappedDeceasedLane) {
            console.log(`Released-deal-living Y range: ${releasedDealLivingLane.yStart} → ${releasedDealLivingLane.yEnd}`);
            console.log(`Kidnapped-deceased Y range: ${kidnappedDeceasedLane.yStart} → ${kidnappedDeceasedLane.yEnd}`);
            
            if (releasedDealLivingLane.yStart > kidnappedDeceasedLane.yEnd) {
                console.log('❌ ISSUE CONFIRMED: Released-deal-living appears BELOW kidnapped-deceased');
                console.log('This explains why you see living hostages below deceased ones');
            } else if (releasedDealLivingLane.yEnd < kidnappedDeceasedLane.yStart) {
                console.log('✅ CORRECT: Released-deal-living appears ABOVE kidnapped-deceased');
            } else {
                console.log('⚠️  OVERLAP: Lanes may be overlapping');
            }
        }
        
        return results;
        
    } catch (error) {
        console.error('Y-coordinate debug failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

debugYCoordinates();