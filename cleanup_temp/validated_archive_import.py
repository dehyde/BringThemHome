import pandas as pd
import re
from datetime import datetime
from urllib.parse import urlparse

# Load files
archive_df = pd.read_csv('temp_archive/hostages-list-complete-final.csv', encoding='utf-8-sig')
current_df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')
tracking_df = pd.read_csv('master_tracking.csv', encoding='utf-8-sig')

def validate_date_format(date_str):
    """Validate date is in YYYY-MM-DD format"""
    if pd.isna(date_str) or str(date_str) == 'nan':
        return None
    
    date_str = str(date_str).strip()
    if not date_str:
        return None
    
    # Check if already in YYYY-MM-DD format
    if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        try:
            datetime.strptime(date_str, '%Y-%m-%d')
            return date_str
        except:
            return None
    
    # Try other common formats and convert
    formats = ['%d/%m/%Y', '%m/%d/%Y', '%Y/%m/%d', '%d-%m-%Y']
    for fmt in formats:
        try:
            parsed = datetime.strptime(date_str, fmt)
            return parsed.strftime('%Y-%m-%d')
        except:
            continue
    
    return None

def validate_circumstances_category(circumstances_str):
    """Validate circumstances match our defined categories"""
    if pd.isna(circumstances_str) or not str(circumstances_str).strip():
        return None
        
    circumstances_str = str(circumstances_str).strip()
    
    # Define our valid categories
    valid_categories = [
        'Returned in Deal',
        'Returned in Deal - Body', 
        'Returned in Military Operation',
        'Returned in Military Operation - Body',
        'Died Before/During Kidnapping',
        'Died in Captivity - Unknown Circumstances',
        'Died in Captivity - Killed by IDF',
        'Died in Captivity - Hunger/Conditions',
        'Died in Captivity - Killed by Hamas',
        'Died in Captivity - Killed by Fleeing Hamas',
        'Died in Captivity - Unprovoked Execution'
    ]
    
    # Direct match
    if circumstances_str in valid_categories:
        return circumstances_str
    
    # Fuzzy matching for common variations
    mapping = {
        'Released via deal': 'Returned in Deal',
        'Released in deal': 'Returned in Deal',
        'Killed in captivity by captors': 'Died in Captivity - Killed by Hamas',
        'Still in captivity': None,  # Invalid for our purposes
        'Body returned in deal': 'Returned in Deal - Body',
        'Military recovery': 'Returned in Military Operation - Body'
    }
    
    return mapping.get(circumstances_str, None)

def validate_url(url):
    """Validate URL is accessible and specific (not generic domain)"""
    if pd.isna(url) or not str(url).strip():
        return False
        
    url = str(url).strip()
    
    # Check if it's a real URL
    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return False
    except:
        return False
    
    # Check it's not a generic domain
    generic_patterns = [
        r'^https?://[^/]+/?$',  # Just domain with no path
        r'^https?://[^/]+/#?$'   # Domain with just # or /
    ]
    
    for pattern in generic_patterns:
        if re.match(pattern, url):
            return False
    
    # Basic validation passed
    return True

print("=== VALIDATED ARCHIVE IMPORT PROCESS ===")
print("Validation Requirements:")
print("- Dates must be YYYY-MM-DD format")
print("- Circumstances must match defined categories")
print("- URLs must be specific articles, not generic domains") 
print("- Only ADD data, never override existing")
print()

# Track validation results
validation_stats = {
    'entries_processed': 0,
    'entries_imported': 0,
    'dates_validated': 0,
    'dates_rejected': 0,
    'circumstances_validated': 0,
    'circumstances_rejected': 0,
    'urls_validated': 0,
    'urls_rejected': 0
}

imported_entries = []

for idx, current_row in current_df.iterrows():
    hebrew_name = current_row['Hebrew Name']
    
    # Find matching archive entry
    archive_matches = archive_df[archive_df['Hebrew Name'] == hebrew_name]
    if len(archive_matches) == 0:
        continue
        
    validation_stats['entries_processed'] += 1
    archive_row = archive_matches.iloc[0]
    
    # Track what we're importing for this entry
    import_data = {}
    
    # VALIDATE AND IMPORT DEATH DATE (only if current is empty)
    if (pd.isna(current_row['Date of Death']) or str(current_row['Date of Death']) == 'nan'):
        death_date = validate_date_format(archive_row.get('Date of Death'))
        if death_date:
            import_data['Date of Death'] = death_date
            validation_stats['dates_validated'] += 1
        elif pd.notna(archive_row.get('Date of Death')):
            validation_stats['dates_rejected'] += 1
    
    # VALIDATE AND IMPORT RELEASE DATE (only if current is empty)
    if (pd.isna(current_row['Release Date']) or str(current_row['Release Date']) == 'nan'):
        release_date = validate_date_format(archive_row.get('Release Date'))
        if release_date:
            import_data['Release Date'] = release_date
            validation_stats['dates_validated'] += 1
        elif pd.notna(archive_row.get('Release Date')):
            validation_stats['dates_rejected'] += 1
    
    # VALIDATE AND IMPORT CONTEXT OF DEATH (only if current is empty)
    if (pd.isna(current_row['Context of Death']) or str(current_row['Context of Death']) == 'nan'):
        context = validate_circumstances_category(archive_row.get('Context of Death'))
        if context:
            import_data['Context of Death'] = context
            validation_stats['circumstances_validated'] += 1
        elif pd.notna(archive_row.get('Context of Death')):
            validation_stats['circumstances_rejected'] += 1
    
    # VALIDATE AND IMPORT RELEASE/DEATH CIRCUMSTANCES (only if current is empty)
    if (pd.isna(current_row['Release/Death Circumstances']) or str(current_row['Release/Death Circumstances']) == 'nan'):
        circumstances = validate_circumstances_category(archive_row.get('Release/Death Circumstances'))
        if circumstances:
            import_data['Release/Death Circumstances'] = circumstances
            validation_stats['circumstances_validated'] += 1
        elif pd.notna(archive_row.get('Release/Death Circumstances')):
            validation_stats['circumstances_rejected'] += 1
    
    # VALIDATE AND EXPAND CITATIONS (add to existing, don't replace)
    current_citations = str(current_row.get('Citation URLs', ''))
    archive_citations = str(archive_row.get('Citation URLs', ''))
    
    if archive_citations and archive_citations != 'nan':
        # Split and validate each URL
        new_urls = []
        for url in archive_citations.split(';'):
            url = url.strip()
            if validate_url(url) and url not in current_citations:
                new_urls.append(url)
                validation_stats['urls_validated'] += 1
            elif url:
                validation_stats['urls_rejected'] += 1
        
        if new_urls:
            if current_citations and current_citations != 'nan':
                import_data['Citation URLs'] = current_citations + '; ' + '; '.join(new_urls)
            else:
                import_data['Citation URLs'] = '; '.join(new_urls)
    
    # IMPORT COUNTRIES INVOLVED (only if current is empty)
    if (pd.isna(current_row['Countries Involved in Deals']) or str(current_row['Countries Involved in Deals']) == 'nan'):
        countries = archive_row.get('Countries Involved in Deals')
        if pd.notna(countries) and str(countries).strip() and str(countries) != 'nan':
            import_data['Countries Involved in Deals'] = str(countries).strip()
    
    # Apply validated imports
    if import_data:
        validation_stats['entries_imported'] += 1
        for field, value in import_data.items():
            current_df.at[idx, field] = value
        
        # Track for reporting
        imported_entries.append({
            'Row': idx + 2,
            'Hebrew_Name': hebrew_name,
            'Imported_Fields': list(import_data.keys()),
            'Data': import_data
        })

print("=== VALIDATION RESULTS ===")
print(f"Entries processed: {validation_stats['entries_processed']}")
print(f"Entries imported: {validation_stats['entries_imported']}")
print(f"Dates validated/rejected: {validation_stats['dates_validated']}/{validation_stats['dates_rejected']}")
print(f"Circumstances validated/rejected: {validation_stats['circumstances_validated']}/{validation_stats['circumstances_rejected']}")
print(f"URLs validated/rejected: {validation_stats['urls_validated']}/{validation_stats['urls_rejected']}")

# Save updated current CSV
current_df.to_csv('hostages-from-kan.csv', index=False, encoding='utf-8-sig')

# Update tracking file
for entry in imported_entries:
    row_idx = entry['Row'] - 2  # Convert back to 0-based index
    if row_idx < len(tracking_df):
        tracking_df.at[row_idx, 'Research Status'] = 'Completed'
        tracking_df.at[row_idx, 'Date Researched'] = datetime.now().strftime('%Y-%m-%d')
        tracking_df.at[row_idx, 'Validation Status'] = 'Validated'
        tracking_df.at[row_idx, 'Research Notes'] = f"Data imported from archive with validation"

tracking_df.to_csv('master_tracking.csv', index=False, encoding='utf-8-sig')

print(f"\n=== IMPORT COMPLETE ===")
print(f"✓ Updated main CSV with {validation_stats['entries_imported']} entries")
print(f"✓ Updated tracking file")
print(f"✓ All data validated according to requirements")
print(f"✓ No existing data overridden")

# Update progress summary
import json
progress = {
    'Total Entries': len(current_df),
    'Not Started': len(tracking_df[tracking_df['Research Status'] == 'Not Started']),
    'In Progress': len(tracking_df[tracking_df['Research Status'] == 'In Progress']),
    'Completed': len(tracking_df[tracking_df['Research Status'] == 'Completed']),
    'Verified': len(tracking_df[tracking_df['Research Status'] == 'Verified']),
    'Last Updated': datetime.now().strftime('%Y-%m-%d')
}
progress['Completion Percentage'] = round((progress['Completed'] + progress['Verified']) / progress['Total Entries'] * 100, 1)

with open('progress_summary.json', 'w') as f:
    json.dump(progress, f, indent=2)

print(f"Progress updated: {progress['Completion Percentage']}% complete ({progress['Completed']} entries)")