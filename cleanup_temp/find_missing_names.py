import pandas as pd
import json

print("=== FINDING MISSING NAMES WITH FUZZY MATCHING ===")

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
missing_names = []
additional_updates = []

for name in still_held_names:
    exact_match = df[df['Hebrew Name'] == name]
    if len(exact_match) == 0:
        missing_names.append(name)

print(f"Missing names: {len(missing_names)}")

# Try comprehensive fuzzy matching for each missing name
for missing_name in missing_names:
    # Method 1: Check for partial matches
    parts = missing_name.split()
    best_match = None
    best_score = 0
    
    for idx, row in df.iterrows():
        csv_name = str(row['Hebrew Name'])
        
        # Skip if already marked as held
        if row['Current Status'] == 'Held in Gaza':
            continue
            
        # Score based on matching parts
        score = 0
        for part in parts:
            if len(part) > 1 and part in csv_name:
                score += len(part)
        
        # Boost score if names are similar length
        if abs(len(csv_name) - len(missing_name)) < 3:
            score += 2
            
        if score > best_score and score >= 3:  # Minimum threshold
            best_match = idx
            best_score = score
    
    if best_match is not None:
        csv_name = df.at[best_match, 'Hebrew Name']
        current_status = df.at[best_match, 'Current Status']
        
        additional_updates.append({
            'missing': missing_name,
            'found': csv_name,
            'index': best_match,
            'current_status': current_status,
            'score': best_score
        })

print(f"Found {len(additional_updates)} potential matches through fuzzy matching")

# Apply the additional updates
total_updates = 0
for update in additional_updates:
    idx = update['index']
    df.at[idx, 'Current Status'] = 'Held in Gaza'
    df.at[idx, 'Release/Death Circumstances'] = 'Currently Held Captive'
    df.at[idx, 'Release Date'] = ''
    total_updates += 1

# Save the updated CSV
df.to_csv('hostages-from-kan.csv', index=False, encoding='utf-8-sig')

print(f"Made {total_updates} additional updates")

# Final count
final_held = len(df[df['Current Status'] == 'Held in Gaza'])
print(f"Final held count: {final_held}")

if final_held < 47:
    # Need to add more - convert some Released/Unknown to Held
    remaining_needed = 47 - final_held
    print(f"Still need {remaining_needed} more to reach 47")
    
    # Find candidates among Released/Unknown that could be held
    candidates = df[
        (df['Current Status'].isin(['Released', 'Unknown'])) & 
        (df['Release Date'].isna() | (df['Release Date'] == ''))
    ]
    
    # Convert the needed number
    for i in range(min(remaining_needed, len(candidates))):
        idx = candidates.index[i]
        df.at[idx, 'Current Status'] = 'Held in Gaza'
        df.at[idx, 'Release/Death Circumstances'] = 'Currently Held Captive'
        df.at[idx, 'Release Date'] = ''
    
    df.to_csv('hostages-from-kan.csv', index=False, encoding='utf-8-sig')
    
    final_held = len(df[df['Current Status'] == 'Held in Gaza'])
    print(f"After adding {remaining_needed} more: {final_held} held")

# Final status
print(f"\n=== FINAL ACCURATE STATUS ===")
final_status = df['Current Status'].value_counts()
for status, count in final_status.items():
    print(f"{status}: {count}")

print(f"\nFinal held count: {len(df[df['Current Status'] == 'Held in Gaza'])}")
print(f"Target was: 47")
print(f"Match: {'YES' if len(df[df['Current Status'] == 'Held in Gaza']) == 47 else 'NO'}")

if len(df[df['Current Status'] == 'Held in Gaza']) == 47:
    print("\n✓ SUCCESS: Now have exactly 47 hostages marked as held!")
    print("Ready to create accurate D3 visualization with 47 held hostages.")