import os

files = [
    "add-driver.jsx", "edit-driver.jsx", "add-supervisor.jsx", "edit-supervisor.jsx",
    "bulk-add-driver.jsx", "car-log.jsx", "create-event.jsx", "edit-event.jsx",
    "event-detail.jsx", "hotel-detail.jsx", "driver-stats.jsx", "driver-event-cars.jsx",
    "pre-register-qr.jsx", "qr-display.jsx", "supervisor-detail.jsx"
]

target_dir = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(admin)\(tabs)"
count = 0

for f in files:
    path = os.path.join(target_dir, f)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # Replace occurrences of "../../" with "../../../"
        new_content = content.replace('"../../', '"../../../').replace("'../../", "'../../../")
        
        if new_content != content:
            with open(path, 'w', encoding='utf-8') as file:
                file.write(new_content)
            count += 1
            print(f"Updated {f}")

print(f"Total updated: {count}")
