/**
 * Debug deceased hostage transition events
 * Check what transition dates are being used for deceased hostages
 */

const puppeteer = require('puppeteer');

async function debugDeceasedTransitions() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        await page.goto('http://localhost:8080/', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        await page.waitForTimeout(8000);
        
        const deceasedAnalysis = await page.evaluate(() => {
            const app = window.app;
            const sortedData = app?.laneManager?.getSortedData() || [];
            
            // Find all deceased hostages (both with and without transitions)
            const allDeceased = sortedData.filter(h => h.finalLane?.includes('deceased'));
            const deceasedWithTransitions = allDeceased.filter(h => h.hasTransition && h.path?.length > 1);
            const deceasedWithoutTransitions = allDeceased.filter(h => !h.hasTransition || h.path?.length <= 1);
            
            const analysis = deceasedWithTransitions.slice(0, 10).map(hostage => {
                const name = hostage['Hebrew Name'];
                const status = hostage['Current Status'];
                const finalLane = hostage.finalLane;
                
                // Get all available date fields
                const dates = {
                    kidnappedDate: hostage.kidnappedDate ? hostage.kidnappedDate.toISOString().split('T')[0] : null,
                    deathDate: hostage.deathDate ? hostage.deathDate.toISOString().split('T')[0] : null,
                    releaseDate: hostage.releaseDate ? hostage.releaseDate.toISOString().split('T')[0] : null,
                };
                
                // Get transition event details
                const transitionEvent = hostage.transitionEvent;
                const transitionDate = transitionEvent ? transitionEvent.date.toISOString().split('T')[0] : null;
                const transitionType = transitionEvent ? transitionEvent.type : null;
                
                // Get path details
                const pathEvents = hostage.path ? hostage.path.map(p => ({
                    lane: p.lane,
                    date: p.date.toISOString().split('T')[0],
                    event: p.event
                })) : [];
                
                // Determine expected transition date based on user requirement:
                // "That transition should happen on the date of the body release"
                let expectedTransitionDate;
                if (dates.releaseDate) {
                    // If body was returned, transition should be on release date
                    expectedTransitionDate = dates.releaseDate;
                } else {
                    // If body was not returned, transition should be on death date
                    expectedTransitionDate = dates.deathDate;
                }
                
                return {
                    name,
                    status,
                    finalLane,
                    dates,
                    transitionEvent: {
                        type: transitionType,
                        date: transitionDate
                    },
                    pathEvents,
                    expectedTransitionDate: expectedTransitionDate,
                    isTransitionDateCorrect: transitionDate === expectedTransitionDate,
                    hasReleaseDate: !!dates.releaseDate
                };
            });
            
            // Also analyze deceased without transitions (still in captivity)
            const noTransitionAnalysis = deceasedWithoutTransitions.slice(0, 5).map(hostage => {
                const name = hostage['Hebrew Name'];
                const status = hostage['Current Status'];
                const finalLane = hostage.finalLane;
                
                return {
                    name,
                    status, 
                    finalLane,
                    hasTransition: hostage.hasTransition,
                    pathLength: hostage.path ? hostage.path.length : 0
                };
            });

            return {
                totalDeceased: allDeceased.length,
                withTransitions: deceasedWithTransitions.length,
                withoutTransitions: deceasedWithoutTransitions.length,
                analysis,
                noTransitionAnalysis,
                summary: {
                    correctTransitions: analysis.filter(a => a.isTransitionDateCorrect).length,
                    incorrectTransitions: analysis.filter(a => !a.isTransitionDateCorrect).length
                }
            };
        });
        
        console.log('\n=== DECEASED HOSTAGE TRANSITION DEBUG ===');
        console.log(`Total deceased hostages: ${deceasedAnalysis.totalDeceased}`);
        console.log(`With transitions: ${deceasedAnalysis.withTransitions}`);
        console.log(`Without transitions (still in captivity): ${deceasedAnalysis.withoutTransitions}`);
        console.log(`Correct transition dates: ${deceasedAnalysis.summary.correctTransitions}`);
        console.log(`Incorrect transition dates: ${deceasedAnalysis.summary.incorrectTransitions}`);
        
        console.log('\n=== INDIVIDUAL ANALYSIS ===');
        deceasedAnalysis.analysis.forEach(hostage => {
            const status = hostage.isTransitionDateCorrect ? '✅' : '❌';
            console.log(`\n${status} ${hostage.name}:`);
            console.log(`   Status: ${hostage.status}`);
            console.log(`   Final Lane: ${hostage.finalLane}`);
            console.log(`   Kidnapped: ${hostage.dates.kidnappedDate}`);
            console.log(`   Death Date: ${hostage.dates.deathDate}`);
            console.log(`   Release Date: ${hostage.dates.releaseDate}`);
            console.log(`   Transition Event: ${hostage.transitionEvent.type} on ${hostage.transitionEvent.date}`);
            console.log(`   Expected: ${hostage.expectedTransitionDate} ${hostage.hasReleaseDate ? '(body release date)' : '(death date)'}`);
            
            if (!hostage.isTransitionDateCorrect) {
                console.log(`   ❌ WRONG: Using ${hostage.transitionEvent.date} instead of ${hostage.expectedTransitionDate}`);
            }
            
            console.log(`   Path Events:`);
            hostage.pathEvents.forEach((event, i) => {
                console.log(`     ${i}: ${event.event} → ${event.lane} (${event.date})`);
            });
        });
        
        if (deceasedAnalysis.withoutTransitions > 0) {
            console.log('\n=== DECEASED WITHOUT TRANSITIONS (STILL IN CAPTIVITY) ===');
            deceasedAnalysis.noTransitionAnalysis.forEach(hostage => {
                console.log(`\n📍 ${hostage.name}:`);
                console.log(`   Status: ${hostage.status}`);
                console.log(`   Final Lane: ${hostage.finalLane}`);
                console.log(`   Has Transition: ${hostage.hasTransition}`);
                console.log(`   Path Length: ${hostage.pathLength}`);
            });
        }
        
        return deceasedAnalysis;
        
    } catch (error) {
        console.error('Deceased transitions debug failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

debugDeceasedTransitions();