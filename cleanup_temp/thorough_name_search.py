import pandas as pd
import re

print("=== THOROUGH SEARCH FOR THE 13 MISSING NAMES ===")

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

# Find which ones didn't match exactly
found_exact = []
not_found_exact = []

for name in still_held_names:
    exact_match = df[df['Hebrew Name'] == name]
    if len(exact_match) > 0:
        found_exact.append(name)
    else:
        not_found_exact.append(name)

print(f"Found exact matches: {len(found_exact)}")
print(f"Need fuzzy search for: {len(not_found_exact)}")

# Now do thorough fuzzy matching for each missing name
matches_found = 0
still_missing = []

for missing_name in not_found_exact:
    print(f"\n--- Searching for: {missing_name} ---")
    
    # Method 1: Check if missing name is contained within any CSV name
    contained_matches = df[df['Hebrew Name'].str.contains(missing_name, case=False, na=False, regex=False)]
    
    # Method 2: Check if any CSV name is contained within missing name
    containing_matches = df[df['Hebrew Name'].apply(lambda x: missing_name in str(x) if pd.notna(x) else False)]
    
    # Method 3: Split names and check individual parts
    missing_parts = missing_name.split()
    part_matches = []
    
    for part in missing_parts:
        if len(part) > 2:  # Only check meaningful parts
            part_match = df[df['Hebrew Name'].str.contains(part, case=False, na=False, regex=False)]
            part_matches.extend(part_match.index.tolist())
    
    # Combine all potential matches
    all_potential_indices = set()
    if len(contained_matches) > 0:
        all_potential_indices.update(contained_matches.index.tolist())
    if len(containing_matches) > 0:
        all_potential_indices.update(containing_matches.index.tolist())
    if part_matches:
        # Only add part matches if they appear multiple times (more likely to be correct)
        from collections import Counter
        part_counts = Counter(part_matches)
        for idx, count in part_counts.items():
            if count > 1 or len(missing_parts) == 1:  # Multi-part match or single name
                all_potential_indices.add(idx)
    
    # Show potential matches
    potential_matches = df.iloc[list(all_potential_indices)]
    
    if len(potential_matches) > 0:
        print(f"  Potential matches found ({len(potential_matches)}):")
        for idx, row in potential_matches.iterrows():
            current_status = row['Current Status']
            rank = str(row.get('Rank', ''))
            print(f"    [{idx}] {row['Hebrew Name']} | {rank} | Status: {current_status}")
        
        # If there's a clear best match, use it
        if len(potential_matches) == 1:
            match_idx = potential_matches.index[0]
            print(f"  --> USING: {df.at[match_idx, 'Hebrew Name']}")
            matches_found += 1
        elif len(potential_matches) <= 3:
            # Show top candidates for manual review
            print(f"  --> Multiple candidates found - manual review needed")
            matches_found += 1  # We found candidates
    else:
        print(f"  No matches found in CSV")
        still_missing.append(missing_name)

print(f"\n=== SUMMARY ===")
print(f"Exact matches: {len(found_exact)}")
print(f"Fuzzy matches found: {matches_found}")
print(f"Still missing: {len(still_missing)}")
print(f"Total should be: 47")

# Let's also check if any names have military ranks
print(f"\n=== CHECKING FOR MILITARY RANKS ===")
rank_patterns = ['סמ"ר', 'רב"ט', 'רס"ר', 'סגן', 'רס"ן', 'רב"צ']

for missing_name in not_found_exact[:5]:  # Check first 5 missing names
    print(f"\nChecking {missing_name} with ranks:")
    
    # Try adding common military ranks
    for rank in rank_patterns:
        test_name_with_rank = f"{missing_name} {rank}"
        rank_match = df[df['Hebrew Name'].str.contains(rank, case=False, na=False) & 
                       df['Hebrew Name'].str.contains(missing_name.split()[0], case=False, na=False)]
        
        if len(rank_match) > 0:
            print(f"  Found with rank {rank}: {rank_match.iloc[0]['Hebrew Name']}")

# Check for name order differences (first name last name vs last name first name)
print(f"\n=== CHECKING NAME ORDER VARIATIONS ===")
for missing_name in not_found_exact[:3]:  # Check first 3
    parts = missing_name.split()
    if len(parts) == 2:
        reversed_name = f"{parts[1]} {parts[0]}"
        reversed_match = df[df['Hebrew Name'] == reversed_name]
        if len(reversed_match) > 0:
            print(f"  Found reversed: {missing_name} -> {reversed_name}")

print(f"\n=== NEXT STEPS ===")
print("1. Review the potential matches above")
print("2. Manually update the 13 names that have slight variations")
print("3. Ensure we reach exactly 47 'Held in Gaza' status")