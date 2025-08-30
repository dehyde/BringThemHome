/**
 * Debug why transitions still appear at timeline end instead of release dates
 */

const puppeteer = require('puppeteer');

async function debugTransitionTiming() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        await page.goto('http://127.0.0.1:3000/', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        await page.waitForTimeout(8000);
        
        const results = await page.evaluate(() => {
            const app = window.app;
            const sortedData = app?.laneManager?.getSortedData() || [];
            const timeline = app?.timelineCore;
            
            const timelineEndX = timeline.dateToX(new Date());
            const timelineStartX = timeline.dateToX(new Date('2023-10-07'));
            
            // Find deceased hostages with returned bodies to check their transition timing
            const deceasedWithBodies = sortedData.filter(h => 
                h.hasTransition &&
                h.finalLane?.includes('deceased') &&
                h.finalLane?.includes('released') &&
                h.releaseDate && h.releaseDate_valid
            ).slice(0, 5);
            
            console.log(`Analyzing ${deceasedWithBodies.length} deceased hostages with returned bodies`);
            
            const timingAnalysis = deceasedWithBodies.map(hostage => {
                const name = hostage['Hebrew Name'];
                
                // Get all the relevant dates
                const kidnappedDate = hostage.kidnappedDate;
                const deathDate = hostage.deathDate;
                const releaseDate = hostage.releaseDate;
                const transitionEvent = hostage.transitionEvent;
                
                // Calculate X coordinates for these dates
                const kidnappedX = timeline.dateToX(kidnappedDate);
                const deathX = deathDate ? timeline.dateToX(deathDate) : null;
                const releaseX = timeline.dateToX(releaseDate);
                const transitionX = transitionEvent ? timeline.dateToX(transitionEvent.date) : null;
                
                // Find the actual SVG path to see where the transition visually appears
                const svgLine = Array.from(document.querySelectorAll('.hostage-line'))
                    .find(line => line.getAttribute('data-name') === name);
                
                let visualTransitionX = null;
                if (svgLine) {
                    const pathData = svgLine.getAttribute('d');
                    if (pathData) {
                        // Parse the path to find the vertical line (transition point)
                        const commands = pathData.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/g) || [];
                        
                        // Look for L commands that represent the transition
                        const lineCommands = commands.filter(cmd => cmd.startsWith('L')).map(cmd => {
                            const coords = cmd.slice(1).trim().split(/[\s,]+/).map(n => parseFloat(n));
                            return { x: coords[0], y: coords[1] };
                        });
                        
                        // The transition should be where we have a significant Y change
                        for (let i = 0; i < lineCommands.length - 1; i++) {
                            const curr = lineCommands[i];
                            const next = lineCommands[i + 1];
                            
                            if (curr && next && Math.abs(curr.y - next.y) > 100) {
                                visualTransitionX = curr.x;
                                break;
                            }
                        }
                    }
                }
                
                // Check if the visual transition is at the timeline end
                const visualAtEnd = visualTransitionX ? Math.abs(visualTransitionX - timelineEndX) < 20 : false;
                const transitionAtEnd = transitionX ? Math.abs(transitionX - timelineEndX) < 20 : false;
                
                return {
                    name,
                    status: hostage['Current Status'],
                    dates: {
                        kidnapped: kidnappedDate.toISOString().split('T')[0],
                        death: deathDate ? deathDate.toISOString().split('T')[0] : null,
                        release: releaseDate.toISOString().split('T')[0],
                        transitionEventDate: transitionEvent ? transitionEvent.date.toISOString().split('T')[0] : null,
                        transitionEventType: transitionEvent ? transitionEvent.type : null
                    },
                    coordinates: {
                        kidnappedX: Math.round(kidnappedX),
                        deathX: deathX ? Math.round(deathX) : null,
                        releaseX: Math.round(releaseX),
                        transitionX: transitionX ? Math.round(transitionX) : null,
                        visualTransitionX: visualTransitionX ? Math.round(visualTransitionX) : null,
                        timelineEndX: Math.round(timelineEndX)
                    },
                    analysis: {
                        transitionAtEnd,
                        visualAtEnd,
                        transitionMatchesRelease: transitionX ? Math.abs(transitionX - releaseX) < 5 : false,
                        visualMatchesRelease: visualTransitionX ? Math.abs(visualTransitionX - releaseX) < 5 : false,
                        transitionMatchesVisual: (transitionX && visualTransitionX) ? Math.abs(transitionX - visualTransitionX) < 5 : false
                    },
                    pathEvents: hostage.path ? hostage.path.map(p => ({
                        lane: p.lane,
                        date: p.date.toISOString().split('T')[0],
                        event: p.event
                    })) : []
                };
            });
            
            return {
                timelineEndX: Math.round(timelineEndX),
                timelineStartX: Math.round(timelineStartX),
                currentDate: new Date().toISOString().split('T')[0],
                analysisCount: timingAnalysis.length,
                timingAnalysis
            };
        });
        
        console.log('\n=== TRANSITION TIMING DEBUG ===');
        console.log(`Current date: ${results.currentDate}`);
        console.log(`Timeline: ${results.timelineStartX} (Oct 7) → ${results.timelineEndX} (Today)`);
        console.log(`Analyzing ${results.analysisCount} deceased hostages with returned bodies`);
        
        console.log('\n=== DETAILED TIMING ANALYSIS ===');
        
        let transitionsAtEnd = 0;
        let visualTransitionsAtEnd = 0;
        let correctTransitions = 0;
        
        results.timingAnalysis.forEach(hostage => {
            console.log(`\n📍 ${hostage.name}:`);
            console.log(`   Status: ${hostage.status}`);
            console.log(`   Dates:`);
            console.log(`     Kidnapped: ${hostage.dates.kidnapped}`);
            console.log(`     Death: ${hostage.dates.death}`);
            console.log(`     Release: ${hostage.dates.release}`);
            console.log(`     Transition event: ${hostage.dates.transitionEventType} on ${hostage.dates.transitionEventDate}`);
            
            console.log(`   Coordinates:`);
            console.log(`     Release should be at: X=${hostage.coordinates.releaseX}`);
            console.log(`     Transition data says: X=${hostage.coordinates.transitionX}`);
            console.log(`     Visual transition at: X=${hostage.coordinates.visualTransitionX}`);
            console.log(`     Timeline ends at: X=${hostage.coordinates.timelineEndX}`);
            
            const analysis = hostage.analysis;
            
            if (analysis.transitionAtEnd) {
                console.log(`   ❌ TRANSITION DATA AT END: Transition calculated at timeline end`);
                transitionsAtEnd++;
            }
            
            if (analysis.visualAtEnd) {
                console.log(`   ❌ VISUAL AT END: Line visually transitions at timeline end`);
                visualTransitionsAtEnd++;
            }
            
            if (analysis.transitionMatchesRelease && analysis.visualMatchesRelease) {
                console.log(`   ✅ CORRECT: Both data and visual match release date`);
                correctTransitions++;
            } else if (analysis.transitionMatchesRelease) {
                console.log(`   ⚠️  DATA CORRECT, VISUAL WRONG: Data matches release but visual doesn't`);
            } else if (analysis.visualMatchesRelease) {
                console.log(`   ⚠️  VISUAL CORRECT, DATA WRONG: Visual matches release but data doesn't`);
            } else {
                console.log(`   ❌ BOTH WRONG: Neither data nor visual match release date`);
            }
            
            console.log(`   Path events:`);
            hostage.pathEvents.forEach((event, i) => {
                console.log(`     ${i}: ${event.event} → ${event.lane} (${event.date})`);
            });
        });
        
        console.log('\n=== SUMMARY ===');
        console.log(`Transitions at timeline end (data): ${transitionsAtEnd}`);
        console.log(`Visual transitions at timeline end: ${visualTransitionsAtEnd}`);  
        console.log(`Correct transitions: ${correctTransitions}`);
        
        if (transitionsAtEnd > 0 || visualTransitionsAtEnd > 0) {
            console.log('\n🎯 ROOT CAUSE IDENTIFIED:');
            if (transitionsAtEnd > 0) {
                console.log(`   ${transitionsAtEnd} transitions have data pointing to timeline end`);
                console.log('   Issue: transitionEvent.date is not set to releaseDate');
                console.log('   Location: data-processor.js calculateEventOrder()');
            }
            if (visualTransitionsAtEnd > 0) {
                console.log(`   ${visualTransitionsAtEnd} transitions visually appear at timeline end`);
                console.log('   Issue: SVG generation using wrong X coordinate');
                console.log('   Location: transition-engine.js addTransitionSegment()');
            }
        }
        
        return results;
        
    } catch (error) {
        console.error('Transition timing debug failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

debugTransitionTiming();