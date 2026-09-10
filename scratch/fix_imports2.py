import os

files = [
    r'd:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(supervisor)\(tabs)\event-detail.jsx',
    r'd:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(driver)\(tabs)\index.jsx',
    r'd:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(driver)\(tabs)\activity.jsx',
    r'd:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(driver)\failed-syncs.jsx',
    r'd:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(admin)\(tabs)\event-detail.jsx',
    r'd:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(admin)\(tabs)\supervisor-detail.jsx',
    r'd:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(admin)\(tabs)\pre-register-qr.jsx',
]

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if 'theme.colors.' in content and 'import { theme }' not in content:
            rel_path = filepath.split(r'frontend\app\\')[1]
            depth = rel_path.count('\\')
            import_str = "import { theme } from '" + "../" * (depth + 1) + "utils/theme';\n"
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(import_str + content)
            print(f'Added import to {os.path.basename(filepath)}')
