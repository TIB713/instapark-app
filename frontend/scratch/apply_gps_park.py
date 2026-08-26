import os

base_dir = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend"

# 2. Update park.jsx
f_park = os.path.join(base_dir, "app", "(driver)", "(tabs)", "park.jsx")
with open(f_park, "r", encoding="utf-8") as f:
    content = f.read()

# Drop captureGPSPin from destructuring
content = content.replace("    takeParkPhoto,\n    captureGPSPin,\n    confirmPark", "    takeParkPhoto,\n    confirmPark")
content = content.replace("    takeParkPhoto,\r\n    captureGPSPin,\r\n    confirmPark", "    takeParkPhoto,\n    confirmPark")

# Remove the GPS button
target_buttons = """            <Btn variant="outline" onPress={captureGPSPin} style={{ marginBottom: rp(24) }}>
              {capturingGPS ? "Saving GPS..." : capturedGPS ? "GPS Saved ✓" : "Save GPS Pin"}
            </Btn>

            <Btn variant="accent" disabled={!selectedSlot || confirmingPark} onPress={confirmPark}>"""

target_buttons_2 = """            <Btn variant="outline" onPress={captureGPSPin} style={{ marginBottom: rp(24) }}>
              {capturingGPS ? "Saving GPS..." : capturedGPS ? "GPS Saved ✓" : "Save GPS Pin"}
            </Btn>
            <Btn variant="accent" disabled={!selectedSlot || confirmingPark} onPress={confirmPark}>"""

replacement_buttons = """            <Btn variant="accent" disabled={!selectedSlot || confirmingPark} onPress={confirmPark}>"""

if target_buttons in content:
    content = content.replace(target_buttons, replacement_buttons)
elif target_buttons_2 in content:
    content = content.replace(target_buttons_2, replacement_buttons)
else:
    # Manual replace
    idx1 = content.find('<Btn variant="outline" onPress={captureGPSPin}')
    if idx1 != -1:
        idx2 = content.find('</Btn>', idx1) + 6
        old_btn = content[idx1:idx2]
        content = content.replace(old_btn, "")
        
with open(f_park, "w", encoding="utf-8") as f:
    f.write(content)


# 3. Update lib/offline.js
f_offline = os.path.join(base_dir, "lib", "offline.js")
with open(f_offline, "r", encoding="utf-8") as f:
    content = f.read()

target_enqueue = """export const enqueueParkAction = async (carId, { zone, slot, parkedDriverId, keyTag, photoLocalPaths }) => {
  try {
    const existing = await AsyncStorage.getItem(PARK_QUEUE_KEY);
    const queue = existing ? JSON.parse(existing) : [];
    queue.push({
      type: "park",
      carId,
      zone,
      slot,
      parkedDriverId,
      keyTag,
      photoLocalPaths,
      retryCount: 0,
      maxRetries: 3,
      lastError: null,
      enqueuedAt: Date.now(),
    });"""

replacement_enqueue = """export const enqueueParkAction = async (carId, { zone, slot, parkedDriverId, keyTag, photoLocalPaths, gpsLat, gpsLng }) => {
  try {
    const existing = await AsyncStorage.getItem(PARK_QUEUE_KEY);
    const queue = existing ? JSON.parse(existing) : [];
    queue.push({
      type: "park",
      carId,
      zone,
      slot,
      parkedDriverId,
      keyTag,
      photoLocalPaths,
      gpsLat: gpsLat ?? null,
      gpsLng: gpsLng ?? null,
      retryCount: 0,
      maxRetries: 3,
      lastError: null,
      enqueuedAt: Date.now(),
    });"""

content = content.replace(target_enqueue, replacement_enqueue)


target_process = """      try {
        await api.patch(`/cars/${item.carId}/park`, {
          zone: item.zone,
          slot: item.slot,
          parked_driver_id: item.parkedDriverId,
          key_tag: item.keyTag
        });"""

replacement_process = """      try {
        await api.patch(`/cars/${item.carId}/park`, {
          zone: item.zone,
          slot: item.slot,
          parked_driver_id: item.parkedDriverId,
          key_tag: item.keyTag,
          gps_lat: item.gpsLat ?? null,
          gps_lng: item.gpsLng ?? null
        });"""

content = content.replace(target_process, replacement_process)

with open(f_offline, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated park.jsx and offline.js")
