import json

with open('/Users/chotaehyung/.gemini/antigravity-ide/brain/9ccb1526-0013-4473-9dcf-6617baec1e97/.system_generated/steps/2026/output.txt', 'r') as f:
    data = json.load(f)

nodes = data['workflow']['nodes'] if 'nodes' in data['workflow'] else data['nodes']

for node in nodes:
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

with open('updated_nodes.json', 'w') as f:
    json.dump(nodes, f)
print("Updated nodes saved.")
