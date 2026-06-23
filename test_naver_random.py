import random
import urllib.request
import urllib.parse
import json
import os
from dotenv import load_dotenv

load_dotenv('.env', override=True)
encText = urllib.parse.quote('site:tiktok.com "메이크업"')
start_indices = random.sample(range(1, 901, 100), 3)
print("Testing starts:", start_indices)

for start in start_indices:
    url = f'https://openapi.naver.com/v1/search/webkr?query={encText}&display=10&start={start}'
    req = urllib.request.Request(url)
    req.add_header('X-Naver-Client-Id', os.environ['NAVER_CLIENT_ID'])
    req.add_header('X-Naver-Client-Secret', os.environ['NAVER_CLIENT_SECRET'])
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"Start {start}: found {len(data.get('items', []))} items")
    except Exception as e:
        print(f"Error on start {start}:", e)
