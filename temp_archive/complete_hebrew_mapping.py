import pandas as pd
import re
from difflib import SequenceMatcher

# Load current CSV
df = pd.read_csv('hostages-list-final.csv', encoding='utf-8-sig')

# Comprehensive Hebrew name mappings from multiple sources
comprehensive_mappings = {
    # From Kan.org.il extraction
    'יונתן סמרנו': ['Yonatan Samreno', 'Jonathan Samreno'],
    'שי לוינסון': ['Shai Levinson', 'Shay Levinson'], 
    'עפרה קידר': ['Ofra Keidar', 'Ofra Kedar'],
    'אביב אצילי': ['Aviv Atzili', 'Aviv Etzili'],
    'יאיר יעקב': ['Yair Yaakov', 'Yair Jacob'],
    'נטפונג פינטה': ['Nattapong Pinta', 'Nattapong Phinta'],
    'ג׳ודי ויינשטיין': ['Judy Weinstein', 'Judith Weinstein'],
    'גדי חגי': ['Gadi Haggai', 'Gadi Hagay'],
    'אלון אוהל': ['Alon Ohel'],
    'אור לוי': ['Or Levy', 'Or Levi'],
    'אלכסנדר לובנוב': ['Alexander Lobanov', 'Aleksandr Lobanov'],
    'עלמוג סרוסי': ['Almog Sarusi', 'Almog Saroussi'],
    'עדן ירושלמי': ['Eden Yerushalmi', 'Eden Jerusalmi'],
    'מתן צנגוקר': ['Matan Zangauker', 'Matan Zangawker'],
    'עומרי מירן': ['Omri Miran'],
    'אמיר שמואל': ['Amir Shmuel', 'Amir Samuel'],
    'נדב פופלוול': ['Nadav Popplewell'],
    'מיטל חיים': ['Mital Haim'],
    'אליה טופיק': ['Elya Toufic', 'Elia Toufic'],
    'דולב יהוד': ['Dolev Yehud'],
    'אבניר סימן טוב': ['Avner Siton', 'Avner Simantuv'],
    
    # Previously mapped
    'אמילי דמארי': ['Emily Damari'],
    'רומי גונן': ['Romi Gonen'],
    'הרש גולדברג-פולין': ['Hersh Goldberg-Polin'],
    'לירי אלבג': ['Liri Albag'],
    'קרינה אריאב': ['Karina Ariev'],
    'נעמה לוי': ['Naama Levy'],
    'אוהד בן עמי': ['Ohad Ben Ami'],
    'גיא גלבוע דלאל': ['Guy Gilboa-Dalal'],
    'הדר גולדין': ['Hadar Goldin'],
    'אורון שאול': ['Oron Shaul'],
    
    # Additional common transliterations
    'עדן זכריה': ['Eden Zacharia', 'Eden Zecharya'],
    'אלכסנדר דנציג': ['Alex Danzig', 'Alexander Danzig'],
    'איתי סבירסקי': ['Itai Svirsky'],
    'תמיר אדר': ['Tamir Adar'],
    'רון שרמן': ['Ron Sherman'],
    'ליאור רודיק': ['Lior Rudik'],
    'דן אלמג': ['Dan Almog'],
    'יונתן סמו': ['Yonatan Samo'],
    'עמית שני': ['Amit Shani'],
    'חיים דסקל': ['Chaim Dascal'],
    'תמר כהן': ['Tamar Cohen'],
    'רותי מונדו': ['Ruti Mondo'],
    'גל דלאל': ['Gal Dalal'],
    'מיה רגב': ['Maya Regev'],
    'חיים פרי': ['Chaim Perry'],
    'שני לוק': ['Shani Look'],
    'עופרי ברודצקי': ['Ofri Brodsky'],
    'איילה מצגר': ['Aiyla Metzger'],
    'שחר בן אבירהם': ['Shahar Ben Avraham'],
    'רומן שפירא': ['Roman Shapira'],
    'תהילה בן משה': ['Tehila Ben Moshe'],
    'רנה רבינוביץ': ['Rina Rabinovitz'],
    'אליזבת צורף': ['Elizabeth Tzureff'],
    'תמר אלוני': ['Tamar Aloni'],
    'אמירה ראשיד': ['Amira Rashid'],
    'עידן אלכסנדר': ['Idan Alexander'],
    'אמיר ראפ': ['Amir Rap'],
    'עידן ברע': ['Idan Bara'],
    'כפיר ביבס': ['Kfir Bibas'],
    'אריאל ביבס': ['Ariel Bibas'],
    'יותם פאת': ['Yotam Haim']
}

def similarity(a, b):
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def find_best_hebrew_match(english_name):
    best_match = None
    best_score = 0.0
    
    for hebrew_name, english_variants in comprehensive_mappings.items():
        for english_variant in english_variants:
            score = similarity(english_name, english_variant)
            if score > best_score and score > 0.7:  # 70% similarity threshold
                best_match = hebrew_name
                best_score = score
    
    return best_match if best_score > 0.7 else None

# Update Hebrew names
updated_count = 0
for index, row in df.iterrows():
    if pd.isna(row['Hebrew Name']) or row['Hebrew Name'] == '':
        english_name = str(row['Hostage Name'])
        hebrew_match = find_best_hebrew_match(english_name)
        if hebrew_match:
            df.at[index, 'Hebrew Name'] = hebrew_match
            updated_count += 1

print(f"Updated {updated_count} additional Hebrew names with fuzzy matching")

# Save final version
df.to_csv('hostages-list-complete-final.csv', index=False, encoding='utf-8-sig')

# Final statistics
total = len(df)
with_hebrew = len(df[df['Hebrew Name'].notna() & (df['Hebrew Name'] != '')])
missing = total - with_hebrew

print(f"\nFinal comprehensive stats:")
print(f"Total entries: {total}")
print(f"With Hebrew names: {with_hebrew}")
print(f"Still missing: {missing}")
print(f"Coverage: {with_hebrew/total*100:.1f}%")