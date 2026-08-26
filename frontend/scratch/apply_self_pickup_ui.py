import os

# 4. Update frontend UI (app/(supervisor)/(tabs)/event-detail.jsx)
f_ui = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(supervisor)\(tabs)\event-detail.jsx"
with open(f_ui, "r", encoding="utf-8") as f:
    content = f.read()

target_ui_destructure = """    showAssignPicker, setShowAssignPicker,"""
replacement_ui_destructure = """    selfPickupOtpInput, setSelfPickupOtpInput, showSelfPickupOtpField, setShowSelfPickupOtpField,
    showAssignPicker, setShowAssignPicker,"""
if target_ui_destructure in content and "selfPickupOtpInput" not in content:
    content = content.replace(target_ui_destructure, replacement_ui_destructure)

target_ui_2 = """  const { showQr, tab: initialTab } = useLocalSearchParams();"""
replacement_ui_2 = """  const { showQr, tab: initialTab, selfPickupCarId } = useLocalSearchParams();"""
if target_ui_2 in content:
    content = content.replace(target_ui_2, replacement_ui_2)

target_ui_3 = """  useEffect(() => {
    if (showQr && cars && cars.length > 0) {
      const car = cars.find(c => c.qr_token === showQr);
      if (car) {
        setSelectedCar(car);
        setShowCarModal(true);
      }
    }
  }, [showQr, cars]);"""
replacement_ui_3 = """  useEffect(() => {
    if (showQr && cars && cars.length > 0) {
      const car = cars.find(c => c.qr_token === showQr);
      if (car) {
        setSelectedCar(car);
        setShowCarModal(true);
      }
    }
  }, [showQr, cars]);

  useEffect(() => {
    if (!selfPickupCarId || !cars?.length) return;
    const car = cars.find(c => c.id === selfPickupCarId);
    if (car) {
      setSelectedCar(car);
      setShowCarModal(true);
      setShowSelfPickupOtpField(true);
    }
  }, [selfPickupCarId, cars]);"""
if target_ui_3 in content:
    content = content.replace(target_ui_3, replacement_ui_3)


target_ui_4 = """                        <TouchableOpacity
                          onPress={() => markSelfPickup(selectedCar)}
                          disabled={markingSelfPickup === selectedCar.id}
                          style={{ backgroundColor: theme.colors.warningLight, borderWidth: 1.5, borderColor: theme.colors.warning, borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", flexDirection: "row", justifyContent: "center" }}
                        >
                          <Ionicons name="walk-outline" size={18} color={theme.colors.warning} />
                          <Text style={{ color: theme.colors.warning, fontWeight: "900", letterSpacing: rs(2), marginLeft: rp(8) }}>
                            {markingSelfPickup === selectedCar.id ? "MARKING..." : "SELF PICKUP"}
                          </Text>
                        </TouchableOpacity>"""
replacement_ui_4 = """                        <TouchableOpacity
                          onPress={() => markSelfPickup(selectedCar)}
                          disabled={markingSelfPickup === selectedCar.id}
                          style={{ backgroundColor: theme.colors.warningLight, borderWidth: 1.5, borderColor: theme.colors.warning, borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", flexDirection: "row", justifyContent: "center" }}
                        >
                          <Ionicons name="walk-outline" size={18} color={theme.colors.warning} />
                          <Text style={{ color: theme.colors.warning, fontWeight: "900", letterSpacing: rs(2), marginLeft: rp(8) }}>
                            {markingSelfPickup === selectedCar.id ? "MARKING..." : "SELF PICKUP"}
                          </Text>
                        </TouchableOpacity>

                        {showSelfPickupOtpField && (
                          <View style={{ backgroundColor: "#F9FAFB", borderRadius: rp(20), padding: rp(16), marginTop: rp(12) }}>
                            <Text style={{ fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(2), marginBottom: rp(8) }}>
                              GUEST SELF-PICKUP CODE
                            </Text>
                            <TextInput
                              value={selfPickupOtpInput}
                              onChangeText={setSelfPickupOtpInput}
                              placeholder="Enter guest's code"
                              keyboardType="number-pad"
                              maxLength={6}
                              style={{ backgroundColor: "#fff", borderRadius: rp(12), borderWidth: 1, borderColor: theme.colors.border, paddingVertical: rp(10), paddingHorizontal: rp(14), fontSize: rs(18), fontWeight: "800", textAlign: "center", letterSpacing: rs(4) }}
                            />
                            <TouchableOpacity
                              onPress={() => doMarkSelfPickup(selectedCar, selfPickupOtpInput)}
                              disabled={markingSelfPickup === selectedCar.id || !selfPickupOtpInput.trim()}
                              style={{ backgroundColor: theme.colors.accent, borderRadius: rp(12), paddingVertical: rp(12), alignItems: "center", marginTop: rp(10) }}
                            >
                              {markingSelfPickup === selectedCar.id ? (
                                <ActivityIndicator color="#fff" size="small" />
                              ) : (
                                <Text style={{ color: "#fff", fontWeight: "700", letterSpacing: rs(1) }}>Confirm Pickup</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        )}"""

if target_ui_4 in content:
    content = content.replace(target_ui_4, replacement_ui_4)
else:
    print("Warning: target_ui_4 not found")

target_ui_5_1 = """onRequestClose={() => setShowCarModal(false)}"""
replacement_ui_5_1 = """onRequestClose={() => { setShowCarModal(false); setShowSelfPickupOtpField(false); setSelfPickupOtpInput(""); }}"""
if target_ui_5_1 in content:
    content = content.replace(target_ui_5_1, replacement_ui_5_1)

target_ui_5_2 = """onPress={() => setShowCarModal(false)}"""
replacement_ui_5_2 = """onPress={() => { setShowCarModal(false); setShowSelfPickupOtpField(false); setSelfPickupOtpInput(""); }}"""
if target_ui_5_2 in content:
    content = content.replace(target_ui_5_2, replacement_ui_5_2)

with open(f_ui, "w", encoding="utf-8") as f:
    f.write(content)

print("Done apply_self_pickup_ui.py")
