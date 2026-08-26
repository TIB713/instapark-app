import os
import re

base_dir = r"d:\Admin\Desktop\InstaPark-Combined"

checkin_path = os.path.join(base_dir, r"instapark-app\frontend\app\(driver)\(tabs)\checkin.jsx")
add_car_path = os.path.join(base_dir, r"instapark-app\frontend\app\(supervisor)\(tabs)\add-car.jsx")
offline_path = os.path.join(base_dir, r"instapark-app\frontend\lib\offline.js")
server_path = os.path.join(base_dir, r"instapark\backend\server.py")

def remove_alt_guest_phone_checkin(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. In GuestContactSection: delete the "ALTERNATE MOBILE (OPTIONAL)" Lbl, its input row, and its error text block.
    # Remove altGuestPhone/setAltGuestPhone from the component's props and destructuring.
    content = re.sub(r'altGuestPhone,\s*setAltGuestPhone,\s*', '', content)
    
    # Remove the UI block
    content = re.sub(r'\s*<Lbl>ALTERNATE MOBILE \(OPTIONAL\)</Lbl>[\s\S]*?\{\s*errors\.altGuestPhone\s*&&\s*<Text[^>]*>\*\s*\{\s*errors\.altGuestPhone\s*\}</Text>\s*\}', '', content)

    # 2. Remove const [altGuestPhone, setAltGuestPhone] = useState("");
    content = re.sub(r'const\s+\[altGuestPhone,\s*setAltGuestPhone\]\s*=\s*useState\([^)]*\);\s*', '', content)

    # 3. Remove the setAltGuestPhone("") reset call.
    content = re.sub(r'^\s*setAltGuestPhone\([^)]*\);\s*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'if\s*\(d\.altGuestPhone\)\s*setAltGuestPhone\(d\.altGuestPhone\);', '', content)
    content = re.sub(r'setAltGuestPhone\([^)]*\);', '', content)
    
    # 4. Remove altPhoneToSave validation block in the submit handler
    validation_block = r'''\s*let altPhoneToSave = "";\s*if \(altGuestPhone\.trim\(\)\) \{\s*const normalizeIndianPhone = [^;]*;\s*const normalized = [^;]*;\s*const isValidIndian = [^;]*;\s*const isValidIntl = [^;]*;\s*if \(!isValidIndian && !isValidIntl\) \{\s*errs\.altGuestPhone = [^;]*;\s*\} else \{\s*altPhoneToSave = [^;]*;\s*\}\s*\}'''
    content = re.sub(validation_block, '', content)

    # 5. Remove 'altGuestPhone' from the scrollToFirstError field-order array
    content = content.replace(", 'altGuestPhone'", "")

    # 6. Remove altPhoneToSave param from doSubmit(), and remove altGuestPhone/alt_guest_phone from offline/online payloads
    content = re.sub(r'doSubmit\(phoneToSave,\s*altPhoneToSave\);', 'doSubmit(phoneToSave);', content)
    content = re.sub(r'const doSubmit = async\s*\(phoneToSave,\s*altPhoneToSave\)\s*=>', 'const doSubmit = async (phoneToSave) =>', content)
    content = re.sub(r'^\s*altGuestPhone:\s*altPhoneToSave\s*\|\|\s*null,?\s*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'^\s*alt_guest_phone:\s*altPhoneToSave\s*\|\|\s*null,?\s*$', '', content, flags=re.MULTILINE)

    # Remove altGuestPhone={altGuestPhone} setAltGuestPhone={setAltGuestPhone}
    content = re.sub(r'altGuestPhone=\{altGuestPhone\}\s*setAltGuestPhone=\{setAltGuestPhone\}', '', content)

    # Remove from draft state 
    content = re.sub(r',\s*altGuestPhone:\s*d\.altGuestPhone', '', content)
    content = re.sub(r',\s*altGuestPhone', '', content)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)


def remove_alt_guest_phone_add_car(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Same set of regexes as checkin.jsx
    content = re.sub(r'altGuestPhone,\s*setAltGuestPhone,\s*', '', content)
    content = re.sub(r'\s*<Lbl>ALTERNATE MOBILE \(OPTIONAL\)</Lbl>[\s\S]*?\{\s*errors\.altGuestPhone\s*&&\s*<Text[^>]*>\*\s*\{\s*errors\.altGuestPhone\s*\}</Text>\s*\}', '', content)
    content = re.sub(r'const\s+\[altGuestPhone,\s*setAltGuestPhone\]\s*=\s*useState\([^)]*\);\s*', '', content)
    content = re.sub(r'^\s*setAltGuestPhone\([^)]*\);\s*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'if\s*\(d\.altGuestPhone\)\s*setAltGuestPhone\(d\.altGuestPhone\);', '', content)
    content = re.sub(r'setAltGuestPhone\([^)]*\);', '', content)
    
    validation_block = r'''\s*let altPhoneToSave = "";\s*if \(altGuestPhone\.trim\(\)\) \{\s*const normalizeIndianPhone = [^;]*;\s*const normalized = [^;]*;\s*const isValidIndian = [^;]*;\s*const isValidIntl = [^;]*;\s*if \(!isValidIndian && !isValidIntl\) \{\s*errs\.altGuestPhone = [^;]*;\s*\} else \{\s*altPhoneToSave = [^;]*;\s*\}\s*\}'''
    content = re.sub(validation_block, '', content)

    content = content.replace(", 'altGuestPhone'", "")
    content = re.sub(r'doSubmit\(phoneToSave,\s*altPhoneToSave\);', 'doSubmit(phoneToSave);', content)
    content = re.sub(r'const doSubmit = async\s*\(phoneToSave,\s*altPhoneToSave\)\s*=>', 'const doSubmit = async (phoneToSave) =>', content)
    content = re.sub(r'^\s*altGuestPhone:\s*altPhoneToSave\s*\|\|\s*null,?\s*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'^\s*alt_guest_phone:\s*altPhoneToSave\s*\|\|\s*null,?\s*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'altGuestPhone=\{altGuestPhone\}\s*setAltGuestPhone=\{setAltGuestPhone\}', '', content)
    
    content = re.sub(r',\s*altGuestPhone:\s*d\.altGuestPhone', '', content)
    content = re.sub(r',\s*altGuestPhone', '', content)
    content = re.sub(r'^\s*alt_guest_phone:\s*item\.altGuestPhone,?\s*$', '', content, flags=re.MULTILINE)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

def remove_alt_guest_phone_offline(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    content = re.sub(r'^\s*alt_guest_phone:\s*item\.altGuestPhone,?\s*$', '', content, flags=re.MULTILINE)
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

def remove_alt_guest_phone_server(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # 4. Remove alt_guest_phone: Optional[str] = None from the CarCreate model (~line 5767).
    content = re.sub(r'^\s*alt_guest_phone:\s*Optional\[str\]\s*=\s*None\s*$', '', content, flags=re.MULTILINE)
    
    # 5. Remove "alt_guest_phone": body.alt_guest_phone or None from the new-car document built in POST /cars (~line 6024).
    content = re.sub(r'^\s*"alt_guest_phone":\s*body\.alt_guest_phone\s*or\s*None,?\s*$', '', content, flags=re.MULTILINE)
    
    # 6. Remove the if "alt_guest_phone" in body: update["alt_guest_phone"] = ... line from PATCH /cars/{cid}/complete-checkin (~line 7489).
    content = re.sub(r'^\s*if\s*"alt_guest_phone"\s*in\s*body:\s*update\["alt_guest_phone"\]\s*=\s*body\.get\("alt_guest_phone"\)\s*$', '', content, flags=re.MULTILINE)
    
    # 7. Remove "alt_guest_phone": match.get("alt_guest_phone") from the plate pre-fill lookup response (~line 6245).
    content = re.sub(r'^\s*"alt_guest_phone":\s*match\.get\("alt_guest_phone"\),?\s*$', '', content, flags=re.MULTILINE)
    
    # 8. Remove "alt_guest_phone": r.get("alt_guest_phone") from the two car-history response builders (~lines 8575, 8683).
    content = re.sub(r'^\s*"alt_guest_phone":\s*r\.get\("alt_guest_phone"\),?\s*$', '', content, flags=re.MULTILINE)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

if __name__ == "__main__":
    remove_alt_guest_phone_checkin(checkin_path)
    remove_alt_guest_phone_add_car(add_car_path)
    remove_alt_guest_phone_offline(offline_path)
    remove_alt_guest_phone_server(server_path)
    print("Replacements done.")
