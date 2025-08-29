import pandas as pd
import json
from datetime import datetime

# Load the tracking file
df_tracking = pd.read_csv('master_tracking.csv', encoding='utf-8-sig')

# Find Ilan Weiss entry (first row)
ilan_idx = 0  # First entry in our tracking file

# Update with researched information
df_tracking.loc[ilan_idx, 'Research Status'] = 'Completed'
df_tracking.loc[ilan_idx, 'Date Researched'] = '2025-08-29'
df_tracking.loc[ilan_idx, 'Death Date'] = '2023-10-07'
df_tracking.loc[ilan_idx, 'Release/Return Date'] = '2025-08-29'
df_tracking.loc[ilan_idx, 'Circumstances Category'] = 'Died Before/During Kidnapping'
df_tracking.loc[ilan_idx, 'New Citations Found'] = 'https://www.jpost.com/israel-news/article-865713; https://www.timesofisrael.com/liveblog_entry/idf-recovers-body-of-slain-hostage-ilan-weiss-remains-of-another-captive-from-gaza/'
df_tracking.loc[ilan_idx, 'Validation Status'] = 'Validated'
df_tracking.loc[ilan_idx, 'Research Notes'] = 'Killed on Oct 7 while defending Kibbutz Be\'eri. Body taken by Hamas. Wife & daughter were hostages, released Nov 2023. Body recovered by IDF/Shin Bet Aug 29, 2025.'

# Save updated tracking
df_tracking.to_csv('master_tracking.csv', index=False, encoding='utf-8-sig')

# Update progress summary
progress = {
    'Total Entries': len(df_tracking),
    'Not Started': len(df_tracking[df_tracking['Research Status'] == 'Not Started']),
    'In Progress': len(df_tracking[df_tracking['Research Status'] == 'In Progress']),
    'Completed': len(df_tracking[df_tracking['Research Status'] == 'Completed']),
    'Verified': len(df_tracking[df_tracking['Research Status'] == 'Verified']),
    'Last Updated': '2025-08-29'
}
progress['Completion Percentage'] = round((progress['Completed'] + progress['Verified']) / progress['Total Entries'] * 100, 1)

with open('progress_summary.json', 'w') as f:
    json.dump(progress, f, indent=2)

print("=== RESEARCH COMPLETED: ILAN WEISS ===")
print("Name: אילן וייס (Ilan Weiss)")
print("Age: 56")
print("Death Date: 2023-10-07 (during Hamas attack)")
print("Body Return Date: 2025-08-29 (IDF recovery operation)")
print("Circumstances: Died Before/During Kidnapping")
print("Details: Killed defending Kibbutz Be'eri, body taken by Hamas")
print("Family: Wife Shiri & daughter Noga were hostages (released Nov 2023)")
print()
print("Citations Added:")
print("- Jerusalem Post: https://www.jpost.com/israel-news/article-865713")
print("- Times of Israel: https://www.timesofisrael.com/liveblog_entry/idf-recovers-body-of-slain-hostage-ilan-weiss-remains-of-another-captive-from-gaza/")
print()
print(f"Progress: {progress['Completion Percentage']}% complete ({progress['Completed']} of {progress['Total Entries']} entries)")

# Also update the main CSV with this information
df_main = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')
main_idx = df_main[df_main['Hebrew Name'] == 'אילן וייס'].index[0]

df_main.loc[main_idx, 'Date of Death'] = '2023-10-07'
df_main.loc[main_idx, 'Context of Death'] = 'Died Before/During Kidnapping'
df_main.loc[main_idx, 'Release Date'] = '2025-08-29'
df_main.loc[main_idx, 'Release/Death Circumstances'] = 'Returned in Military Operation - Body'
df_main.loc[main_idx, 'Citation URLs'] = 'https://www.kan.org.il/content/kan-news/defense/946446/; https://www.jpost.com/israel-news/article-865713'

df_main.to_csv('hostages-from-kan.csv', index=False, encoding='utf-8-sig')
print("Main CSV updated with research findings.")