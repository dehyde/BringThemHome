import re
import pandas as pd

# Read the Kan.txt file
with open('Hostage list info from Kan.txt', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract all memorial items using regex
# Pattern: Find each memorial-list-item block
pattern = r'<div class="memorial-list-item">(.*?)</div>\s*</div>\s*</div>'
items = re.findall(pattern, content, re.DOTALL)

hostages = []
print(f"Found {len(items)} memorial items")

for i, item in enumerate(items):
    try:
        # Extract Hebrew name
        name_match = re.search(r'alt="([^"]+)".*?title="([^"]+)"', item)
        if name_match:
            hebrew_name = name_match.group(1)
        else:
            # Fallback - look for name in card-title
            name_match2 = re.search(r'<span class="text-xs">.*?</span>\s*(.*?)\s*<span class="text-sm">', item, re.DOTALL)
            if name_match2:
                hebrew_name = name_match2.group(1).strip()
            else:
                print(f"Warning: Could not extract name from item {i+1}")
                continue
        
        # Extract rank (if exists)
        rank_match = re.search(r'<span class="text-xs">([^<]*)</span>', item)
        rank = rank_match.group(1).strip() if rank_match and rank_match.group(1).strip() else ''
        
        # Extract age and location
        age_loc_match = re.search(r'<span class="text-sm">(\d+),\s*([^<]*)</span>', item)
        if age_loc_match:
            age = int(age_loc_match.group(1))
            location = age_loc_match.group(2).strip()
        else:
            age = None
            location = ''
            
        # Extract status/description from card-text
        status_match = re.search(r'<div class="card-text">\s*(.*?)\s*</div>', item, re.DOTALL)
        status_desc = status_match.group(1).strip() if status_match else ''
        
        # Extract photo URL
        photo_match = re.search(r'src="([^"]*)"', item)
        photo_url = photo_match.group(1) if photo_match else ''
        
        # Extract article URL
        article_match = re.search(r'href="([^"]*)".*?target="_blank"', item)
        article_url = article_match.group(1) if article_match else ''
        
        # Determine status based on description
        if 'הוחזר' in status_desc or 'הושב' in status_desc:
            if 'חיים' in status_desc or 'שוחרר' in status_desc:
                current_status = 'Released'
            else:
                current_status = 'Deceased - Returned'
        elif 'נרצח' in status_desc or 'נהרג' in status_desc:
            current_status = 'Deceased'
        elif 'נחטף' in status_desc or 'בשבי' in status_desc:
            current_status = 'Held in Gaza'
        else:
            current_status = 'Unknown'
            
        # Determine if civilian or soldier based on rank
        if rank:
            civilian_soldier = f'Soldier - {rank}'
        else:
            civilian_soldier = 'Civilian'
        
        hostages.append({
            'Hebrew Name': hebrew_name,
            'Rank': rank,
            'Age at Kidnapping': age,
            'Location': location,
            'Current Status': current_status,
            'Civilian/Soldier Status': civilian_soldier,
            'Status Description': status_desc,
            'Photo URL': photo_url,
            'Article URL': article_url,
            'Kidnapped Date': '2023-10-07',
            'Source': 'Kan.org.il'
        })
        
    except Exception as e:
        print(f"Error processing item {i+1}: {e}")
        continue

print(f"Successfully extracted {len(hostages)} hostages")

# Create DataFrame
df = pd.DataFrame(hostages)

# Add remaining columns to match structure
df['Date of Death'] = ''
df['Context of Death'] = ''
df['Release Date'] = ''
df['Release/Death Circumstances'] = ''
df['Countries Involved in Deals'] = ''
df['Location Kidnapped (Hebrew)'] = df['Location']
df['Kidnapping Circumstances (Hebrew)'] = df['Status Description']
df['Kidnapping Summary (Hebrew)'] = df['Status Description']
df['Citation URLs'] = df['Article URL']

# Reorder columns
column_order = [
    'Hebrew Name', 'Rank', 'Age at Kidnapping', 'Civilian/Soldier Status', 
    'Kidnapped Date', 'Current Status', 'Date of Death', 'Context of Death', 
    'Release Date', 'Release/Death Circumstances', 'Countries Involved in Deals',
    'Location Kidnapped (Hebrew)', 'Kidnapping Circumstances (Hebrew)', 
    'Kidnapping Summary (Hebrew)', 'Photo URL', 'Citation URLs', 'Source'
]

df = df.reindex(columns=column_order, fill_value='')

# Save to CSV
df.to_csv('hostages-from-kan.csv', index=False, encoding='utf-8-sig')

print(f"\nCreated CSV with {len(df)} entries")
print(f"\nStatus breakdown:")
print(df['Current Status'].value_counts().to_string())

print(f"\nCivilian/Soldier breakdown:")
print(df['Civilian/Soldier Status'].value_counts().to_string())

print(f"\nRank breakdown (soldiers only):")
ranks = df[df['Rank'] != '']['Rank'].value_counts()
print(ranks.to_string())

print(f"\nSample entries:")
for i in range(min(5, len(df))):
    row = df.iloc[i]
    rank_str = f" ({row['Rank']})" if row['Rank'] else ""
    try:
        print(f"  {row['Hebrew Name']}{rank_str}, {row['Age at Kidnapping']}, {row['Current Status']}")
    except UnicodeEncodeError:
        print(f"  [Hebrew Name]{rank_str}, {row['Age at Kidnapping']}, {row['Current Status']}")