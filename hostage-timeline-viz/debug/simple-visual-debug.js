/**
 * Simple debug for visual transition issues
 */

const puppeteer = require('puppeteer');

async function simpleVisualDebug() {
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
            
            // Find a specific deceased hostage with returned body
            const testHostage = sortedData.find(h => 
                h['Hebrew Name'] === 'מיה גורן' ||
                (h.hasTransition && 
                 h.finalLane?.includes('deceased') &&
                 h.releaseDate && h.releaseDate_valid)
            );
            
            if (!testHostage) {
                return { error: 'No test hostage found' };
            }
            
            const name = testHostage['Hebrew Name'];
            const path = testHostage.path;
            
            // Find SVG line
            const hostageLines = Array.from(document.querySelectorAll('.hostage-line'));
            const svgLine = hostageLines.find(line => {
                const nameAttr = line.getAttribute('data-name');
                return nameAttr === name;
            });
            
            const timelineStart = timeline.dateToX(new Date('2023-10-07'));
            const timelineEnd = timeline.dateToX(new Date());
            
            let pathAnalysis = null;
            if (svgLine) {
                const pathData = svgLine.getAttribute('d');
                const coords = pathData ? pathData.match(/[\d.]+/g)?.map(n => parseFloat(n)) : [];
                
                pathAnalysis = {
                    found: true,
                    pathLength: pathData?.length || 0,
                    coordinates: coords?.length || 0,
                    firstX: coords?.[0] || null,
                    lastX: coords?.[coords.length - 2] || null, // X coord of last point
                    startsAtTimelineStart: coords?.[0] ? Math.abs(coords[0] - timelineStart) < 10 : null,
                    endsAtTimelineEnd: coords?.length >= 2 ? Math.abs(coords[coords.length - 2] - timelineEnd) < 10 : null
                };
            } else {
                pathAnalysis = { found: false };
            }
            
            return {
                hostage: {
                    name,
                    status: testHostage['Current Status'],
                    finalLane: testHostage.finalLane,
                    pathEvents: path ? path.length : 0,
                    releaseDate: testHostage.releaseDate ? testHostage.releaseDate.toISOString().split('T')[0] : null,
                    deathDate: testHostage.deathDate ? testHostage.deathDate.toISOString().split('T')[0] : null
                },
                timeline: {
                    startX: Math.round(timelineStart),
                    endX: Math.round(timelineEnd),
                    width: Math.round(timelineEnd - timelineStart)
                },
                svg: pathAnalysis,
                totalLines: hostageLines.length,
                releaseCoordinate: testHostage.releaseDate ? Math.round(timeline.dateToX(testHostage.releaseDate)) : null
            };
        });
        
        console.log('\n=== SIMPLE VISUAL DEBUG ===');
        console.log('\nTest Hostage:', results.hostage.name);
        console.log('Status:', results.hostage.status);
        console.log('Final Lane:', results.hostage.finalLane);
        console.log('Path Events:', results.hostage.pathEvents);
        console.log('Death Date:', results.hostage.deathDate);
        console.log('Release Date:', results.hostage.releaseDate);
        
        console.log('\nTimeline Info:');
        console.log('Start X:', results.timeline.startX);
        console.log('End X:', results.timeline.endX);
        console.log('Width:', results.timeline.width);
        console.log('Release X should be:', results.releaseCoordinate);
        
        console.log('\nSVG Analysis:');
        console.log('SVG Line Found:', results.svg.found);
        if (results.svg.found) {
            console.log('Path Length:', results.svg.pathLength);
            console.log('Coordinates Count:', results.svg.coordinates);
            console.log('First X:', results.svg.firstX);
            console.log('Last X:', results.svg.lastX);
            console.log('Starts at timeline start:', results.svg.startsAtTimelineStart);
            console.log('Ends at timeline end:', results.svg.endsAtTimelineEnd);
            
            // Check the key issue
            if (results.svg.endsAtTimelineEnd) {
                console.log('\n❌ ISSUE CONFIRMED: Line extends to timeline end');
                console.log(`   Expected release at X=${results.releaseCoordinate}, but line goes to X=${results.svg.lastX}`);
                console.log('   This suggests transition is not happening at the correct date');
            }
        }
        
        console.log('\nTotal hostage lines found:', results.totalLines);
        
        return results;
        
    } catch (error) {
        console.error('Simple visual debug failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

simpleVisualDebug();