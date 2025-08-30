const puppeteer = require('puppeteer');

async function testParsingFixes() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        await page.goto('http://localhost:8080/', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        await page.waitForTimeout(8000);
        
        const testResults = await page.evaluate(() => {
            const app = window.app;
            const rawData = app?.data || [];
            
            // Test specific problematic hostages
            const problemCases = [
                'איציק אלגרט',  // Should be released-deal-deceased
                'שלמה מנצור',   // Should be released-deal-deceased  
                'צחי עידן',     // Should be released-deal-deceased
                'יונתן סמרנו',  // Should be released-deal-deceased
                'שירי ביבס'     // Should be released-deal-deceased
            ];
            
            const results = {};
            
            problemCases.forEach(name => {
                const hostage = rawData.find(h => h['Hebrew Name'] === name);
                if (hostage) {
                    results[name] = {
                        currentStatus: hostage['Current Status'],
                        releaseDate: hostage['Release Date'],
                        releaseDate_valid: hostage.releaseDate_valid,
                        finalLane: hostage.finalLane,
                        hasTransition: hostage.hasTransition,
                        transitionEvent: hostage.transitionEvent?.type || 'none',
                        pathLength: hostage.path?.length || 0
                    };
                }
            });
            
            // Count lane distributions
            const laneDistribution = {};
            rawData.forEach(hostage => {
                const lane = hostage.finalLane;
                laneDistribution[lane] = (laneDistribution[lane] || 0) + 1;
            });
            
            // Count status mismatches
            const statusMismatches = rawData.filter(hostage => {
                const status = hostage['Current Status'];
                const lane = hostage.finalLane;
                
                // Deceased hostages in living lane
                if (status === 'Deceased' && lane === 'kidnapped-living') {
                    return true;
                }
                
                // Released hostages still in captivity lane  
                if ((status.includes('Released') || status.includes('Deceased - Returned')) && 
                    lane?.includes('kidnapped')) {
                    return true;
                }
                
                return false;
            });
            
            return {
                testCases: results,
                laneDistribution,
                statusMismatchCount: statusMismatches.length,
                statusMismatchExamples: statusMismatches.slice(0, 5).map(h => ({
                    name: h['Hebrew Name'],
                    status: h['Current Status'],
                    lane: h.finalLane
                }))
            };
        });
        
        console.log('\n=== PARSING FIX TEST RESULTS ===');
        
        console.log('\n=== PROBLEMATIC TEST CASES ===');
        Object.entries(testResults.testCases).forEach(([name, data]) => {
            const isFixed = data.finalLane.includes('released');
            console.log(`${isFixed ? '✅' : '❌'} ${name}:`);
            console.log(`   Status: "${data.currentStatus}"`);
            console.log(`   Lane: ${data.finalLane}`);
            console.log(`   Has Transition: ${data.hasTransition}`);
            console.log(`   Path Length: ${data.pathLength}`);
            console.log('');
        });
        
        console.log('=== LANE DISTRIBUTION ===');
        Object.entries(testResults.laneDistribution).forEach(([lane, count]) => {
            console.log(`${lane}: ${count}`);
        });
        
        console.log(`\n=== STATUS MISMATCHES ===`);
        console.log(`Total mismatches: ${testResults.statusMismatchCount}`);
        testResults.statusMismatchExamples.forEach(example => {
            console.log(`❌ ${example.name}: "${example.status}" in ${example.lane}`);
        });
        
        // Determine success
        const fixedCount = Object.values(testResults.testCases).filter(tc => 
            tc.finalLane.includes('released')
        ).length;
        
        const success = fixedCount === Object.keys(testResults.testCases).length && 
                       testResults.statusMismatchCount < 10;
        
        if (success) {
            console.log('\n🎉 SUCCESS: Lane assignment issues have been fixed!');
        } else {
            console.log('\n❌ ISSUES REMAIN: Some problems still need addressing');
        }
        
        return success;
        
    } catch (error) {
        console.error('Fix test failed:', error);
        return false;
    } finally {
        await browser.close();
    }
}

testParsingFixes();