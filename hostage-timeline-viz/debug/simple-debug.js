const puppeteer = require('puppeteer');
const path = require('path');

async function simpleDebug() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('console', (msg) => {
        console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
    });
    
    page.on('pageerror', (err) => {
        console.error(`[PAGE ERROR] ${err.message}`);
    });
    
    try {
        const testPagePath = `file://${path.resolve(__dirname, 'simple-test.html')}`;
        console.log(`Loading: ${testPagePath}`);
        
        await page.goto(testPagePath, { waitUntil: 'networkidle0' });
        await page.waitForTimeout(3000);
        
        const results = await page.evaluate(() => {
            return document.getElementById('results').innerHTML;
        });
        
        console.log('\n=== RESULTS ===');
        console.log(results);
        
    } catch (error) {
        console.error('Simple debug failed:', error);
    } finally {
        await browser.close();
    }
}

simpleDebug();