/**
 * Test hover/tooltip functionality
 */

const puppeteer = require('puppeteer');

async function testHoverFunctionality() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        await page.goto('http://localhost:8080/', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        await page.waitForTimeout(8000);
        
        const hoverResults = await page.evaluate(() => {
            const lines = Array.from(document.querySelectorAll('.hostage-line')).slice(0, 5);
            const results = [];
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const name = line.getAttribute('data-name');
                
                try {
                    // Get line position
                    const rect = line.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    
                    // Simulate mouseenter
                    const event = new MouseEvent('mouseenter', {
                        view: window,
                        bubbles: true,
                        cancelable: true,
                        clientX: centerX,
                        clientY: centerY
                    });
                    
                    line.dispatchEvent(event);
                    
                    // Wait a moment for tooltip to appear
                    setTimeout(() => {}, 100);
                    
                    // Check for tooltip
                    const tooltip = document.querySelector('.tooltip, [class*="tooltip"]');
                    const hasTooltip = !!tooltip;
                    let tooltipContent = null;
                    
                    if (tooltip) {
                        tooltipContent = tooltip.textContent || tooltip.innerHTML;
                    }
                    
                    // Check line styling
                    const computedStyle = window.getComputedStyle(line);
                    const strokeWidth = computedStyle.strokeWidth;
                    
                    results.push({
                        index: i,
                        name: name,
                        hasDataName: !!name,
                        hasTooltip: hasTooltip,
                        tooltipContent: tooltipContent ? tooltipContent.substring(0, 100) : null,
                        strokeWidth: strokeWidth,
                        pathLength: line.getAttribute('d')?.length || 0,
                        rectValid: rect.width > 0 && rect.height > 0
                    });
                    
                    // Clean up - mouse leave
                    line.dispatchEvent(new MouseEvent('mouseleave'));
                    
                } catch (error) {
                    results.push({
                        index: i,
                        name: name || 'unknown',
                        error: error.message
                    });
                }
            }
            
            return {
                results,
                totalLines: document.querySelectorAll('.hostage-line').length,
                hasInteractionManager: !!window.app?.interactionManager,
                tooltipElements: document.querySelectorAll('.tooltip, [class*="tooltip"]').length
            };
        });
        
        console.log('\n=== HOVER FUNCTIONALITY TEST ===');
        console.log(`Total hostage lines: ${hoverResults.totalLines}`);
        console.log(`Has interaction manager: ${hoverResults.hasInteractionManager}`);
        console.log(`Tooltip elements in DOM: ${hoverResults.tooltipElements}`);
        
        console.log('\n=== INDIVIDUAL LINE TESTS ===');
        let workingHovers = 0;
        let failedHovers = 0;
        
        hoverResults.results.forEach(result => {
            if (result.error) {
                console.log(`❌ Line ${result.index}: Error - ${result.error}`);
                failedHovers++;
            } else {
                const status = result.hasTooltip ? '✅' : '❌';
                console.log(`${status} Line ${result.index}: ${result.name}`);
                console.log(`     Data-name: ${result.hasDataName}, Tooltip: ${result.hasTooltip}`);
                console.log(`     Stroke width: ${result.strokeWidth}, Path length: ${result.pathLength}`);
                console.log(`     Valid rect: ${result.rectValid}`);
                
                if (result.tooltipContent) {
                    console.log(`     Tooltip content: ${result.tooltipContent}`);
                }
                
                if (result.hasTooltip) {
                    workingHovers++;
                } else {
                    failedHovers++;
                }
            }
            console.log('');
        });
        
        console.log('=== SUMMARY ===');
        console.log(`Working hovers: ${workingHovers}`);
        console.log(`Failed hovers: ${failedHovers}`);
        
        if (failedHovers > 0) {
            console.log('\n🎯 HOVER ISSUES DETECTED:');
            if (!hoverResults.hasInteractionManager) {
                console.log('   - Interaction manager not found');
            }
            if (hoverResults.tooltipElements === 0) {
                console.log('   - No tooltip elements in DOM');
                console.log('   - Check interaction.js showTooltip() implementation');
            }
            console.log('   - Lines have data-name attributes but tooltips not appearing');
        } else {
            console.log('✅ All hover tests passed');
        }
        
        return hoverResults;
        
    } catch (error) {
        console.error('Hover test failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

testHoverFunctionality();