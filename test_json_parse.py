import json

def extract_json_array(text):
    # try to find the first '['
    start = text.find('[')
    if start == -1:
        raise ValueError("No '[' found")
    
    # try to parse from this start point, expanding the end point
    # We can just count brackets or use a simple stack
    stack = 0
    in_string = False
    escape = False
    
    for i in range(start, len(text)):
        char = text[i]
        
        if not in_string:
            if char == '[':
                stack += 1
            elif char == ']':
                stack -= 1
            elif char == '"':
                in_string = True
        else:
            if escape:
                escape = False
            elif char == '\\':
                escape = True
            elif char == '"':
                in_string = False
                
        if stack == 0 and char == ']':
            # Found the matching closing bracket
            json_str = text[start:i+1]
            return json.loads(json_str)
            
    raise ValueError("Unclosed array")

test_str = """
Here are the keywords:
[
  "k1",
  "[nested]"
]
Some trailing text [with brackets]
"""

print(extract_json_array(test_str))
