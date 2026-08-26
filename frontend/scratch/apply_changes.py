import re
import os

base_dir = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend"

def apply_replacements(filepath, replacements, file_specific=None):
    full_path = os.path.join(base_dir, filepath)
    if not os.path.exists(full_path):
        print(f"File not found: {full_path}")
        return
        
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()

    for old, new in replacements:
        if isinstance(old, re.Pattern):
            content = old.sub(new, content)
        else:
            content = content.replace(old, new)
            
    if file_specific:
        content = file_specific(content)

    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Updated {filepath}")

checkin_addcar_replacements = [
    (re.compile(r'\s*const \[eventAllowsInstantPark, setEventAllowsInstantPark\] = useState\(false\);\n\s*const \[instantPark, setInstantPark\] = useState\(false\);'), ''),
    (re.compile(r'\s*const \[eventAllowsInstantPark, setEventAllowsInstantPark\] = useState\(false\);'), ''),
    (re.compile(r'\s*const \[instantPark, setInstantPark\] = useState\(false\);'), ''),
    (re.compile(r'\s*setEventAllowsInstantPark\(!!data\.allow_instant_park\);'), ''),
    ('instantPark, eventAllowsInstantPark, ', ''),
    ('instantPark={instantPark} eventAllowsInstantPark={eventAllowsInstantPark}', ''),
    (re.compile(r'<Lbl>\{instantPark && eventAllowsInstantPark \? "GUEST NAME \(OPTIONAL\)" : "GUEST NAME \*"\}</Lbl>'), '<Lbl>GUEST NAME (OPTIONAL)</Lbl>'),
    (re.compile(r'<Lbl>\{eventAllowsInstantPark && instantPark \? "VEHICLE COLOR \(OPTIONAL\)" : "VEHICLE COLOR \*"\}</Lbl>'), '<Lbl>VEHICLE COLOR (OPTIONAL)</Lbl>'),
    (re.compile(r'<Lbl>\{eventAllowsInstantPark && instantPark \? "VEHICLE MAKE/MODEL \(OPTIONAL\)" : "VEHICLE MAKE/MODEL \*"\}</Lbl>'), '<Lbl>VEHICLE MAKE/MODEL (OPTIONAL)</Lbl>'),
    (re.compile(r'<Lbl>\{instantPark && eventAllowsInstantPark \? "GUEST MOBILE \(OPTIONAL\)" : "GUEST MOBILE \*"\}</Lbl>'), '<Lbl>GUEST MOBILE (OPTIONAL)</Lbl>'),
    (re.compile(r'<Lbl>VEHICLE PHOTOS \* \(AT LEAST 2 REQUIRED\)</Lbl>'), '<Lbl>VEHICLE PHOTOS (OPTIONAL)</Lbl>'),
    (re.compile(r'\s*const REQUIRED_PHOTO_COUNT = 2;'), ''),
    (re.compile(r'\s*if \(!color\.trim\(\) && !\(eventAllowsInstantPark && instantPark\)\) errs\.color = "Vehicle color is required";'), ''),
    (re.compile(r'\s*if \(!make\.trim\(\) && !\(eventAllowsInstantPark && instantPark\)\) errs\.make = "Vehicle make/model is required";'), ''),
    (re.compile(r'\s*const skipGuestDetails = eventAllowsInstantPark && instantPark;'), ''),
    (re.compile(r'\s*if \(!skipGuestDetails && !guestName\.trim\(\)\) errs\.guestName = "Guest name is required";'), ''),
    (re.compile(r'if \(!skipGuestDetails && !guestPhone\.trim\(\)\) errs\.guestPhone = "Guest mobile number is required";\s*else if \(guestPhone\.trim\(\)\) \{'), 'if (guestPhone.trim()) {'),
    (re.compile(r'\s*const validPhotosCount = Object\.values\(photos\)\.filter\(Boolean\)\.length;\s*if \(validPhotosCount < REQUIRED_PHOTO_COUNT\) \{\s*errs\.photos = `Please upload at least \$\{REQUIRED_PHOTO_COUNT\} photos\.`;\s*\}'), ''),
    ('instantPark: eventAllowsInstantPark && instantPark', 'instantPark: true'),
    ('instant_park: eventAllowsInstantPark && instantPark', 'instant_park: true'),
]

def checkin_specific(content):
    content = content.replace("'altGuestPhone', 'photos'", "'altGuestPhone'")
    content = re.sub(r'\{eventAllowsInstantPark && \(\s*<View style=\{\{ backgroundColor: theme\.colors\.primaryLight.*?</TouchableOpacity>\s*</View>\s*\)\}', '', content, flags=re.DOTALL)
    return content
    
def addcar_specific(content):
    content = content.replace("'guestName', 'photos', 'driver'", "'guestName', 'driver'")
    content = re.sub(r'\{eventAllowsInstantPark && \(\s*<View style=\{\{ backgroundColor: theme\.colors\.primaryLight.*?</TouchableOpacity>\s*</View>\s*\)\}', '', content, flags=re.DOTALL)
    return content

apply_replacements(r"app\(driver)\(tabs)\checkin.jsx", checkin_addcar_replacements, checkin_specific)
apply_replacements(r"app\(supervisor)\(tabs)\add-car.jsx", checkin_addcar_replacements, addcar_specific)

create_event_replacements = [
    (re.compile(r'\s*const \[allowInstantPark, setAllowInstantPark\] = useState\(false\);'), ''),
    (re.compile(r'\s*allow_instant_park: allowInstantPark,'), ''),
    (re.compile(r'<View style=\{\{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: rp\(8\), marginBottom: rp\(24\) \}\}>\s*<Text style=\{\{ fontSize: rs\(13\), fontWeight: "700", color: "#374151", flex: 1, textTransform: "uppercase" \}\}>ALLOW INSTANT PARK</Text>\s*<Switch\s*value=\{allowInstantPark\}\s*onValueChange=\{setAllowInstantPark\}\s*trackColor=\{\{ false: "#D1D5DB", true: "#059669" \}\}\s*thumbColor="#ffffff"\s*/>\s*</View>'), ''),
]
apply_replacements(r"app\(admin)\create-event.jsx", create_event_replacements)

edit_event_replacements = [
    (re.compile(r'\s*const \[allowInstantPark, setAllowInstantPark\] = useState\(false\);'), ''),
    (re.compile(r'\s*setAllowInstantPark\(!!data\.allow_instant_park\);'), ''),
    (re.compile(r'\s*allow_instant_park: allowInstantPark,'), ''),
    (re.compile(r'<View style=\{\{ backgroundColor: "#EEF2FF", borderWidth: rp\(1\).*?Let drivers skip guest name & phone.*?</TouchableOpacity>\s*</View>'), ''),
]
apply_replacements(r"app\(admin)\edit-event.jsx", edit_event_replacements)

sup_edit_event_replacements = [
    (re.compile(r'\s*const \[allowInstantPark, setAllowInstantPark\] = useState\(false\);'), ''),
    (re.compile(r'\s*setAllowInstantPark\(!!data\.allow_instant_park\);'), ''),
    (re.compile(r'\s*allow_instant_park: allowInstantPark,'), ''),
    (re.compile(r'<View style=\{\{ backgroundColor: theme\.colors\.primaryLight, borderWidth: rp\(1\).*?Let drivers skip guest name & phone.*?</TouchableOpacity>\s*</View>'), ''),
]
apply_replacements(r"app\(supervisor)\(tabs)\edit-event.jsx", sup_edit_event_replacements)

hotels_replacements = [
    (re.compile(r'\s*const \[allowInstantPark, setAllowInstantPark\] = useState\(false\);'), ''),
    (re.compile(r'\s*setAllowInstantPark\(false\);'), ''),
    (re.compile(r'\s*allow_instant_park: allowInstantPark,'), ''),
    (re.compile(r'<View style=\{\{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: rp\(16\), marginBottom: rp\(16\) \}\}>\s*<Text style=\{\{ fontSize: rs\(13\), fontWeight: "700", color: "#374151", flex: 1 \}\}>Allow Instant Park for this hotel\'s events</Text>.*?<Switch.*?/>\s*</View>', flags=re.DOTALL), ''),
]
apply_replacements(r"app\(admin)\hotels.jsx", hotels_replacements)

hotel_detail_replacements = [
    (re.compile(r'\s*const \[newEventAllowInstantPark, setNewEventAllowInstantPark\] = useState\(false\);'), ''),
    (re.compile(r'\s*allow_instant_park: newEventAllowInstantPark,'), ''),
    (re.compile(r'\s*allow_instant_park: editHotel\.allow_instant_park,'), ''),
    (re.compile(r'<View style=\{\{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: rp\(8\), marginBottom: rp\(24\) \}\}>\s*<Text style=\{\{ fontSize: rs\(13\), fontWeight: "700", color: "#374151", flex: 1, textTransform: "uppercase" \}\}>ALLOW INSTANT PARK</Text>.*?<Switch.*?/>\s*</View>', flags=re.DOTALL), ''),
    (re.compile(r'\{editingInfo \? \(\s*<View style=\{\{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: rp\(16\), marginBottom: rp\(16\) \}\}>.*?Allow Instant Park for this hotel\'s events.*?</View>\s*\) : \(\s*<View style=\{\{ marginBottom: rp\(16\) \}\}>.*?</View>\s*\)\}', flags=re.DOTALL), ''),
]
apply_replacements(r"app\(admin)\hotel-detail.jsx", hotel_detail_replacements)

parkflow_replacements = [
    (re.compile(r'\s*if \(parkPhotos\.length === 0\) \{\s*confirmDialog\.info\("Photo required", "Please take at least one parking photo before confirming\."\);\s*return;\s*\}'), ''),
]
apply_replacements(r"hooks\useParkFlow.js", parkflow_replacements)

park_replacements = [
    (re.compile(r'\s*else if \(parkPhotos\.length === 0\) confirmLabel = "Add a parking photo";'), ''),
    (re.compile(r'<SectionTitle>Parking Photos</SectionTitle>'), '<SectionTitle>Parking Photos (Optional)</SectionTitle>'),
]
apply_replacements(r"app\(driver)\(tabs)\park.jsx", park_replacements)
