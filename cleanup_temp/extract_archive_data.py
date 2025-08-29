import pandas as pd

print("=== EXTRACTING DATA FROM ARCHIVE FILES ===")

# Load the most comprehensive archive file
archive_df = pd.read_csv('temp_archive/hostages-list-complete-final.csv', encoding='utf-8-sig')
print(f"Archive file loaded: {len(archive_df)} entries")

# Load our current working file
current_df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')
print(f"Current file loaded: {len(current_df)} entries")

# Load tracking file
tracking_df = pd.read_csv('master_tracking.csv', encoding='utf-8-sig')

# Function to match names (since formats might be different)
def find_matching_archive_entry(hebrew_name):
    """Find matching entry in archive by Hebrew name"""
    matches = archive_df[archive_df['Hebrew Name'] == hebrew_name]
    if len(matches) > 0:
        return matches.iloc[0]
    return None

# Track what we find
matches_found = 0
data_extracted = 0

print(f"\n=== CROSS-REFERENCING ARCHIVE DATA ===")

for idx, row in current_df.iterrows():
    hebrew_name = row['Hebrew Name']
    
    # Look for match in archive
    archive_match = find_matching_archive_entry(hebrew_name)
    
    if archive_match is not None:
        matches_found += 1
        
        # Check what data we can extract
        extractable_data = []
        
        if pd.notna(archive_match['Date of Death']) and archive_match['Date of Death']:
            extractable_data.append(f"Death Date: {archive_match['Date of Death']}")
        
        if pd.notna(archive_match['Release Date']) and archive_match['Release Date']:
            extractable_data.append(f"Release Date: {archive_match['Release Date']}")
            
        if pd.notna(archive_match['Context of Death']) and archive_match['Context of Death']:
            extractable_data.append(f"Death Context: {archive_match['Context of Death']}")
            
        if pd.notna(archive_match['Release/Death Circumstances']) and archive_match['Release/Death Circumstances']:
            extractable_data.append(f"Circumstances: {archive_match['Release/Death Circumstances']}")
            
        if pd.notna(archive_match['Countries Involved in Deals']) and archive_match['Countries Involved in Deals']:
            extractable_data.append(f"Countries: {archive_match['Countries Involved in Deals']}")
        
        if extractable_data:
            data_extracted += 1
            try:
                print(f"✓ {hebrew_name}: {'; '.join(extractable_data)}")
            except UnicodeEncodeError:
                print(f"✓ [Hebrew Name] Row {idx+2}: {'; '.join(extractable_data)}")

print(f"\n=== ARCHIVE EXTRACTION SUMMARY ===")
print(f"Total current entries: {len(current_df)}")
print(f"Archive matches found: {matches_found}")
print(f"Entries with extractable data: {data_extracted}")
print(f"Potential research acceleration: {data_extracted} entries")

# Save a detailed mapping for manual review
mapping_data = []

for idx, row in current_df.iterrows():
    hebrew_name = row['Hebrew Name']
    archive_match = find_matching_archive_entry(hebrew_name)
    
    if archive_match is not None:
        mapping_data.append({
            'Current_Row': idx + 2,
            'Hebrew_Name': hebrew_name,
            'Current_Status': row['Current Status'],
            'Archive_Death_Date': archive_match.get('Date of Death', ''),
            'Archive_Release_Date': archive_match.get('Release Date', ''),
            'Archive_Context': archive_match.get('Context of Death', ''),
            'Archive_Circumstances': archive_match.get('Release/Death Circumstances', ''),
            'Archive_Countries': archive_match.get('Countries Involved in Deals', ''),
            'Archive_Citations': archive_match.get('Citation URLs', ''),
            'Ready_to_Import': 'Yes' if any([
                pd.notna(archive_match.get('Date of Death')) and archive_match.get('Date of Death'),
                pd.notna(archive_match.get('Release Date')) and archive_match.get('Release Date'),
                pd.notna(archive_match.get('Context of Death')) and archive_match.get('Context of Death')
            ]) else 'No'
        })

mapping_df = pd.DataFrame(mapping_data)
mapping_df.to_csv('archive_data_mapping.csv', index=False, encoding='utf-8-sig')
print(f"\nDetailed mapping saved to: archive_data_mapping.csv")

ready_to_import = len(mapping_df[mapping_df['Ready_to_Import'] == 'Yes'])
print(f"Entries ready for immediate import: {ready_to_import}")

print(f"\n=== NEXT STEPS ===")
print(f"1. Review archive_data_mapping.csv")
print(f"2. Import validated data from archive")  
print(f"3. Update progress tracking")
print(f"4. Continue research for remaining entries")