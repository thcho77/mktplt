import sys, os
from collect_real_data import collect_youtube, collect_instagram, collect_tiktok, collect_facebook

def test_platform(name, func):
    print(f"--- Testing {name} ---")
    try:
        recs = func('뷰티', '뷰티', 5000, 1000000)
        print(f"Success! {len(recs)} records found.")
        for r in recs[:2]: print(r)
    except Exception as e:
        print(f"ERROR on {name}: {e}")

test_platform("YouTube", collect_youtube)
test_platform("Instagram", collect_instagram)
test_platform("TikTok", collect_tiktok)
test_platform("Facebook", collect_facebook)
