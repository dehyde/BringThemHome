/**
 * Headless Browser Debug Script for Hostage Timeline Visualization
 * Captures debug data and identifies root causes
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function debugHostageTimeline() {
    console.log('Starting headless browser debug session...');
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Enable console message capture
    const consoleMessages = [];
    const errors = [];
    
    page.on('console', async (msg) => {
        const text = msg.text();
        console.log(`[BROWSER] ${msg.type().toUpperCase()}: ${text}`);
        
        // Get detailed error information for JSHandle errors
        const args = msg.args();
        const detailedArgs = [];
        for (const arg of args) {
            try {
                const value = await arg.jsonValue();
                detailedArgs.push(value);
            } catch (e) {
                try {
                    const errorText = await arg.evaluate(obj => {
                        if (obj instanceof Error) {
                            return `${obj.name}: ${obj.message}\n${obj.stack}`;
                        }
                        return obj.toString();
                    });
                    detailedArgs.push(errorText);
                } catch (e2) {
                    detailedArgs.push('[Complex Object]');
                }
            }
        }
        
        consoleMessages.push({
            type: msg.type(),
            text: text,
            detailedArgs: detailedArgs,
            timestamp: new Date().toISOString()
        });
    });
    
    page.on('pageerror', (err) => {
        console.error(`[PAGE ERROR] ${err.message}`);
        errors.push({
            type: 'pageerror',
            message: err.message,
            stack: err.stack,
            timestamp: new Date().toISOString()
        });
    });
    
    page.on('requestfailed', (request) => {
        console.error(`[REQUEST FAILED] ${request.url()} - ${request.failure().errorText}`);
        errors.push({
            type: 'requestfailed',
            url: request.url(),
            error: request.failure().errorText,
            timestamp: new Date().toISOString()
        });
    });
    
    try {
        // Navigate to debug page
        const debugPagePath = `file://${path.resolve(__dirname, 'debug-enhanced.html')}`;
        console.log(`Loading debug page: ${debugPagePath}`);
        
        await page.goto(debugPagePath, { 
            waitUntil: ['networkidle0', 'domcontentloaded'],
            timeout: 30000
        });
        
        // Wait for application to initialize
        console.log('Waiting for application initialization...');
        await page.waitForTimeout(5000);
        
        // Check if visualization container is visible
        const visualizationVisible = await page.evaluate(() => {
            const container = document.getElementById('visualization-container');
            return container && container.style.display !== 'none';
        });
        
        console.log(`Visualization container visible: ${visualizationVisible}`);
        
        // Capture debug data
        const debugData = await page.evaluate(() => {
            // Trigger analysis
            if (window.debugApp) {
                window.debugApp.analyzeVisualization();
            }
            
            return {
                debugData: window.debugData,
                domAnalysis: window.debugApp ? window.debugApp.getDOMAnalysis() : null,
                appState: window.app ? window.app.getState() : null,
                svgExists: !!document.querySelector('.timeline-svg'),
                svgDimensions: (() => {
                    const svg = document.querySelector('.timeline-svg');
                    return svg ? {
                        width: svg.getAttribute('width'),
                        height: svg.getAttribute('height'),
                        children: svg.children.length
                    } : null;
                })(),
                hostageLineCount: document.querySelectorAll('.hostage-line').length,
                hostageLineDetails: Array.from(document.querySelectorAll('.hostage-line')).slice(0, 5).map((line, index) => ({
                    index,
                    hasPath: !!line.getAttribute('d'),
                    pathLength: line.getAttribute('d')?.length || 0,
                    pathPreview: line.getAttribute('d')?.substring(0, 100) || 'EMPTY',
                    stroke: line.style.stroke,
                    strokeWidth: line.style.strokeWidth,
                    className: line.className.baseVal
                }))
            };
        });
        
        // Take screenshot for visual analysis
        console.log('Taking screenshot...');
        await page.screenshot({ 
            path: path.join(__dirname, 'debug-screenshot.png'),
            fullPage: true 
        });
        
        // Compile comprehensive debug report
        const debugReport = {
            timestamp: new Date().toISOString(),
            browserInfo: await page.evaluate(() => ({
                userAgent: navigator.userAgent,
                viewportSize: {
                    width: window.innerWidth,
                    height: window.innerHeight
                }
            })),
            consoleMessages,
            errors,
            debugData,
            rootCauseAnalysis: analyzeRootCause(debugData, errors, consoleMessages)
        };
        
        // Save debug report
        const reportPath = path.join(__dirname, `debug-report-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(debugReport, null, 2));
        console.log(`Debug report saved to: ${reportPath}`);
        
        // Print immediate findings
        console.log('\n=== IMMEDIATE FINDINGS ===');
        console.log(`SVG Element: ${debugData.svgExists ? 'EXISTS' : 'MISSING'}`);
        console.log(`Hostage Lines Found: ${debugData.hostageLineCount}`);
        console.log(`Application State:`, debugData.appState);
        console.log(`DOM Analysis:`, debugData.domAnalysis);
        
        if (debugData.hostageLineDetails) {
            console.log('\n=== HOSTAGE LINE ANALYSIS ===');
            debugData.hostageLineDetails.forEach(line => {
                console.log(`Line ${line.index}: Path=${line.hasPath ? 'YES' : 'NO'}, Length=${line.pathLength}, Stroke=${line.stroke}`);
            });
        }
        
        console.log('\n=== ROOT CAUSE ANALYSIS ===');
        console.log(debugReport.rootCauseAnalysis);
        
        return debugReport;
        
    } catch (error) {
        console.error('Debug session failed:', error);
        errors.push({
            type: 'debug_session_error',
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        throw error;
    } finally {
        await browser.close();
    }
}

function analyzeRootCause(debugData, errors, consoleMessages) {
    const analysis = {
        primaryIssue: 'UNKNOWN',
        evidence: [],
        recommendations: []
    };
    
    // Check for missing SVG
    if (!debugData.svgExists) {
        analysis.primaryIssue = 'SVG_CONTAINER_MISSING';
        analysis.evidence.push('Timeline SVG element not found in DOM');
        analysis.recommendations.push('Check TimelineCore initialization');
        return analysis;
    }
    
    // Check for missing hostage lines
    if (debugData.hostageLineCount === 0) {
        analysis.primaryIssue = 'NO_HOSTAGE_LINES_RENDERED';
        analysis.evidence.push('No .hostage-line elements found in DOM');
        analysis.recommendations.push('Check data binding and path generation in main.js renderHostageLines()');
        return analysis;
    }
    
    // Check for empty paths
    const linesWithPaths = debugData.hostageLineDetails?.filter(line => line.hasPath && line.pathLength > 0) || [];
    const emptyPaths = debugData.hostageLineDetails?.filter(line => !line.hasPath || line.pathLength === 0) || [];
    
    if (emptyPaths.length > 0 && linesWithPaths.length === 0) {
        analysis.primaryIssue = 'EMPTY_SVG_PATHS';
        analysis.evidence.push(`All ${debugData.hostageLineCount} lines have empty or missing path data`);
        analysis.evidence.push('TransitionEngine.generateTransitionPath() likely returning empty strings');
        analysis.recommendations.push('Debug TransitionEngine path generation logic');
        analysis.recommendations.push('Check if hostage records have proper path data structure');
        return analysis;
    }
    
    // Check for partial rendering
    if (emptyPaths.length > 0 && linesWithPaths.length > 0) {
        analysis.primaryIssue = 'PARTIAL_PATH_GENERATION';
        analysis.evidence.push(`${linesWithPaths.length} lines have paths, ${emptyPaths.length} are empty`);
        analysis.recommendations.push('Check data consistency and path generation for specific hostage records');
        return analysis;
    }
    
    // Check for coordinate issues
    if (debugData.domAnalysis?.hostageLines?.count > 0) {
        analysis.primaryIssue = 'COORDINATE_CALCULATION_ISSUES';
        analysis.evidence.push('Lines exist with paths but may be positioned incorrectly');
        analysis.recommendations.push('Check LaneManager Y-coordinate calculations');
        analysis.recommendations.push('Verify TimelineCore X-scale domain/range');
        return analysis;
    }
    
    // Look for specific errors in console
    const pathErrors = consoleMessages.filter(msg => 
        msg.text.includes('path') || 
        msg.text.includes('coordinate') || 
        msg.text.includes('TransitionEngine') ||
        msg.text.includes('undefined')
    );
    
    if (pathErrors.length > 0) {
        analysis.primaryIssue = 'JAVASCRIPT_ERRORS';
        analysis.evidence = pathErrors.map(err => err.text);
        analysis.recommendations.push('Fix JavaScript errors related to path generation');
        return analysis;
    }
    
    analysis.primaryIssue = 'REQUIRES_DEEPER_INVESTIGATION';
    analysis.evidence.push('Basic checks passed, issue may be in styling or complex logic');
    analysis.recommendations.push('Manual browser inspection needed');
    
    return analysis;
}

// Run debug session
if (require.main === module) {
    debugHostageTimeline()
        .then(() => {
            console.log('Debug session completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Debug session failed:', error);
            process.exit(1);
        });
}

module.exports = { debugHostageTimeline };