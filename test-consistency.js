const puppeteer = require('puppeteer');

async function testGradientConsistency() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    await page.goto('http://localhost:8080');
    
    // Wait for the page to load
    await page.waitForSelector('#vis-container', { timeout: 10000 });
    
    // Extract gradient information for all hostages
    const gradientData = await page.evaluate(() => {
        const hostages = [];
        const paths = document.querySelectorAll('path[stroke*="gradient-"]');
        
        paths.forEach(path => {
            const strokeUrl = path.getAttribute('stroke');
            const gradientId = strokeUrl.match(/url\(#([^)]+)\)/)?.[1];
            
            if (gradientId) {
                const gradient = document.getElementById(gradientId);
                if (gradient) {
                    const stops = Array.from(gradient.querySelectorAll('stop')).map(stop => ({
                        offset: stop.getAttribute('offset'),
                        color: stop.getAttribute('stop-color')
                    }));
                    
                    // Extract hostage name from path class or data attribute
                    const classList = Array.from(path.classList);
                    const nameClass = classList.find(cls => cls.startsWith('hostage-'));
                    const hostageName = nameClass ? nameClass.replace('hostage-', '').replace(/-/g, ' ') : 'unknown';
                    
                    hostages.push({
                        name: hostageName,
                        gradientId: gradientId,
                        stops: stops,
                        hasTransition: stops.length > 2
                    });
                }
            }
        });
        
        return hostages;
    });
    
    // Group hostages by release period and analyze consistency
    const releaseGroups = {};
    
    gradientData.forEach(hostage => {
        if (hostage.hasTransition) {
            // Try to identify the release group by gradient pattern
            const transitionStart = parseFloat(hostage.stops[1]?.offset?.replace('%', '') || '0');
            const groupKey = Math.round(transitionStart / 10) * 10; // Group by nearest 10%
            
            if (!releaseGroups[groupKey]) {
                releaseGroups[groupKey] = [];
            }
            releaseGroups[groupKey].push({
                name: hostage.name,
                transitionStart: transitionStart,
                stops: hostage.stops
            });
        }
    });
    
    console.log('\n=== GRADIENT CONSISTENCY ANALYSIS ===\n');
    
    Object.keys(releaseGroups).forEach(groupKey => {
        const group = releaseGroups[groupKey];
        console.log(`Release Group ${groupKey}% (${group.length} hostages):`);
        
        // Check if all hostages in this group have similar transition points
        const transitionPoints = group.map(h => h.transitionStart);
        const minTransition = Math.min(...transitionPoints);
        const maxTransition = Math.max(...transitionPoints);
        const variance = maxTransition - minTransition;
        
        console.log(`  Transition variance: ${variance.toFixed(1)}% (${minTransition.toFixed(1)}% - ${maxTransition.toFixed(1)}%)`);
        
        if (variance > 5) {
            console.log(`  ⚠️  HIGH VARIANCE - Inconsistent transitions detected!`);
            group.forEach(hostage => {
                console.log(`    ${hostage.name}: ${hostage.transitionStart.toFixed(1)}%`);
            });
        } else {
            console.log(`  ✅ CONSISTENT - All transitions within ${variance.toFixed(1)}%`);
        }
        
        console.log('');
    });
    
    // Look specifically for problematic cases mentioned
    const problematicNames = ['צ\'לרמצ\'אי סאאנגקאו', 'וויצ\'יאן טמטונג', 'טל שהם'];
    console.log('=== SPECIFIC PROBLEMATIC CASES ===\n');
    
    problematicNames.forEach(name => {
        const hostage = gradientData.find(h => h.name.includes(name.replace(/'/g, '')));
        if (hostage) {
            console.log(`${name}:`);
            console.log(`  Has transition: ${hostage.hasTransition}`);
            if (hostage.hasTransition && hostage.stops.length > 1) {
                const transitionStart = parseFloat(hostage.stops[1].offset.replace('%', ''));
                console.log(`  Transition starts at: ${transitionStart.toFixed(1)}%`);
            }
            console.log('');
        } else {
            console.log(`${name}: Not found in gradient data`);
        }
    });
    
    await browser.close();
}

testGradientConsistency().catch(console.error);