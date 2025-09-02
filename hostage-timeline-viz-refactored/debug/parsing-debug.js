/**
 * Headless Browser Debug for Data Parsing Issues
 * Root cause analysis for incorrect lane assignments and missing transitions
 */

const puppeteer = require('puppeteer');

async function debugParsingIssues() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('console', (msg) => {
        if (msg.text().includes('warning') || msg.text().includes('error') || msg.text().includes('Unclear')) {
            console.log(`[BROWSER WARNING] ${msg.text()}`);
        }
    });
    
    try {
        await page.goto('http://localhost:8080/', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        await page.waitForTimeout(8000);
        
        // Extract detailed hostage data for analysis
        const parsingAnalysis = await page.evaluate(() => {
            const app = window.app;
            const rawData = app?.data || [];
            
            // Analyze lane assignments
            const laneAnalysis = {};
            const transitionAnalysis = {
                shouldTransition: [],
                noTransition: [],
                incorrectLane: []
            };
            
            rawData.forEach(hostage => {
                const name = hostage['Hebrew Name'];
                const currentStatus = hostage['Current Status'];
                const releaseDate = hostage['Release Date'];
                const deathDate = hostage['Date of Death'];
                const finalLane = hostage.finalLane;
                const hasTransition = hostage.hasTransition;
                const path = hostage.path;
                
                // Track lane distribution
                if (!laneAnalysis[finalLane]) {
                    laneAnalysis[finalLane] = [];
                }
                laneAnalysis[finalLane].push({
                    name,
                    currentStatus,
                    releaseDate,
                    deathDate,
                    hasTransition,
                    pathLength: path ? path.length : 0
                });
                
                // Identify problematic cases
                const isReleased = currentStatus?.includes('Released') || currentStatus?.includes('Deceased - Returned');
                const isInCaptivityLane = finalLane?.includes('kidnapped');
                
                if (isReleased && isInCaptivityLane) {
                    transitionAnalysis.incorrectLane.push({
                        name,
                        currentStatus,
                        finalLane,
                        releaseDate,
                        issue: 'Released hostage assigned to captivity lane'
                    });
                }
                
                if (isReleased && !hasTransition) {
                    transitionAnalysis.noTransition.push({
                        name,
                        currentStatus,
                        finalLane,
                        releaseDate,
                        issue: 'Released hostage has no transition path'
                    });
                }
                
                if (releaseDate && isInCaptivityLane) {
                    transitionAnalysis.shouldTransition.push({
                        name,
                        currentStatus,
                        finalLane,
                        releaseDate,
                        issue: 'Has release date but in captivity lane'
                    });
                }
            });
            
            // Analyze captivity lane overlap
            const captivityAnalysis = {
                living: laneAnalysis['kidnapped-living'] || [],
                deceased: laneAnalysis['kidnapped-deceased'] || []
            };
            
            // Check for status mismatches in captivity lanes
            const statusMismatches = [];
            
            captivityAnalysis.living.forEach(hostage => {
                if (hostage.deathDate || hostage.currentStatus?.includes('Deceased')) {
                    statusMismatches.push({
                        name: hostage.name,
                        lane: 'living',
                        issue: 'Deceased hostage in living lane',
                        status: hostage.currentStatus,
                        deathDate: hostage.deathDate
                    });
                }
            });
            
            captivityAnalysis.deceased.forEach(hostage => {
                if (!hostage.deathDate && !hostage.currentStatus?.includes('Deceased')) {
                    statusMismatches.push({
                        name: hostage.name,
                        lane: 'deceased', 
                        issue: 'Living hostage in deceased lane',
                        status: hostage.currentStatus,
                        deathDate: hostage.deathDate
                    });
                }
            });
            
            return {
                totalHostages: rawData.length,
                laneDistribution: Object.fromEntries(
                    Object.entries(laneAnalysis).map(([lane, hostages]) => [lane, hostages.length])
                ),
                transitionIssues: {
                    incorrectLaneCount: transitionAnalysis.incorrectLane.length,
                    noTransitionCount: transitionAnalysis.noTransition.length,
                    shouldTransitionCount: transitionAnalysis.shouldTransition.length,
                    examples: {
                        incorrectLane: transitionAnalysis.incorrectLane.slice(0, 5),
                        noTransition: transitionAnalysis.noTransition.slice(0, 5),
                        shouldTransition: transitionAnalysis.shouldTransition.slice(0, 5)
                    }
                },
                statusMismatches: {
                    count: statusMismatches.length,
                    examples: statusMismatches.slice(0, 10)
                },
                captivityOverlapAnalysis: {
                    livingCount: captivityAnalysis.living.length,
                    deceasedCount: captivityAnalysis.deceased.length,
                    livingExamples: captivityAnalysis.living.slice(0, 5).map(h => ({
                        name: h.name,
                        status: h.currentStatus,
                        deathDate: h.deathDate,
                        releaseDate: h.releaseDate
                    })),
                    deceasedExamples: captivityAnalysis.deceased.slice(0, 5).map(h => ({
                        name: h.name,
                        status: h.currentStatus,
                        deathDate: h.deathDate,
                        releaseDate: h.releaseDate
                    }))
                }
            };
        });
        
        console.log('\n=== DATA PARSING ROOT CAUSE ANALYSIS ===');
        console.log('Total hostages processed:', parsingAnalysis.totalHostages);
        
        console.log('\n=== LANE DISTRIBUTION ===');
        Object.entries(parsingAnalysis.laneDistribution).forEach(([lane, count]) => {
            console.log(`${lane}: ${count} hostages`);
        });
        
        console.log('\n=== TRANSITION ISSUES ===');
        console.log('Released hostages in captivity lanes:', parsingAnalysis.transitionIssues.incorrectLaneCount);
        console.log('Released hostages without transitions:', parsingAnalysis.transitionIssues.noTransitionCount);
        console.log('Hostages with release dates in captivity:', parsingAnalysis.transitionIssues.shouldTransitionCount);
        
        console.log('\n=== EXAMPLES OF INCORRECT LANE ASSIGNMENTS ===');
        parsingAnalysis.transitionIssues.examples.incorrectLane.forEach(example => {
            console.log(`❌ ${example.name}: Status="${example.currentStatus}", Lane="${example.finalLane}"`);
        });
        
        console.log('\n=== EXAMPLES OF MISSING TRANSITIONS ===');
        parsingAnalysis.transitionIssues.examples.noTransition.forEach(example => {
            console.log(`❌ ${example.name}: Released but no transition, Release Date: ${example.releaseDate}`);
        });
        
        console.log('\n=== STATUS MISMATCHES IN CAPTIVITY LANES ===');
        console.log('Total status mismatches:', parsingAnalysis.statusMismatches.count);
        parsingAnalysis.statusMismatches.examples.forEach(mismatch => {
            console.log(`❌ ${mismatch.name}: ${mismatch.issue} - Status: "${mismatch.status}"`);
        });
        
        console.log('\n=== CAPTIVITY LANE OVERLAP ANALYSIS ===');
        console.log('Living captivity:', parsingAnalysis.captivityOverlapAnalysis.livingCount);
        console.log('Deceased captivity:', parsingAnalysis.captivityOverlapAnalysis.deceasedCount);
        
        console.log('\n=== LIVING CAPTIVITY EXAMPLES ===');
        parsingAnalysis.captivityOverlapAnalysis.livingExamples.forEach(example => {
            console.log(`- ${example.name}: Status="${example.status}", Death=${example.deathDate || 'None'}, Release=${example.releaseDate || 'None'}`);
        });
        
        console.log('\n=== DECEASED CAPTIVITY EXAMPLES ===');
        parsingAnalysis.captivityOverlapAnalysis.deceasedExamples.forEach(example => {
            console.log(`- ${example.name}: Status="${example.status}", Death=${example.deathDate || 'None'}, Release=${example.releaseDate || 'None'}`);
        });
        
        // Save detailed analysis
        const reportPath = '/Users/tombar-gal/BringThemHome/hostage-timeline-viz/debug/parsing-analysis-report.json';
        require('fs').writeFileSync(reportPath, JSON.stringify(parsingAnalysis, null, 2));
        console.log(`\nDetailed report saved to: ${reportPath}`);
        
        // Root cause determination
        console.log('\n=== ROOT CAUSE ANALYSIS ===');
        
        if (parsingAnalysis.transitionIssues.incorrectLaneCount > 0) {
            console.log('🎯 PRIMARY ISSUE: Lane assignment logic incorrectly classifying released hostages');
            console.log('   Location: data-processor.js determineLane() function');
        }
        
        if (parsingAnalysis.statusMismatches.count > 0) {
            console.log('🎯 SECONDARY ISSUE: Status parsing logic creating living/deceased overlap');
            console.log('   Location: data-processor.js status interpretation');
        }
        
        if (parsingAnalysis.transitionIssues.noTransitionCount > 0) {
            console.log('🎯 TERTIARY ISSUE: Transition path generation failing for released hostages');
            console.log('   Location: data-processor.js generateTransitionPaths() function');
        }
        
        return parsingAnalysis;
        
    } catch (error) {
        console.error('Parsing debug failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Run analysis
debugParsingIssues()
    .then(() => {
        console.log('\nParsing analysis completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Parsing analysis failed:', error);
        process.exit(1);
    });