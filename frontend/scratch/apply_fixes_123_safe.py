import os

base_dir = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend"

# Fix 1: checkin.jsx
f1 = os.path.join(base_dir, "app", "(driver)", "(tabs)", "checkin.jsx")
if os.path.exists(f1):
    with open(f1, "r", encoding="utf-8") as f: lines = f.readlines()
    new_lines = []
    skip = 0
    for i, l in enumerate(lines):
        if skip > 0:
            skip -= 1
            continue
        if "setInstantPark(false);" in l:
            continue
        if "if (errors.photos && Object.values(next).filter(Boolean).length >= REQUIRED_PHOTO_COUNT) {" in l:
            skip = 3
            continue
        new_lines.append(l)
    with open(f1, "w", encoding="utf-8") as f: f.writelines(new_lines)

# Fix 2: add-car.jsx
f2 = os.path.join(base_dir, "app", "(supervisor)", "(tabs)", "add-car.jsx")
if os.path.exists(f2):
    with open(f2, "r", encoding="utf-8") as f: lines = f.readlines()
    new_lines = []
    skip = 0
    for i, l in enumerate(lines):
        if skip > 0:
            skip -= 1
            continue
        if "setInstantPark(false);" in l:
            continue
        if "if (errors.photos && Object.values(next).filter(Boolean).length >= REQUIRED_PHOTO_COUNT) {" in l:
            skip = 3
            continue
        if "instantPark, eventAllowsInstantPark," in l:
            new_lines.append(l.replace("instantPark, eventAllowsInstantPark,", ""))
            continue
        new_lines.append(l)
    with open(f2, "w", encoding="utf-8") as f: f.writelines(new_lines)

# Fix 3: edit-event.jsx
for path_part in [os.path.join("(admin)", "edit-event.jsx"), os.path.join("(supervisor)", "(tabs)", "edit-event.jsx")]:
    f3 = os.path.join(base_dir, "app", path_part)
    if os.path.exists(f3):
        with open(f3, "r", encoding="utf-8") as f: lines = f.readlines()
        new_lines = []
        skip_mode = False
        skip_count = 0
        for i, l in enumerate(lines):
            # Look for the start of the card
            if "INSTANT PARK" in l:
                # We need to backtrack to remove the opening <View> tag which was 2 or 3 lines above
                # Let's find the most recent <View> tag in new_lines
                for j in range(len(new_lines)-1, -1, -1):
                    if "<View style=" in new_lines[j]:
                        new_lines = new_lines[:j]
                        break
                skip_mode = True
                skip_count = 0
                continue
            
            if skip_mode:
                if "</View>" in l:
                    skip_count += 1
                    if skip_count == 2: # the card has a few views, we want to skip until the main closing view. Wait, actually we can just look for the first </View> after </TouchableOpacity>
                        pass
                if "</TouchableOpacity>" in l:
                    # Next </View> is the end of the card
                    pass
                # Better logic: The card ends exactly 2 lines after </TouchableOpacity>
                if "</TouchableOpacity>" in lines[i-1] if i>0 else False:
                    # this line is </View>
                    skip_mode = False
                    continue
                continue
                
            new_lines.append(l)
        with open(f3, "w", encoding="utf-8") as f: f.writelines(new_lines)

print("Fixes applied successfully.")
