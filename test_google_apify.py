import urllib.request
import urllib.parse
import json
import os

from dotenv import load_dotenv
load_dotenv('.env', override=True)

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
GOOGLE_CX = os.environ.get("GOOGLE_CX")
APIFY_TOKEN = os.environ.get("APIFY_TOKEN")

print(f"Key={GOOGLE_API_KEY[:5]}..., CX={GOOGLE_CX[:5]}..., Apify={APIFY_TOKEN[:5]}...")

keyword = "패션"
encText = urllib.parse.quote(f'site:instagram.com "{keyword}"')
google_url = f"https://www.googleapis.com/customsearch/v1?key={GOOGLE_API_KEY}&cx={GOOGLE_CX}&q={encText}&num=3"

try:
    print(f"Requesting Google URL: {google_url}")
    req = urllib.request.Request(google_url)
    with urllib.request.urlopen(req, timeout=10) as response:
        data_google = json.loads(response.read().decode('utf-8'))
        print(f"Google Found items: {len(data_google.get('items', []))}")
        for item in data_google.get('items', []):
            print("Link:", item.get('link'))
            print("Snippet:", item.get('snippet'))
            print("---")
except Exception as e:
    print(f"Google Error: {e}")
