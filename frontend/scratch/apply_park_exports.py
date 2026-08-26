import re

filepath = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\hooks\useParkFlow.js"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Replace the return block
target_regex = r"    closeParkModal: \(\) => setShowParkModal\(false\),(.*?)\s+};\s*}\s*$"

replacement = """    closeParkModal: () => setShowParkModal(false),
    setShowParkModal,
    setSelectedCar,
    setEventZones,
    setSlots,
    setSelectedZone,
    setSelectedSlot,
    setKeyTag,
    setParkPhotos,
    setLoadingPhotoIdx,
    setParkingPhotoStep,
    setTakingParkPhoto,
    setShowParkSuccessModal,
    setParkedCarInfo,
    setCapturedGPS,
    setCapturingGPS,
    setOpeningParkModal,
    setConfirmingPark,
    setDismissingParkSuccess,
    selectSlot,
    takeParkPhoto,
    confirmPark,
    doConfirmPark,
    uploadParkPhotosInBackground,
    captureGPSPin
  };
}"""

if re.search(target_regex, content, flags=re.DOTALL):
    content = re.sub(target_regex, replacement, content, flags=re.DOTALL)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated useParkFlow.js exports.")
else:
    print("Regex failed to match.")
