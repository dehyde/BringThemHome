const puppeteer = require('puppeteer');

async function compareHostages() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Capture console logs
    const logs = [];
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('COMPARE-DEBUG') || 
            text.includes('שני גורן') || 
            text.includes('עופר קלדרון') ||
            text.includes('TRANSITION-PRECISE') ||
            text.includes('GRADIENT-STOPS')) {
            logs.push(text);
        }
    });
    
    await page.goto('http://localhost:8080');
    
    // Give time for page to load and process
    await page.waitForTimeout(8000); // Give time for all processing
    
    console.log('\n=== HOSTAGE COMPARISON DEBUG ===\n');
    
    // Filter and display logs
    const shaniLogs = logs.filter(log => log.includes('שני גורן'));
    const oferLogs = logs.filter(log => log.includes('עופר קלדרון'));
    
    console.log('=== שני גורן ===');
    shaniLogs.forEach(log => console.log(log));
    
    console.log('\n=== עופר קלדרון ===');
    oferLogs.forEach(log => console.log(log));
    
    console.log('\n=== ALL COMPARE DEBUG LOGS ===');
    logs.filter(log => log.includes('COMPARE-DEBUG')).forEach(log => console.log(log));
    
    await browser.close();
}

compareHostages().catch(console.error);