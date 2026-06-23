import sys, os
from collect_real_data import collect_cosme

results = collect_cosme("뷰티", "뷰티", 1000, 100000)
print(f"Collected {len(results)} records")
