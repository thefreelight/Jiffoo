#!/usr/bin/env python3
import base64
import json
import sys

def create_base64_content():
    """Read the README file and create base64 encoded content"""
    try:
        with open('../Jiffoo/README.md', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Encode to base64
        encoded = base64.b64encode(content.encode('utf-8')).decode('ascii')
        
        print(f"✅ File read successfully")
        print(f"📊 Original size: {len(content)} characters")
        print(f"📊 Base64 size: {len(encoded)} characters")
        print(f"📊 Lines: {content.count(chr(10)) + 1}")
        
        # Print first 100 characters to verify
        print(f"📝 Content preview: {content[:100]}...")
        
        # Save the base64 content to a file for manual use
        with open('readme-base64.txt', 'w') as f:
            f.write(encoded)
        
        print("📁 Base64 content saved to: readme-base64.txt")
        
        return encoded
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

if __name__ == "__main__":
    create_base64_content()
