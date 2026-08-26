import re

with open(r'd:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\hooks\useDriverTasks.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'^\s*console\.log\(`\[DUP_DEBUG\].*\n', '', content, flags=re.MULTILINE)

with open(r'd:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\hooks\useDriverTasks.js', 'w', encoding='utf-8') as f:
    f.write(content)
