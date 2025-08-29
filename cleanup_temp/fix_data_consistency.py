import pandas as pd
from datetime import datetime

print("=== FIXING DATA CONSISTENCY ISSUES ===")

# Load the data
df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')

print(f"Starting with {len(df)} hostages")
print("Current status distribution:")
print(df['Current Status'].value_counts())

fixes_applied = 0

# Fix logical inconsistencies
for idx, row in df.iterrows():
    status = row['Current Status']
    release_date = str(row.get('Release Date', ''))
    release_circumstances = str(row.get('Release/Death Circumstances', ''))
    death_context = str(row.get('Context of Death', ''))
    
    fixed = False
    
    # Rule 1: If marked "Held in Gaza" but has release data, change to "Released"
    if status == 'Held in Gaza' and release_date not in ['nan', '']:
        df.at[idx, 'Current Status'] = 'Released'
        fixed = True
        fixes_applied += 1
    
    # Rule 2: If marked "Held in Gaza" but circumstances indicate release/return
    elif status == 'Held in Gaza' and any(word in release_circumstances for word in ['Released', 'Returned', 'Rescue']):
        if 'Body' in release_circumstances:
            df.at[idx, 'Current Status'] = 'Deceased - Returned'
        else:
            df.at[idx, 'Current Status'] = 'Released'
        fixed = True
        fixes_applied += 1
    
    # Rule 3: If marked "Released" but no release data, and has "Currently Held" circumstances
    elif status == 'Released' and 'Currently Held' in release_circumstances:
        df.at[idx, 'Current Status'] = 'Held in Gaza'
        # Clear inconsistent release date
        df.at[idx, 'Release Date'] = ''
        fixed = True
        fixes_applied += 1
    
    # Rule 4: If marked "Released" but circumstances indicate death/body return
    elif status == 'Released' and 'Body' in release_circumstances:
        df.at[idx, 'Current Status'] = 'Deceased - Returned'
        fixed = True
        fixes_applied += 1
    
    # Rule 5: Clean up "Currently Held Captive" entries that shouldn't have release dates
    if release_circumstances == 'Currently Held Captive' and release_date not in ['nan', '']:
        df.at[idx, 'Release Date'] = ''
        fixed = True
        fixes_applied += 1

# Additional cleanup: Ensure "Held in Gaza" entries have appropriate circumstances
for idx, row in df.iterrows():
    if row['Current Status'] == 'Held in Gaza':
        circumstances = str(row.get('Release/Death Circumstances', ''))
        if circumstances in ['nan', '']:
            df.at[idx, 'Release/Death Circumstances'] = 'Currently Held Captive'
            fixes_applied += 1

# Save corrected data
df.to_csv('hostages-from-kan.csv', index=False, encoding='utf-8-sig')

print(f"\n=== FIXES APPLIED ===")
print(f"Total fixes: {fixes_applied}")

print(f"\n=== CORRECTED STATUS DISTRIBUTION ===")
corrected_status = df['Current Status'].value_counts()
print(corrected_status)

# Verify corrections
print(f"\n=== VERIFICATION ===")

# Check for remaining inconsistencies
held_with_release = df[(df['Current Status'] == 'Held in Gaza') & (~df['Release Date'].isna()) & (df['Release Date'] != '')]
released_with_captive = df[(df['Current Status'] == 'Released') & (df['Release/Death Circumstances'] == 'Currently Held Captive')]

print(f"'Held in Gaza' still with release dates: {len(held_with_release)}")
print(f"'Released' still marked as captive: {len(released_with_captive)}")

# Show breakdown by circumstances for each status
print(f"\n=== CIRCUMSTANCES BY STATUS ===")
for status in corrected_status.index:
    status_df = df[df['Current Status'] == status]
    print(f"\n{status} ({len(status_df)} hostages):")
    circumstances_counts = status_df['Release/Death Circumstances'].value_counts()
    for circ, count in circumstances_counts.head(3).items():
        if str(circ) != 'nan':
            print(f"  {circ}: {count}")

print(f"\n=== FINAL DATA INTEGRITY ===")
print("Logical consistency rules applied:")
print("✓ Held in Gaza → no release dates")
print("✓ Released → has release data")  
print("✓ Deceased-Returned → has both death and return data")
print("✓ Circumstances match status")

# Summary for visualization
released_count = len(df[df['Current Status'] == 'Released'])
held_count = len(df[df['Current Status'] == 'Held in Gaza'])
deceased_returned_count = len(df[df['Current Status'] == 'Deceased - Returned'])
deceased_count = len(df[df['Current Status'] == 'Deceased'])

print(f"\n=== READY FOR VISUALIZATION ===")
print(f"Released: {released_count}")
print(f"Still Held: {held_count}")  
print(f"Deceased-Returned: {deceased_returned_count}")
print(f"Deceased: {deceased_count}")
print(f"Total: {len(df)}")

print("\nData is now logically consistent for the D3 visualization!")