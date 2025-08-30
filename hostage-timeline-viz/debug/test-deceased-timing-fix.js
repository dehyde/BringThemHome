const puppeteer = require('puppeteer');

async function testDeceasedTimingFix() {
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
            const data = app?.data || [];
            
            // Test the problematic cases from before
            const testCases = [
                'יונתן סמרנו',  // Should transition on Oct 7 (died then)
                'עפרה קידר',   // Should transition on Oct 7 (died then) 
                'שי לוינסון',   // Should transition on Oct 7 (died then)
                'נטפונג פינטה', // Should transition in early captivity
                'איציק אלגרט'   // Should transition on death date (Feb 27, 2025)
            ];
            
            const results = testCases.map(name => {
                const hostage = data.find(h => h['Hebrew Name'] === name);
                if (!hostage) return { name, found: false };
                
                const path = hostage.path || [];
                const transitionEvent = hostage.transitionEvent;
                
                // Check if transitioning at current date (problem indicator)
                const currentTime = new Date().getTime();
                const transitionTime = transitionEvent?.timestamp || 0;
                const isCurrentDate = Math.abs(currentTime - transitionTime) < 24 * 60 * 60 * 1000;
                
                return {
                    name,
                    found: true,
                    status: hostage['Current Status'],
                    deathContext: hostage['Context of Death'],
                    releaseCircumstances: hostage['Release/Death Circumstances'],
                    transitionDate: transitionEvent?.date.toISOString(),
                    transitionType: transitionEvent?.type,
                    pathLength: path.length,
                    pathSummary: path.length > 1 ? 
                        `${path[0].date.toISOString().split('T')[0]} → ${path[path.length-1].date.toISOString().split('T')[0]}` :
                        'single point',
                    isCurrentDate: isCurrentDate,
                    isFixed: !isCurrentDate // Fixed if NOT using current date
                };
            });
            
            // Overall statistics  
            const allDeceased = data.filter(h => 
                h['Current Status']?.includes('Deceased') || h.finalLane?.includes('deceased')
            );
            
            const deceasedUsingCurrentDate = allDeceased.filter(h => {
                const transitionEvent = h.transitionEvent;
                if (!transitionEvent) return false;
                const currentTime = new Date().getTime();
                return Math.abs(currentTime - transitionEvent.timestamp) < 24 * 60 * 60 * 1000;
            });
            
            return {
                testCases: results,
                overallStats: {
                    totalDeceased: allDeceased.length,
                    usingCurrentDate: deceasedUsingCurrentDate.length,
                    fixedCount: allDeceased.length - deceasedUsingCurrentDate.length
                },
                currentDate: new Date().toISOString()
            };
        });
        
        console.log('\n=== DECEASED TIMING FIX TEST RESULTS ===');
        console.log(`Current date: ${fixTestResults.currentDate.split('T')[0]}`);
        
        console.log('\n=== TEST CASES ===');
        fixTestResults.testCases.forEach(test => {
            if (!test.found) {
                console.log(`❓ ${test.name}: Not found`);
                return;
            }
            
            const status = test.isFixed ? '✅ FIXED' : '❌ STILL BROKEN';
            console.log(`${status} ${test.name}:`);
            console.log(`   Status: "${test.status}"`);
            console.log(`   Death context: "${test.deathContext}"`);
            console.log(`   Transition: ${test.transitionType} at ${test.transitionDate?.split('T')[0]}`);
            console.log(`   Path: ${test.pathSummary}`);
            if (test.isCurrentDate) {
                console.log(`   ❌ Still using current date`);
            }
            console.log('');
        });
        
        console.log('=== OVERALL RESULTS ===');
        console.log(`Total deceased hostages: ${fixTestResults.overallStats.totalDeceased}`);
        console.log(`Using current date: ${fixTestResults.overallStats.usingCurrentDate}`);
        console.log(`Fixed transitions: ${fixTestResults.overallStats.fixedCount}`);
        
        const successRate = fixTestResults.overallStats.fixedCount / fixTestResults.overallStats.totalDeceased;
        console.log(`Success rate: ${(successRate * 100).toFixed(1)}%`);
        
        const testCaseSuccessRate = fixTestResults.testCases.filter(t => t.isFixed).length / fixTestResults.testCases.length;
        console.log(`Test cases fixed: ${fixTestResults.testCases.filter(t => t.isFixed).length}/${fixTestResults.testCases.length} (${(testCaseSuccessRate * 100).toFixed(1)}%)`);
        
        if (testCaseSuccessRate >= 0.8 && successRate >= 0.8) {
            console.log('\n🎉 SUCCESS: Deceased hostage transition timing significantly improved!');
            return true;
        } else {
            console.log('\n❌ ISSUES REMAIN: More work needed on transition timing');
            return false;
        }
        
    } catch (error) {
        console.error('Deceased timing fix test failed:', error);
        return false;
    } finally {
        await browser.close();
    }
}

testDeceasedTimingFix();