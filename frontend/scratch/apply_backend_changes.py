import re

filepath = r"d:\Admin\Desktop\InstaPark-Combined\instapark\backend\server.py"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

replacements = [
    # 1. create_car
    (re.compile(r'    use_instant_park = bool\(body\.instant_park\)\n    if use_instant_park and not event\.get\("allow_instant_park"\):\n        raise HTTPException\(400, "Instant Park is not enabled for this event"\)\n    if not use_instant_park:\n        if not body\.guest_phone or not body\.guest_phone\.strip\(\):\n            raise HTTPException\(400, "Guest phone number is required"\)\n        if not body\.guest_name or not body\.guest_name\.strip\(\):\n            raise HTTPException\(400, "Guest name is required"\)'), 
     '    # Instant Park is now the permanent default — guest details are always optional.\n    use_instant_park = True'),
    
    # 2. HotelCreate / HotelUpdate
    (re.compile(r'    allow_instant_park: Optional\[bool\] = False\n'), ''),
    (re.compile(r'    allow_instant_park: Optional\[bool\] = None\n'), ''),
    
    # 3. create_hotel
    (re.compile(r'        "allow_instant_park": bool\(body\.allow_instant_park\),\n'), ''),
    
    # 4. EventCreate / EventUpdate
    (re.compile(r'    allow_instant_park: bool = False\n'), ''),
    
    # 5. update_event
    (re.compile(r'        if submitted_fields - \{"gate_timer_minutes", "auto_close_grace_minutes", "allow_instant_park", "name", "venue", "venue_place_id", "venue_address", "venue_lat", "venue_lng", "start_time", "end_time", "gates"\}:\n            raise HTTPException\(400, "Daily hotel events cannot have their capacity, zones, or dates changed — only name, venue, times, gates, gate timer, and instant park\."\)'),
     '        if submitted_fields - {"gate_timer_minutes", "auto_close_grace_minutes", "name", "venue", "venue_place_id", "venue_address", "venue_lat", "venue_lng", "start_time", "end_time", "gates"}:\n            raise HTTPException(400, "Daily hotel events cannot have their capacity, zones, or dates changed — only name, venue, times, gates, and gate timer.")'),

    # 6. process_hotel_daily_event
    (re.compile(r'        allow_instant_park = bool\(hotel\.get\("allow_instant_park", False\)\)\n'), ''),
    (re.compile(r'            "allow_instant_park": allow_instant_park,\n'), '')
]

for old, new in replacements:
    content = old.sub(new, content)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated backend server.py")
