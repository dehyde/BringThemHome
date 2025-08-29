import pandas as pd

print("=== FINDING THE 13 MISSING HELD HOSTAGES ===")

# Load current data
df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')

# Your accurate list of 47 still held
still_held_names = [
    'תמיר אדר', 'אלון אהל', 'יוסף חיים אוחנה', 'אבינתן אור', 'דרור אור',
    'גיא אילוז', 'מוחמד אלאטרש', 'רונן אנגל', 'מתן אנגרסט', 'אלקנה בוחבוט',
    'אוריאל ברוך', 'סהר ברוך', 'גלי ברמן', 'זיו ברמן', 'רום ברסלבסקי',
    'מני גודארד', 'רן רני גאוילי', 'הדר גולדין', 'גיא גלבוע דלאל', 'ביפין ג\'ושי',
    'אביתר דוד', 'עוז דניאל', 'איתן הורן', 'ענבר הימן', 'מקסים הרקין',
    'אריה זלמנוביץ', 'טל חיימי', 'אסף חממי', 'איתי חן', 'נמרוד כהן',
    'שגב כלפון', 'איתן לוי', 'ג\'ושוע לואיטו מולל', 'איתן אברהם מור', 'עמרי מירן',
    'אליהו מרגלית', 'עומר נאוטרה', 'תמיר נמרודי', 'דניאל שמעון פרץ', 'מתן צנגאוקר',
    'אריאל קוניו', 'דוד קוניו', 'עמירם קופר', 'בר אברהם קופרשטיין', 'ליאור רודאיף',
    'יוסי שרעבי', 'עידן שתיוי'
]

print(f"Your accurate list: {len(still_held_names)} names")

# Find which ones matched
found = []
not_found = []

for name in still_held_names:
    exact_match = df[df['Hebrew Name'] == name]
    if len(exact_match) > 0:
        found.append(name)
    else:
        not_found.append(name)

print(f"Found exact matches: {len(found)}")
print(f"Not found (need to locate): {len(not_found)}")

# Show the 13 missing names
print(f"\n=== THE 13 MISSING NAMES ===")
for i, name in enumerate(not_found, 1):
    print(f"{i:2d}. {name}")

# Try to find similar names in the CSV for each missing one
print(f"\n=== SEARCHING FOR SIMILAR NAMES IN CSV ===")

all_hebrew_names = df['Hebrew Name'].tolist()

for missing_name in not_found:
    print(f"\nSearching for: {missing_name}")
    
    # Try partial matches
    possible_matches = []
    
    # Split the missing name into parts
    missing_parts = missing_name.split()
    
    for csv_name in all_hebrew_names:
        csv_parts = str(csv_name).split()
        
        # Check if any part matches
        for missing_part in missing_parts:
            for csv_part in csv_parts:
                if len(missing_part) > 2 and len(csv_part) > 2:
                    if missing_part in csv_part or csv_part in missing_part:
                        if csv_name not in possible_matches:
                            possible_matches.append(csv_name)
    
    if possible_matches:
        print(f"  Possible matches: {possible_matches[:3]}")  # Show first 3
    else:
        print(f"  No similar names found - may need to be added")

# Check current "Held in Gaza" count
current_held = df[df['Current Status'] == 'Held in Gaza']
print(f"\n=== CURRENT STATUS ===")
print(f"Currently marked as 'Held in Gaza': {len(current_held)}")
print(f"Should be: 47")
print(f"Missing: {47 - len(current_held)}")

# Solution options
print(f"\n=== SOLUTION OPTIONS ===")
print("1. Find the 13 missing names through better matching")
print("2. Add the 13 missing entries to the CSV")
print("3. Manually correct the name spellings")
print("4. Force update by adding the missing 13 to reach exactly 47")

print(f"\nShall I proceed with option 4 - add the missing 13 names to reach exactly 47?")