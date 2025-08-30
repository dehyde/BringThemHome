/**
 * Debug transitions that happen very close to timeline end (recent dates)
 */

const puppeteer = require('puppeteer');

async function debugRecentTransitions() {
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
            const timeline = app?.timelineCore;
            
            const timelineEndX = timeline.dateToX(new Date());
            const today = new Date();
            const oneMonthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            
            // Find deceased with returned bodies who transitioned recently
            const recentTransitions = sortedData.filter(h => 
                h.hasTransition && 
                h.finalLane?.includes('released') &&
                h.finalLane?.includes('deceased') &&
                h.releaseDate && h.releaseDate_valid &&
                h.releaseDate > oneMonthAgo  // Within last month
            );
            
            const analysis = recentTransitions.map(hostage => {
                const name = hostage['Hebrew Name'];
                const releaseX = timeline.dateToX(hostage.releaseDate);
                const distanceFromEnd = Math.abs(releaseX - timelineEndX);
                
                // Find SVG path
                const svgLine = Array.from(document.querySelectorAll('.hostage-line'))
                    .find(line => line.getAttribute('data-name') === name);
                
                let actualEndX = null;
                if (svgLine) {
                    const pathData = svgLine.getAttribute('d');
                    const coords = pathData.match(/[\d.]+/g)?.map(n => parseFloat(n)) || [];
                    actualEndX = coords[coords.length - 2]; // Last X coordinate
                }
                
                return {
                    name,
                    releaseDate: hostage.releaseDate.toISOString().split('T')[0],
                    expectedX: Math.round(releaseX),
                    actualEndX: actualEndX ? Math.round(actualEndX) : null,
                    distanceFromTimelineEnd: Math.round(distanceFromEnd),
                    isVeryCloseToEnd: distanceFromEnd < 50, // Less than 50px from end
                    daysSinceRelease: Math.round((today - hostage.releaseDate) / (24 * 60 * 60 * 1000))
                };
            });
            
            return {
                timelineEndX: Math.round(timelineEndX),
                today: today.toISOString().split('T')[0],
                oneMonthAgo: oneMonthAgo.toISOString().split('T')[0],
                recentTransitions: analysis.length,
                analysis
            };
        });
        
        console.log('\n=== RECENT TRANSITIONS DEBUG ===');
        console.log(`Today: ${results.today}`);
        console.log(`Timeline End X: ${results.timelineEndX}`);
        console.log(`Checking transitions since: ${results.oneMonthAgo}`);
        console.log(`Recent transitions found: ${results.recentTransitions}`);
        
        if (results.analysis.length > 0) {
            console.log('\n=== RECENT TRANSITIONS ANALYSIS ===');
            
            let veryCloseToEnd = 0;
            results.analysis.forEach(hostage => {
                const status = hostage.isVeryCloseToEnd ? '⚠️ ' : '✅ ';
                console.log(`\n${status} ${hostage.name}:`);
                console.log(`   Release Date: ${hostage.releaseDate} (${hostage.daysSinceRelease} days ago)`);
                console.log(`   Expected X: ${hostage.expectedX}`);
                console.log(`   Actual End X: ${hostage.actualEndX}`);
                console.log(`   Distance from timeline end: ${hostage.distanceFromTimelineEnd}px`);
                
                if (hostage.isVeryCloseToEnd) {
                    veryCloseToEnd++;
                    console.log(`   ⚠️  This transition appears very close to timeline end`);
                }
            });
            
            console.log('\n=== SUMMARY ===');
            console.log(`Transitions very close to end (<50px): ${veryCloseToEnd}`);
            
            if (veryCloseToEnd > 0) {
                console.log('\n🎯 ANALYSIS:');
                console.log('   Transitions very close to timeline end may appear to be "at the end"');
                console.log('   This is expected behavior for very recent releases');
                console.log('   The user may be misinterpreting recent transitions as incorrect behavior');
                console.log('   Solution: Add visual indication or extend timeline slightly past today');
            }
        } else {
            console.log('\n✅ No recent transitions found');
        }
        
        return results;
        
    } catch (error) {
        console.error('Recent transitions debug failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

debugRecentTransitions();