#!/usr/bin/env python3
import base64

# Read the README file
with open('../Jiffoo/README.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Encode to base64
encoded = base64.b64encode(content.encode('utf-8')).decode('ascii')

# Print the encoded content
print(encoded)
