const puppeteer = require('puppeteer');

async function testWithHttpServer() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('console', (msg) => {
        console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
    });
    
    page.on('pageerror', (err) => {
        console.error(`[PAGE ERROR] ${err.message}`);
    });
    
    try {
        console.log('Testing with HTTP server...');
        await page.goto('http://localhost:8080/', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        // Wait for initialization
        await page.waitForTimeout(10000);
        
        // Check results
        const results = await page.evaluate(() => {
            const svg = document.querySelector('.timeline-svg');
            const lines = document.querySelectorAll('.hostage-line');
            const container = document.getElementById('visualization-container');
            const app = window.app;
            
            return {
                svgExists: !!svg,
                svgDimensions: svg ? { 
                    width: svg.getAttribute('width'), 
                    height: svg.getAttribute('height'),
                    children: svg.children.length 
                } : null,
                hostageLineCount: lines.length,
                linesWithPaths: Array.from(lines).filter(l => l.getAttribute('d')).length,
                containerVisible: container && container.style.display !== 'none',
                appState: app ? app.getState() : null
            };
        });
        
        console.log('\n=== HTTP SERVER TEST RESULTS ===');
        console.log('SVG exists:', results.svgExists);
        console.log('SVG dimensions:', results.svgDimensions);
        console.log('Hostage lines:', results.hostageLineCount);
        console.log('Lines with paths:', results.linesWithPaths);
        console.log('Container visible:', results.containerVisible);
        console.log('App state:', results.appState);
        
        if (results.hostageLineCount > 0) {
            console.log('\n🎉 SUCCESS: Hostage lines are rendering!');
        } else {
            console.log('\n❌ STILL FAILING: No hostage lines found');
        }
        
        // Take screenshot
        await page.screenshot({ 
            path: '/Users/tombar-gal/BringThemHome/hostage-timeline-viz/debug/http-test-screenshot.png',
            fullPage: true 
        });
        
    } catch (error) {
        console.error('HTTP test failed:', error);
    } finally {
        await browser.close();
    }
}

testWithHttpServer();