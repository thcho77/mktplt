import os
from dotenv import load_dotenv
load_dotenv('.env')
import sys
sys.path.append(os.getcwd())

# Simulate missing/blocked tokens by clearing them
os.environ['META_ACCESS_TOKEN'] = ''
os.environ['META_IG_USER_ID'] = ''
import collect_real_data
collect_real_data.META_ACCESS_TOKEN = ''
collect_real_data.META_IG_USER_ID = ''

print("--- Testing Instagram Fallback ---")
ig_recs = collect_real_data.collect_instagram('뷰티', '뷰티', 1000, 50000000)
for r in ig_recs[:5]: print(r['account_name'], r['follower_count'], r['source_data'])

print("\n--- Testing TikTok Fallback ---")
tk_recs = collect_real_data.collect_tiktok('fentybeauty', '뷰티', 1000, 50000000)
for r in tk_recs[:5]: print(r['account_name'], r['follower_count'], r['source_data'])
