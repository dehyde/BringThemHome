/**
 * Debug the specific SVG arc generation in addTransitionSegment
 */

const puppeteer = require('puppeteer');

async function debugSVGArc() {
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
            
            // Get the problematic hostage (אורי מגידיש)
            const testHostage = sortedData.find(h => h['Hebrew Name'] === 'אורי מגידיש');
            
            if (!testHostage) {
                return { error: 'Test hostage not found' };
            }
            
            // Manually trace through the transition engine logic to see what's happening
            const transitionEngine = app.transitionEngine;
            
            // Get the path points
            const pathPoints = testHostage.path;
            console.log('Path points:', pathPoints?.length);
            
            // Simulate the calculatePathSegments logic for this specific hostage
            let segments = [];
            
            if (pathPoints && pathPoints.length > 0) {
                for (let i = 0; i < pathPoints.length; i++) {
                    const currentPoint = pathPoints[i];
                    const nextPoint = pathPoints[i + 1];
                    
                    console.log(`Point ${i}:`, currentPoint.lane, currentPoint.date);
                    
                    const currentX = timeline.dateToX(currentPoint.date);
                    const currentY = app.laneManager.getHostageY({
                        ...testHostage,
                        laneId: currentPoint.lane,
                        lanePosition: testHostage.lanePosition
                    });
                    
                    console.log(`  X=${Math.round(currentX)}, Y=${Math.round(currentY)}`);
                    
                    if (nextPoint) {
                        const nextY = app.laneManager.getTransitionY(nextPoint.lane, testHostage.lanePosition || 0);
                        const nextX = timeline.dateToX(nextPoint.date);
                        const turnRadius = 4; // Base turn radius
                        
                        console.log(`  Next: X=${Math.round(nextX)}, Y=${Math.round(nextY)}`);
                        
                        // This creates the transition segment
                        segments.push({
                            type: 'transition',
                            from: { x: Math.round(currentX), y: Math.round(currentY) },
                            to: { x: Math.round(nextX), y: Math.round(nextY) },
                            transitionX: Math.round(nextX),
                            turnRadius: turnRadius,
                            isMovingUp: nextY < currentY
                        });
                    }
                }
            }
            
            // Now let's examine what the actual addTransitionSegment would do
            // Specifically check the point calculations
            if (segments.length > 0) {
                const segment = segments[0]; // First transition
                const { transitionX, turnRadius, from, to, isMovingUp } = segment;
                
                // These are the exact calculations from addTransitionSegment
                const point1X = transitionX + turnRadius;
                const point1Y = from.y;
                
                const point2X = transitionX;
                const point2Y = from.y + (isMovingUp ? -turnRadius : turnRadius);
                
                const point3X = transitionX;
                const point3Y = to.y + (isMovingUp ? turnRadius : -turnRadius);
                
                const point4X = transitionX - turnRadius;
                const point4Y = to.y;
                
                segments[0].calculatedPoints = {
                    point1: { x: point1X, y: point1Y },
                    point2: { x: point2X, y: point2Y },
                    point3: { x: point3X, y: point3Y },
                    point4: { x: point4X, y: point4Y }
                };
                
                // Check if these coordinates make sense
                segments[0].analysis = {
                    horizontalDistance: point1X - from.x,
                    arcSequence: [
                        `Start: (${from.x}, ${from.y})`,
                        `Line to: (${point1X}, ${point1Y})`,
                        `Arc to: (${point2X}, ${point2Y})`,
                        `Line to: (${point3X}, ${point3Y})`,
                        `Arc to: (${point4X}, ${point4Y})`,
                        `Expected end: (${to.x}, ${to.y})`
                    ],
                    potentialIssue: point4X > point1X ? 'Point4 is right of Point1 (backwards!)' : 'Sequence looks okay'
                };
            }
            
            return {
                hostage: testHostage['Hebrew Name'],
                pathLength: pathPoints?.length || 0,
                segments,
                timeline: {
                    startX: Math.round(timeline.dateToX(new Date('2023-10-07'))),
                    endX: Math.round(timeline.dateToX(new Date()))
                }
            };
        });
        
        console.log('\n=== SVG ARC DEBUG ===');
        console.log(`Hostage: ${results.hostage}`);
        console.log(`Path length: ${results.pathLength}`);
        console.log(`Timeline: ${results.timeline?.startX} → ${results.timeline?.endX}`);
        
        if (results.segments && results.segments.length > 0) {
            const segment = results.segments[0];
            console.log('\n=== TRANSITION SEGMENT ANALYSIS ===');
            console.log(`From: (${segment.from.x}, ${segment.from.y})`);
            console.log(`To: (${segment.to.x}, ${segment.to.y})`);
            console.log(`Transition X: ${segment.transitionX}`);
            console.log(`Turn radius: ${segment.turnRadius}`);
            console.log(`Moving up: ${segment.isMovingUp}`);
            
            if (segment.calculatedPoints) {
                console.log('\n=== CALCULATED CORNER POINTS ===');
                const pts = segment.calculatedPoints;
                console.log(`Point 1 (right): (${pts.point1.x}, ${pts.point1.y})`);
                console.log(`Point 2 (turn): (${pts.point2.x}, ${pts.point2.y})`);
                console.log(`Point 3 (turn): (${pts.point3.x}, ${pts.point3.y})`);
                console.log(`Point 4 (left): (${pts.point4.x}, ${pts.point4.y})`);
                
                console.log('\n=== ARC SEQUENCE ===');
                segment.analysis.arcSequence.forEach((step, i) => {
                    console.log(`${i + 1}. ${step}`);
                });
                
                console.log(`\n🔍 POTENTIAL ISSUE: ${segment.analysis.potentialIssue}`);
                
                // Check if Point 4 X is greater than Point 1 X (which would be backwards in RTL)
                if (pts.point4.x > pts.point1.x) {
                    console.log('\n❌ CONFIRMED ISSUE: Point 4 X > Point 1 X');
                    console.log('   This creates a backwards movement in RTL coordinate system');
                    console.log(`   Point 1 X: ${pts.point1.x}, Point 4 X: ${pts.point4.x}`);
                    console.log('   The arc goes right, then left past the starting point');
                }
            }
        }
        
        return results;
        
    } catch (error) {
        console.error('SVG arc debug failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

debugSVGArc();