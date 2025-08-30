/**
 * Debug X-coordinate transition issues
 * Analyze why lines are going back and forth in time
 */

const puppeteer = require('puppeteer');

async function debugXCoordinateIssues() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        await page.goto('http://localhost:8080/', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        await page.waitForTimeout(8000);
        
        const xCoordinateAnalysis = await page.evaluate(() => {
            const app = window.app;
            const data = app?.data || [];
            const timeline = app?.timelineCore;
            
            // Get scale information
            const scales = timeline?.getScales();
            const xScale = scales?.x;
            
            // Analyze scale domain and range
            const scaleDomain = xScale ? xScale.domain() : null;
            const scaleRange = xScale ? xScale.range() : null;
            
            // Test scale with known dates
            const testDates = [
                new Date('2023-10-07'), // Kidnapping date
                new Date('2024-01-01'), // Mid-point
                new Date('2025-08-30')  // Recent date
            ];
            
            const scaleTest = testDates.map(date => ({
                date: date.toISOString(),
                xCoordinate: xScale ? xScale(date) : null
            }));
            
            // Analyze hostage paths with problematic transitions
            const pathAnalysis = data.slice(0, 10).map(hostage => {
                const path = hostage.path || [];
                
                const pathCoordinates = path.map((point, index) => {
                    const x = xScale ? xScale(point.date) : null;
                    const prevX = index > 0 ? (xScale ? xScale(path[index - 1].date) : null) : null;
                    const goesBackward = prevX !== null && x !== null && x > prevX; // In RTL, larger X = earlier time
                    
                    return {
                        index,
                        date: point.date.toISOString(),
                        x: x,
                        lane: point.lane,
                        event: point.event,
                        goesBackward: goesBackward,
                        deltaX: prevX !== null ? x - prevX : null
                    };
                });
                
                const hasBackwardMovement = pathCoordinates.some(p => p.goesBackward);
                
                return {
                    name: hostage['Hebrew Name'],
                    pathLength: path.length,
                    coordinates: pathCoordinates,
                    hasBackwardMovement,
                    dateRange: path.length > 0 ? {
                        start: path[0].date.toISOString(),
                        end: path[path.length - 1].date.toISOString()
                    } : null
                };
            });
            
            // Check transition engine path generation
            const transitionEngine = app?.transitionEngine;
            
            // Analyze SVG path data
            const svgPaths = Array.from(document.querySelectorAll('.hostage-line')).slice(0, 5).map((line, index) => {
                const pathData = line.getAttribute('d');
                const pathSegments = pathData ? pathData.split(/[ML]/).filter(s => s.trim()) : [];
                
                // Extract coordinate pairs
                const coordinates = pathSegments.map(segment => {
                    const coords = segment.trim().split(/[,\s]+/);
                    return coords.length >= 2 ? { x: parseFloat(coords[0]), y: parseFloat(coords[1]) } : null;
                }).filter(coord => coord && !isNaN(coord.x) && !isNaN(coord.y));
                
                // Check for backward X movement
                const backwardMovements = [];
                for (let i = 1; i < coordinates.length; i++) {
                    const current = coordinates[i];
                    const previous = coordinates[i - 1];
                    if (current.x > previous.x) { // In RTL: larger X = earlier time = backward
                        backwardMovements.push({
                            from: previous,
                            to: current,
                            deltaX: current.x - previous.x
                        });
                    }
                }
                
                return {
                    lineIndex: index,
                    pathData: pathData?.substring(0, 100) + '...',
                    coordinateCount: coordinates.length,
                    coordinates: coordinates.slice(0, 5), // First 5 coordinates
                    backwardMovements,
                    hasBackwardMovement: backwardMovements.length > 0
                };
            });
            
            return {
                scaleInfo: {
                    domain: scaleDomain?.map(d => d.toISOString()),
                    range: scaleRange,
                    isRTL: scaleRange && scaleRange[0] < scaleRange[1] ? false : true // RTL should have range[0] > range[1]
                },
                scaleTest,
                pathAnalysis: pathAnalysis.filter(p => p.hasBackwardMovement || p.pathLength > 1),
                svgPathAnalysis: svgPaths.filter(p => p.hasBackwardMovement),
                problemSummary: {
                    hostagesTotalAnalyzed: 10,
                    hostagesWithBackwardMovement: pathAnalysis.filter(p => p.hasBackwardMovement).length,
                    svgPathsWithBackwardMovement: svgPaths.filter(p => p.hasBackwardMovement).length
                }
            };
        });
        
        console.log('\n=== X-COORDINATE DEBUGGING ANALYSIS ===');
        
        console.log('\n=== SCALE CONFIGURATION ===');
        console.log('Scale domain:', xCoordinateAnalysis.scaleInfo.domain);
        console.log('Scale range:', xCoordinateAnalysis.scaleInfo.range);
        console.log('Is RTL configured correctly:', xCoordinateAnalysis.scaleInfo.isRTL);
        
        console.log('\n=== SCALE TEST WITH KNOWN DATES ===');
        xCoordinateAnalysis.scaleTest.forEach(test => {
            console.log(`${test.date}: X=${test.xCoordinate}`);
        });
        
        console.log('\n=== HOSTAGE PATH ANALYSIS (with backward movement) ===');
        xCoordinateAnalysis.pathAnalysis.forEach(hostage => {
            console.log(`\n❌ ${hostage.name}:`);
            console.log(`   Path length: ${hostage.pathLength}`);
            console.log(`   Date range: ${hostage.dateRange?.start} → ${hostage.dateRange?.end}`);
            console.log('   Coordinates:');
            hostage.coordinates.forEach(coord => {
                const flag = coord.goesBackward ? '🔄 BACKWARD' : '✓';
                console.log(`     ${flag} ${coord.date}: X=${coord.x}, Lane=${coord.lane}, ΔX=${coord.deltaX}`);
            });
        });
        
        console.log('\n=== SVG PATH ANALYSIS (with backward movement) ===');
        xCoordinateAnalysis.svgPathAnalysis.forEach(path => {
            console.log(`\nLine ${path.lineIndex}:`);
            console.log(`   Coordinates: ${path.coordinateCount}`);
            console.log(`   Backward movements: ${path.backwardMovements.length}`);
            path.backwardMovements.forEach(movement => {
                console.log(`     🔄 X: ${movement.from.x} → ${movement.to.x} (ΔX: +${movement.deltaX})`);
            });
            console.log(`   First coordinates:`, path.coordinates);
        });
        
        console.log('\n=== PROBLEM SUMMARY ===');
        console.log(`Hostages analyzed: ${xCoordinateAnalysis.problemSummary.hostagesTotalAnalyzed}`);
        console.log(`Hostages with backward date movement: ${xCoordinateAnalysis.problemSummary.hostagesWithBackwardMovement}`);
        console.log(`SVG paths with backward X movement: ${xCoordinateAnalysis.problemSummary.svgPathsWithBackwardMovement}`);
        
        // Root cause analysis
        console.log('\n=== ROOT CAUSE ANALYSIS ===');
        
        const scaleRange = xCoordinateAnalysis.scaleInfo.range;
        const scaleDomain = xCoordinateAnalysis.scaleInfo.domain;
        
        if (scaleRange && scaleRange[0] < scaleRange[1]) {
            console.log('🎯 MAJOR ISSUE: Scale range is LEFT-TO-RIGHT, should be RIGHT-TO-LEFT for RTL timeline');
            console.log('   Current range:', scaleRange);
            console.log('   Should be: [max, min] for RTL (later dates on left)');
        }
        
        if (scaleDomain && scaleDomain.length === 2) {
            const startDate = new Date(scaleDomain[0]);
            const endDate = new Date(scaleDomain[1]);
            if (startDate < endDate) {
                console.log('🎯 DOMAIN ISSUE: Scale domain should be [endDate, startDate] for RTL');
                console.log(`   Current: [${scaleDomain[0]}, ${scaleDomain[1]}]`);
                console.log(`   Should be: [${scaleDomain[1]}, ${scaleDomain[0]}] for RTL`);
            }
        }
        
        if (xCoordinateAnalysis.problemSummary.hostagesWithBackwardMovement > 0) {
            console.log('🎯 TRANSITION LOGIC ISSUE: Hostage paths contain dates moving backward in time');
            console.log('   This suggests data processing creates invalid chronological sequences');
        }
        
        // Save detailed report
        const reportPath = '/Users/tombar-gal/BringThemHome/hostage-timeline-viz/debug/x-coordinate-debug-report.json';
        require('fs').writeFileSync(reportPath, JSON.stringify(xCoordinateAnalysis, null, 2));
        console.log(`\nDetailed report saved to: ${reportPath}`);
        
        return xCoordinateAnalysis;
        
    } catch (error) {
        console.error('X-coordinate debug failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

debugXCoordinateIssues();