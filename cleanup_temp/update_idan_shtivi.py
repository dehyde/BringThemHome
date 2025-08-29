import pandas as pd
import json
from datetime import datetime

# Load files
current_df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')
tracking_df = pd.read_csv('master_tracking.csv', encoding='utf-8-sig')

print("=== UPDATING IDAN SHTIVI RESEARCH ===")

# Find Idan Shtivi in both files
hebrew_name = 'עידן שתיוי'
idan_main_idx = current_df[current_df['Hebrew Name'] == hebrew_name].index[0]
idan_tracking_idx = tracking_df[tracking_df['Hebrew Name'] == hebrew_name].index[0]

print(f"Found in main CSV at row {idan_main_idx + 2}")
print(f"Found in tracking CSV at row {idan_tracking_idx + 2}")

# Update main CSV with validated research data
print("\nUpdating main CSV with research findings...")
current_df.at[idan_main_idx, 'Date of Death'] = '2023-10-07'
current_df.at[idan_main_idx, 'Context of Death'] = 'Died Before/During Kidnapping'
# Body still held in Gaza as of latest reports - no return date yet

# Update citations (add to existing)
current_citations = str(current_df.at[idan_main_idx, 'Citation URLs'])
new_citations = [
    'https://www.haaretz.com/israel-news/2024-10-07/ty-article/idan-shtivi-kidnapped-from-the-nova-festival-was-killed-on-oct-7-body-held-in-gaza/00000192-65c3-de36-adfe-efeb338b0000',
    'https://www.timesofisrael.com/a-year-later-authorities-say-hostage-idan-shtivi-killed-during-october-7-attack/'
]

if current_citations and current_citations != 'nan':
    current_df.at[idan_main_idx, 'Citation URLs'] = current_citations + '; ' + '; '.join(new_citations)
else:
    current_df.at[idan_main_idx, 'Citation URLs'] = '; '.join(new_citations)

# Update tracking file
print("Updating tracking file...")
tracking_df.at[idan_tracking_idx, 'Research Status'] = 'Completed'
tracking_df.at[idan_tracking_idx, 'Date Researched'] = datetime.now().strftime('%Y-%m-%d')
tracking_df.at[idan_tracking_idx, 'Death Date'] = '2023-10-07'
tracking_df.at[idan_tracking_idx, 'Circumstances Category'] = 'Died Before/During Kidnapping'
tracking_df.at[idan_tracking_idx, 'New Citations Found'] = '; '.join(new_citations)
tracking_df.at[idan_tracking_idx, 'Validation Status'] = 'Validated'
tracking_df.at[idan_tracking_idx, 'Research Notes'] = '28-year-old volunteer photographer killed Oct 7 at Nova festival. Was helping others escape when abducted. Body still held in Gaza.'

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
print(f"Body Status: Still held in Gaza")
print(f"Progress: {progress['Completion Percentage']}% ({completed}/{total} entries)")