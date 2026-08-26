import os
import re

f_ui = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(supervisor)\(tabs)\event-detail.jsx"
with open(f_ui, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Revert selfPickupCarId from useLocalSearchParams
content = content.replace(
    "const { showQr, tab: initialTab, selfPickupCarId } = useLocalSearchParams();",
    "const { showQr, tab: initialTab } = useLocalSearchParams();"
)

# 2. Revert the selfPickupCarId useEffect if it exists (it probably didn't get added, but just in case)
target_use_effect = """  useEffect(() => {
    if (!selfPickupCarId || !cars?.length) return;
    const car = cars.find(c => c.id === selfPickupCarId);
    if (car) {
      setSelectedCar(car);
      setShowCarModal(true);
      setShowSelfPickupOtpField(true);
    }
  }, [selfPickupCarId, cars]);"""
content = content.replace(target_use_effect, "")

# 3. Update filteredCars search to match checkin_code
target_filtered_cars = """  const filteredCars = useMemo(() => {
    return cars.filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        const matchesPlate = c.plate?.toLowerCase().includes(q);
        const matchesCode = c.card_code?.toString().includes(search.trim());
        if (!matchesPlate && !matchesCode) return false;
      }
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      return true;
    });
  }, [cars, search, statusFilter]);"""

replacement_filtered_cars = """  const filteredCars = useMemo(() => {
    return cars.filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        const matchesPlate = c.plate?.toLowerCase().includes(q);
        const matchesCode = c.checkin_code?.includes(search.trim());
        if (!matchesPlate && !matchesCode) return false;
      }
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      return true;
    });
  }, [cars, search, statusFilter]);"""

if "matchesCode = c.checkin_code" not in content:
    content = content.replace(target_filtered_cars, replacement_filtered_cars)

# 4. Update the SELF PICKUP button and inline OTP field
target_ui_button = """                        <TouchableOpacity
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

replacement_ui_button = """                        <TouchableOpacity
                          onPress={() => setShowSelfPickupOtpField(true)}
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
                              GUEST'S SELF-PICKUP CODE
                            </Text>
                            <TextInput
                              value={selfPickupOtpInput}
                              onChangeText={setSelfPickupOtpInput}
                              placeholder="Enter code (leave blank if none given)"
                              keyboardType="number-pad"
                              maxLength={6}
                              style={{ backgroundColor: "#fff", borderRadius: rp(12), borderWidth: 1, borderColor: theme.colors.border, paddingVertical: rp(10), paddingHorizontal: rp(14), fontSize: rs(18), fontWeight: "800", textAlign: "center", letterSpacing: rs(4) }}
                            />
                            <TouchableOpacity
                              onPress={() => doMarkSelfPickup(selectedCar, selfPickupOtpInput)}
                              disabled={markingSelfPickup === selectedCar.id}
                              style={{ backgroundColor: theme.colors.accent, borderRadius: rp(12), paddingVertical: rp(12), alignItems: "center", marginTop: rp(10) }}
                            >
                              {markingSelfPickup === selectedCar.id ? (
                                <ActivityIndicator color="#fff" size="small" />
                              ) : (
                                <Text style={{ color: "#fff", fontWeight: "700", letterSpacing: rs(1) }}>Verify OTP</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        )}"""

if target_ui_button in content:
    content = content.replace(target_ui_button, replacement_ui_button)
else:
    # Manual replace if string mismatch
    idx1 = content.find('<TouchableOpacity')
    while idx1 != -1:
        if 'markSelfPickup(selectedCar)' in content[idx1:idx1+100]:
            end_idx = content.find(')}', idx1) + 2
            old_btn_block = content[idx1:end_idx]
            if 'GUEST SELF-PICKUP CODE' in old_btn_block:
                 content = content.replace(old_btn_block, replacement_ui_button.strip())
                 break
        idx1 = content.find('<TouchableOpacity', idx1 + 1)
    
    if "Verify OTP" not in content:
        print("Warning: target_ui_button manual replacement also failed")

with open(f_ui, "w", encoding="utf-8") as f:
    f.write(content)

print("Done applying new self pickup prompt")
