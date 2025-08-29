import pandas as pd

print("=== CHECKING DATA CONSISTENCY ===")

# Load the data
df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')

print("Current status distribution:")
print(df['Current Status'].value_counts())

# Check for logical inconsistencies
inconsistencies = []

for idx, row in df.iterrows():
    status = row['Current Status']
    release_date = str(row.get('Release Date', ''))
    release_circumstances = str(row.get('Release/Death Circumstances', ''))
    death_date = str(row.get('Date of Death', ''))
    death_context = str(row.get('Context of Death', ''))
    
    issues = []
    
    # Check: Released status should have release data
    if status == 'Released':
        if release_date in ['nan', '']:
            issues.append("Released but no release date")
        if release_circumstances in ['nan', '']:
            issues.append("Released but no release circumstances")
    
    # Check: Held in Gaza should NOT have release data
    elif status == 'Held in Gaza':
        if release_date not in ['nan', '']:
            issues.append("Held in Gaza but has release date")
        if 'Released' in release_circumstances or 'Returned' in release_circumstances:
            issues.append("Held in Gaza but has release circumstances")
    
    # Check: Deceased should have death data
    elif status == 'Deceased':
        if death_context in ['nan', '']:
            issues.append("Deceased but no death context")
    
    # Check: Deceased-Returned should have both death and return data
    elif status == 'Deceased - Returned':
        if death_context in ['nan', '']:
            issues.append("Deceased-Returned but no death context")
        if release_date in ['nan', '']:
            issues.append("Deceased-Returned but no return date")
    
    if issues:
        inconsistencies.append({
            'index': idx,
            'name': row['Hebrew Name'],
            'status': status,
            'issues': issues,
            'release_date': release_date,
            'release_circumstances': release_circumstances,
            'death_context': death_context
        })

print(f"\n=== FOUND {len(inconsistencies)} INCONSISTENCIES ===")

for issue in inconsistencies[:10]:  # Show first 10
    print(f"\nRow {issue['index']}: {issue['name']}")
    print(f"  Status: {issue['status']}")
    for problem in issue['issues']:
        print(f"  - {problem}")
    print(f"  Release Date: {issue['release_date']}")
    print(f"  Release Circumstances: {issue['release_circumstances']}")

# Check specific problematic cases
print(f"\n=== DETAILED ANALYSIS ===")

# Check "Held in Gaza" with release data
held_with_release = df[(df['Current Status'] == 'Held in Gaza') & (~df['Release Date'].isna())]
print(f"'Held in Gaza' with release dates: {len(held_with_release)}")

# Check "Released" without release data  
released_no_data = df[(df['Current Status'] == 'Released') & (df['Release Date'].isna())]
print(f"'Released' without release dates: {len(released_no_data)}")

# Show the problematic "Held in Gaza" entries
if len(held_with_release) > 0:
    print(f"\nProblematic 'Held in Gaza' entries:")
    for idx, row in held_with_release.head(5).iterrows():
        print(f"  {row['Hebrew Name']}: Release Date = {row['Release Date']}, Circumstances = {row['Release/Death Circumstances']}")

print(f"\n=== RECOMMENDATIONS ===")
print("1. 'Held in Gaza' entries with release data should be changed to 'Released'")
print("2. 'Released' entries without release data need proper dates/circumstances")
print("3. Need to verify actual current status of each hostage")

# Check the most recent data we should have
print(f"\n=== DATA SOURCE VERIFICATION NEEDED ===")
print("The data needs to be verified against current reliable sources to determine:")
print("- Who is actually still held in Gaza")  
print("- Who has been released and when")
print("- Who has died and under what circumstances")
print("- Who has been returned (alive or bodies)")

# Quick fix proposal
print(f"\n=== PROPOSED QUICK FIX ===")
print("Convert 'Held in Gaza' entries that have release dates to 'Released' status")
print("This would resolve the logical inconsistency")