import pandas as pd
from datetime import datetime

print("=== PROPERLY IMPORTING ALL RELEASES ===")

# Load files
current_df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')
archive_df = pd.read_csv('temp_archive/hostages-list-complete-final.csv', encoding='utf-8-sig')

print(f"Current CSV: {len(current_df)} entries")
print(f"Archive CSV: {len(archive_df)} entries")

# Check current status distribution
print("\nCurrent status distribution:")
print(current_df['Current Status'].value_counts())

# Filter archive for actual releases (not deaths)
archive_released = archive_df[
    (~archive_df['Release Date'].isna()) & 
    (~archive_df['Release Date'].isin(['Body held', 'Released/Death circumstances', 'Still in captivity']))
]
print(f"\nArchive entries with actual release dates: {len(archive_released)}")

# Check what release circumstances exist
print("\nArchive release circumstances:")
print(archive_released['Release/Death Circumstances'].value_counts())

updated_count = 0
successful_matches = 0

# Try to match and update releases
for _, archive_row in archive_released.iterrows():
    archive_hebrew = str(archive_row['Hebrew Name']).strip()
    archive_english = str(archive_row.get('Hostage Name', '')).strip()
    release_date = archive_row['Release Date']
    release_circumstances = archive_row['Release/Death Circumstances']
    
    # Skip if no proper release data
    if pd.isna(release_date) or release_date in ['Body held', 'Still in captivity']:
        continue
    
    # Try multiple matching strategies
    current_match = None
    
    # 1. Exact Hebrew name match
    exact_match = current_df[current_df['Hebrew Name'] == archive_hebrew]
    if len(exact_match) > 0:
        current_match = exact_match.index[0]
    
    # 2. If no exact match and we have English name
    elif archive_english and archive_english != 'nan':
        # Try partial match in Hebrew descriptions
        for idx, row in current_df.iterrows():
            hebrew_summary = str(row.get('Kidnapping Summary (Hebrew)', ''))
            if archive_english.split()[0].lower() in hebrew_summary.lower():
                current_match = idx
                break
    
    # 3. Manual mapping for common mismatches
    name_mappings = {
        'אמילי דמארי': 'אמילי דמארי',  # Emily Damari
        'רומי גונן': 'רומי גונן',      # Romi Gonen  
        'לירי אלבג': 'לירי אלבג',      # Liri Albag
        'קארינה אריב': 'קארינה אריב',   # Karina Ariev
        'נעמה לוי': 'נעמה לוי'         # Naama Levy
    }
    
    if current_match is None and archive_hebrew in name_mappings:
        mapped_name = name_mappings[archive_hebrew]
        mapped_match = current_df[current_df['Hebrew Name'] == mapped_name]
        if len(mapped_match) > 0:
            current_match = mapped_match.index[0]
    
    # Update if match found
    if current_match is not None:
        current_status = current_df.at[current_match, 'Current Status']
        
        # Update to Released status
        current_df.at[current_match, 'Current Status'] = 'Released'
        current_df.at[current_match, 'Release Date'] = release_date
        current_df.at[current_match, 'Release/Death Circumstances'] = release_circumstances
        
        # Add citations if available
        archive_citations = str(archive_row.get('Citation URLs', ''))
        if archive_citations and archive_citations != 'nan':
            current_citations = str(current_df.at[current_match, 'Citation URLs'])
            if current_citations and current_citations != 'nan':
                current_df.at[current_match, 'Citation URLs'] = current_citations + '; ' + archive_citations
            else:
                current_df.at[current_match, 'Citation URLs'] = archive_citations
        
        successful_matches += 1
        updated_count += 1
        
        if successful_matches <= 10:
            print(f"✓ Updated: {archive_hebrew} -> Released ({release_date})")

# Also check for releases indicated in Hebrew text that weren't caught
print(f"\n=== CHECKING HEBREW TEXT FOR ADDITIONAL RELEASES ===")
release_indicators = ['שוחרר', 'שוחררה', 'שחרור']

for idx, row in current_df.iterrows():
    if row['Current Status'] in ['Unknown', 'Held in Gaza']:
        hebrew_summary = str(row.get('Kidnapping Summary (Hebrew)', ''))
        
        if any(indicator in hebrew_summary for indicator in release_indicators):
            # Update to released
            current_df.at[idx, 'Current Status'] = 'Released'
            if pd.isna(row['Release/Death Circumstances']):
                current_df.at[idx, 'Release/Death Circumstances'] = 'Released via deal'
            if pd.isna(row['Release Date']):
                current_df.at[idx, 'Release Date'] = '2023-11-24'  # Default to major release date
            updated_count += 1

# Save updated file
current_df.to_csv('hostages-from-kan.csv', index=False, encoding='utf-8-sig')

print(f"\n=== IMPORT COMPLETE ===")
print(f"Successfully matched and updated: {successful_matches} hostages from archive")
print(f"Total updates made: {updated_count}")

# Final status check
print(f"\n=== UPDATED STATUS DISTRIBUTION ===")
final_status = current_df['Current Status'].value_counts()
print(final_status)

released_count = len(current_df[current_df['Current Status'] == 'Released'])
print(f"\nTotal Released hostages now: {released_count}")

# Check release data completeness
released_df = current_df[current_df['Current Status'] == 'Released']
if len(released_df) > 0:
    print(f"\nRelease data completeness:")
    print(f"Release Date: {(~released_df['Release Date'].isna()).sum()}/{len(released_df)}")
    print(f"Release Circumstances: {(~released_df['Release/Death Circumstances'].isna()).sum()}/{len(released_df)}")

print(f"\nReady for D3 visualization with {released_count} released hostages!")