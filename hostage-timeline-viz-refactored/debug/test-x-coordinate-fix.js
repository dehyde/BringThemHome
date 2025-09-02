const puppeteer = require('puppeteer');

async function testXCoordinateFix() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        await page.goto('http://localhost:8080/', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        await page.waitForTimeout(8000);
        
        const fixTestResults = await page.evaluate(() => {
            const app = window.app;
            const timeline = app?.timelineCore;
            const scales = timeline?.getScales();
            const xScale = scales?.x;
            
            // Test the fixed scale
            const testDates = [
                { name: 'Oct 7, 2023 (kidnapping)', date: new Date('2023-10-07') },
                { name: 'Jan 1, 2024 (midpoint)', date: new Date('2024-01-01') },
                { name: 'Aug 30, 2025 (recent)', date: new Date('2025-08-30') }
            ];
            
            const scaleTest = testDates.map(test => ({
                name: test.name,
                date: test.date.toISOString(),
                xCoordinate: xScale ? xScale(test.date) : null
            }));
            
            // Test a few hostage paths
            const data = app?.data || [];
            const pathTests = data.slice(0, 5).map(hostage => {
                const path = hostage.path || [];
                const pathCoordinates = path.map((point, index) => {
                    const x = xScale ? xScale(point.date) : null;
                    return {
                        date: point.date.toISOString(),
                        x: x,
                        lane: point.lane,
                        event: point.event
                    };
                });
                
                // Check chronological order
                let chronologicalOrder = true;
                for (let i = 1; i < pathCoordinates.length; i++) {
                    const current = pathCoordinates[i];
                    const previous = pathCoordinates[i-1];
                    // In RTL: later dates should have smaller X coordinates
                    if (current.x > previous.x) {
                        chronologicalOrder = false;
                        break;
                    }
                }
                
                return {
                    name: hostage['Hebrew Name'],
                    pathLength: path.length,
                    coordinates: pathCoordinates,
                    chronologicalOrder,
                    summary: pathCoordinates.length > 1 ? 
                        `${pathCoordinates[0].x.toFixed(1)} → ${pathCoordinates[pathCoordinates.length-1].x.toFixed(1)}` : 
                        'single point'
                };
            });
            
            return {
                scaleInfo: {
                    domain: xScale?.domain().map(d => d.toISOString()),
                    range: xScale?.range()
                },
                scaleTest,
                pathTests,
                overallResults: {
                    pathsWithCorrectOrder: pathTests.filter(p => p.chronologicalOrder).length,
                    totalPaths: pathTests.length
                }
            };
        });
        
        console.log('\n=== X-COORDINATE FIX TEST RESULTS ===');
        
        console.log('\n=== UPDATED SCALE CONFIGURATION ===');
        console.log('Scale domain:', fixTestResults.scaleInfo.domain);
        console.log('Scale range:', fixTestResults.scaleInfo.range);
        
        console.log('\n=== DATE-TO-X COORDINATE MAPPING ===');
        fixTestResults.scaleTest.forEach(test => {
            console.log(`${test.name}: X=${test.xCoordinate?.toFixed(1)}`);
        });
        
        // Verify RTL correctness
        const coords = fixTestResults.scaleTest.map(t => t.xCoordinate).filter(x => x !== null);
        const isRTLCorrect = coords.length >= 2 && coords[0] > coords[coords.length - 1]; // Earlier dates should have larger X
        console.log(`\nRTL Configuration: ${isRTLCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
        console.log('(Earlier dates should have larger X coordinates for RTL)');
        
        console.log('\n=== HOSTAGE PATH CHRONOLOGICAL ORDER ===');
        fixTestResults.pathTests.forEach(path => {
            const status = path.chronologicalOrder ? '✅' : '❌';
            console.log(`${status} ${path.name}: ${path.summary} (${path.pathLength} points)`);
        });
        
        console.log('\n=== OVERALL RESULTS ===');
        const successRate = fixTestResults.overallResults.pathsWithCorrectOrder / fixTestResults.overallResults.totalPaths;
        console.log(`Paths with correct chronological order: ${fixTestResults.overallResults.pathsWithCorrectOrder}/${fixTestResults.overallResults.totalPaths} (${(successRate * 100).toFixed(1)}%)`);
        
        if (isRTLCorrect && successRate === 1.0) {
            console.log('\n🎉 SUCCESS: X-coordinate transitions are now chronologically correct!');
            return true;
        } else {
            console.log('\n❌ ISSUES REMAIN: X-coordinate problems still exist');
            return false;
        }
        
    } catch (error) {
        console.error('X-coordinate fix test failed:', error);
        return false;
    } finally {
        await browser.close();
    }
}

testXCoordinateFix();