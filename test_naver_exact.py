import urllib.request, urllib.parse, json, os, re, random
from dotenv import load_dotenv
load_dotenv('.env', override=True)
keyword = "메이크업"
encText = urllib.parse.quote(f'"tiktok.com/@" {keyword}')
start_indices = [1]
seen_urls = set()
results = []
for start_idx in start_indices:
    url = f'https://openapi.naver.com/v1/search/webkr?query={encText}&display=100&start={start_idx}'
    req = urllib.request.Request(url)
    req.add_header('X-Naver-Client-Id', os.environ['NAVER_CLIENT_ID'])
    req.add_header('X-Naver-Client-Secret', os.environ['NAVER_CLIENT_SECRET'])
    with urllib.request.urlopen(req) as response:
        data_naver = json.loads(response.read().decode('utf-8'))
        items = data_naver.get('items', [])
        print(f"Start {start_idx}: found {len(items)} items")
        for item in items:
            link = item['link'].split('?')[0].strip('/')
            desc = item.get('description', '')
            m_user = re.search(r'tiktok\.com/@([A-Za-z0-9_.]+)', link + " " + desc)
            if m_user:
                username = m_user.group(1)
                if username not in ['tag', 'discover', 'music', 'search', 'about']:
                    results.append(username)
print("Extracted Usernames:", results)
