/**
 * Specific debug for transition extension issue
 */

const puppeteer = require('puppeteer');

async function debugTransitionExtension() {
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
            const transitionEngine = app?.transitionEngine;
            
            // Find a deceased hostage with returned body
            const testHostage = sortedData.find(h => 
                h['Hebrew Name'] === 'מיה גורן' &&
                h.hasTransition && 
                h.finalLane?.includes('deceased') &&
                h.releaseDate && h.releaseDate_valid
            );
            
            if (!testHostage) {
                return { error: 'Test hostage not found' };
            }
            
            // Analyze the path generation step by step
            const pathAnalysis = {
                name: testHostage['Hebrew Name'],
                status: testHostage['Current Status'],
                finalLane: testHostage.finalLane,
                initialLane: testHostage.initialLane,
                hasTransition: testHostage.hasTransition,
                pathLength: testHostage.path?.length || 0,
                pathEvents: testHostage.path ? testHostage.path.map(p => ({
                    lane: p.lane,
                    date: p.date.toISOString().split('T')[0],
                    event: p.event,
                    x: Math.round(timeline.dateToX(p.date))
                })) : []
            };
            
            // Check what the transition engine generates
            let generatedPath = null;
            let pathSegments = null;
            
            try {
                generatedPath = transitionEngine.generateTransitionPath(testHostage);
                
                // Also get the segments for analysis
                pathSegments = transitionEngine.calculatePathSegments(testHostage);
                
            } catch (error) {
                pathAnalysis.generationError = error.message;
            }
            
            // Timeline boundaries
            const timelineStart = timeline.dateToX(new Date('2023-10-07'));
            const timelineEnd = timeline.dateToX(new Date());
            const releaseX = testHostage.releaseDate ? timeline.dateToX(testHostage.releaseDate) : null;
            
            return {
                hostageAnalysis: pathAnalysis,
                generatedPath: generatedPath ? generatedPath.substring(0, 200) + '...' : null,
                pathSegments: pathSegments ? pathSegments.map(seg => ({
                    isTransition: seg.isTransition,
                    startX: Math.round(seg.startX),
                    startY: Math.round(seg.startY),
                    endX: Math.round(seg.endX),
                    endY: Math.round(seg.endY),
                    lane: seg.lane || seg.toLane
                })) : null,
                timeline: {
                    startX: Math.round(timelineStart),
                    endX: Math.round(timelineEnd),
                    releaseX: releaseX ? Math.round(releaseX) : null,
                    width: Math.round(timelineStart - timelineEnd) // Should be positive for RTL
                },
                rtlCheck: {
                    oct7X: Math.round(timelineStart),
                    todayX: Math.round(timelineEnd),
                    releaseX: releaseX ? Math.round(releaseX) : null,
                    isRTLCorrect: timelineStart > timelineEnd
                }
            };
        });
        
        console.log('\n=== TRANSITION EXTENSION DEBUG ===');
        
        if (results.error) {
            console.log('❌ Error:', results.error);
            return;
        }
        
        console.log('\n=== HOSTAGE ANALYSIS ===');
        const h = results.hostageAnalysis;
        console.log(`Name: ${h.name}`);
        console.log(`Status: ${h.status}`);
        console.log(`Initial Lane: ${h.initialLane}`);
        console.log(`Final Lane: ${h.finalLane}`);
        console.log(`Has Transition: ${h.hasTransition}`);
        console.log(`Path Events: ${h.pathLength}`);
        
        console.log('\nPath Events with X coordinates:');
        h.pathEvents.forEach((event, i) => {
            console.log(`  ${i}: ${event.event} → ${event.lane} (${event.date}) at X=${event.x}`);
        });
        
        console.log('\n=== TIMELINE COORDINATES ===');
        const t = results.timeline;
        console.log(`Oct 7 (start): X=${t.startX}`);
        console.log(`Today (end): X=${t.endX}`);
        console.log(`Release Date: X=${t.releaseX}`);
        console.log(`Timeline Width: ${t.width}`);
        
        console.log('\n=== RTL CHECK ===');
        const rtl = results.rtlCheck;
        console.log(`RTL Correct: ${rtl.isRTLCorrect} (${rtl.oct7X} > ${rtl.todayX})`);
        console.log(`Expected order: Oct7(${rtl.oct7X}) > Release(${rtl.releaseX}) > Today(${rtl.todayX})`);
        
        console.log('\n=== PATH SEGMENTS ===');
        if (results.pathSegments) {
            results.pathSegments.forEach((seg, i) => {
                const type = seg.isTransition ? 'TRANSITION' : 'HORIZONTAL';
                console.log(`  ${i}: ${type} from X=${seg.startX},Y=${seg.startY} to X=${seg.endX},Y=${seg.endY} (${seg.lane || 'unknown'})`);
                
                // Check if this segment extends to timeline end
                if (!seg.isTransition && Math.abs(seg.endX - t.endX) < 10) {
                    console.log(`    ❌ ISSUE: This horizontal segment extends to timeline end instead of stopping at transition`);
                }
            });
        }
        
        console.log('\n=== ROOT CAUSE ANALYSIS ===');
        
        // Key issue: Find horizontal segments that extend to timeline end
        const extendingSegments = results.pathSegments?.filter(seg => 
            !seg.isTransition && Math.abs(seg.endX - t.endX) < 10
        ) || [];
        
        if (extendingSegments.length > 0) {
            console.log(`🎯 FOUND ISSUE: ${extendingSegments.length} segments extend to timeline end`);
            console.log('Expected behavior: Lines should end at the transition date, not timeline end');
            console.log('Location: transition-engine.js calculatePathSegments() - horizontal segment calculation');
            console.log(`Problem likely in final segment endX calculation (should be ${t.releaseX}, not ${t.endX})`);
        } else {
            console.log('✅ No segments extending to timeline end found');
        }
        
        console.log('\n=== GENERATED PATH PREVIEW ===');
        console.log(results.generatedPath || 'No path generated');
        
        return results;
        
    } catch (error) {
        console.error('Transition extension debug failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

debugTransitionExtension();