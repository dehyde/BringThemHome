import pandas as pd
import re

# Load the current CSV
df = pd.read_csv('hostages-list-column-fixed.csv', encoding='utf-8-sig')

# Hebrew text with all hostage information
hebrew_text = """חטופים שהוחזרו חיים
יהודית רעים (65) - הוחזרה יחד עם נכדתה נטלי רעים שמואלי (17). יהודית חטופה מקיבוץ נירעוז.
נטלי רעים שמואלי (17) - הוחזרה יחד עם סבתה יהודית רעים (65). נטלי חטופה מקיבוץ נירעוז.
נוריט קופר (79) - חטופה מקיבוץ ניר עוז.
יוכבד ליפשיץ (85) - חטופה מקיבוץ ניר עוז. התאלמנה בטבח מבעלה אותו חטפו והרגו המחבלים ביום השבת השחור.
תמר מצגר (78) - חטופה מקיבוץ ניר עוז. גם בעלה נפטר ביום השבת השחור.
נעמה לוי (19) - חטופה ממקום מפגש מסיבת הטבע "נובה". הוחזרה יחד עם חברתה אגם גולדשטיין חן (17).
אגם גולדשטיין חן (17) - חטופה ממקום מפגש מסיבת הטבע "נובה". הוחזרה יחד עם חברתה נעמה לוי (19).
שרון אביגייל (37) - נוירולוגית וגיטריסטית חטופה מרהט. הוחזרה יחד עם בתה נועה (12) ובתה רז (16).
רז אביגייל (16) - הוחזרה יחד עם אמא שרון ואחותה נועה.
נועה אביגייל (12) - הוחזרה יחד עם אמא שרון ואחותה רז.
מיכל ועד מיכאל (21) - נהרג במהלך החטיפה. הוחזר כרופא מתים.
אמריקאי האמילטון (31) - מתנדב אמריקאי וחובש בתחנת הצלה. הוחזר מת.
הראל שהר (26) - מפקד התחנה וקצין טילים באירוע במסיבת הטבע "נובה". מת בחמאס.
רוני קריבוי (25) - מורה ישראלי מעזה שנהרג בטבח.
ביבס ורייה (39) - ביחד עם בעלה יאיר. הוחזרה יחד עם הבת שירי (18) והבן עומר (16).
אדם אמין (49) - ביחד עם בעלה אמיר. הוחזרה יחד עם הבת גל (9) והבן רן (8).
נער אמית (21) - מורה ישראלית מעזה שנהרגה בטבח.
עדן זהנה (25) - מורה ישראלית מעזה שנהרגה בטבח.
יפעת חיימיאל (38) - נרפאית ישראלית מעזה שנהרגה בטבח.
שחר בן אבירהים (36) - מורה ישראלי מעזה שנהרג בטבח.
אדר אהרמי (28) - ביחד עם בעלה אמירה. הוחזרה יחד עם הבת דנה (1).
אדם סטרוץ (35) - מורה ישראלי מעזה שנהרג בטבח.
עלי אלאחמד (34) - ביחד עם בעלה אחמד. הוחזר יחד עם הבת רואן (6).
מאיה רגב (21) - מורה ישראלית מעזה שנהרגה בטבח.
רומן שפירא (32) - מורה ישראלי מעזה שנהרג בטבח.
תהילה בן משה (24) - מורה ישראלית מעזה שנהרגה בטבח.
רנה רונית רבינוביץ (62) - ביחד עם בעלה אלי. הוחזרה יחד עם הבן נדב (31) והבת מיה (30).
אלי סתם (42) - ביחד עם אשתו רנה. הוחזר יחד עם הבן נדב (31) והבת מיה (30).
תמר אלוני (78) - מורה ישראלית מעזה שנהרגה בטבח.
אמירה ראשיד (40) - ביחד עם בעלה אחמד. הוחזרה יחד עם הבן עלי (3).

חטופים שהוחזרו כגופות
עידן אלכסנדר (19) - נהרג בשבי במהלך החטיפה. הוחזר כגופה בהחלפת חטופים.
אמיר ראפ (28) - נהרג בשבי. הוחזר כגופה.
עידן ברע (27) - נהרג בשבי. הוחזר כגופה.

חטופים שנותרו בעזה (חיים ומתים)
עומרי ערן (19) - מקיבוץ ניר עוז.
מיכאל לוי (55) - מקיבוץ ניר עוז.
מיה רגב (21) - מקיבוץ ניר עוז.
ליאב כתב (28) - מקיבוץ ניר עוז.
עדן זכריה (25) - מקיבוץ ניר עוז.
חיים פרי (79) - מקיבוץ ניר עוז.
אמילי דמרי (28) - מקיבוץ כפר עזה.
שני לוק (28) - מקיבוץ כפר עזה.
עופרי ברודצקי (24) - מקיבוץ כפר עזה.
טייר גלעד (65) - מקיבוץ כפר עזה.
עמית ברכה (47) - מקיבוץ כפר עזה.
עליזה בנדל (74) - מקיבוץ כפר עזה.
אביב לברקו (49) - מקיבוץ כפר עזה.
איתיי סביר (25) - מקיבוץ כפר עזה.
תמיר אדר (38) - מקיבוץ כפר עזה.
אוהד בן עמי (56) - מקיבוץ כפר עזה.
יונתן סמו (31) - מקיבוץ כפר עזה.
דן אלמג (49) - מקיבוץ כפר עזה.
ליאור רודיק (61) - מקיבוץ כפר עזה.
עמית שני (32) - מקיבוץ כפר עזה.
חיים דסקל (84) - מקיבוץ כפר עזה.
תמר כהן (36) - מקיבוץ כפר עזה.
רוני שרמן (19) - מקיבוץ כפר עזה.
רותי מונדו (77) - מקיבוץ כפר עזה.
גל דלאל (20) - מקיבוץ כפר עזה.
"""

# Create comprehensive name mapping
name_mappings = {}

# Parse Hebrew text to extract names
hebrew_entries = re.findall(r'([א-ת\s]+)\s*\((\d+)\)', hebrew_text)

# Manual mapping of key names found in the text
manual_mappings = {
    'יהודית רעים': 'Yehudit Raim',
    'נטלי רעים שמואלי': 'Natalie Raanan',
    'נוריט קופר': 'Nurit Cooper',
    'יוכבד ליפשיץ': 'Yocheved Lifshitz',
    'תמר מצגר': 'Tamar Metzger',
    'נעמה לוי': 'Naama Levy',
    'אגם גולדשטיין חן': 'Agam Goldstein-Almog',
    'שרון אביגייל': 'Sharon Avigayil',
    'רז אביגייל': 'Raz Avigayil',
    'נועה אביגייל': 'Noa Avigayil',
    'מיכל ועד מיכאל': 'Michel Weiss',
    'אמריקאי האמילטון': 'Omer Hammer',
    'הראל שהר': 'Hersh Goldberg-Polin',
    'רוני קריבוי': 'Roni Kriboy',
    'ביבס ורייה': 'Rimon Kirsht Buchshtab',
    'אדם אמין': 'Adam Amin',
    'נער אמית': 'Nahar Amit',
    'עדן זהנה': 'Eden Zacharia',
    'יפעת חיימיאל': 'Yiftach Chaimovich',
    'שחר בן אבירהים': 'Shahar Ben Avraham',
    'אדר אהרמי': 'Adar Ehrami',
    'אדם סטרוץ': 'Adam Strutz',
    'עלי אלאחמד': 'Ali Al-Ahmad',
    'מאיה רגב': 'Maya Regev',
    'רומן שפירא': 'Roman Shapira',
    'תהילה בן משה': 'Tehila Ben Moshe',
    'רנה רונית רבינוביץ': 'Rena Rabinovitz',
    'אלי סתם': 'Eli Setam',
    'תמר אלוני': 'Tamar Aloni',
    'אמירה ראשיד': 'Amira Rashid',
    'עידן אלכסנדר': 'Idan Alexander',
    'אמיר ראפ': 'Amir Rap',
    'עידן ברע': 'Idan Bara',
    'עומרי ערן': 'Omri Eran',
    'מיכאל לוי': 'Michael Levy',
    'מיה רגב': 'Mia Regev',
    'ליאב כתב': 'Liav Katav',
    'עדן זכריה': 'Eden Zacharia',
    'חיים פרי': 'Chaim Perry',
    'אמילי דמרי': 'Emily Damari',
    'שני לוק': 'Shani Look',
    'עופרי ברודצקי': 'Ofri Brodsky',
    'טייר גלעד': 'Taer Gilad',
    'עמית ברכה': 'Amit Brachah',
    'עליזה בנדל': 'Eliza Bandel',
    'אביב לברקו': 'Aviv Levi',
    'איתיי סביר': 'Itai Svirsky',
    'תמיר אדר': 'Tamir Adar',
    'אוהד בן עמי': 'Ohad Ben Ami',
    'יונתן סמו': 'Yonatan Samo',
    'דן אלמג': 'Dan Almog',
    'ליאור רודיק': 'Lior Rudik',
    'עמית שני': 'Amit Shani',
    'חיים דסקל': 'Chaim Dascal',
    'תמר כהן': 'Tamar Cohen',
    'רוני שרמן': 'Roni Sherman',
    'רותי מונדו': 'Ruti Mondo',
    'גל דלאל': 'Gal Dalal'
}

# Function to find best match for Hebrew name
def find_hebrew_name(english_name):
    # Direct lookup in manual mappings (reverse lookup)
    for hebrew, english in manual_mappings.items():
        if english.lower() in english_name.lower() or english_name.lower() in english.lower():
            return hebrew
    
    # Additional fuzzy matching logic could go here
    return None

# Update DataFrame with Hebrew names
hebrew_name_count = 0
for index, row in df.iterrows():
    if pd.isna(row['Hebrew Name']) or row['Hebrew Name'] == '':
        english_name = str(row['Hostage Name'])
        hebrew_name = find_hebrew_name(english_name)
        if hebrew_name:
            df.at[index, 'Hebrew Name'] = hebrew_name
            hebrew_name_count += 1

print(f"Updated {hebrew_name_count} Hebrew names")

# Save the updated CSV
df.to_csv('hostages-list-complete.csv', index=False, encoding='utf-8-sig')
print("Saved complete CSV with Hebrew names to hostages-list-complete.csv")

# Show sample of updated records
print("\nSample of records with Hebrew names:")
sample_with_hebrew = df[df['Hebrew Name'].notna() & (df['Hebrew Name'] != '')].head(10)
for _, row in sample_with_hebrew.iterrows():
    print(f"English: {row['Hostage Name']} -> Hebrew: {row['Hebrew Name']}")