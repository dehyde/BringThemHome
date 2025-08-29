import pandas as pd
import json
from datetime import datetime

# Load files
current_df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')
tracking_df = pd.read_csv('master_tracking.csv', encoding='utf-8-sig')

print("=== FIXING MISSING DATA FROM HEBREW DESCRIPTIONS ===")

updated_count = 0

# Process all entries to extract missing information
for idx, row in current_df.iterrows():
    hebrew_name = row['Hebrew Name']
    current_status = row['Current Status']
    hebrew_desc = str(row.get('Hebrew Description Short', ''))
    hebrew_desc_long = str(row.get('Hebrew Description Long', ''))
    
    # Combine descriptions for analysis
    full_desc = hebrew_desc + ' ' + hebrew_desc_long
    
    updated = False
    
    # Extract release circumstances for Released status
    if current_status == 'Released':
        if pd.isna(row['Release/Death Circumstances']):
            current_df.at[idx, 'Release/Death Circumstances'] = 'Returned in Deal'
            updated = True
        
        # Extract release dates from Hebrew text patterns
        if pd.isna(row['Release Date']):
            if 'נובמבר 2023' in full_desc or 'אחרי 49 יום' in full_desc:
                current_df.at[idx, 'Release Date'] = '2023-11-24'
                updated = True
            elif 'אחרי 55 יום' in full_desc:
                current_df.at[idx, 'Release Date'] = '2023-12-01'
                updated = True
    
    # Extract data for Deceased - Returned status
    elif current_status == 'Deceased - Returned':
        # Extract death circumstances
        if pd.isna(row['Context of Death']):
            if 'נרצח בשבי' in full_desc or 'נרצחה בשבי' in full_desc:
                current_df.at[idx, 'Context of Death'] = 'Died in Captivity - Killed by Hamas'
                updated = True
            elif 'נרצח ב-7 באוקטובר' in full_desc or 'נרצחה ב-7 באוקטובר' in full_desc or 'נפל בקרב ב-7' in full_desc:
                current_df.at[idx, 'Context of Death'] = 'Died Before/During Kidnapping'
                current_df.at[idx, 'Date of Death'] = '2023-10-07'
                updated = True
            elif 'נפל במבצע' in full_desc or 'נפל ונחטף' in full_desc:
                current_df.at[idx, 'Context of Death'] = 'Died Before/During Kidnapping'
                current_df.at[idx, 'Date of Death'] = '2023-10-07'
                updated = True
        
        # Extract return circumstances
        if pd.isna(row['Release/Death Circumstances']):
            current_df.at[idx, 'Release/Death Circumstances'] = 'Returned in Military Operation - Body'
            updated = True
        
        # Extract return dates from Hebrew patterns
        if pd.isna(row['Release Date']):
            date_patterns = {
                'ב-24.07.24': '2024-07-24', 'ב-24.7.24': '2024-07-24',
                'ב-20.8.24': '2024-08-20', 'ב-31.8.24': '2024-08-31',
                'ב-27.2.25': '2025-02-27', 'ב-19.1.25': '2025-01-19',
                'ב-8.1.25': '2025-01-08', 'ב-4.12.24': '2024-12-04',
                'ב-29.8.25': '2025-08-29', 'ב-22.6.25': '2025-06-22',
                'ב-11.06.25': '2025-06-11', 'ב-07.06.25': '2025-06-07',
                'ב-05.06.25': '2025-06-05'
            }
            for pattern, date in date_patterns.items():
                if pattern in full_desc:
                    current_df.at[idx, 'Release Date'] = date
                    updated = True
                    break
    
    # Extract data for Deceased status
    elif current_status == 'Deceased':
        if pd.isna(row['Context of Death']):
            if 'נהרג בקרב ב-7 באוקטובר' in full_desc or 'נרצח ב-7 באוקטובר' in full_desc:
                current_df.at[idx, 'Date of Death'] = '2023-10-07'
                current_df.at[idx, 'Context of Death'] = 'Died Before/During Kidnapping'
                updated = True
            elif 'נרצח בשבי' in full_desc or 'נרצחה בשבי' in full_desc:
                current_df.at[idx, 'Context of Death'] = 'Died in Captivity - Killed by Hamas'
                updated = True
    
    # Extract data for Unknown status (likely rescued)
    elif current_status == 'Unknown':
        if pd.isna(row['Release/Death Circumstances']):
            if 'חולץ' in full_desc or 'חולצה' in full_desc:
                current_df.at[idx, 'Release/Death Circumstances'] = 'Returned in Military Operation'
                updated = True
                if 'אחרי 246 ימים' in full_desc:
                    current_df.at[idx, 'Release Date'] = '2024-06-08'
    
    if updated:
        updated_count += 1
        if updated_count % 50 == 0:
            print(f"Updated {updated_count} entries...")

# Save the updated file
current_df.to_csv('hostages-from-kan.csv', index=False, encoding='utf-8-sig')

print(f"\n=== DATA EXTRACTION COMPLETE ===")
print(f"Updated {updated_count} entries with extracted information")

# Check completeness again
key_fields = ['Date of Death', 'Context of Death', 'Release Date', 'Release/Death Circumstances']
print("\n--- Updated Completeness ---")
for col in key_fields:
    missing = current_df[col].isna().sum()
    filled = len(current_df) - missing
    print(f"{col}: {filled}/{len(current_df)} filled ({missing} missing)")

# Check released entries specifically
released_df = current_df[current_df['Current Status'] == 'Released']
print(f"\n--- Released Entries ({len(released_df)} total) ---")
for col in ['Release Date', 'Release/Death Circumstances']:
    filled = (~released_df[col].isna()).sum()
    print(f"{col}: {filled}/{len(released_df)} filled")

# Check deceased-returned entries
deceased_returned_df = current_df[current_df['Current Status'] == 'Deceased - Returned']
print(f"\n--- Deceased-Returned Entries ({len(deceased_returned_df)} total) ---")
for col in ['Date of Death', 'Context of Death', 'Release Date', 'Release/Death Circumstances']:
    filled = (~deceased_returned_df[col].isna()).sum()
    print(f"{col}: {filled}/{len(deceased_returned_df)} filled")