import os
import glob

screens = [
    "add-driver", "edit-driver", "add-supervisor", "edit-supervisor",
    "bulk-add-driver", "car-log", "create-event", "edit-event",
    "event-detail", "hotel-detail", "driver-stats", "driver-event-cars",
    "pre-register-qr", "qr-display", "supervisor-detail"
]

search_dirs = [
    r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app",
    r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\components"
]

count = 0

for d in search_dirs:
    for root, _, files in os.walk(d):
        for file in files:
            if file.endswith(".jsx") or file.endswith(".js"):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                new_content = content
                for screen in screens:
                    # Looking for exact string " /(admin)/screen" and replace with " /(admin)/(tabs)/screen"
                    # But need to be careful not to replace it if it's already " /(admin)/(tabs)/screen"
                    # So replace " /(admin)/(tabs)/screen" with a placeholder, then replace " /(admin)/screen", then restore placeholder
                    # Actually, easier: just replace " /(admin)/screen"
                    # Wait, if it's " /(admin)/(tabs)/screen", " /(admin)/screen" won't match. So it's safe.
                    # We should match '="/(admin)/screen' or '"/(admin)/screen' or '`/(admin)/screen' or `'/(admin)/screen`
                    
                    new_content = new_content.replace(f"/(admin)/{screen}", f"/(admin)/(tabs)/{screen}")
                
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    count += 1
                    print(f"Updated routes in {path}")

print(f"Total files updated: {count}")
