import sys
import json
import subprocess
import os
from dotenv import load_dotenv

load_dotenv()
DB_CONTAINER = os.getenv('DB_CONTAINER', 'postgres')
DB_USER = os.getenv('DB_USER', 'thcho77')
DB_NAME = os.getenv('DB_NAME', 'n8n_database')

from collect_real_data import is_brand_account

# Get all records
query = "SELECT row_to_json(t) FROM (SELECT id, platform, account_name, account_url, source_data FROM influencers) t;"
result = subprocess.run(
    ['docker', 'exec', '-i', DB_CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-t', '-c', query],
    capture_output=True, text=True
)

deleted_count = 0
for line in result.stdout.split('\n'):
    line = line.strip()
    if not line: continue
    
    try:
        row = json.loads(line)
    except json.JSONDecodeError:
        continue
        
    inf_id = row.get('id')
    platform = row.get('platform')
    name = row.get('account_name')
    url = row.get('account_url')
    source_data = row.get('source_data') or {}
    
    bio = source_data.get('bio', '') if isinstance(source_data, dict) else ''
    
    is_brand = False
    if platform == 'cosme':
        if url and ('/brand/' in url or '/brands/' in url):
            is_brand = True
            
    if not is_brand:
        is_brand = is_brand_account(name, bio, url)
        
    if is_brand:
        # Delete
        del_query = f"DELETE FROM influencers WHERE id = {inf_id};"
        subprocess.run(
            ['docker', 'exec', '-i', DB_CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-t', '-c', del_query],
            capture_output=True
        )
        deleted_count += 1

print(f"Total deleted brand accounts: {deleted_count}")
