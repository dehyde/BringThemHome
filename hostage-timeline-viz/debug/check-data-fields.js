/**
 * Check what fields are available on hostage records
 * Specifically looking for נטפונג פינטה and other deceased hostages
 */

// Let's see what fields are available after data processing
console.log('=== DATA FIELD INVESTIGATION ===\n');

// Mock a hostage record based on the CSV structure
const csvRecord = {
    'Hebrew Name': 'נטפונג פינטה',
    'Current Status': 'Deceased - Returned',
    'Date of Death': 'Killed in captivity - first months',
    'Context of Death': 'Died in Captivity - Killed by Hamas',
    'Release Date': '',
    'Release/Death Circumstances': 'Body held'
};

console.log('CSV Record Fields:');
Object.keys(csvRecord).forEach(key => {
    console.log(`  "${key}": "${csvRecord[key]}"`);
});

// Check what fields the data processor would create
console.log('\nExpected processed fields (based on data-processor.js):');
console.log('  - Hebrew Name: from CSV');
console.log('  - currentStatus: from "Current Status"');
console.log('  - deathDate: parsed from "Date of Death"');
console.log('  - deathDate_valid: boolean if date parsing succeeded');
console.log('  - releaseDate: parsed from "Release Date"');  
console.log('  - releaseDate_valid: boolean if date parsing succeeded');
console.log('  - laneId: assigned by determineLane()');

console.log('\nPotential issues:');
console.log('1. Field name mismatch: sortWithinKidnappedLivingLane expects "currentStatus" but data might use "Current Status"');
console.log('2. Date parsing: "Killed in captivity - first months" is not a valid date, so deathDate_valid would be false');
console.log('3. Lane assignment: If status is "Deceased - Returned", they might not end up in kidnapped-living lane');

console.log('\nNext steps:');
console.log('- Check browser console for debug logs when page loads');
console.log('- Verify actual field names in the processed data');
console.log('- Confirm which hostages are actually in kidnapped-living lane');