import json, subprocess, sys

# 1. Get the JSON from docker
res = subprocess.run(['docker', 'exec', 'n8n', 'cat', '/tmp/wf.json'], capture_output=True, text=True)
if res.returncode != 0:
    print("Failed to read wf.json:", res.stderr)
    sys.exit(1)

data = json.loads(res.stdout)
workflow = data[0]

# 2. Update the Schedule Trigger node
for node in workflow['nodes']:
    if node['name'] == 'Schedule Trigger':
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
        print("Schedule Trigger updated.")

# 3. Save to a local file
with open('wf_updated.json', 'w') as f:
    json.dump(workflow, f)

# 4. Copy to docker and import
subprocess.run(['docker', 'cp', 'wf_updated.json', 'n8n:/tmp/wf_updated.json'])
import_res = subprocess.run(['docker', 'exec', 'n8n', 'n8n', 'import:workflow', '--input=/tmp/wf_updated.json'], capture_output=True, text=True)
print("Import Output:", import_res.stdout)
print("Import Error:", import_res.stderr)
