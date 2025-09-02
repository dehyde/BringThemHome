/**
 * Debug SVG path rendering issues - focus on loops and extensions beyond timeline
 */

const puppeteer = require('puppeteer');

async function debugSVGPathRendering() {
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
            const timelineStartX = timeline.dateToX(new Date('2023-10-07'));
            
            // Find green lines (kidnapped lanes) that have transitions
            const greenLinesWithTransitions = sortedData.filter(h => 
                h.hasTransition &&
                h.initialLane?.includes('kidnapped') &&
                (h.finalLane?.includes('released') || h.finalLane?.includes('kidnapped'))
            );
            
            console.log(`Found ${greenLinesWithTransitions.length} green lines with transitions`);
            
            // Analyze their SVG paths in detail
            const pathAnalysis = greenLinesWithTransitions.slice(0, 5).map(hostage => {
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
                        endY,
                        extendsBeforeStart: endX !== null && endX > timelineStartX + 10, // Beyond Oct 7
                        extendsBeyondEnd: endX !== null && endX < timelineEndX - 10 // Beyond today
                    };
                });
                
                // Look for problematic patterns
                const issues = [];
                
                // Check for coordinates beyond timeline boundaries
                const commandsBeyondEnd = parsedCommands.filter(cmd => cmd.extendsBeyondEnd);
                const commandsBeforeStart = parsedCommands.filter(cmd => cmd.extendsBeforeStart);
                
                if (commandsBeyondEnd.length > 0) {
                    issues.push(`${commandsBeyondEnd.length} commands extend beyond timeline end`);
                }
                if (commandsBeforeStart.length > 0) {
                    issues.push(`${commandsBeforeStart.length} commands extend before timeline start`);
                }
                
                // Check for back-and-forth movements (loops)
                const xCoords = parsedCommands.map(cmd => cmd.endX).filter(x => x !== null);
                let hasLoops = false;
                for (let i = 1; i < xCoords.length - 1; i++) {
                    const prev = xCoords[i-1];
                    const curr = xCoords[i];
                    const next = xCoords[i+1];
                    
                    // In RTL, normal flow is decreasing X. Check for reversals
                    if (prev > curr && curr < next) {
                        hasLoops = true;
                        issues.push(`Loop detected at command ${i}: X goes ${Math.round(prev)} → ${Math.round(curr)} → ${Math.round(next)}`);
                        break;
                    }
                }
                
                return {
                    name,
                    status: hostage['Current Status'],
                    initialLane: hostage.initialLane,
                    finalLane: hostage.finalLane,
                    pathLength: pathData.length,
                    commandCount: parsedCommands.length,
                    commands: parsedCommands,
                    issues,
                    hasIssues: issues.length > 0,
                    color: svgLine.style.stroke || svgLine.getAttribute('stroke') || 'unknown'
                };
            });
            
            return {
                timelineEndX: Math.round(timelineEndX),
                timelineStartX: Math.round(timelineStartX),
                totalGreenWithTransitions: greenLinesWithTransitions.length,
                pathAnalysis,
                problemPaths: pathAnalysis.filter(p => p.hasIssues)
            };
        });
        
        console.log('\n=== SVG PATH RENDERING DEBUG ===');
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
            console.log(`   Color: ${path.color}`);
            console.log(`   Path: ${path.commandCount} commands, ${path.pathLength} chars`);
            
            if (path.issues.length > 0) {
                console.log(`   Issues:`);
                path.issues.forEach(issue => {
                    console.log(`     - ${issue}`);
                });
            }
            
            // Show detailed path commands for problematic paths
            if (path.hasIssues) {
                console.log(`   Commands:`);
                path.commands.forEach(cmd => {
                    const beyondMarker = cmd.extendsBeyondEnd ? ' [BEYOND END]' : cmd.extendsBeforeStart ? ' [BEFORE START]' : '';
                    console.log(`     ${cmd.index}: ${cmd.type} → (${Math.round(cmd.endX || 0)}, ${Math.round(cmd.endY || 0)})${beyondMarker}`);
                });
            }
        });
        
        console.log('\n=== ROOT CAUSE ANALYSIS ===');
        
        if (results.problemPaths.length > 0) {
            console.log('🎯 SVG PATH ISSUES CONFIRMED:');
            console.log(`   ${results.problemPaths.length} paths have rendering problems`);
            
            const pathsWithLoops = results.problemPaths.filter(p => 
                p.issues.some(issue => issue.includes('Loop detected'))
            );
            const pathsBeyondEnd = results.problemPaths.filter(p => 
                p.issues.some(issue => issue.includes('beyond timeline end'))
            );
            const pathsBeforeStart = results.problemPaths.filter(p => 
                p.issues.some(issue => issue.includes('before timeline start'))
            );
            
            if (pathsWithLoops.length > 0) {
                console.log(`   - ${pathsWithLoops.length} paths have loops (explains "arc and converge, then move back")`);
            }
            if (pathsBeyondEnd.length > 0) {
                console.log(`   - ${pathsBeyondEnd.length} paths extend beyond timeline end`);
            }
            if (pathsBeforeStart.length > 0) {
                console.log(`   - ${pathsBeforeStart.length} paths extend before timeline start`);
            }
            
            console.log('\n   This confirms the user\'s description of green lines with strange looping behavior');
            console.log('   Location: transition-engine.js path generation logic');
        } else {
            console.log('✅ No obvious path rendering issues detected');
        }
        
        return results;
        
    } catch (error) {
        console.error('SVG path rendering debug failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

debugSVGPathRendering();