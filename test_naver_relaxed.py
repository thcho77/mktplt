import urllib.request
import urllib.parse
import json
import os
from dotenv import load_dotenv

load_dotenv('.env', override=True)
encText = urllib.parse.quote('site:tiktok.com 메이크업')
url = f'https://openapi.naver.com/v1/search/webkr?query={encText}&display=10'
req = urllib.request.Request(url)
req.add_header('X-Naver-Client-Id', os.environ['NAVER_CLIENT_ID'])
req.add_header('X-Naver-Client-Secret', os.environ['NAVER_CLIENT_SECRET'])
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode('utf-8'))
    print("Total results reported by Naver:", data.get('total'))
