import pandas as pd
import json
from datetime import datetime

# Load files
current_df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')
tracking_df = pd.read_csv('master_tracking.csv', encoding='utf-8-sig')

print("=== UPDATING MAYA GOREN RESEARCH ===")

# Find Maya Goren in both files
hebrew_name = 'מיה גורן'
maya_main_idx = current_df[current_df['Hebrew Name'] == hebrew_name].index[0]
maya_tracking_idx = tracking_df[tracking_df['Hebrew Name'] == hebrew_name].index[0]

print(f"Found in main CSV at row {maya_main_idx + 2}")
print(f"Found in tracking CSV at row {maya_tracking_idx + 2}")

# Update main CSV with validated research data
print("\nUpdating main CSV with research findings...")
current_df.at[maya_main_idx, 'Date of Death'] = '2023-10-07'
current_df.at[maya_main_idx, 'Context of Death'] = 'Died Before/During Kidnapping'
current_df.at[maya_main_idx, 'Release Date'] = '2024-07-24'
current_df.at[maya_main_idx, 'Release/Death Circumstances'] = 'Returned in Military Operation - Body'

# Update citations (add to existing)
current_citations = str(current_df.at[maya_main_idx, 'Citation URLs'])
new_citations = [
    'https://www.timesofisrael.com/taken-captive-nir-oz-kindergarten-teacher-from-her-classroom/',
    'https://www.jpost.com/breaking-news/article-811783'
]

if current_citations and current_citations != 'nan':
    current_df.at[maya_main_idx, 'Citation URLs'] = current_citations + '; ' + '; '.join(new_citations)
else:
    current_df.at[maya_main_idx, 'Citation URLs'] = '; '.join(new_citations)

# Update tracking file
print("Updating tracking file...")
tracking_df.at[maya_tracking_idx, 'Research Status'] = 'Completed'
tracking_df.at[maya_tracking_idx, 'Date Researched'] = datetime.now().strftime('%Y-%m-%d')
tracking_df.at[maya_tracking_idx, 'Death Date'] = '2023-10-07'
tracking_df.at[maya_tracking_idx, 'Release/Return Date'] = '2024-07-24'
tracking_df.at[maya_tracking_idx, 'Circumstances Category'] = 'Died Before/During Kidnapping'
tracking_df.at[maya_tracking_idx, 'New Citations Found'] = '; '.join(new_citations)
tracking_df.at[maya_tracking_idx, 'Validation Status'] = 'Validated'
tracking_df.at[maya_tracking_idx, 'Research Notes'] = '56-year-old kindergarten teacher killed Oct 7 at Nir Oz while setting up kindergarten. Husband Avner also killed. Body recovered July 24, 2024 from Khan Younis.'

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
print(f"Death Date: 2023-10-07")
print(f"Circumstances: Died Before/During Kidnapping")
print(f"Body Return: 2024-07-24")
print(f"Return Method: Returned in Military Operation - Body")
print(f"Progress: {progress['Completion Percentage']}% ({completed}/{total} entries)")