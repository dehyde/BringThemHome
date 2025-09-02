/**
 * Hard refresh debug - force browser to reload everything and check actual behavior
 */

const puppeteer = require('puppeteer');

async function hardRefreshDebug() {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--disable-cache', '--disable-application-cache', '--disable-offline-load-stale-cache']
    });
    const page = await browser.newPage();
    
    try {
        // Disable cache completely
        await page.setCacheEnabled(false);
        
        console.log('Loading page with fresh cache...');
        await page.goto('http://localhost:8080/', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        await page.waitForTimeout(10000); // Wait longer for complete loading
        
        console.log('Analyzing deceased hostage transitions...');
        
        const results = await page.evaluate(() => {
            const app = window.app;
            const sortedData = app?.laneManager?.getSortedData() || [];
            const timeline = app?.timelineCore;
            
            // Get timeline boundaries
            const timelineStartX = timeline.dateToX(new Date('2023-10-07'));
            const timelineEndX = timeline.dateToX(new Date());
            
            // Find ALL deceased hostages with returned bodies
            const allDeceasedWithBodies = sortedData.filter(h => 
                h.finalLane?.includes('deceased') &&
                h.finalLane?.includes('released') &&
                h.releaseDate && h.releaseDate_valid
            );
            
            console.log(`Found ${allDeceasedWithBodies.length} deceased with returned bodies`);
            
            // Check each one's actual SVG path
            const pathAnalysis = allDeceasedWithBodies.map(hostage => {
                const name = hostage['Hebrew Name'];
                
                // Find SVG element
                const svgLine = Array.from(document.querySelectorAll('.hostage-line'))
                    .find(line => line.getAttribute('data-name') === name);
                
                if (!svgLine) {
                    return { name, error: 'SVG not found' };
                }
                
                // Get path data
                const pathData = svgLine.getAttribute('d');
                if (!pathData) {
                    return { name, error: 'No path data' };
                }
                
                // Extract coordinates - look for the very last coordinate pair
                const coordMatches = pathData.match(/[\d.-]+/g);
                if (!coordMatches || coordMatches.length < 2) {
                    return { name, error: 'Cannot parse coordinates' };
                }
                
                // Find the actual ending X coordinate
                let lastX = null;
                for (let i = coordMatches.length - 2; i >= 0; i -= 2) {
                    const x = parseFloat(coordMatches[i]);
                    if (!isNaN(x)) {
                        lastX = x;
                        break;
                    }
                }
                
                if (lastX === null) {
                    return { name, error: 'Cannot find last X coordinate' };
                }
                
                // Calculate expected release X
                const expectedReleaseX = timeline.dateToX(hostage.releaseDate);
                
                // Check if it's at timeline end vs release date
                const distanceFromEnd = Math.abs(lastX - timelineEndX);
                const distanceFromRelease = Math.abs(lastX - expectedReleaseX);
                
                const isAtTimelineEnd = distanceFromEnd < 10; // Within 10px of timeline end
                const isAtReleaseDate = distanceFromRelease < 10; // Within 10px of release date
                
                return {
                    name,
                    releaseDate: hostage.releaseDate.toISOString().split('T')[0],
                    expectedReleaseX: Math.round(expectedReleaseX),
                    actualLastX: Math.round(lastX),
                    distanceFromEnd: Math.round(distanceFromEnd),
                    distanceFromRelease: Math.round(distanceFromRelease),
                    isAtTimelineEnd,
                    isAtReleaseDate,
                    pathLength: pathData.length
                };
            });
            
            return {
                timelineEndX: Math.round(timelineEndX),
                timelineStartX: Math.round(timelineStartX),
                totalDeceased: allDeceasedWithBodies.length,
                pathAnalysis,
                // Also return some transition engine info
                transitionEngineExists: !!app?.transitionEngine,
                calculatePathSegmentsExists: !!(app?.transitionEngine?.calculatePathSegments)
            };
        });
        
        console.log('\n=== HARD REFRESH ANALYSIS ===');
        console.log(`Timeline: ${results.timelineStartX} → ${results.timelineEndX}`);
        console.log(`Total deceased with returned bodies: ${results.totalDeceased}`);
        console.log(`Transition engine exists: ${results.transitionEngineExists}`);
        console.log(`calculatePathSegments exists: ${results.calculatePathSegmentsExists}`);
        
        console.log('\n=== DECEASED TRANSITIONS ANALYSIS ===');
        
        let atTimelineEnd = 0;
        let atReleaseDate = 0;
        let errors = 0;
        
        // Show first 10 in detail, then summarize
        results.pathAnalysis.forEach((hostage, index) => {
            if (hostage.error) {
                errors++;
                if (index < 5) console.log(`❌ ${hostage.name}: ${hostage.error}`);
                return;
            }
            
            if (hostage.isAtTimelineEnd) {
                atTimelineEnd++;
                console.log(`\n❌ ${hostage.name}: AT TIMELINE END`);
                console.log(`   Release: ${hostage.releaseDate} (expected X=${hostage.expectedReleaseX})`);
                console.log(`   Actual last X: ${hostage.actualLastX}`);
                console.log(`   Distance from timeline end: ${hostage.distanceFromEnd}px`);
                console.log(`   Distance from release date: ${hostage.distanceFromRelease}px`);
            } else if (hostage.isAtReleaseDate) {
                atReleaseDate++;
                if (index < 3) { // Show first few correct ones
                    console.log(`\n✅ ${hostage.name}: AT RELEASE DATE`);
                    console.log(`   Release: ${hostage.releaseDate} (expected X=${hostage.expectedReleaseX})`);
                    console.log(`   Actual last X: ${hostage.actualLastX}`);
                }
            } else {
                console.log(`\n⚠️  ${hostage.name}: UNCLEAR POSITION`);
                console.log(`   Actual last X: ${hostage.actualLastX}`);
                console.log(`   Expected release X: ${hostage.expectedReleaseX}`);
                console.log(`   Distance from end: ${hostage.distanceFromEnd}px`);
                console.log(`   Distance from release: ${hostage.distanceFromRelease}px`);
            }
        });
        
        console.log('\n=== FINAL SUMMARY ===');
        console.log(`Errors: ${errors}`);
        console.log(`At timeline end: ${atTimelineEnd}`);
        console.log(`At release date: ${atReleaseDate}`);
        console.log(`Other positions: ${results.totalDeceased - errors - atTimelineEnd - atReleaseDate}`);
        
        if (atTimelineEnd > 0) {
            console.log('\n🎯 CONFIRMED ISSUE:');
            console.log(`${atTimelineEnd} deceased hostages are ending at timeline end instead of release date`);
            console.log('This confirms the user\'s report is accurate');
            console.log('The fix may not be working or may not be applied to all code paths');
        } else {
            console.log('\n✅ No issues found - all transitions at correct dates');
        }
        
        return results;
        
    } catch (error) {
        console.error('Hard refresh debug failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

hardRefreshDebug();