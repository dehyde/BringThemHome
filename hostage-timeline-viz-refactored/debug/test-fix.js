const puppeteer = require('puppeteer');

async function testCaptivityFix() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        await page.goto('http://localhost:8080/', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        await page.waitForTimeout(5000);
        
        const testResults = await page.evaluate(() => {
            const container = document.getElementById('main-timeline');
            const captivityLabels = Array.from(document.querySelectorAll('.lane-label')).filter(l => 
                l.textContent.includes('חטופים')
            );
            
            // Test scrolling to captivity section
            const containerRect = container.getBoundingClientRect();
            const containerStyles = getComputedStyle(container);
            
            return {
                containerDimensions: {
                    width: containerRect.width,
                    height: containerRect.height,
                    scrollHeight: container.scrollHeight,
                    overflowY: containerStyles.overflowY,
                    maxHeight: containerStyles.maxHeight
                },
                captivityLabels: captivityLabels.map(label => ({
                    text: label.textContent,
                    y: parseFloat(label.getAttribute('y')),
                    visible: label.getBoundingClientRect().top < window.innerHeight
                })),
                canScroll: container.scrollHeight > container.clientHeight
            };
        });
        
        console.log('\n=== CAPTIVITY FIX TEST RESULTS ===');
        console.log('Container can scroll:', testResults.canScroll);
        console.log('Container overflow-y:', testResults.containerDimensions.overflowY);
        console.log('Container max-height:', testResults.containerDimensions.maxHeight);
        console.log('Scroll height:', testResults.containerDimensions.scrollHeight);
        console.log('Client height:', testResults.containerDimensions.height);
        
        console.log('\n=== CAPTIVITY LABELS ===');
        testResults.captivityLabels.forEach(label => {
            console.log(`"${label.text}" at Y: ${label.y} - Initially visible: ${label.visible}`);
        });
        
        // Test scrolling to bottom
        await page.evaluate(() => {
            const container = document.getElementById('main-timeline');
            container.scrollTop = container.scrollHeight;
        });
        
        await page.waitForTimeout(1000);
        
        const afterScroll = await page.evaluate(() => {
            const container = document.getElementById('main-timeline');
            const captivityLabels = Array.from(document.querySelectorAll('.lane-label')).filter(l => 
                l.textContent.includes('חטופים')
            );
            
            const containerRect = container.getBoundingClientRect();
            
            return {
                scrollTop: container.scrollTop,
                captivityLabelsVisible: captivityLabels.map(label => {
                    const rect = label.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    return {
                        text: label.textContent,
                        visibleInContainer: rect.top >= containerRect.top && rect.bottom <= containerRect.bottom
                    };
                })
            };
        });
        
        console.log('\n=== AFTER SCROLLING TO BOTTOM ===');
        console.log('Scroll position:', afterScroll.scrollTop);
        afterScroll.captivityLabelsVisible.forEach(label => {
            console.log(`"${label.text}" visible in container: ${label.visibleInContainer}`);
        });
        
        // Take final screenshot
        await page.screenshot({ 
            path: '/Users/tombar-gal/BringThemHome/hostage-timeline-viz/debug/fix-test-result.png',
            fullPage: true 
        });
        
        const success = testResults.canScroll && afterScroll.captivityLabelsVisible.some(l => l.visibleInContainer);
        
        if (success) {
            console.log('\n🎉 SUCCESS: Captivity hostages are now accessible via scrolling!');
        } else {
            console.log('\n❌ ISSUE: Captivity hostages still not properly accessible');
        }
        
        return success;
        
    } catch (error) {
        console.error('Fix test failed:', error);
        return false;
    } finally {
        await browser.close();
    }
}

testCaptivityFix();