#!/usr/bin/env python3
import base64
import json

# Read the README file
with open('../Jiffoo/README.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Encode to base64
encoded = base64.b64encode(content.encode('utf-8')).decode('ascii')

# Create the GitHub API payload
payload = {
    "message": "docs: complete README update - remove Chinese content for international open source project\n\n- Remove all Chinese documentation sections\n- Keep only English content for global accessibility\n- Ensure complete and consistent documentation\n- Prepare for international open source community",
    "content": encoded,
    "sha": "ff8d53bc9aa277f697c211fea1d59dd7a237ad43"
}

# Save to file for manual use
with open('github-payload.json', 'w') as f:
    json.dump(payload, f, indent=2)

print("✅ GitHub API payload created successfully!")
print(f"📊 Content size: {len(content)} characters")
print(f"📊 Base64 size: {len(encoded)} characters")
print("📁 Payload saved to: github-payload.json")
