import pandas as pd
import json
from datetime import datetime

# Load files
current_df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')
tracking_df = pd.read_csv('master_tracking.csv', encoding='utf-8-sig')

print("=== UPDATING OMER NEUTRA RESEARCH ===")

# Find Omer Neutra in both files
hebrew_name = 'עומר נאוטרה'
omer_main_idx = current_df[current_df['Hebrew Name'] == hebrew_name].index[0]
omer_tracking_idx = tracking_df[tracking_df['Hebrew Name'] == hebrew_name].index[0]

print(f"Found in main CSV at row {omer_main_idx + 2}")
print(f"Found in tracking CSV at row {omer_tracking_idx + 2}")

# Update main CSV with validated research data
print("\nUpdating main CSV with research findings...")
current_df.at[omer_main_idx, 'Date of Death'] = '2023-10-07'
current_df.at[omer_main_idx, 'Context of Death'] = 'Died Before/During Kidnapping'
# Body still held in Gaza as of latest reports - no return date yet

# Update citations (add to existing)
current_citations = str(current_df.at[omer_main_idx, 'Citation URLs'])
new_citations = [
    'https://www.timesofisrael.com/after-over-a-year-idf-confirms-us-israeli-hostage-cpt-omer-neutra-killed-on-oct-7/',
    'https://www.haaretz.com/israel-news/2024-12-02/ty-article/.premium/idf-israeli-american-soldier-omer-neutra-killed-on-oct-7-body-held-in-gaza/00000193-866d-dce7-a7f3-976d017b0000'
]

if current_citations and current_citations != 'nan':
    current_df.at[omer_main_idx, 'Citation URLs'] = current_citations + '; ' + '; '.join(new_citations)
else:
    current_df.at[omer_main_idx, 'Citation URLs'] = '; '.join(new_citations)

# Update tracking file
print("Updating tracking file...")
tracking_df.at[omer_tracking_idx, 'Research Status'] = 'Completed'
tracking_df.at[omer_tracking_idx, 'Date Researched'] = datetime.now().strftime('%Y-%m-%d')
tracking_df.at[omer_tracking_idx, 'Death Date'] = '2023-10-07'
tracking_df.at[omer_tracking_idx, 'Circumstances Category'] = 'Died Before/During Kidnapping'
tracking_df.at[omer_tracking_idx, 'New Citations Found'] = '; '.join(new_citations)
tracking_df.at[omer_tracking_idx, 'Validation Status'] = 'Validated'
tracking_df.at[omer_tracking_idx, 'Research Notes'] = '21-year-old American-Israeli tank commander killed Oct 7 near Nir Oz. Long Island native who enlisted as lone soldier. Body still held in Gaza.'

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