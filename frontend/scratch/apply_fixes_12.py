import os

base_dir = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend"

# Fix 1: checkin.jsx
f1 = os.path.join(base_dir, "app", "(driver)", "(tabs)", "checkin.jsx")
if os.path.exists(f1):
    with open(f1, "r", encoding="utf-8") as f: content = f.read()
    content = content.replace('    setGuestName("");\n    setInstantPark(false);\n    setErrors({});', '    setGuestName("");\n    setErrors({});')
    with open(f1, "w", encoding="utf-8") as f: f.write(content)

# Fix 2: add-car.jsx
f2 = os.path.join(base_dir, "app", "(supervisor)", "(tabs)", "add-car.jsx")
if os.path.exists(f2):
    with open(f2, "r", encoding="utf-8") as f: content = f.read()
    content = content.replace('    setGuestName("");\n    setIsPreRegistered(false);\n    setInstantPark(false);', '    setGuestName("");\n    setIsPreRegistered(false);')
    with open(f2, "w", encoding="utf-8") as f: f.write(content)

print("Checkin and add-car updated.")
