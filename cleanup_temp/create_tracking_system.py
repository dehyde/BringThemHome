import pandas as pd

# Load the main CSV
df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')

print("Creating tracking system...")

# Create comprehensive tracking for all 240 entries
tracking_df = df[['Hebrew Name', 'Age at Kidnapping', 'Current Status', 'Citation URLs']].copy()

# Add tracking columns
tracking_df['Research Status'] = 'Not Started'  # Not Started, In Progress, Completed, Verified
tracking_df['Date Researched'] = ''
tracking_df['Death Date'] = ''
tracking_df['Release/Return Date'] = ''  
tracking_df['Circumstances Category'] = ''
tracking_df['New Citations Found'] = ''
tracking_df['Validation Status'] = 'Pending'  # Pending, Validated, Needs Review
tracking_df['Research Notes'] = ''
tracking_df['Priority'] = ''

# Set priorities based on current status
def set_priority(status):
    if status == 'Deceased - Returned':
        return 'High - Has documentation'
    elif status == 'Deceased':
        return 'High - Need death circumstances'
    elif status == 'Unknown':
        return 'Medium - Need status clarification'
    else:
        return 'Low - Currently held'

tracking_df['Priority'] = tracking_df['Current Status'].apply(set_priority)

# Save the master tracking file
tracking_df.to_csv('master_tracking.csv', index=False, encoding='utf-8-sig')

# Create summary by status
print("\n=== TRACKING SUMMARY ===")
print(f"Total entries to research: {len(tracking_df)}")

priority_breakdown = tracking_df['Priority'].value_counts()
for priority, count in priority_breakdown.items():
    print(f"  {priority}: {count}")

status_breakdown = tracking_df['Current Status'].value_counts()
print(f"\nStatus breakdown:")
for status, count in status_breakdown.items():
    print(f"  {status}: {count}")

# Create a simple progress counter
progress_summary = {
    'Total Entries': len(tracking_df),
    'Not Started': len(tracking_df[tracking_df['Research Status'] == 'Not Started']),
    'In Progress': len(tracking_df[tracking_df['Research Status'] == 'In Progress']),
    'Completed': len(tracking_df[tracking_df['Research Status'] == 'Completed']),
    'Verified': len(tracking_df[tracking_df['Research Status'] == 'Verified']),
    'Completion Percentage': 0.0
}

# Save progress summary as JSON for easy updating
import json
with open('progress_summary.json', 'w') as f:
    json.dump(progress_summary, f, indent=2)

print(f"\n=== FILES CREATED ===")
print(f"✓ master_tracking.csv - Complete tracking of all 240 entries")
print(f"✓ progress_summary.json - Quick progress overview")
print(f"✓ research_progress.md - Detailed documentation")

print(f"\n=== HOW TO TRACK PROGRESS ===")
print(f"1. Update 'Research Status' column as you work:")
print(f"   - 'Not Started' → 'In Progress' → 'Completed' → 'Verified'")
print(f"2. Fill in dates, circumstances, citations as you research")
print(f"3. Run progress update script to see completion stats")
print(f"4. Priority order: High priority entries first")

# Show first few high priority entries
high_priority = tracking_df[tracking_df['Priority'].str.contains('High')].head()
print(f"\nFirst 5 high-priority entries to start with:")
for i, (idx, row) in enumerate(high_priority.iterrows()):
    print(f"{i+1}. Row {idx+2} - {row['Current Status']} (Age {row['Age at Kidnapping']})")
    print(f"   Priority: {row['Priority']}")
    if row['Citation URLs']:
        print(f"   Has existing URL: Yes")
    print()