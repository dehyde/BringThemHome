/**
 * Comprehensive validation of deceased hostage transitions
 * Focus on deceased-in-captivity → released transitions
 */

const puppeteer = require('puppeteer');

async function validateTransitions() {
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
            
            // Find ALL deceased hostages with returned bodies (the problem cases)
            const deceasedWithBodies = sortedData.filter(h => 
                h.hasTransition && 
                h.finalLane?.includes('released') &&
                h.finalLane?.includes('deceased') &&
                h.releaseDate && h.releaseDate_valid
            );
            
            console.log(`Found ${deceasedWithBodies.length} deceased hostages with returned bodies`);
            
            // Timeline boundaries
            const timelineStartX = timeline.dateToX(new Date('2023-10-07'));
            const timelineEndX = timeline.dateToX(new Date());
            const timelineWidth = Math.abs(timelineStartX - timelineEndX);
            
            // Analyze each one
            const analysis = deceasedWithBodies.map(hostage => {
                const name = hostage['Hebrew Name'];
                
                // Get expected coordinates
                const kidnappedX = timeline.dateToX(hostage.kidnappedDate);
                const deathX = hostage.deathDate ? timeline.dateToX(hostage.deathDate) : null;
                const releaseX = timeline.dateToX(hostage.releaseDate);
                
                // Find the actual SVG line
                const svgLine = Array.from(document.querySelectorAll('.hostage-line'))
                    .find(line => line.getAttribute('data-name') === name);
                
                let actualAnalysis = null;
                if (svgLine) {
                    const pathData = svgLine.getAttribute('d');
                    
                    // Extract all X coordinates from the path
                    const coords = pathData.match(/[\d.]+/g)?.map(n => parseFloat(n)) || [];
                    const xCoords = [];
                    for (let i = 0; i < coords.length; i += 2) {
                        if (coords[i] !== undefined) {
                            xCoords.push(coords[i]);
                        }
                    }
                    
                    const firstX = xCoords[0];
                    const lastX = xCoords[xCoords.length - 1];
                    
                    // Check if transition happens at timeline end
                    const transitionAtEnd = Math.abs(lastX - timelineEndX) < 20; // 20px tolerance
                    const transitionAtRelease = Math.abs(lastX - releaseX) < 20;
                    
                    actualAnalysis = {
                        pathFound: true,
                        pathLength: pathData.length,
                        firstX: Math.round(firstX),
                        lastX: Math.round(lastX),
                        xCoordCount: xCoords.length,
                        transitionAtEnd,
                        transitionAtRelease,
                        transitionDistance: Math.abs(lastX - releaseX)
                    };
                } else {
                    actualAnalysis = { pathFound: false };
                }
                
                return {
                    name,
                    status: hostage['Current Status'],
                    initialLane: hostage.initialLane,
                    finalLane: hostage.finalLane,
                    dates: {
                        kidnapped: hostage.kidnappedDate.toISOString().split('T')[0],
                        death: hostage.deathDate ? hostage.deathDate.toISOString().split('T')[0] : null,
                        release: hostage.releaseDate.toISOString().split('T')[0]
                    },
                    expectedCoords: {
                        kidnappedX: Math.round(kidnappedX),
                        deathX: deathX ? Math.round(deathX) : null,
                        releaseX: Math.round(releaseX)
                    },
                    pathEvents: hostage.path ? hostage.path.length : 0,
                    actualAnalysis
                };
            });
            
            return {
                timelineBounds: {
                    startX: Math.round(timelineStartX),
                    endX: Math.round(timelineEndX),
                    width: Math.round(timelineWidth)
                },
                totalDeceasedWithBodies: deceasedWithBodies.length,
                analysis: analysis // All hostages for complete analysis
            };
        });
        
        console.log('\n=== COMPREHENSIVE DECEASED TRANSITION VALIDATION ===');
        console.log('\n=== TIMELINE INFO ===');
        console.log(`Timeline Start (Oct 7): X=${results.timelineBounds.startX}`);
        console.log(`Timeline End (Today): X=${results.timelineBounds.endX}`);
        console.log(`Timeline Width: ${results.timelineBounds.width}`);
        
        console.log(`\n=== ANALYSIS OF ${results.totalDeceasedWithBodies} DECEASED WITH RETURNED BODIES ===`);
        
        let transitionsAtEnd = 0;
        let transitionsAtRelease = 0;
        let pathsNotFound = 0;
        
        results.analysis.forEach((hostage, index) => {
            // Only show details for first 5 and any that fail, to avoid too much output
            const showDetails = index < 5 || hostage.actualAnalysis.transitionAtEnd;
            
            // Count statistics for all hostages
            if (!hostage.actualAnalysis.pathFound) {
                pathsNotFound++;
            } else if (hostage.actualAnalysis.transitionAtEnd) {
                transitionsAtEnd++;
            } else if (hostage.actualAnalysis.transitionAtRelease) {
                transitionsAtRelease++;
            }
            
            if (!showDetails) return;
            console.log(`\n🔍 ${hostage.name}:`);
            console.log(`   Status: ${hostage.status}`);
            console.log(`   Lane Path: ${hostage.initialLane} → ${hostage.finalLane}`);
            console.log(`   Dates: Death=${hostage.dates.death}, Release=${hostage.dates.release}`);
            console.log(`   Expected X: Kidnapped=${hostage.expectedCoords.kidnappedX}, Death=${hostage.expectedCoords.deathX}, Release=${hostage.expectedCoords.releaseX}`);
            
            if (showDetails) {
                if (!hostage.actualAnalysis.pathFound) {
                    console.log(`   ❌ SVG PATH NOT FOUND`);
                } else {
                    const actual = hostage.actualAnalysis;
                    console.log(`   Actual X: First=${actual.firstX}, Last=${actual.lastX}`);
                    console.log(`   Path: ${actual.pathLength} chars, ${actual.xCoordCount} X coords`);
                    console.log(`   Distance from release X: ${actual.transitionDistance}px`);
                    
                    if (actual.transitionAtEnd) {
                        console.log(`   ❌ ISSUE: Transition at timeline END (should be at release date)`);
                    } else if (actual.transitionAtRelease) {
                        console.log(`   ✅ CORRECT: Transition at release date`);
                    } else {
                        console.log(`   ⚠️  UNCLEAR: Transition neither at end nor at release`);
                    }
                }
            } else {
                // For non-detailed entries, just show if there's a problem
                if (hostage.actualAnalysis.transitionAtEnd) {
                    console.log(`\n❌ ${hostage.name}: Transition at timeline END (should be at release)`);
                }
            }
        });
        
        console.log('\n=== VALIDATION SUMMARY ===');
        console.log(`Total deceased with returned bodies: ${results.totalDeceasedWithBodies}`);
        console.log(`Paths not found: ${pathsNotFound}`);
        console.log(`Transitions at timeline end: ${transitionsAtEnd}`);
        console.log(`Transitions at correct release date: ${transitionsAtRelease}`);
        console.log(`Other/unclear: ${results.analysis.length - pathsNotFound - transitionsAtEnd - transitionsAtRelease}`);
        
        if (transitionsAtEnd > 0) {
            console.log('\n🎯 VALIDATION FAILED:');
            console.log(`   ${transitionsAtEnd} deceased hostages still transition at timeline end`);
            console.log('   The fix did not work as expected');
            console.log('   Lines should end at release date, not timeline end');
            
            // Suggest debugging steps
            console.log('\n🔧 DEBUGGING NEEDED:');
            console.log('   1. Check if calculatePathSegments() logic is actually being used');
            console.log('   2. Verify hostage.transitionEvent.date matches releaseDate');
            console.log('   3. Check if there are multiple path generation code paths');
            console.log('   4. Verify the SVG paths are being regenerated after code changes');
        } else {
            console.log('\n✅ VALIDATION PASSED:');
            console.log(`   All ${transitionsAtRelease} deceased hostages transition at correct release dates`);
        }
        
        return results;
        
    } catch (error) {
        console.error('Transition validation failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

validateTransitions();