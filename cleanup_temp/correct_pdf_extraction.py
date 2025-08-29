import pandas as pd
import re

# The PDF format is: Hebrew name + Age + English name
# Let me extract them properly by parsing the actual PDF text structure

# From the PDF, the format is:
# Hebrew name (age) English name | Hebrew name (age) English name

# HOSTAGES - ALIVE (Page 1)
hostages_alive = [
    # Left column
    ("אלון בן עידית", "Alon ben Idit (Ohel)", 23),
    ("אריאל בן סילביה", "Ariel ben Silvana (Konio)", 27), 
    ("אבינתן בן דיצה תרצה", "Avinathan ben Ditza Tirtza (Or)", 31),
    ("בר אברהם בן וליה'ג", "Bar Avraham ben Julia (Kuperstein)", 22),
    ("ביפין ג'ושי", "Bipin Joshi", 24),
    ("דוד בן סילביה", "David ben Silvana (Konio)", 34),
    ("איתן אברהם בן אפרת", "Eitan Avraham ben Efrat (Mor)", 23),
    ("איתן בן רות אדית", "Eitan ben Rut Idit (Horn)", 38),
    ("אלקנה בן רוחמה", "Elkana ben Ruchama (Bohbot)", 35),
    ("אביתר בן גילה", "Evyatar ben Gila (David)", 24),
    ("גלי בן טליה", "Gali ben Talya (Berman)", 27),
    
    # Right column  
    ("גיא בן מירב", "Guy ben Meirav (Gilboa-Dalal)", 23),
    ("מתן שחר בן ענת", "Matan Shachar ben Anat (Angrest)", 22),
    ("מתן בן עינב", "Matan ben Einav (Zangauker)", 25),
    ("מקסים בן טלה", "Maxim ben Tella (Herkin)", 36),
    ("נמרוד בן ויקי", "Nimrod ben Vicky (Cohen)", 20),
    ("עמרי בן ורוניקה אסתר", "Omri ben Veronika Esther (Miran)", 47),
    ("רום בן תמר נועה", "Rom ben Tamar Noa (Braslavski)", 20),
    ("שגב בן גלית", "Segev ben Galit (Kalfon)", 26),
    ("תמיר בן חירות", "Tamir ben Cherut (Nimrodi)", 20),
    ("יוסף חיים בן מרים", "Yosef Chaim ben Miriam (Ohana)", 25),
    ("זיו בן טליה", "Ziv ben Talya (Berman)", 27)
]

# DECEASED (Page 1)  
deceased = [
    # Left column
    ("עמירם בן שרה", "Amiram ben Sara (Cooper)", 84),
    ("אריה בן צבי", "Arye ben Tzvi (Zalmanovich)", 86),
    ("אסף בן אילן", "Asaf ben Ilan (Hamami)", 40),
    ("דניאל שמעון בן דורון", "Daniel Shimon ben Doron (Peretz)", 22),
    ("דרור בן יובל", "Dror ben Yuval (Or)", 48),
    ("איתן בן סול", "Eitan ben Sol (Levy)", 53),
    ("אליהו בן דבורה", "Eliyahu ben D'vorah (Margalit)", 75),
    ("גיא בן מישל", "Guy ben Mishel (Illuz)", 26),
    ("הדר בן שמחה", "Hadar ben Simcha (Goldin)", 23),
    ("עידן בן אלי", "Idan ben Eli (Shtivi)", 29),
    ("אילן שלמה בן אברהם", "Ilan Shlomo ben Avraham (Weiss)", 56),
    ("ענבר בת חיים", "Inbar bat Chaim (Haiman)", 27),
    ("איתי בן ראובן", "Itai ben Reuven (Chen)", 38),
    ("יהושע בן לויטו מולל", "Joshua ben Luito Molel", 21),
    ("ליאור בן גיורא", "Lior ben Giora (Rudaeff)", 61),
    
    # Right column
    ("מני בן יעקב", "Meni ben Yaakov (Godard)", 73),
    ("מוחמד אל אטראש", "Mohammad El Alatrash", 40),
    ("עומר בן רונן", "Omer ben Ronen (Neutra)", 23),
    ("עוז בן עמיר", "Oz ben Amir (Daniel)", 19),
    ("רונן בן תומר", "Ronen ben Tomer (Engel)", 55),
    ("רן בן יצחק", "Ran ben Yitzchak (Gvili)", 24),
    ("סהר בן אהרון", "Sahar ben Aharon (Baruch)", 25),
    ("סונטאיה אוקאראסרי", "Sonthaya Oakkharasri", 31),
    ("סותטיסאק בן תונג מא", "Sudthisak ben Thong Ma (Rinthalak)", None),
    ("טל בן זהר", "Tal ben Zohar (Chaimi)", 42),
    ("תמיר בן משה", "Tamir ben Moshe (Adar)", 38),
    ("אוריאל בן עמיר", "Uriel ben Amir (Baruch)", 35),
    ("יאיר בן אלפרד", "Yair ben Alfred (Yaakov)", 59),
    ("יוסי בן רצון", "Yossi ben Ratzon (Sharabi)", 53)
]

# From pages 2-3, extract the RELEASED names (much longer list)
# The format here is Hebrew name + Age + English name
released_sample = [
    # This is just a sample - the PDF has many more released names
    ("עדה בת אסתר", "Ada bat Esther (Sagi)", 75),
    ("עדי בת שושן", "Adi bat Shoshan (Shoham)", 38),
    ("עדינה בת אידה", "Adina bat Ida (Moshe)", 72),
    ("אגם בת מירב", "Agam bat Meirav (Berger)", 20),
    ("ארבל בת יעל", "Arbel bat Yael (Yehud)", 29),
    ("אגם בת חן", "Agam bat Chen (Almog-Goldstein)", 17),
    ("עאישה אלזיאדנה", "Aisha Alziadna", 17),
    ("עלמה בת יונת", "Alma bat Yonit (Or)", 13),
    ("אלמוג בן אורית", "Almog ben Orit (Meir-Jan)", 21),
    ("עמית בת מרים", "Amit bat Miriam (Sousana)", 40),
    # ... many more from the PDF
]

def extract_english_name(full_name):
    """Extract just the family name from the full Hebrew format"""
    # Remove the parentheses and everything before them
    if '(' in full_name and ')' in full_name:
        return full_name.split('(')[1].split(')')[0]
    return full_name

# Create the complete dataset
all_hostages = []

# Add alive hostages
for hebrew, english_full, age in hostages_alive:
    english_name = extract_english_name(english_full)
    all_hostages.append({
        'English Name': english_name,
        'Hebrew Name': hebrew,
        'Age at Kidnapping': age,
        'Current Status': 'Alive'
    })

# Add deceased
for hebrew, english_full, age in deceased:
    english_name = extract_english_name(english_full)
    all_hostages.append({
        'English Name': english_name,
        'Hebrew Name': hebrew,
        'Age at Kidnapping': age,
        'Current Status': 'Deceased'
    })

# Add released (sample - would need to extract all from PDF)
for hebrew, english_full, age in released_sample:
    english_name = extract_english_name(english_full)
    all_hostages.append({
        'English Name': english_name,
        'Hebrew Name': hebrew,
        'Age at Kidnapping': age,
        'Current Status': 'Released'
    })

# Create DataFrame with proper column structure
df = pd.DataFrame(all_hostages)

# Rename to match original structure
df = df.rename(columns={'English Name': 'Hostage Name'})

# Add empty columns
df['Civilian/Soldier Status'] = ''
df['Kidnapped Date'] = '2023-10-07'
df['Date of Death'] = ''
df['Context of Death'] = ''
df['Release Date'] = ''
df['Release/Death Circumstances'] = ''
df['Countries Involved in Deals'] = ''
df['Location Kidnapped (Hebrew)'] = ''
df['Kidnapping Circumstances (Hebrew)'] = ''
df['Kidnapping Summary (Hebrew)'] = ''
df['Photo URL'] = ''
df['Citation URLs'] = ''
df['Source'] = 'Chabad PDF - Corrected'

print(f"Created corrected CSV with {len(df)} entries")
print(f"Status breakdown:")
print(f"  Alive: {len(df[df['Current Status'] == 'Alive'])}")
print(f"  Deceased: {len(df[df['Current Status'] == 'Deceased'])}")
print(f"  Released: {len(df[df['Current Status'] == 'Released'])}")

df.to_csv('hostages-corrected-extraction.csv', index=False, encoding='utf-8-sig')

print(f"\nNote: This is a partial extraction. The PDF contains 250+ names")
print(f"across multiple pages. Need to extract all released names from pages 2-4.")

# Show corrected sample
print("\nSample with correct name matching:")
for i in range(5):
    row = df.iloc[i]
    try:
        print(f"  English: {row['Hostage Name']} <-> Hebrew: {row['Hebrew Name']}")
    except UnicodeEncodeError:
        print(f"  English: {row['Hostage Name']} <-> Hebrew: [Hebrew name present]")