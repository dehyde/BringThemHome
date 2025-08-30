/**
 * Debug SVG paths on the correct server instance: 127.0.0.1:3000
 */

const puppeteer = require('puppeteer');

async function debugCorrectServer() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        console.log('Testing against the correct server: 127.0.0.1:3000');
        
        await page.goto('http://127.0.0.1:3000/hostage-timeline-viz/index.html', { 
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
            
            // Find green lines (kidnapped lanes) that have transitions
            const greenLinesWithTransitions = sortedData.filter(h => 
                h.hasTransition &&
                h.initialLane?.includes('kidnapped') &&
                (h.finalLane?.includes('released') || h.finalLane?.includes('kidnapped'))
            );
            
            console.log(`Found ${greenLinesWithTransitions.length} green lines with transitions`);
            
            // Analyze their SVG paths in detail - focus on first 10
            const pathAnalysis = greenLinesWithTransitions.slice(0, 10).map(hostage => {
                const name = hostage['Hebrew Name'];
                
                // Find SVG element
                const svgLine = Array.from(document.querySelectorAll('.hostage-line'))
                    .find(line => line.getAttribute('data-name') === name);
                
                if (!svgLine) {
                    return { name, error: 'SVG not found' };
                }
                
                const pathData = svgLine.getAttribute('d');
                if (!pathData) {
                    return { name, error: 'No path data' };
                }
                
                // Parse path commands in detail
                const commands = pathData.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/g) || [];
                const parsedCommands = commands.map((cmd, index) => {
                    const type = cmd[0];
                    const coords = cmd.slice(1).trim().split(/[\s,]+/).map(n => parseFloat(n)).filter(n => !isNaN(n));
                    
                    // For each command, get the ending position
                    let endX = null, endY = null;
                    if (type === 'M' || type === 'L') {
                        endX = coords[0];
                        endY = coords[1];
                    } else if (type === 'A') {
                        endX = coords[5]; // Arc end X
                        endY = coords[6]; // Arc end Y
                    }
                    
                    return {
                        index,
                        type,
                        coords,
                        endX,
                        endY
                    };
                });
                
                // Check for loops - look for X coordinates that go back and forth
                const xCoords = parsedCommands.map(cmd => cmd.endX).filter(x => x !== null);
                let hasLoops = false;
                let loopDetails = [];
                
                for (let i = 1; i < xCoords.length - 1; i++) {
                    const prev = xCoords[i-1];
                    const curr = xCoords[i];
                    const next = xCoords[i+1];
                    
                    // In RTL, normal flow is decreasing X. Check for reversals
                    if (prev > curr && curr < next) {
                        hasLoops = true;
                        loopDetails.push(`Loop at command ${i}: X goes ${Math.round(prev)} → ${Math.round(curr)} → ${Math.round(next)}`);
                    }
                }
                
                // Also check for segments that go beyond timeline boundaries
                const segmentsBeyondEnd = parsedCommands.filter(cmd => 
                    cmd.endX !== null && cmd.endX < timelineEndX - 10
                );
                const segmentsBeforeStart = parsedCommands.filter(cmd => 
                    cmd.endX !== null && cmd.endX > timelineStartX + 10
                );
                
                return {
                    name,
                    status: hostage['Current Status'],
                    initialLane: hostage.initialLane,
                    finalLane: hostage.finalLane,
                    pathLength: pathData.length,
                    commandCount: parsedCommands.length,
                    commands: parsedCommands.map(cmd => ({
                        type: cmd.type,
                        endX: cmd.endX ? Math.round(cmd.endX) : null,
                        endY: cmd.endY ? Math.round(cmd.endY) : null
                    })),
                    hasLoops,
                    loopDetails,
                    segmentsBeyondEnd: segmentsBeyondEnd.length,
                    segmentsBeforeStart: segmentsBeforeStart.length,
                    hasIssues: hasLoops || segmentsBeyondEnd.length > 0 || segmentsBeforeStart.length > 0
                };
            });
            
            return {
                server: '127.0.0.1:3000',
                timelineEndX: Math.round(timelineEndX),
                timelineStartX: Math.round(timelineStartX),
                totalGreenWithTransitions: greenLinesWithTransitions.length,
                pathAnalysis,
                problemPaths: pathAnalysis.filter(p => p.hasIssues && !p.error)
            };
        });
        
        console.log('\n=== CORRECT SERVER DEBUG ===');
        console.log(`Server: ${results.server}`);
        console.log(`Timeline bounds: ${results.timelineStartX} (Oct 7) → ${results.timelineEndX} (Today)`);
        console.log(`Total green lines with transitions: ${results.totalGreenWithTransitions}`);
        console.log(`Paths with issues: ${results.problemPaths.length}`);
        
        console.log('\n=== PATH ANALYSIS ===');
        results.pathAnalysis.forEach(path => {
            if (path.error) {
                console.log(`❌ ${path.name}: ${path.error}`);
                return;
            }
            
            const status = path.hasIssues ? '🔴' : '✅';
            console.log(`\n${status} ${path.name}:`);
            console.log(`   Lane: ${path.initialLane} → ${path.finalLane}`);
            console.log(`   Path: ${path.commandCount} commands, ${path.pathLength} chars`);
            
            if (path.hasLoops) {
                console.log(`   🔴 LOOPS DETECTED:`);
                path.loopDetails.forEach(detail => {
                    console.log(`     - ${detail}`);
                });
            }
            
            if (path.segmentsBeyondEnd > 0) {
                console.log(`   🔴 ${path.segmentsBeyondEnd} segments extend beyond timeline end`);
            }
            
            if (path.segmentsBeforeStart > 0) {
                console.log(`   🔴 ${path.segmentsBeforeStart} segments extend before timeline start`);
            }
            
            // Show path commands for problematic paths
            if (path.hasIssues) {
                console.log(`   Commands:`);
                path.commands.forEach((cmd, i) => {
                    console.log(`     ${i}: ${cmd.type} → (${cmd.endX}, ${cmd.endY})`);
                });
            }
        });
        
        console.log('\n=== CONCLUSION ===');
        
        if (results.problemPaths.length > 0) {
            console.log('🎯 LOOPS STILL EXIST ON CORRECT SERVER:');
            console.log(`   ${results.problemPaths.length} paths still have the looping issue`);
            console.log('   This confirms the user\'s report - the fix was not applied to the correct server');
            console.log('   The code changes need to be applied to the server at 127.0.0.1:3000');
        } else {
            console.log('✅ ALL PATHS LOOK GOOD:');
            console.log('   No loops or path issues detected on the correct server');
        }
        
        return results;
        
    } catch (error) {
        console.error('Correct server debug failed:', error);
        console.error('Make sure the server at 127.0.0.1:3000 is running');
        throw error;
    } finally {
        await browser.close();
    }
}

debugCorrectServer();