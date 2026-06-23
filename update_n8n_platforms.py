import json, subprocess, sys

res = subprocess.run(['docker', 'exec', 'n8n', 'cat', '/tmp/wf.json'], capture_output=True, text=True)
data = json.loads(res.stdout)
workflow = data[0]

all_platforms = "['naver_blog', 'bilibili', 'youtube', 'instagram', 'tiktok', 'facebook', 'threads', 'twitter', 'cosme', 'douyin', 'xiaohongshu']"

for node in workflow['nodes']:
    if node['name'] == 'Prepare Search Queries':
        jsCode = node['parameters']['jsCode']
        jsCode = jsCode.replace("platforms: ['naver_blog', 'bilibili', 'youtube']", f"platforms: {all_platforms}")
        jsCode = jsCode.replace("['naver_blog', 'youtube', 'bilibili']", all_platforms)
        node['parameters']['jsCode'] = jsCode
        print("Updated Prepare Search Queries")
    elif node['name'] == 'Schedule Trigger':
        # Ensure it is still hourly
        node['parameters'] = {
            "rule": {
                "interval": [
                    {
                        "field": "hours",
                        "hoursInterval": 1,
                        "triggerAtMinute": 0
                    }
                ]
            }
        }

with open('wf_updated2.json', 'w') as f:
    json.dump(workflow, f)

subprocess.run(['docker', 'cp', 'wf_updated2.json', 'n8n:/tmp/wf_updated2.json'])
import_res = subprocess.run(['docker', 'exec', 'n8n', 'n8n', 'import:workflow', '--input=/tmp/wf_updated2.json'], capture_output=True, text=True)
print("Import Output:", import_res.stdout)
