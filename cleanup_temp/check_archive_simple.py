import pandas as pd

# Load files
archive_df = pd.read_csv('temp_archive/hostages-list-complete-final.csv', encoding='utf-8-sig')
current_df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')

print("ARCHIVE DATA EXTRACTION RESULTS")
print(f"Archive entries: {len(archive_df)}")
print(f"Current entries: {len(current_df)}")

# Check for matches and extractable data
matches = 0
with_dates = 0
with_circumstances = 0

for idx, row in current_df.iterrows():
    hebrew_name = row['Hebrew Name']
    archive_matches = archive_df[archive_df['Hebrew Name'] == hebrew_name]
    
    if len(archive_matches) > 0:
        matches += 1
        archive_row = archive_matches.iloc[0]
        
        # Check what data exists
        if pd.notna(archive_row.get('Date of Death')) or pd.notna(archive_row.get('Release Date')):
            with_dates += 1
            
        if pd.notna(archive_row.get('Context of Death')) or pd.notna(archive_row.get('Release/Death Circumstances')):
            with_circumstances += 1

print(f"Name matches found: {matches}")
print(f"Entries with date info: {with_dates}")  
print(f"Entries with circumstances: {with_circumstances}")
print(f"Potential research acceleration: {max(with_dates, with_circumstances)} entries")

# Check specific examples
print(f"\nSample archive data available:")
for i in range(min(5, len(archive_df))):
    row = archive_df.iloc[i]
    has_data = []
    if pd.notna(row.get('Date of Death')) and str(row.get('Date of Death')) != 'nan':
        has_data.append("Death Date")
    if pd.notna(row.get('Release Date')) and str(row.get('Release Date')) != 'nan':
        has_data.append("Release Date") 
    if pd.notna(row.get('Release/Death Circumstances')) and str(row.get('Release/Death Circumstances')) != 'nan':
        has_data.append("Circumstances")
    
    if has_data:
        print(f"  Row {i+2}: {', '.join(has_data)}")

print(f"\nRECOMMENDATION: Import archive data first, then research remaining gaps")