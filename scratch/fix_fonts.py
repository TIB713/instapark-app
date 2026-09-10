import os
import re

directory = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(admin)\(tabs)"

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to find <Text ...> or <TextInput ...>
    # We will iterate through all tags and modify their style attributes.
    # This is a basic parser.
    
    def replacer(match):
        tag = match.group(0)
        # Find style={{...}} or style={[..., {...}]}
        # It's easier to find the innermost { ... } that contains font/color properties
        # But let's just do a simple replacement for style={{ ... }} first.
        
        # Check if already has fontFamily
        if 'fontFamily' in tag:
            return tag
            
        def style_replacer(style_match):
            prefix = style_match.group(1)
            inner = style_match.group(2)
            suffix = style_match.group(3)
            
            font_family = "theme.fontFamily.regular"
            if re.search(r"fontWeight:\s*('600'|\"600\"|theme\.fontWeight\.semibold)", inner):
                font_family = "theme.fontFamily.semibold"
            elif re.search(r"fontWeight:\s*('700'|\"700\"|'800'|\"800\"|'900'|\"900\"|theme\.fontWeight\.bold)", inner):
                font_family = "theme.fontFamily.bold"
                
            if re.search(r"fontSize:\s*(rs\(32\)|rs\(24\)|rs\(theme\.fontSize\.title\)|rs\(theme\.fontSize\.display\))", inner):
                font_family = "theme.fontFamily.headline"
                
            return f"{prefix}fontFamily: {font_family}, {inner}{suffix}"
            
        # Match style={{ ... }}
        tag = re.sub(r'(style=\{\{\s*)(.*?)(\s*\}\})', style_replacer, tag, flags=re.DOTALL)
        
        # Match style={[..., { ... }]}
        tag = re.sub(r'(style=\{.*?,\s*\{\s*)(.*?)(\s*\}\s*\]\})', style_replacer, tag, flags=re.DOTALL)
        
        return tag

    new_content = re.sub(r'<(?:Text|TextInput)[^>]*>', replacer, content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {os.path.basename(filepath)}")

for filename in os.listdir(directory):
    if not filename.endswith(".jsx"): continue
    process_file(os.path.join(directory, filename))
