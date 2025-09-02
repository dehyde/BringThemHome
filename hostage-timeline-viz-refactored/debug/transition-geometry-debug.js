/**
 * Debug transition path geometry and turn mechanics
 * Analyze bezier curves, coordinates, and RTL issues
 */

const puppeteer = require('puppeteer');

async function debugTransitionGeometry() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        await page.goto('http://localhost:8080/', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        await page.waitForTimeout(8000);
        
        const geometryAnalysis = await page.evaluate(() => {
            const app = window.app;
            const sortedData = app?.laneManager?.getSortedData() || [];
            const timeline = app?.timelineCore;
            const laneManager = app?.laneManager;
            
            // Find hostages with transitions (especially deceased ones) from sorted data
            const hostagesToAnalyze = sortedData.filter(h => h.hasTransition && h.path?.length > 1).slice(0, 5);
            
            const geometryTests = hostagesToAnalyze.map(hostage => {
                const path = hostage.path;
                const name = hostage['Hebrew Name'];
                
                if (path.length < 2) return null;
                
                // Get coordinate information for each path point
                const pathCoordinates = path.map(point => {
                    const x = timeline.dateToX(point.date);
                    // For source: use actual source lane Y, for destination: use destination lane Y
                    const y = laneManager.getTransitionY(point.lane, hostage.lanePosition || 0);
                    
                    return {
                        lane: point.lane,
                        date: point.date.toISOString().split('T')[0],
                        x: Math.round(x * 10) / 10, // Round for readability
                        y: Math.round(y * 10) / 10,
                        event: point.event
                    };
                });
                
                // Analyze the transition
                const source = pathCoordinates[0];
                const destination = pathCoordinates[pathCoordinates.length - 1];
                
                // Check RTL correctness (source should have larger X than destination)
                const isRTLCorrect = source.x > destination.x;
                const deltaX = destination.x - source.x;
                const deltaY = destination.y - source.y;
                
                return {
                    name,
                    pathLength: path.length,
                    source: source,
                    destination: destination,
                    transition: {
                        deltaX: Math.round(deltaX * 10) / 10,
                        deltaY: Math.round(deltaY * 10) / 10,
                        isRTLCorrect: isRTLCorrect,
                        direction: deltaY > 0 ? 'down' : deltaY < 0 ? 'up' : 'horizontal'
                    },
                    allCoordinates: pathCoordinates
                };
            }).filter(t => t !== null);
            
            // Analyze SVG path data for bezier curves
            const svgPathAnalysis = Array.from(document.querySelectorAll('.hostage-line')).slice(0, 5).map((line, index) => {
                const pathData = line.getAttribute('d');
                if (!pathData) return null;
                
                // Parse SVG path commands
                const commands = pathData.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/g) || [];
                const parsedCommands = commands.map(cmd => {
                    const type = cmd[0];
                    const coords = cmd.slice(1).trim().split(/[\s,]+/).map(n => parseFloat(n)).filter(n => !isNaN(n));
                    return { type, coords };
                });
                
                return {
                    lineIndex: index,
                    pathData: pathData.substring(0, 150) + '...',
                    commandCount: parsedCommands.length,
                    commands: parsedCommands,
                    hasBezierCurves: parsedCommands.some(cmd => cmd.type === 'C'),
                    hasQuadraticCurves: parsedCommands.some(cmd => cmd.type === 'Q')
                };
            }).filter(p => p !== null);
            
            return {
                geometryTests,
                svgPathAnalysis,
                transitionEngine: {
                    baseTurnRadius: app?.transitionEngine?.config?.baseTurnRadius,
                    curveType: app?.transitionEngine?.config?.curveType
                }
            };
        });
        
        console.log('\n=== TRANSITION GEOMETRY DEBUG ANALYSIS ===');
        
        console.log('\n=== TRANSITION ENGINE CONFIG ===');
        console.log('Base turn radius:', geometryAnalysis.transitionEngine.baseTurnRadius);
        console.log('Curve type:', geometryAnalysis.transitionEngine.curveType);
        
        console.log('\n=== COORDINATE ANALYSIS ===');
        geometryAnalysis.geometryTests.forEach(test => {
            console.log(`\n📍 ${test.name}:`);
            console.log(`   Source: Lane="${test.source.lane}", X=${test.source.x}, Y=${test.source.y} (${test.source.date})`);
            console.log(`   Destination: Lane="${test.destination.lane}", X=${test.destination.x}, Y=${test.destination.y} (${test.destination.date})`);
            
            const rtlStatus = test.transition.isRTLCorrect ? '✅ CORRECT' : '❌ WRONG';
            console.log(`   RTL Order: ${rtlStatus} (ΔX=${test.transition.deltaX}, ΔY=${test.transition.deltaY})`);
            console.log(`   Movement: ${test.transition.direction}`);
            
            if (!test.transition.isRTLCorrect) {
                console.log(`   ❌ ISSUE: Source X (${test.source.x}) should be > Destination X (${test.destination.x}) for RTL`);
            }
            
            if (test.allCoordinates.length > 2) {
                console.log('   Intermediate points:');
                test.allCoordinates.slice(1, -1).forEach((coord, i) => {
                    console.log(`     ${i+1}: Lane="${coord.lane}", X=${coord.x}, Y=${coord.y} (${coord.date})`);
                });
            }
        });
        
        console.log('\n=== SVG PATH ANALYSIS ===');
        geometryAnalysis.svgPathAnalysis.forEach(path => {
            console.log(`\nLine ${path.lineIndex}:`);
            console.log(`   Commands: ${path.commandCount}`);
            console.log(`   Has Bezier curves: ${path.hasBezierCurves}`);
            console.log(`   Has Quadratic curves: ${path.hasQuadraticCurves}`);
            console.log(`   Path preview: ${path.pathData}`);
            
            console.log('   Command breakdown:');
            path.commands.forEach((cmd, i) => {
                console.log(`     ${i}: ${cmd.type} [${cmd.coords.join(', ')}]`);
            });
        });
        
        // Root cause analysis
        console.log('\n=== ROOT CAUSE ANALYSIS ===');
        
        const rtlIssues = geometryAnalysis.geometryTests.filter(t => !t.transition.isRTLCorrect).length;
        const hasBezierCurves = geometryAnalysis.svgPathAnalysis.some(p => p.hasBezierCurves);
        
        if (rtlIssues > 0) {
            console.log('🎯 MAJOR ISSUE: RTL coordinate ordering is wrong');
            console.log(`   ${rtlIssues} transitions have source X < destination X (should be >)`);
            console.log('   Location: transition-engine.js coordinate calculation');
        }
        
        if (!hasBezierCurves) {
            console.log('🎯 CURVE ISSUE: No bezier curves found in SVG paths');
            console.log('   Transitions may be using straight lines instead of proper curves');
            console.log('   Location: transition-engine.js addTransitionSegment()');
        } else {
            console.log('✅ Bezier curves are being generated');
        }
        
        console.log('\n=== EXPECTED TURN MECHANICS ===');
        console.log('For proper 90-degree turns:');
        console.log('1. Start horizontal in source lane');
        console.log('2. Turn vertically (90° up/down) - first bezier curve');
        console.log('3. Turn horizontally (90° left) - second bezier curve');
        console.log('4. Continue horizontal in destination lane');
        console.log('Expected: 4 control points for 2-corner turn');
        
        // Save detailed report
        const reportPath = '/Users/tombar-gal/BringThemHome/hostage-timeline-viz/debug/transition-geometry-report.json';
        require('fs').writeFileSync(reportPath, JSON.stringify(geometryAnalysis, null, 2));
        console.log(`\nDetailed report saved to: ${reportPath}`);
        
        return geometryAnalysis;
        
    } catch (error) {
        console.error('Transition geometry debug failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

debugTransitionGeometry();