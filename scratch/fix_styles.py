import os, re

files = [
    r'd:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\components\valet\ui.jsx',
    r'd:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(admin)\(tabs)\hotels.jsx',
    r'd:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(admin)\(tabs)\supervisor-detail.jsx',
    r'd:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(admin)\(tabs)\hotel-detail.jsx',
    r'd:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(admin)\(tabs)\driver-stats.jsx',
    r'd:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(admin)\(tabs)\qr-display.jsx',
    r'd:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(admin)\(tabs)\event-detail.jsx'
]

def add_font_family_to_style_obj(content):
    def replacer(match):
        prefix = match.group(1)
        inner = match.group(2)
        suffix = match.group(3)
        if 'fontFamily:' in inner: return match.group(0)
        
        font_family = 'theme.fontFamily.regular'
        if re.search(r"fontWeight:\s*('600'|\"600\"|theme\.fontWeight\.semibold)", inner):
            font_family = 'theme.fontFamily.semibold'
        elif re.search(r"fontWeight:\s*('700'|\"700\"|'800'|\"800\"|'900'|\"900\"|theme\.fontWeight\.bold)", inner):
            font_family = 'theme.fontFamily.bold'
            
        if re.search(r"fontSize:\s*(rs\(32\)|rs\(24\)|rs\(theme\.fontSize\.title\)|rs\(theme\.fontSize\.display\))", inner):
            font_family = 'theme.fontFamily.headline'
            
        return f"{prefix}fontFamily: {font_family}, {inner}{suffix}"

    # Match key: { ... } OR const name = { ... }
    # Let's match `prefix` ending with `{`, followed by inner, followed by `}`.
    # The inner must contain fontSize, color, or fontWeight.
    return re.sub(r'((?:\w+:\s*|const\s+\w+\s*=\s*)\{\s*)([^{]*?(?:fontSize:|color:|fontWeight:)[^{]*?)(\})', replacer, content, flags=re.DOTALL)

for filepath in files:
    if not os.path.exists(filepath): continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'valet\\ui.jsx' in filepath or 'valet/ui.jsx' in filepath.replace('\\', '/'):
        content = re.sub(r'(export const fieldTextInputStyle\s*=\s*\{\s*)([^{]*?)(\})', lambda m: m.group(0) if 'fontFamily' in m.group(0) else m.group(1) + 'fontFamily: theme.fontFamily.regular, ' + m.group(2) + m.group(3), content)
        content = re.sub(r'(<Text style=\{\[\{\s*)([^{]*?(?:fontWeight:\s*theme\.fontWeight\.bold)[^{]*?)(\}\])', lambda m: m.group(0) if 'fontFamily' in m.group(0) else m.group(1) + 'fontFamily: theme.fontFamily.bold, ' + m.group(2) + m.group(3), content)
        content = re.sub(r'(<Text style=\{\{\s*)([^{]*?(?:fontWeight:\s*theme\.fontWeight\.bold)[^{]*?)(\}\})', lambda m: m.group(0) if 'fontFamily' in m.group(0) else m.group(1) + 'fontFamily: theme.fontFamily.bold, ' + m.group(2) + m.group(3), content)
    
    new_content = add_font_family_to_style_obj(content)
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Updated {os.path.basename(filepath)}')
