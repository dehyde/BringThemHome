import pandas as pd
import urllib.parse

# Load the CSV
df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')

def fix_image_url(relative_url):
    """Convert relative URL to full Kan.org.il URL with proper encoding"""
    if not relative_url or relative_url == '':
        return ''
    
    # Remove leading slash if present
    if relative_url.startswith('/'):
        relative_url = relative_url[1:]
    
    # Create full URL
    full_url = f"https://www.kan.org.il/{relative_url}"
    
    return full_url

# Update Photo URLs
df['Photo URL'] = df['Photo URL'].apply(fix_image_url)

# Save updated CSV
df.to_csv('hostages-from-kan.csv', index=False, encoding='utf-8-sig')

print(f"Updated {len(df)} image URLs")
print("\nSample updated URLs:")
for i in range(5):
    if df.iloc[i]['Photo URL']:
        try:
            print(f"  {df.iloc[i]['Hebrew Name']}: {df.iloc[i]['Photo URL']}")
        except UnicodeEncodeError:
            print(f"  [Hebrew Name]: {df.iloc[i]['Photo URL']}")