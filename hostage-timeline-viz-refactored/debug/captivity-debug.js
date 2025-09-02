const puppeteer = require('puppeteer');

async function debugCaptivityIssue() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('console', (msg) => {
        if (msg.text().includes('חטופים') || msg.text().includes('captivity') || msg.text().includes('Lane Statistics')) {
            console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
        }
    });
    
    try {
        await page.goto('http://localhost:8080/', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        await page.waitForTimeout(8000);
        
        const captivityAnalysis = await page.evaluate(() => {
            const svg = document.querySelector('.timeline-svg');
            const container = document.getElementById('main-timeline');
            const visualContainer = document.getElementById('visualization-container');
            
            // Find captivity hostage lines
            const allLines = document.querySelectorAll('.hostage-line');
            const captivityLines = Array.from(allLines).filter(line => 
                line.className.baseVal.includes('kidnapped') || 
                line.getAttribute('class').includes('kidnapped')
            );
            
            // Get lane labels
            const laneLabels = Array.from(document.querySelectorAll('.lane-label')).map(label => ({
                text: label.textContent,
                y: parseFloat(label.getAttribute('y')),
                x: parseFloat(label.getAttribute('x'))
            }));
            
            // Get container dimensions
            const containerRect = container?.getBoundingClientRect();
            const visualRect = visualContainer?.getBoundingClientRect();
            
            return {
                svgDimensions: svg ? {
                    width: svg.getAttribute('width'),
                    height: svg.getAttribute('height'),
                    actualHeight: svg.getBoundingClientRect().height,
                    viewBox: svg.getAttribute('viewBox')
                } : null,
                containerDimensions: containerRect ? {
                    width: containerRect.width,
                    height: containerRect.height,
                    scrollHeight: container.scrollHeight,
                    scrollTop: container.scrollTop
                } : null,
                visualContainerDimensions: visualRect ? {
                    width: visualRect.width, 
                    height: visualRect.height,
                    scrollHeight: visualContainer.scrollHeight,
                    overflow: getComputedStyle(visualContainer).overflow
                } : null,
                totalLines: allLines.length,
                captivityLines: captivityLines.length,
                laneLabels: laneLabels,
                captivityLaneLabels: laneLabels.filter(l => l.text.includes('חטופים')),
                viewportHeight: window.innerHeight,
                bodyScrollHeight: document.body.scrollHeight,
                firstLineY: allLines.length > 0 ? allLines[0].getBBox().y : null,
                lastLineY: allLines.length > 0 ? allLines[allLines.length - 1].getBBox().y : null
            };
        });
        
        console.log('\n=== CAPTIVITY DEBUGGING ANALYSIS ===');
        console.log('Total hostage lines:', captivityAnalysis.totalLines);
        console.log('Captivity lines found:', captivityAnalysis.captivityLines);
        console.log('SVG dimensions:', captivityAnalysis.svgDimensions);
        console.log('Container dimensions:', captivityAnalysis.containerDimensions);
        console.log('Visual container:', captivityAnalysis.visualContainerDimensions);
        console.log('Viewport height:', captivityAnalysis.viewportHeight);
        console.log('Body scroll height:', captivityAnalysis.bodyScrollHeight);
        
        console.log('\n=== LANE LABELS ===');
        captivityAnalysis.laneLabels.forEach(label => {
            console.log(`"${label.text}" at Y: ${label.y}`);
        });
        
        console.log('\n=== CAPTIVITY LANE LABELS ===');
        captivityAnalysis.captivityLaneLabels.forEach(label => {
            console.log(`"${label.text}" at Y: ${label.y} (visible: ${label.y < captivityAnalysis.viewportHeight})`);
        });
        
        console.log('\n=== LINE POSITIONING ===');
        console.log('First line Y:', captivityAnalysis.firstLineY);
        console.log('Last line Y:', captivityAnalysis.lastLineY);
        
        // Scroll to bottom to see captivity sections
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        
        await page.waitForTimeout(1000);
        
        // Take screenshots
        await page.screenshot({ 
            path: '/Users/tombar-gal/BringThemHome/hostage-timeline-viz/debug/captivity-debug-full.png',
            fullPage: true 
        });
        
        await page.screenshot({ 
            path: '/Users/tombar-gal/BringThemHome/hostage-timeline-viz/debug/captivity-debug-viewport.png',
            fullPage: false 
        });
        
        // Check what's visible after scrolling
        const afterScroll = await page.evaluate(() => {
            const visualContainer = document.getElementById('visualization-container');
            return {
                scrollTop: window.pageYOffset,
                scrollLeft: window.pageXOffset,
                containerRect: visualContainer?.getBoundingClientRect()
            };
        });
        
        console.log('\n=== AFTER SCROLLING ===');
        console.log('Scroll position:', afterScroll);
        
        if (captivityAnalysis.captivityLines === 0) {
            console.log('\n❌ ISSUE: No captivity lines found in DOM');
            console.log('This suggests lane classification or CSS selector issues');
        } else if (captivityAnalysis.captivityLaneLabels.some(l => l.y > captivityAnalysis.viewportHeight)) {
            console.log('\n❌ ISSUE: Captivity lanes positioned below viewport');
            console.log('Container height or scrolling issue');
        }
        
    } catch (error) {
        console.error('Captivity debug failed:', error);
    } finally {
        await browser.close();
    }
}

debugCaptivityIssue();