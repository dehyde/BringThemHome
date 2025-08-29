import pandas as pd
import json
from datetime import datetime

# Load files
current_df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')
tracking_df = pd.read_csv('master_tracking.csv', encoding='utf-8-sig')

print("=== UPDATING YAGEV BUCHSHTAV RESEARCH ===")

# Find Yagev Buchshtav in both files
hebrew_name = 'יגב בוכשטב'
yagev_main_idx = current_df[current_df['Hebrew Name'] == hebrew_name].index[0]
yagev_tracking_idx = tracking_df[tracking_df['Hebrew Name'] == hebrew_name].index[0]

print(f"Found in main CSV at row {yagev_main_idx + 2}")
print(f"Found in tracking CSV at row {yagev_tracking_idx + 2}")

# Update main CSV with validated research data
print("\nUpdating main CSV with research findings...")
# Executed by Hamas in February 2024 as IDF closed in
current_df.at[yagev_main_idx, 'Context of Death'] = 'Died in Captivity - Killed by Hamas'
current_df.at[yagev_main_idx, 'Release Date'] = '2024-08-19'
current_df.at[yagev_main_idx, 'Release/Death Circumstances'] = 'Returned in Military Operation - Body'

# Update citations (add to existing)
current_citations = str(current_df.at[yagev_main_idx, 'Citation URLs'])
new_citations = [
    'https://www.timesofisrael.com/hostage-yagev-buchshtav-executed-by-hamas-in-feb-as-idf-closed-in-mother-says/',
    'https://www.timesofisrael.com/taken-captive-yagev-buchshtav-could-hear-terrorists-outside-his-window/'
]

if current_citations and current_citations != 'nan':
    current_df.at[yagev_main_idx, 'Citation URLs'] = current_citations + '; ' + '; '.join(new_citations)
else:
    current_df.at[yagev_main_idx, 'Citation URLs'] = '; '.join(new_citations)

# Update tracking file
print("Updating tracking file...")
tracking_df.at[yagev_tracking_idx, 'Research Status'] = 'Completed'
tracking_df.at[yagev_tracking_idx, 'Date Researched'] = datetime.now().strftime('%Y-%m-%d')
tracking_df.at[yagev_tracking_idx, 'Release/Return Date'] = '2024-08-19'
tracking_df.at[yagev_tracking_idx, 'Circumstances Category'] = 'Died in Captivity - Killed by Hamas'
tracking_df.at[yagev_tracking_idx, 'New Citations Found'] = '; '.join(new_citations)
tracking_df.at[yagev_tracking_idx, 'Validation Status'] = 'Validated'
tracking_df.at[yagev_tracking_idx, 'Research Notes'] = '35-year-old musician kidnapped Oct 7 from Nirim with wife Rimon. Executed by Hamas Feb 2024 in tunnel as IDF closed in. Body recovered Aug 19, 2024.'

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
print(f"Circumstances: Died in Captivity - Killed by Hamas")
print(f"Body Return: 2024-08-19")
print(f"Return Method: Returned in Military Operation - Body")
print(f"Progress: {progress['Completion Percentage']}% ({completed}/{total} entries)")