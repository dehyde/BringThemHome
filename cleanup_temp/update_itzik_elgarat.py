import pandas as pd
import json
from datetime import datetime

# Load files
current_df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')
tracking_df = pd.read_csv('master_tracking.csv', encoding='utf-8-sig')

print("=== UPDATING ITZIK ELGARAT RESEARCH ===")

# Find Itzik Elgarat in both files
hebrew_name = 'איציק אלגרט'
itzik_main_idx = current_df[current_df['Hebrew Name'] == hebrew_name].index[0]
itzik_tracking_idx = tracking_df[tracking_df['Hebrew Name'] == hebrew_name].index[0]

print(f"Found in main CSV at row {itzik_main_idx + 2}")
print(f"Found in tracking CSV at row {itzik_tracking_idx + 2}")

# Update main CSV with validated research data
print("\nUpdating main CSV with research findings...")
# Death date unknown but was tortured to death in captivity - no precise date available
current_df.at[itzik_main_idx, 'Context of Death'] = 'Died in Captivity - Killed by Hamas'
current_df.at[itzik_main_idx, 'Release Date'] = '2025-02-27'
current_df.at[itzik_main_idx, 'Release/Death Circumstances'] = 'Returned in Deal - Body'

# Update citations (add to existing)
current_citations = str(current_df.at[itzik_main_idx, 'Citation URLs'])
new_citations = [
    'https://www.timesofisrael.com/autopsy-of-slain-hostage-itzik-elgarat-revealed-he-was-tortured-to-death-brother-says/',
    'https://www.timesofisrael.com/slain-captive-itzik-elgarat-buried-brother-says-netanyahu-dug-his-grave/'
]

if current_citations and current_citations != 'nan':
    current_df.at[itzik_main_idx, 'Citation URLs'] = current_citations + '; ' + '; '.join(new_citations)
else:
    current_df.at[itzik_main_idx, 'Citation URLs'] = '; '.join(new_citations)

# Update tracking file
print("Updating tracking file...")
tracking_df.at[itzik_tracking_idx, 'Research Status'] = 'Completed'
tracking_df.at[itzik_tracking_idx, 'Date Researched'] = datetime.now().strftime('%Y-%m-%d')
tracking_df.at[itzik_tracking_idx, 'Release/Return Date'] = '2025-02-27'
tracking_df.at[itzik_tracking_idx, 'Circumstances Category'] = 'Died in Captivity - Killed by Hamas'
tracking_df.at[itzik_tracking_idx, 'New Citations Found'] = '; '.join(new_citations)
tracking_df.at[itzik_tracking_idx, 'Validation Status'] = 'Validated'
tracking_df.at[itzik_tracking_idx, 'Research Notes'] = '68-year-old kidnapped Oct 7 from Nir Oz safe room after being shot in hand. Tortured to death by Hamas - autopsy showed broken ribs, toes, nose. Body returned Feb 27, 2025 in deal.'

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
print(f"Updated: Itzik Elgarat (איציק אלגרט)")
print(f"Circumstances: Died in Captivity - Killed by Hamas") 
print(f"Body Return: 2025-02-27")
print(f"Return Method: Returned in Deal - Body")
print(f"Progress: {progress['Completion Percentage']}% ({completed}/{total} entries)")