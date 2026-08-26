import os
import re

base_dir = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend"

# Fix 1: checkin.jsx
f1 = os.path.join(base_dir, "app", "(driver)", "(tabs)", "checkin.jsx")
if os.path.exists(f1):
    with open(f1, "r", encoding="utf-8") as f: content = f.read()
    content = content.replace('    setGuestName("");\n    setInstantPark(false);\n    setErrors({});', '    setGuestName("");\n    setErrors({});')
    # Optional cleanup 1
    content = re.sub(r'    if \(errors\.photos && Object\.values\(next\)\.filter\(Boolean\)\.length >= REQUIRED_PHOTO_COUNT\) {\n      const \{ photos, \.\.\.rest \} = errors;\n      setErrors\(rest\);\n    }\n', '', content)
    with open(f1, "w", encoding="utf-8") as f: f.write(content)

# Fix 2: add-car.jsx
f2 = os.path.join(base_dir, "app", "(supervisor)", "(tabs)", "add-car.jsx")
if os.path.exists(f2):
    with open(f2, "r", encoding="utf-8") as f: content = f.read()
    content = content.replace('    setGuestName("");\n    setIsPreRegistered(false);\n    setInstantPark(false);', '    setGuestName("");\n    setIsPreRegistered(false);')
    # Optional cleanup 1
    content = re.sub(r'    if \(errors\.photos && Object\.values\(next\)\.filter\(Boolean\)\.length >= REQUIRED_PHOTO_COUNT\) {\n      const \{ photos, \.\.\.rest \} = errors;\n      setErrors\(rest\);\n    }\n', '', content)
    # Optional cleanup 2 (dead parameters)
    content = content.replace('instantPark, eventAllowsInstantPark,', '')
    with open(f2, "w", encoding="utf-8") as f: f.write(content)

# Fix 3a: edit-event.jsx (admin)
f3a = os.path.join(base_dir, "app", "(admin)", "edit-event.jsx")
if os.path.exists(f3a):
    with open(f3a, "r", encoding="utf-8") as f: content = f.read()
    content = re.sub(r'          <View style=\{\{ backgroundColor: "#EEF2FF"[^\n]+\n(?:[ \t]+<[^>]+>[^\n]*\n)*?[ \t]+<TouchableOpacity\n(?:[ \t]+[^\n]+\n)*?[ \t]+</TouchableOpacity>\n[ \t]+</View>\n', '', content)
    with open(f3a, "w", encoding="utf-8") as f: f.write(content)

# Fix 3b: edit-event.jsx (supervisor)
f3b = os.path.join(base_dir, "app", "(supervisor)", "(tabs)", "edit-event.jsx")
if os.path.exists(f3b):
    with open(f3b, "r", encoding="utf-8") as f: content = f.read()
    content = re.sub(r'          <View style=\{\{ backgroundColor: theme\.colors\.[^\n]+\n(?:[ \t]+<[^>]+>[^\n]*\n)*?[ \t]+<TouchableOpacity\n(?:[ \t]+[^\n]+\n)*?[ \t]+</TouchableOpacity>\n[ \t]+</View>\n', '', content)
    with open(f3b, "w", encoding="utf-8") as f: f.write(content)

print("All fixes applied successfully.")
