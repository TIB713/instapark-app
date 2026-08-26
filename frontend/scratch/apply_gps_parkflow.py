import os

base_dir = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend"
f_useParkFlow = os.path.join(base_dir, "hooks", "useParkFlow.js")

with open(f_useParkFlow, "r", encoding="utf-8") as f:
    content = f.read()

# 1.1 Replace captureGPSPin
target_capture = """  const captureGPSPin = async () => {
    setCapturingGPS(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        confirmDialog.info("Permission denied", "Location permission is needed to save GPS pin.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCapturedGPS({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      confirmDialog.info("Error", "Could not get GPS location. You can still park without it.");
    } finally {
      setCapturingGPS(false);
    }
  };"""

replacement_capture = """  const captureGPSOnce = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const loc = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("gps_timeout")), 5000)),
    ]);
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  } catch {
    // Single try only — if it fails, times out, or permission is denied,
    // park without a pin. No retry.
    return null;
  }
};"""

content = content.replace(target_capture, replacement_capture)

# 1.2 Update doConfirmPark
target_doConfirmPark = """  const doConfirmPark = async () => {
    setConfirmingPark(true);
    try {
      const net = await NetInfo.fetch();

      if (!net.isConnected) {
        // OFFLINE: copy photos first (needed for queue)
        const photoLocalPaths = [];
        for (let i = 0; i < parkPhotos.length; i++) {
          const sourceUri = resizedParkPhotosRef.current[parkPhotos[i]] || parkPhotos[i];
          const localPath = `${FileSystem.documentDirectory}park_${selectedCar.id}_${i}_${Date.now()}.jpg`;
          await FileSystem.copyAsync({ from: sourceUri, to: localPath });
          photoLocalPaths.push(localPath);
        }
        await enqueueParkAction(selectedCar.id, { zone: selectedZone, slot: selectedSlot, parkedDriverId: resolvedDriverId, photoLocalPaths });"""

replacement_doConfirmPark = """  const doConfirmPark = async () => {
    setConfirmingPark(true);
    try {
      const gpsPin = await captureGPSOnce();
      setCapturedGPS(gpsPin);
      const net = await NetInfo.fetch();

      if (!net.isConnected) {
        // OFFLINE: copy photos first (needed for queue)
        const photoLocalPaths = [];
        for (let i = 0; i < parkPhotos.length; i++) {
          const sourceUri = resizedParkPhotosRef.current[parkPhotos[i]] || parkPhotos[i];
          const localPath = `${FileSystem.documentDirectory}park_${selectedCar.id}_${i}_${Date.now()}.jpg`;
          await FileSystem.copyAsync({ from: sourceUri, to: localPath });
          photoLocalPaths.push(localPath);
        }
        await enqueueParkAction(selectedCar.id, { zone: selectedZone, slot: selectedSlot, parkedDriverId: resolvedDriverId, photoLocalPaths, gpsLat: gpsPin?.lat ?? null, gpsLng: gpsPin?.lng ?? null });"""

content = content.replace(target_doConfirmPark, replacement_doConfirmPark)

# 1.2 Update doConfirmPark online
target_doConfirmPark_online = """      // ONLINE: go straight to API  no photo copying needed before this
      const snapshotUris = [...parkPhotos]; // snapshot current URIs before state is cleared
      clearInterval(holdTimerRef.current);
      await api.patch(`/cars/${selectedCar.id}/park`, {
        zone: selectedZone,
        slot: selectedSlot,
        parked_driver_id: resolvedDriverId,
        gps_lat: capturedGPS?.lat || null,
        gps_lng: capturedGPS?.lng || null,
      });"""

# Handle potential weird encoding character ( instead of —)
target_doConfirmPark_online_2 = """      // ONLINE: go straight to API — no photo copying needed before this
      const snapshotUris = [...parkPhotos]; // snapshot current URIs before state is cleared
      clearInterval(holdTimerRef.current);
      await api.patch(`/cars/${selectedCar.id}/park`, {
        zone: selectedZone,
        slot: selectedSlot,
        parked_driver_id: resolvedDriverId,
        gps_lat: capturedGPS?.lat || null,
        gps_lng: capturedGPS?.lng || null,
      });"""

replacement_doConfirmPark_online = """      // ONLINE: go straight to API — no photo copying needed before this
      const snapshotUris = [...parkPhotos]; // snapshot current URIs before state is cleared
      clearInterval(holdTimerRef.current);
      await api.patch(`/cars/${selectedCar.id}/park`, {
        zone: selectedZone,
        slot: selectedSlot,
        parked_driver_id: resolvedDriverId,
        gps_lat: gpsPin?.lat ?? null,
        gps_lng: gpsPin?.lng ?? null,
      });"""

if target_doConfirmPark_online in content:
    content = content.replace(target_doConfirmPark_online, replacement_doConfirmPark_online)
elif target_doConfirmPark_online_2 in content:
    content = content.replace(target_doConfirmPark_online_2, replacement_doConfirmPark_online)
else:
    # Use generic replace to avoid unicode issue
    idx = content.find("await api.patch(`/cars/${selectedCar.id}/park`")
    if idx != -1:
        start_idx = idx
        end_idx = content.find("});", start_idx) + 3
        old_patch = content[start_idx:end_idx]
        new_patch = old_patch.replace("gps_lat: capturedGPS?.lat || null,", "gps_lat: gpsPin?.lat ?? null,")
        new_patch = new_patch.replace("gps_lng: capturedGPS?.lng || null,", "gps_lng: gpsPin?.lng ?? null,")
        content = content.replace(old_patch, new_patch)


# 1.3 Update the export
content = content.replace("captureGPSPin", "captureGPSOnce")

with open(f_useParkFlow, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated useParkFlow.js")
