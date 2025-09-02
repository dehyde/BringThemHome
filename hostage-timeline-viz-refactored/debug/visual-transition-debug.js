/**
 * Debug visual transition behavior and hover issues
 * Analyze where transitions actually appear vs where they should be
 */

const puppeteer = require('puppeteer');

async function debugVisualTransitions() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        await page.goto('http://localhost:8080/', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        await page.waitForTimeout(8000);
        
        const visualAnalysis = await page.evaluate(() => {
            const app = window.app;
            const sortedData = app?.laneManager?.getSortedData() || [];
            const timeline = app?.timelineCore;
            const laneManager = app?.laneManager;
            
            // Find specific deceased hostages with returned bodies for detailed analysis
            const deceasedWithBodies = sortedData.filter(h => 
                h.hasTransition && 
                h.path?.length > 1 &&
                h.finalLane?.includes('deceased') &&
                h.releaseDate && h.releaseDate_valid
            ).slice(0, 3);
            
            const analysis = deceasedWithBodies.map(hostage => {
                const name = hostage['Hebrew Name'];
                const path = hostage.path;
                
                // Get the actual SVG path element
                const hostageLines = Array.from(document.querySelectorAll('.hostage-line'));
                const hostageLine = hostageLines.find(line => {
                    const nameAttr = line.getAttribute('data-name');
                    return nameAttr === name || nameAttr?.includes(name);
                });
                
                let svgPathData = null;
                let pathCommands = [];
                let transitionCoordinates = [];
                
                if (hostageLine) {
                    svgPathData = hostageLine.getAttribute('d');
                    
                    // Parse path commands
                    if (svgPathData) {
                        const commands = svgPathData.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/g) || [];
                        pathCommands = commands.map(cmd => {
                            const type = cmd[0];
                            const coords = cmd.slice(1).trim().split(/[\s,]+/).map(n => parseFloat(n)).filter(n => !isNaN(n));
                            return { type, coords };
                        });
                        
                        // Find where transitions happen in the path
                        pathCommands.forEach((cmd, i) => {
                            if (cmd.type === 'A') { // Arc command = transition
                                transitionCoordinates.push({
                                    commandIndex: i,
                                    type: 'arc',
                                    coords: cmd.coords
                                });
                            }
                        });
                    }
                }
                
                // Calculate expected vs actual transition dates
                const kidnappedDate = hostage.kidnappedDate;
                const deathDate = hostage.deathDate;
                const releaseDate = hostage.releaseDate;
                
                // Expected transition points
                const expectedTransitions = [];
                
                // Death transition (if died after kidnapping)
                if (deathDate && kidnappedDate && deathDate.getTime() > kidnappedDate.getTime()) {
                    expectedTransitions.push({
                        type: 'death',
                        date: deathDate,
                        x: timeline.dateToX(deathDate),
                        description: 'kidnapped-living → kidnapped-deceased'
                    });
                }
                
                // Release transition (body returned)
                if (releaseDate) {
                    expectedTransitions.push({
                        type: 'release',
                        date: releaseDate,
                        x: timeline.dateToX(releaseDate),
                        description: 'kidnapped-deceased → released-*-deceased'
                    });
                }
                
                // Timeline boundaries
                const timelineStart = timeline.dateToX(new Date('2023-10-07'));
                const timelineEnd = timeline.dateToX(new Date());
                
                return {
                    name,
                    status: hostage['Current Status'],
                    finalLane: hostage.finalLane,
                    dates: {
                        kidnapped: kidnappedDate ? kidnappedDate.toISOString().split('T')[0] : null,
                        death: deathDate ? deathDate.toISOString().split('T')[0] : null,
                        release: releaseDate ? releaseDate.toISOString().split('T')[0] : null
                    },
                    pathLength: path ? path.length : 0,
                    pathEvents: path ? path.map(p => ({
                        lane: p.lane,
                        date: p.date.toISOString().split('T')[0],
                        event: p.event
                    })) : [],
                    svgFound: !!hostageLine,
                    svgPathLength: svgPathData ? svgPathData.length : 0,
                    pathCommandCount: pathCommands.length,
                    transitionCount: transitionCoordinates.length,
                    expectedTransitions,
                    actualTransitions: transitionCoordinates,
                    timeline: {
                        start: Math.round(timelineStart),
                        end: Math.round(timelineEnd)
                    }
                };
            });
            
            // Also check hover behavior
            const hoverIssues = [];
            const testLines = Array.from(document.querySelectorAll('.hostage-line')).slice(0, 5);
            
            testLines.forEach((line, index) => {
                try {
                    // Simulate hover
                    const rect = line.getBoundingClientRect();
                    const event = new MouseEvent('mouseenter', {
                        view: window,
                        bubbles: true,
                        cancelable: true,
                        clientX: rect.left + rect.width / 2,
                        clientY: rect.top + rect.height / 2
                    });
                    
                    line.dispatchEvent(event);
                    
                    // Check if tooltip appeared
                    const tooltip = document.querySelector('.tooltip, [class*="tooltip"]');
                    const hasTooltip = !!tooltip;
                    
                    hoverIssues.push({
                        lineIndex: index,
                        name: line.getAttribute('data-name'),
                        hasTooltip,
                        pathData: line.getAttribute('d')?.substring(0, 50) + '...',
                        strokeWidth: window.getComputedStyle(line).strokeWidth,
                        visibility: window.getComputedStyle(line).visibility
                    });
                    
                    // Clean up - mouse leave
                    line.dispatchEvent(new MouseEvent('mouseleave'));
                    
                } catch (error) {
                    hoverIssues.push({
                        lineIndex: index,
                        error: error.message
                    });
                }
            });
            
            return {
                deceasedAnalysis: analysis,
                hoverBehavior: hoverIssues,
                totalHostageLines: document.querySelectorAll('.hostage-line').length,
                timelineInfo: {
                    width: timeline.dimensions?.width || 'unknown',
                    height: laneManager.laneDefinitions ? Object.keys(laneManager.laneDefinitions).length * 50 : 'unknown',
                    dateRange: {
                        start: '2023-10-07',
                        end: new Date().toISOString().split('T')[0]
                    }
                }
            };
        });
        
        console.log('\n=== VISUAL TRANSITION DEBUG ===');
        
        console.log('\n=== DECEASED HOSTAGE VISUAL ANALYSIS ===');
        visualAnalysis.deceasedAnalysis.forEach(hostage => {
            console.log(`\n🔍 ${hostage.name}:`);
            console.log(`   Status: ${hostage.status}`);
            console.log(`   Final Lane: ${hostage.finalLane}`);
            console.log(`   Dates: Kidnapped=${hostage.dates.kidnapped}, Death=${hostage.dates.death}, Release=${hostage.dates.release}`);
            console.log(`   Path Events: ${hostage.pathLength} events`);
            hostage.pathEvents.forEach((event, i) => {
                console.log(`     ${i}: ${event.event} → ${event.lane} (${event.date})`);
            });
            
            console.log(`   SVG Analysis:`);
            console.log(`     Found: ${hostage.svgFound}`);
            console.log(`     Path Commands: ${hostage.pathCommandCount}`);
            console.log(`     Transition Arcs: ${hostage.transitionCount}`);
            
            console.log(`   Expected Transitions:`);
            hostage.expectedTransitions.forEach((trans, i) => {
                console.log(`     ${i}: ${trans.type} at X=${trans.x} (${trans.date.toISOString().split('T')[0]}) - ${trans.description}`);
            });
            
            if (hostage.actualTransitions.length > 0) {
                console.log(`   Actual SVG Transitions:`);
                hostage.actualTransitions.forEach((trans, i) => {
                    console.log(`     ${i}: Arc at coords [${trans.coords.slice(-2).join(', ')}]`);
                });
            }
            
            // Check if transitions are at timeline end
            const timelineEnd = hostage.timeline.end;
            hostage.expectedTransitions.forEach(trans => {
                if (Math.abs(trans.x - timelineEnd) < 10) {
                    console.log(`   ❌ ISSUE: ${trans.type} transition appears at timeline end (X=${trans.x} vs end=${timelineEnd})`);
                }
            });
        });
        
        console.log('\n=== HOVER BEHAVIOR ANALYSIS ===');
        console.log(`Total hostage lines found: ${visualAnalysis.totalHostageLines}`);
        
        visualAnalysis.hoverBehavior.forEach(hover => {
            if (hover.error) {
                console.log(`❌ Line ${hover.lineIndex}: Error - ${hover.error}`);
            } else {
                const status = hover.hasTooltip ? '✅' : '❌';
                console.log(`${status} Line ${hover.lineIndex}: ${hover.name || 'unnamed'}`);
                console.log(`     Tooltip: ${hover.hasTooltip}, Stroke: ${hover.strokeWidth}, Visible: ${hover.visibility}`);
                if (!hover.hasTooltip) {
                    console.log(`     Path: ${hover.pathData}`);
                }
            }
        });
        
        console.log('\n=== ROOT CAUSE SUMMARY ===');
        const transitionsAtEnd = visualAnalysis.deceasedAnalysis.filter(h => 
            h.expectedTransitions.some(t => Math.abs(t.x - h.timeline.end) < 10)
        );
        
        if (transitionsAtEnd.length > 0) {
            console.log(`🎯 MAJOR ISSUE: ${transitionsAtEnd.length} hostages have transitions at timeline end`);
            console.log('   This suggests the transition X coordinates are wrong');
            console.log('   Location: data-processor.js transition event calculation or timeline.js dateToX()');
        }
        
        const hoverIssues = visualAnalysis.hoverBehavior.filter(h => !h.hasTooltip && !h.error).length;
        if (hoverIssues > 0) {
            console.log(`🎯 HOVER ISSUE: ${hoverIssues} lines don't show tooltips on hover`);
            console.log('   This suggests SVG path parsing or event handling issues');
            console.log('   Location: visualization-core.js hover handlers or SVG path generation');
        }
        
        return visualAnalysis;
        
    } catch (error) {
        console.error('Visual transition debug failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

debugVisualTransitions();