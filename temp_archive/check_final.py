import pandas as pd

df = pd.read_csv('hostages-list-complete.csv', encoding='utf-8-sig')

print(f"Total entries: {len(df)}")
print(f"Entries with Hebrew names: {len(df[df['Hebrew Name'].notna() & (df['Hebrew Name'] != '')])}")
print(f"Missing Hebrew names: {len(df[(df['Hebrew Name'].isna()) | (df['Hebrew Name'] == '')])}")

print("\nSample entries with Hebrew names:")
with_hebrew = df[df['Hebrew Name'].notna() & (df['Hebrew Name'] != '')].head(10)
for _, row in with_hebrew.iterrows():
    try:
        print(f"  {row['Hostage Name']} -> {row['Hebrew Name']}")
    except UnicodeEncodeError:
        print(f"  {row['Hostage Name']} -> [Hebrew name present]")