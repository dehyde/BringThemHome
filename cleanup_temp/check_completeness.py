import pandas as pd

# Load the data
df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')

print("=== DATA COMPLETENESS ANALYSIS ===")
print(f"Total entries: {len(df)}")

print("\n--- Key Fields Analysis ---")
key_fields = ['Date of Death', 'Context of Death', 'Release Date', 'Release/Death Circumstances']
for col in key_fields:
    missing = df[col].isna().sum()
    filled = len(df) - missing
    print(f"{col}: {filled}/{len(df)} filled ({missing} missing)")

print("\n--- Status Distribution ---")
print(df['Current Status'].value_counts())

print("\n--- Sample of missing data ---")
missing_data = df[df[key_fields].isna().all(axis=1)]
print(f"Entries with ALL key fields missing: {len(missing_data)}")
if len(missing_data) > 0:
    print("Examples:")
    for i, row in missing_data.head(10).iterrows():
        print(f"  {row['Hebrew Name']} ({row['Current Status']})")

# Check by status
print("\n--- Missing Data by Status ---")
for status in df['Current Status'].unique():
    status_df = df[df['Current Status'] == status]
    missing_any = status_df[key_fields].isna().any(axis=1).sum()
    print(f"{status}: {missing_any}/{len(status_df)} have missing key data")

# Check specific fields by status
print("\n--- Specific Field Coverage by Status ---")
for status in ['Deceased', 'Deceased - Returned', 'Released', 'Currently held']:
    if status in df['Current Status'].values:
        status_df = df[df['Current Status'] == status]
        print(f"\n{status} ({len(status_df)} entries):")
        for col in key_fields:
            filled = (~status_df[col].isna()).sum()
            print(f"  {col}: {filled}/{len(status_df)}")