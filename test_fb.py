import os
from dotenv import load_dotenv
load_dotenv('.env')

# Add the mktplt directory to Python path so we can import
import sys
sys.path.append(os.getcwd())

from collect_real_data import collect_facebook

results = collect_facebook('뷰티', '뷰티', 10000, 50000000)
for r in results:
    print(r)

print("Facebook collection finished.")
