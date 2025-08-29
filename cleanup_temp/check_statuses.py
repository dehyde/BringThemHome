import pandas as pd

df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')

print("All unique statuses:")
print(df['Current Status'].value_counts())

print("\nLooking for released hostages in descriptions:")
for idx, row in df.iterrows():
    hebrew_desc = str(row.get('Hebrew Description Short', ''))
    hebrew_desc_long = str(row.get('Hebrew Description Long', ''))
    full_desc = hebrew_desc + ' ' + hebrew_desc_long
    
    # Look for release indicators
    if any(word in full_desc for word in ['שוחרר', 'שוחררה', 'שחרור']):
        print(f"{row['Hebrew Name']} ({row['Current Status']}): {hebrew_desc[:100]}...")
        break

print("\nSample 'Unknown' entries (might be released):")
unknown_df = df[df['Current Status'] == 'Unknown']
for idx, row in unknown_df.head(3).iterrows():
    hebrew_desc = str(row.get('Hebrew Description Short', ''))
    print(f"{row['Hebrew Name']}: {hebrew_desc}")