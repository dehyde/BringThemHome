/**
 * Debug with cache busting and real visual inspection
 */

const puppeteer = require('puppeteer');

async function debugWithCacheBusting() {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--disable-cache', '--disable-application-cache', '--disable-offline-load-stale-cache', '--disable-gpu-sandbox']
    });
    const page = await browser.newPage();
    
    try {
        // Disable all caching
        await page.setCacheEnabled(false);
        
        console.log('Loading with cache disabled and hard refresh...');
        
        // Add a cache buster parameter
        const cacheBuster = Date.now();
        await page.goto(`http://127.0.0.1:3000/hostage-timeline-viz/index.html?v=${cacheBuster}`, { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        // Wait longer for everything to load
        await page.waitForTimeout(10000);
        
        // Check if JavaScript files are loading properly
        const results = await page.evaluate(() => {
            const app = window.app;
            
            // Check what version of transition-engine we're getting
            const transitionEngine = app?.transitionEngine;
            let transitionEngineSource = 'unknown';
            
            if (transitionEngine && transitionEngine.generateTransitionPath) {
                // Try to get some indication of which version we're running
                const testHostage = app?.laneManager?.getSortedData()?.[0];
                if (testHostage) {
                    try {
                        const testPath = transitionEngine.generateTransitionPath(testHostage);
                        transitionEngineSource = testPath ? 'working' : 'not working';
                    } catch (e) {
                        transitionEngineSource = `error: ${e.message}`;
                    }
                }
            }
            
            // Get some specific examples of problematic green lines
            const sortedData = app?.laneManager?.getSortedData() || [];
            const timeline = app?.timelineCore;
            
            // Look specifically for the types of lines the user described
            const greenLinesFromKidnapped = sortedData.filter(h => 
                h.hasTransition &&
                h.initialLane?.includes('kidnapped') &&
                h.finalLane?.includes('released')
            );
            
            console.log(`Found ${greenLinesFromKidnapped.length} green lines transitioning from kidnapped to released`);
            
            // Analyze specific examples that should show the loop issue
            const detailedAnalysis = greenLinesFromKidnapped.slice(0, 3).map(hostage => {
                const name = hostage['Hebrew Name'];
                const svgLine = Array.from(document.querySelectorAll('.hostage-line'))
                    .find(line => line.getAttribute('data-name') === name);
                
                if (!svgLine) return { name, error: 'SVG not found' };
                
                const pathData = svgLine.getAttribute('d');
                if (!pathData) return { name, error: 'No path data' };
                
                // Get the raw path for inspection
                const rawPath = pathData.substring(0, 200);
                
                // Parse coordinates to look for the specific pattern the user described
                const coordPattern = /[\d.-]+/g;
                const coords = pathData.match(coordPattern)?.map(n => parseFloat(n)) || [];
                
                // Look for the pattern: coordinates that go right (decrease in RTL), then left (increase), then right again
                const xCoords = [];
                for (let i = 0; i < coords.length; i += 2) {
                    if (!isNaN(coords[i])) {
                        xCoords.push(Math.round(coords[i]));
                    }
                }
                
                // Check for the specific pattern user described
                let hasUserDescribedPattern = false;
                let patternDescription = '';
                
                for (let i = 0; i < xCoords.length - 2; i++) {
                    const curr = xCoords[i];
                    const next = xCoords[i + 1];
                    const after = xCoords[i + 2];
                    
                    // Look for: goes right (decreases), then left beyond edge, then back right
                    if (curr > next && next < after && Math.abs(after - next) > 10) {
                        hasUserDescribedPattern = true;
                        patternDescription = `X: ${curr} → ${next} → ${after} (goes right, left, right)`;
                        break;
                    }
                }
                
                return {
                    name,
                    initialLane: hostage.initialLane,
                    finalLane: hostage.finalLane,
                    pathLength: pathData.length,
                    rawPath,
                    xCoords,
                    hasUserDescribedPattern,
                    patternDescription,
                    color: svgLine.style.stroke || 'unknown'
                };
            });
            
            return {
                appExists: !!app,
                transitionEngineExists: !!transitionEngine,
                transitionEngineSource,
                dataLoaded: sortedData.length,
                greenTransitionsCount: greenLinesFromKidnapped.length,
                detailedAnalysis,
                cacheBuster: new URLSearchParams(window.location.search).get('v'),
                timestamp: new Date().toISOString()
            };
        });
        
        console.log('\n=== CACHE-BUSTED DEBUG ===');
        console.log(`Cache buster: ${results.cacheBuster}`);
        console.log(`Timestamp: ${results.timestamp}`);
        console.log(`App exists: ${results.appExists}`);
        console.log(`Transition engine exists: ${results.transitionEngineExists}`);
        console.log(`Transition engine status: ${results.transitionEngineSource}`);
        console.log(`Data loaded: ${results.dataLoaded} records`);
        console.log(`Green transitions: ${results.greenTransitionsCount}`);
        
        console.log('\n=== DETAILED PATH INSPECTION ===');
        results.detailedAnalysis.forEach(analysis => {
            if (analysis.error) {
                console.log(`❌ ${analysis.name}: ${analysis.error}`);
                return;
            }
            
            const status = analysis.hasUserDescribedPattern ? '🔴 PROBLEM DETECTED' : '✅ LOOKS OK';
            console.log(`\n${status} - ${analysis.name}:`);
            console.log(`   Lane: ${analysis.initialLane} → ${analysis.finalLane}`);
            console.log(`   Color: ${analysis.color}`);
            console.log(`   Path length: ${analysis.pathLength} chars`);
            console.log(`   X coordinates: [${analysis.xCoords.join(', ')}]`);
            
            if (analysis.hasUserDescribedPattern) {
                console.log(`   🔴 USER'S PATTERN DETECTED: ${analysis.patternDescription}`);
                console.log(`   Raw path preview: ${analysis.rawPath}...`);
            }
        });
        
        const problemCount = results.detailedAnalysis.filter(a => a.hasUserDescribedPattern).length;
        
        console.log('\n=== FINAL DIAGNOSIS ===');
        if (problemCount > 0) {
            console.log(`🎯 CONFIRMED: ${problemCount} paths show the user's described pattern`);
            console.log('   The looping issue is still present despite our fixes');
            console.log('   This suggests either:');
            console.log('   1. The fixes are not being served by the 127.0.0.1:3000 server');
            console.log('   2. There\'s a different code path causing the issue');
            console.log('   3. The problem is in a different part of the rendering pipeline');
        } else {
            console.log('🤔 MYSTERIOUS: No obvious loops detected, but user still sees them');
            console.log('   This could be:');
            console.log('   1. A visual perception issue');
            console.log('   2. Browser-specific rendering differences');
            console.log('   3. The issue appears only under certain conditions');
        }
        
        return results;
        
    } catch (error) {
        console.error('Cache buster debug failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

debugWithCacheBusting();