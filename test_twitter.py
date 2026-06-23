import collect_real_data
import asyncio
import os
from dotenv import load_dotenv

load_dotenv('.env', override=True)
print("Testing Twitter collection...")
results = collect_real_data.collect_twitter("개발자", "기술", 100, 1000000)
print(f"Got {len(results)} results")
