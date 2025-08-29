import pandas as pd

# Load the main CSV
df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')

print("Adding Ilan Weiss research to main CSV...")

# Find Ilan Weiss row
ilan_row = df[df['Hebrew Name'] == 'אילן וייס'].index[0]

print(f"Found Ilan Weiss at row {ilan_row+2} (Excel numbering)")
print("BEFORE update:")
print(f"  Date of Death: '{df.loc[ilan_row, 'Date of Death']}'")
print(f"  Context of Death: '{df.loc[ilan_row, 'Context of Death']}'")
print(f"  Release Date: '{df.loc[ilan_row, 'Release Date']}'")
print(f"  Release/Death Circumstances: '{df.loc[ilan_row, 'Release/Death Circumstances']}'")
print(f"  Citation URLs: '{df.loc[ilan_row, 'Citation URLs']}'")

# Add the researched information
df.loc[ilan_row, 'Date of Death'] = '2023-10-07'
df.loc[ilan_row, 'Context of Death'] = 'Died Before/During Kidnapping'
df.loc[ilan_row, 'Release Date'] = '2025-08-29'
df.loc[ilan_row, 'Release/Death Circumstances'] = 'Returned in Military Operation - Body'
df.loc[ilan_row, 'Citation URLs'] = 'https://www.kan.org.il/content/kan-news/defense/946446/; https://www.jpost.com/israel-news/article-865713'

print("\nAFTER update:")
print(f"  Date of Death: '{df.loc[ilan_row, 'Date of Death']}'")
print(f"  Context of Death: '{df.loc[ilan_row, 'Context of Death']}'")
print(f"  Release Date: '{df.loc[ilan_row, 'Release Date']}'")
print(f"  Release/Death Circumstances: '{df.loc[ilan_row, 'Release/Death Circumstances']}'")
print(f"  Citation URLs: '{df.loc[ilan_row, 'Citation URLs']}'")

# Save the updated CSV
df.to_csv('hostages-from-kan.csv', index=False, encoding='utf-8-sig')
print(f"\nSuccessfully updated main CSV with research data!")
print("The information has been ADDED to existing columns, not replaced.")