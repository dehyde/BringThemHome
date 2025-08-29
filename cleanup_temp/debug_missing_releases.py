import pandas as pd

print("=== DEBUGGING MISSING RELEASES ===")

# Load both files
current_df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')
archive_df = pd.read_csv('temp_archive/hostages-list-complete-final.csv', encoding='utf-8-sig')

# Check current releases
current_released = current_df[current_df['Current Status'] == 'Released']
print(f"Current CSV - Released hostages: {len(current_released)}")

# Check archive releases (those with release dates)
archive_released = archive_df[~archive_df['Release Date'].isna()]
print(f"Archive CSV - Hostages with release dates: {len(archive_released)}")

# Check what release dates exist in archive
print("\nSample archive release dates:")
print(archive_released['Release Date'].value_counts().head(10))

# Try better name matching
print("\n=== TRYING BETTER NAME MATCHING ===")
matches_found = 0
new_releases = 0

for _, archive_row in archive_released.iterrows():
    archive_hebrew = str(archive_row['Hebrew Name']).strip()
    archive_english = str(archive_row['Hostage Name']).strip()
    
    # Try exact Hebrew match first
    exact_match = current_df[current_df['Hebrew Name'] == archive_hebrew]
    
    if len(exact_match) == 0 and archive_english != 'nan':
        # Try partial English name match
        first_name = archive_english.split()[0] if ' ' in archive_english else archive_english
        partial_match = current_df[current_df['Hebrew Name'].str.contains(first_name, case=False, na=False, regex=False)]
        
        if len(partial_match) == 0:
            # Try looking in Hebrew descriptions for English name
            desc_match = current_df[
                current_df['Hebrew Description Short'].str.contains(first_name, case=False, na=False, regex=False) |
                current_df['Hebrew Description Long'].str.contains(first_name, case=False, na=False, regex=False) |
                current_df['Kidnapping Summary (Hebrew)'].str.contains(first_name, case=False, na=False, regex=False)
            ]
            exact_match = desc_match
    
    if len(exact_match) > 0:
        matches_found += 1
        current_idx = exact_match.index[0]
        current_status = current_df.at[current_idx, 'Current Status']
        
        if current_status in ['Unknown', 'Held in Gaza']:
            new_releases += 1
            print(f"Would update: {archive_hebrew} -> {archive_english} (currently {current_status})")
            
            if matches_found <= 5:  # Show first 5 examples
                print(f"  Release Date: {archive_row['Release Date']}")
                print(f"  Circumstances: {archive_row['Release/Death Circumstances']}")
    else:
        if matches_found <= 3:  # Show first 3 non-matches
            print(f"No match found for: {archive_hebrew} ({archive_english})")

print(f"\nTotal matches that could be updated to Released: {new_releases}")
print(f"Total archive entries matched: {matches_found}")

# Check what's in "Unknown" and "Held in Gaza" that might be releases
print(f"\n=== CURRENT STATUS BREAKDOWN ===")
print(current_df['Current Status'].value_counts())

unknown_df = current_df[current_df['Current Status'] == 'Unknown']
held_df = current_df[current_df['Current Status'] == 'Held in Gaza']

print(f"\nUnknown status entries: {len(unknown_df)}")
print(f"Held in Gaza entries: {len(held_df)}")
print("Many of these are likely released hostages that weren't properly categorized.")

# Check if Hebrew descriptions contain release indicators
release_indicators = ['שוחרר', 'שוחררה', 'שחרור', 'חולץ', 'חולצה', 'עסקה']
potential_releases = 0

for idx, row in current_df.iterrows():
    if row['Current Status'] in ['Unknown', 'Held in Gaza']:
        full_text = ' '.join([
            str(row.get('Hebrew Description Short', '')),
            str(row.get('Hebrew Description Long', '')),
            str(row.get('Kidnapping Summary (Hebrew)', ''))
        ])
        
        if any(indicator in full_text for indicator in release_indicators):
            potential_releases += 1

print(f"Entries with release indicators in Hebrew text: {potential_releases}")
print("\nThe archive data contains comprehensive release information that needs to be properly imported.")