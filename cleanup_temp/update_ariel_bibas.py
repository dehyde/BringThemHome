import pandas as pd
import json
from datetime import datetime

# Load files
current_df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')
tracking_df = pd.read_csv('master_tracking.csv', encoding='utf-8-sig')

print("=== UPDATING ARIEL BIBAS RESEARCH ===")

# Find Ariel Bibas in both files
hebrew_name = 'אריאל ביבס'
ariel_main_idx = current_df[current_df['Hebrew Name'] == hebrew_name].index[0]
ariel_tracking_idx = tracking_df[tracking_df['Hebrew Name'] == hebrew_name].index[0]

print(f"Found in main CSV at row {ariel_main_idx + 2}")
print(f"Found in tracking CSV at row {ariel_tracking_idx + 2}")

# Update main CSV with validated research data
print("\nUpdating main CSV with research findings...")
# Hamas claimed killed in Israeli airstrikes but exact death date unknown
current_df.at[ariel_main_idx, 'Context of Death'] = 'Died in Captivity - Unknown Circumstances'
current_df.at[ariel_main_idx, 'Release Date'] = '2025-02-20'
current_df.at[ariel_main_idx, 'Release/Death Circumstances'] = 'Returned in Deal - Body'

# Update citations (add to existing)
current_citations = str(current_df.at[ariel_main_idx, 'Citation URLs'])
new_citations = [
    'https://www.cbsnews.com/news/hamas-bodies-israeli-hostages-2-young-children/',
    'https://en.wikipedia.org/wiki/Kidnapping_and_killing_of_the_Bibas_family'
]

if current_citations and current_citations != 'nan':
    current_df.at[ariel_main_idx, 'Citation URLs'] = current_citations + '; ' + '; '.join(new_citations)
else:
    current_df.at[ariel_main_idx, 'Citation URLs'] = '; '.join(new_citations)

# Update tracking file
print("Updating tracking file...")
tracking_df.at[ariel_tracking_idx, 'Research Status'] = 'Completed'
tracking_df.at[ariel_tracking_idx, 'Date Researched'] = datetime.now().strftime('%Y-%m-%d')
tracking_df.at[ariel_tracking_idx, 'Release/Return Date'] = '2025-02-20'
tracking_df.at[ariel_tracking_idx, 'Circumstances Category'] = 'Died in Captivity - Unknown Circumstances'
tracking_df.at[ariel_tracking_idx, 'New Citations Found'] = '; '.join(new_citations)
tracking_df.at[ariel_tracking_idx, 'Validation Status'] = 'Validated'
tracking_df.at[ariel_tracking_idx, 'Research Notes'] = '4-year-old kidnapped Oct 7 from Nir Oz with mother Shiri and baby brother Kfir. Hamas claimed killed in Israeli airstrikes. Body returned Feb 20, 2025 in deal.'

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
print(f"Circumstances: Died in Captivity - Unknown Circumstances")
print(f"Body Return: 2025-02-20")
print(f"Return Method: Returned in Deal - Body")
print(f"Progress: {progress['Completion Percentage']}% ({completed}/{total} entries)")