import pandas as pd
from datetime import datetime

print("=== IMPORTING RELEASE DATA FROM ARCHIVE ===")

# Load files
current_df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')
archive_df = pd.read_csv('temp_archive/hostages-list-complete-final.csv', encoding='utf-8-sig')

# Filter archive for released hostages (those with release dates)
released_archive = archive_df[~archive_df['Release Date'].isna()]
print(f"Found {len(released_archive)} released hostages in archive")

updated_count = 0
new_releases = 0
no_match_count = 0

for _, archive_row in released_archive.iterrows():
    hebrew_name = archive_row['Hebrew Name']
    
    # Find matching entry in current CSV
    current_match = current_df[current_df['Hebrew Name'] == hebrew_name]
    
    if len(current_match) == 0:
        no_match_count += 1
        continue
    
    current_idx = current_match.index[0]
    current_status = current_df.at[current_idx, 'Current Status']
    
    # Update release information
    release_date = archive_row['Release Date']
    release_circumstances = archive_row['Release/Death Circumstances']
    
    if pd.notna(release_date):
        current_df.at[current_idx, 'Release Date'] = release_date
        
        if pd.notna(release_circumstances):
            current_df.at[current_idx, 'Release/Death Circumstances'] = release_circumstances
        
        # Update status if needed
        if current_status in ['Unknown', 'Held in Gaza']:
            current_df.at[current_idx, 'Current Status'] = 'Released'
            new_releases += 1
        
        # Add citations if available
        archive_citations = str(archive_row.get('Citation URLs', ''))
        if archive_citations and archive_citations != 'nan':
            current_citations = str(current_df.at[current_idx, 'Citation URLs'])
            if current_citations and current_citations != 'nan':
                current_df.at[current_idx, 'Citation URLs'] = current_citations + '; ' + archive_citations
            else:
                current_df.at[current_idx, 'Citation URLs'] = archive_citations
        
        updated_count += 1

print(f"No matches found for {no_match_count} archive entries")

# Save updated file
current_df.to_csv('hostages-from-kan.csv', index=False, encoding='utf-8-sig')

print(f"\n=== RELEASE DATA IMPORT COMPLETE ===")
print(f"Updated {updated_count} hostages with release data")
print(f"Changed status to 'Released' for {new_releases} hostages")

# Check final status distribution
print("\n--- Updated Status Distribution ---")
print(current_df['Current Status'].value_counts())

# Check release data completeness
released_df = current_df[current_df['Current Status'] == 'Released']
if len(released_df) > 0:
    print(f"\n--- Released Hostages ({len(released_df)} total) ---")
    release_date_filled = (~released_df['Release Date'].isna()).sum()
    circumstances_filled = (~released_df['Release/Death Circumstances'].isna()).sum()
    print(f"Release Date: {release_date_filled}/{len(released_df)} filled")
    print(f"Release Circumstances: {circumstances_filled}/{len(released_df)} filled")
else:
    print("\nNo entries with 'Released' status found")

# Also import death data from archive
print("\n=== IMPORTING DEATH DATA FROM ARCHIVE ===")
deceased_archive = archive_df[~archive_df['Date of Death'].isna()]
death_updates = 0

for _, archive_row in deceased_archive.iterrows():
    hebrew_name = archive_row['Hebrew Name']
    current_match = current_df[current_df['Hebrew Name'] == hebrew_name]
    
    if len(current_match) == 0:
        continue
    
    current_idx = current_match.index[0]
    
    # Update death information if missing
    if pd.isna(current_df.at[current_idx, 'Date of Death']):
        death_date = archive_row['Date of Death']
        if pd.notna(death_date):
            current_df.at[current_idx, 'Date of Death'] = death_date
            death_updates += 1
    
    # Update context of death if missing
    if pd.isna(current_df.at[current_idx, 'Context of Death']):
        context = archive_row['Context of Death']
        if pd.notna(context):
            current_df.at[current_idx, 'Context of Death'] = context
            death_updates += 1

# Save again with death data
current_df.to_csv('hostages-from-kan.csv', index=False, encoding='utf-8-sig')
print(f"Updated {death_updates} entries with death information")

# Final completeness check
key_fields = ['Date of Death', 'Context of Death', 'Release Date', 'Release/Death Circumstances']
print("\n--- FINAL COMPLETENESS CHECK ---")
for col in key_fields:
    missing = current_df[col].isna().sum()
    filled = len(current_df) - missing
    print(f"{col}: {filled}/{len(current_df)} filled ({missing} missing)")