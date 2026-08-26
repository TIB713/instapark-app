import os

f_ui = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(supervisor)\(tabs)\event-detail.jsx"
with open(f_ui, "r", encoding="utf-8") as f:
    content = f.read()

target = "doAssign, openAssignPicker, toggleAssign, removeCar, sendRetrievalRequest, markSelfPickup\n  } = useEventCars"
replacement = "doAssign, openAssignPicker, toggleAssign, removeCar, sendRetrievalRequest, markSelfPickup, doMarkSelfPickup\n  } = useEventCars"

if target in content:
    content = content.replace(target, replacement)
else:
    # try another format
    target2 = "doAssign, openAssignPicker, toggleAssign, removeCar, sendRetrievalRequest, markSelfPickup\r\n  } = useEventCars"
    if target2 in content:
        content = content.replace(target2, replacement)

with open(f_ui, "w", encoding="utf-8") as f:
    f.write(content)

print("Added doMarkSelfPickup to destructuring")
