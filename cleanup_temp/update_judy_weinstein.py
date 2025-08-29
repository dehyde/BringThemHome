import pandas as pd
import json
from datetime import datetime

# Load files
current_df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')
tracking_df = pd.read_csv('master_tracking.csv', encoding='utf-8-sig')

print("=== UPDATING JUDY WEINSTEIN RESEARCH ===")

# Find Judy Weinstein in both files
hebrew_name = 'ג׳ודי ויינשטיין '  # Note: there's a space at the end in the data
judy_main_idx = current_df[current_df['Hebrew Name'] == hebrew_name].index[0]
judy_tracking_idx = tracking_df[tracking_df['Hebrew Name'] == hebrew_name].index[0]

print(f"Found in main CSV at row {judy_main_idx + 2}")
print(f"Found in tracking CSV at row {judy_tracking_idx + 2}")

# Update main CSV with validated research data
print("\nUpdating main CSV with research findings...")
current_df.at[judy_main_idx, 'Date of Death'] = '2023-10-07'
current_df.at[judy_main_idx, 'Context of Death'] = 'Died Before/During Kidnapping'
current_df.at[judy_main_idx, 'Release Date'] = '2025-06-05'
current_df.at[judy_main_idx, 'Release/Death Circumstances'] = 'Returned in Military Operation - Body'

# Update citations (add to existing)
current_citations = str(current_df.at[judy_main_idx, 'Citation URLs'])
new_citations = [
    'https://www.timesofisrael.com/idf-recovers-bodies-of-slain-hostages-gadi-haggai-judih-weinstein-in-gaza-operation/',
    'https://www.timesofisrael.com/american-israeli-judith-weinstein-confirmed-murdered-on-oct-7-body-held-in-gaza/'
]

if current_citations and current_citations != 'nan':
    current_df.at[judy_main_idx, 'Citation URLs'] = current_citations + '; ' + '; '.join(new_citations)
else:
    current_df.at[judy_main_idx, 'Citation URLs'] = '; '.join(new_citations)

# Update tracking file
print("Updating tracking file...")
tracking_df.at[judy_tracking_idx, 'Research Status'] = 'Completed'
tracking_df.at[judy_tracking_idx, 'Date Researched'] = datetime.now().strftime('%Y-%m-%d')
tracking_df.at[judy_tracking_idx, 'Death Date'] = '2023-10-07'
tracking_df.at[judy_tracking_idx, 'Release/Return Date'] = '2025-06-05'
tracking_df.at[judy_tracking_idx, 'Circumstances Category'] = 'Died Before/During Kidnapping'
tracking_df.at[judy_tracking_idx, 'New Citations Found'] = '; '.join(new_citations)
tracking_df.at[judy_tracking_idx, 'Validation Status'] = 'Validated'
tracking_df.at[judy_tracking_idx, 'Research Notes'] = 'Killed Oct 7 with husband during morning walk at Kibbutz Nir Oz. Body recovered by IDF operation June 5, 2025 from Khan Younis.'

# Save files
current_df.to_csv('hostages-from-kan.csv', index=False, encoding='utf-8-sig')
tracking_df.to_csv('master_tracking.csv', index=False, encoding='utf-8-sig')

# Update progress summary
completed = len(tracking_df[tracking_df['Research Status'] == 'Completed'])
total = len(tracking_df)

progress = {
    'Total Entries': total,
    'Not Started': len(tracking_df[tracking_df['Research Status'] == 'Not Started']),
    'In Progress': len(tracking_df[tracking_df['Research Status'] == 'In Progress']),
    'Completed': completed,
    'Verified': len(tracking_df[tracking_df['Research Status'] == 'Verified']),
    'Last Updated': datetime.now().strftime('%Y-%m-%d'),
    'Completion Percentage': round(completed / total * 100, 1)
}

with open('progress_summary.json', 'w') as f:
    json.dump(progress, f, indent=2)

print(f"\n=== RESEARCH UPDATE COMPLETE ===")
print(f"Updated: Judy Weinstein (ג׳ודי ויינשטיין)")
print(f"Death Date: 2023-10-07")
print(f"Body Return: 2025-06-05") 
print(f"Circumstances: Died Before/During Kidnapping")
print(f"Return Method: Returned in Military Operation - Body")
print(f"Progress: {progress['Completion Percentage']}% ({completed}/{total} entries)")
print(f"Remaining high-priority cases: Continue with systematic research")