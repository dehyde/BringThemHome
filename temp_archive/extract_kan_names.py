import re
import pandas as pd

# Read the Kan HTML file
with open('kan_full2.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

# Extract Hebrew names from the HTML
hebrew_names = []
pattern = r'<img src="[^"]*" class="img-fluid" alt="([^"]*)" title="([^"]*)"'
matches = re.findall(pattern, html_content)

for match in matches:
    name = match[0].strip()
    if name and len(name) > 2 and not name.startswith('http'):
        hebrew_names.append(name)

print(f"Found {len(hebrew_names)} Hebrew names from Kan")

# Load current CSV
df = pd.read_csv('hostages-list-complete.csv', encoding='utf-8-sig')

# Expanded manual mappings based on known transliterations
expanded_mappings = {
    'יונתן סמרנו': 'Yonatan Samreno',
    'שי לוינסון': 'Shai Levinson', 
    'עפרה קידר': 'Ofra Keidar',
    'אביב אצילי': 'Aviv Atzili',
    'יאיר יעקב': 'Yair Yaakov',
    'נטפונג פינטה': 'Nattapong Pinta',
    'ג׳ודי ויינשטיין': 'Judy Weinstein',
    'גדי חגי': 'Gadi Haggai',
    'אלון אוהל': 'Alon Ohel',
    'אור לוי': 'Or Levy',
    'אלכסנדר לובנוב': 'Alexander Lobanov',
    'עלמוג סרוסי': 'Almog Sarusi',
    'אלכס דנציג': 'Alex Danzig',
    'עדן ירושלמי': 'Eden Yerushalmi',
    'מתן צנגוקר': 'Matan Zangauker',
    'עומרי מירן': 'Omri Miran',
    'אמיר שמואל': 'Amir Shmuel',
    'נדב פופלוול': 'Nadav Popplewell',
    'מיטל חיים': 'Mital Haim',
    'אליה טופיק': 'Elya Toufic',
    'דולב יהוד': 'Dolev Yehud',
    'אבניר סימן טוב': 'Avner Siton',
    'נעמה לוי': 'Naama Levy',
    'אוהד בן עמי': 'Ohad Ben Ami',
    'גיא גלבוע דלאל': 'Guy Gilboa-Dalal',
    'הדר גולדין': 'Hadar Goldin',
    'אורון שאול': 'Oron Shaul',
    'עמית שני': 'Amit Shani',
    'אלכס דנציג': 'Alex Danzig',
    'איתיי סבירסקי': 'Itai Svirsky',
    'אליהו כהן': 'Eliahu Cohen',
    'רועי אסרף': 'Roi Asraf',
    'אלחנן קלצקי': 'Elhanan Kalatzky',
    'עמית לוי': 'Amit Levy',
    'אלי לביא': 'Eli Levia',
    'טל שוחט': 'Tal Shohat',
    'ניב פורטר': 'Niv Porter',
    'עובדה רחמן': 'Ovadya Rahman',
    'אמילי דמארי': 'Emily Damari',
    'רומי גונן': 'Romi Gonen',  
    'הרש גולדברג-פולין': 'Hersh Goldberg-Polin',
    'לירי אלבג': 'Liri Albag',
    'קרינה אריאב': 'Karina Ariev',
    'נעמה לוי': 'Naama Levy',
    'אוהד בן עמי': 'Ohad Ben Ami',
    'גיא גלבוע דלאל': 'Guy Gilboa-Dalal',
    'הדר גולדין': 'Hadar Goldin',
    'אורון שאול': 'Oron Shaul'
}

# Function to find Hebrew name with better matching
def find_hebrew_name_extended(english_name):
    # Direct lookup
    for hebrew, english in expanded_mappings.items():
        if english.lower() == english_name.lower():
            return hebrew
    
    # Partial name matching
    for hebrew, english in expanded_mappings.items():
        english_parts = english.lower().split()
        name_parts = english_name.lower().split()
        
        # Check if any significant part matches
        if len(english_parts) >= 2 and len(name_parts) >= 2:
            if (english_parts[0] in name_parts or name_parts[0] in english_parts) and \
               (english_parts[-1] in name_parts or name_parts[-1] in english_parts):
                return hebrew
    
    return None

# Update with extended mappings
updated_count = 0
for index, row in df.iterrows():
    if pd.isna(row['Hebrew Name']) or row['Hebrew Name'] == '':
        english_name = str(row['Hostage Name'])
        hebrew_name = find_hebrew_name_extended(english_name)
        if hebrew_name:
            df.at[index, 'Hebrew Name'] = hebrew_name
            updated_count += 1

print(f"Updated {updated_count} additional Hebrew names")
df.to_csv('hostages-list-final.csv', index=False, encoding='utf-8-sig')

# Final stats
total = len(df)
with_hebrew = len(df[df['Hebrew Name'].notna() & (df['Hebrew Name'] != '')])
missing = total - with_hebrew

print(f"\nFinal stats:")
print(f"Total entries: {total}")
print(f"With Hebrew names: {with_hebrew}")
print(f"Still missing: {missing}")
print(f"Coverage: {with_hebrew/total*100:.1f}%")