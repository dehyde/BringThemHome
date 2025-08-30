/**
 * Debug future dates in the data that cause timeline end issues
 */

const puppeteer = require('puppeteer');

async function debugFutureDates() {
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
            const now = new Date();
            
            // Find hostages with dates in the future
            const futureIssues = [];
            
            sortedData.forEach(hostage => {
                const issues = [];
                
                // Check each date field
                if (hostage.kidnappedDate && hostage.kidnappedDate > now) {
                    issues.push(`Kidnapped: ${hostage.kidnappedDate.toISOString().split('T')[0]}`);
                }
                if (hostage.deathDate && hostage.deathDate > now) {
                    issues.push(`Death: ${hostage.deathDate.toISOString().split('T')[0]}`);
                }
                if (hostage.releaseDate && hostage.releaseDate > now) {
                    issues.push(`Release: ${hostage.releaseDate.toISOString().split('T')[0]}`);
                }
                
                if (issues.length > 0) {
                    futureIssues.push({
                        name: hostage['Hebrew Name'],
                        status: hostage['Current Status'],
                        initialLane: hostage.initialLane,
                        finalLane: hostage.finalLane,
                        futureIssues: issues,
                        rawReleaseDate: hostage['Release Date'],
                        rawDeathDate: hostage['Date of Death']
                    });
                }
            });
            
            return {
                currentDate: now.toISOString().split('T')[0],
                totalHostages: sortedData.length,
                futureIssues
            };
        });
        
        console.log('\n=== FUTURE DATES DEBUG ===');
        console.log(`Current Date: ${results.currentDate}`);
        console.log(`Total Hostages: ${results.totalHostages}`);
        console.log(`Future Date Issues: ${results.futureIssues.length}`);
        
        if (results.futureIssues.length > 0) {
            console.log('\n=== HOSTAGES WITH FUTURE DATES ===');
            results.futureIssues.forEach(hostage => {
                console.log(`\n❌ ${hostage.name}:`);
                console.log(`   Status: ${hostage.status}`);
                console.log(`   Lane Path: ${hostage.initialLane} → ${hostage.finalLane}`);
                console.log(`   Future Date Issues: ${hostage.futureIssues.join(', ')}`);
                console.log(`   Raw Release Date: "${hostage.rawReleaseDate}"`);
                console.log(`   Raw Death Date: "${hostage.rawDeathDate}"`);
            });
            
            console.log('\n🎯 ROOT CAUSE:');
            console.log('   Future dates cause transitions to appear at timeline end');
            console.log('   This is likely a data entry error - dates should not be in the future');
            console.log('   Solutions:');
            console.log('   1. Fix the data source (CSV file)');
            console.log('   2. Add validation to reject future dates');
            console.log('   3. Add special handling for estimated/placeholder dates');
        } else {
            console.log('\n✅ No future dates found');
        }
        
        return results;
        
    } catch (error) {
        console.error('Future dates debug failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

debugFutureDates();