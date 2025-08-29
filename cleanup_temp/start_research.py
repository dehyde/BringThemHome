import pandas as pd

# Load the CSV to start systematic research
df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')

print("=== HOSTAGE RESEARCH INITIALIZATION ===")
print(f"Total entries: {len(df)}")
print(f"Current status breakdown:")
status_counts = df['Current Status'].value_counts()
for status, count in status_counts.items():
    print(f"  {status}: {count}")

print(f"\n=== STARTING WITH DECEASED - RETURNED CASES ===")
deceased_returned = df[df['Current Status'] == 'Deceased - Returned']
print(f"Found {len(deceased_returned)} cases to research")

print(f"\nFirst 5 cases to research:")
for i, (idx, row) in enumerate(deceased_returned.head().iterrows()):
    try:
        print(f"{i+1}. {row['Hebrew Name']} (Age {row['Age at Kidnapping']}) - {row['Location Kidnapped (Hebrew)']}")
        print(f"   Current info: {row['Kidnapping Summary (Hebrew)']}")
        print(f"   Article: {row['Citation URLs']}")
        print()
    except UnicodeEncodeError:
        print(f"{i+1}. [Hebrew Name] (Age {row['Age at Kidnapping']}) - {row['Location Kidnapped (Hebrew)']}")
        print(f"   Current info: [Hebrew text]")
        print(f"   Article: {row['Citation URLs']}")
        print()

print("=== RESEARCH STRATEGY ===")
print("1. Use existing article URLs to research each case")
print("2. Find specific return dates and circumstances")
print("3. Validate all citation URLs are specific articles")
print("4. Add date ranges when precise dates unavailable")
print("5. Update progress tracker after each batch")

# Create a research checklist file
research_list = deceased_returned[['Hebrew Name', 'Age at Kidnapping', 'Current Status', 'Citation URLs']].copy()
research_list['Date Researched'] = ''
research_list['Death Date'] = ''
research_list['Return Date'] = ''
research_list['Circumstances'] = ''
research_list['New Citations'] = ''
research_list['Validation Status'] = 'Pending'
research_list['Notes'] = ''

research_list.to_csv('research_checklist.csv', index=False, encoding='utf-8-sig')
print(f"\nCreated research_checklist.csv with {len(research_list)} entries to track progress")
print("Ready to begin systematic research!")