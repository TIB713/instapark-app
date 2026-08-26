import os

# 1. Update backend/server.py
f_server = r"d:\Admin\Desktop\InstaPark-Combined\instapark\backend\server.py"
with open(f_server, "r", encoding="utf-8") as f:
    content = f.read()

target_server = """@api_router.patch("/cars/{cid}/self-pickup")
async def self_pickup(cid: str, user=Depends(require_roles("owner", "admin", "superadmin", "supervisor"))):
    car = await db.cars.find_one({"id": cid}, {"_id": 0})
    if not car:
        raise HTTPException(404, "Car not found")
    await assert_car_ownership(car, user)

    allowed_statuses = ("PARKED", "RETRIEVAL_REQUESTED", "ACCEPTED", "BEING_FETCHED", "AWAITING_REPARK")
    if car.get("status") not in allowed_statuses:
        raise HTTPException(400, f"Cannot mark self-pickup from status '{car.get('status')}'.")

    upd = {"""

replacement_server = """@api_router.patch("/cars/{cid}/self-pickup")
async def self_pickup(cid: str, otp: Optional[str] = Query(None), user=Depends(require_roles("owner", "admin", "superadmin", "supervisor"))):
    car = await db.cars.find_one({"id": cid}, {"_id": 0})
    if not car:
        raise HTTPException(404, "Car not found")
    await assert_car_ownership(car, user)

    allowed_statuses = ("PARKED", "RETRIEVAL_REQUESTED", "ACCEPTED", "BEING_FETCHED", "AWAITING_REPARK")
    if car.get("status") not in allowed_statuses:
        raise HTTPException(400, f"Cannot mark self-pickup from status '{car.get('status')}'.")

    key = f"self_pickup_{cid}"
    stored = await _otp_get(key)
    if stored:
        if not otp or not otp.strip():
            raise HTTPException(400, "Guest has an active self-pickup request — enter their code to confirm")
        attempts = await _otp_increment_attempts(key)
        if attempts > OTP_MAX_ATTEMPTS:
            await _otp_delete(key)
            raise HTTPException(400, "Too many incorrect attempts. Ask the guest to request self-pickup again")
        if stored["otp"] != otp.strip():
            raise HTTPException(400, "Incorrect code — please check with the guest and try again")
        await _otp_delete(key)

    upd = {"""

content = content.replace(target_server, replacement_server)
with open(f_server, "w", encoding="utf-8") as f:
    f.write(content)

# 2. Update frontend deep-link routing (app/_layout.jsx)
f_layout = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\_layout.jsx"
with open(f_layout, "r", encoding="utf-8") as f:
    content = f.read()

target_layout = """          case 'sos':
            router.push({
              pathname: '/(supervisor)/(tabs)/event-detail',
              params: { sosCarId: data.car_id }
            });
            break;"""

replacement_layout = """          case 'sos':
            router.push({
              pathname: '/(supervisor)/(tabs)/event-detail',
              params: { sosCarId: data.car_id }
            });
            break;
          case 'self-pickup':
            router.push({
              pathname: '/(supervisor)/(tabs)/event-detail',
              params: { selfPickupCarId: data.car_id }
            });
            break;"""

content = content.replace(target_layout, replacement_layout)
with open(f_layout, "w", encoding="utf-8") as f:
    f.write(content)


# 3. Update hooks/useEventCars.js
f_hook = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\hooks\useEventCars.js"
with open(f_hook, "r", encoding="utf-8") as f:
    content = f.read()

target_hook = """  const doMarkSelfPickup = async (car) => {
    setMarkingSelfPickup(car.id);
    try {
      await api.patch(`/cars/${car.id}/self-pickup`);
      setShowCarModal(false);
      fetchCars();
    } catch (e) {
      confirmDialog.info("Error", e.response?.data?.detail || "Could not mark self-pickup");
    } finally {
      setMarkingSelfPickup(null);
    }
  };"""

replacement_hook = """  const doMarkSelfPickup = async (car, otp) => {
    setMarkingSelfPickup(car.id);
    try {
      await api.patch(`/cars/${car.id}/self-pickup${otp ? `?otp=${encodeURIComponent(otp)}` : ''}`);
      setShowCarModal(false);
      setSelfPickupOtpInput?.("");
      setShowSelfPickupOtpField?.(false);
      fetchCars();
    } catch (e) {
      confirmDialog.info("Error", e.response?.data?.detail || "Could not mark self-pickup");
    } finally {
      setMarkingSelfPickup(null);
    }
  };"""

content = content.replace(target_hook, replacement_hook)
with open(f_hook, "w", encoding="utf-8") as f:
    f.write(content)


# 4. Update frontend UI (app/(supervisor)/(tabs)/event-detail.jsx)
f_ui = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(supervisor)\(tabs)\event-detail.jsx"
with open(f_ui, "r", encoding="utf-8") as f:
    content = f.read()

target_ui_1 = """  const [showCarModal, setShowCarModal] = useState(false);"""
replacement_ui_1 = """  const [showCarModal, setShowCarModal] = useState(false);
  const [selfPickupOtpInput, setSelfPickupOtpInput] = useState("");
  const [showSelfPickupOtpField, setShowSelfPickupOtpField] = useState(false);"""
content = content.replace(target_ui_1, replacement_ui_1)

target_ui_2 = """  const { showQr, tab: initialTab } = useLocalSearchParams();"""
replacement_ui_2 = """  const { showQr, tab: initialTab, selfPickupCarId } = useLocalSearchParams();"""
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
content = content.replace(target_ui_3, replacement_ui_3)


target_ui_4 = """                <TouchableOpacity 
                  onPress={() => markSelfPickup(selectedCar)} 
                  style={{ backgroundColor: "#F3F4F6", borderRadius: rp(20), padding: rp(16), marginTop: rp(12), alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" }}
                >
                  <Text style={{ fontWeight: "700", color: "#374151" }}>SELF PICKUP</Text>
                </TouchableOpacity>"""
replacement_ui_4 = """                <TouchableOpacity 
                  onPress={() => markSelfPickup(selectedCar)} 
                  style={{ backgroundColor: "#F3F4F6", borderRadius: rp(20), padding: rp(16), marginTop: rp(12), alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" }}
                >
                  <Text style={{ fontWeight: "700", color: "#374151" }}>SELF PICKUP</Text>
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
content = content.replace(target_ui_4, replacement_ui_4)

target_ui_5_1 = """onRequestClose={() => setShowCarModal(false)}"""
replacement_ui_5_1 = """onRequestClose={() => { setShowCarModal(false); setShowSelfPickupOtpField(false); setSelfPickupOtpInput(""); }}"""
content = content.replace(target_ui_5_1, replacement_ui_5_1)

target_ui_5_2 = """onPress={() => setShowCarModal(false)}"""
replacement_ui_5_2 = """onPress={() => { setShowCarModal(false); setShowSelfPickupOtpField(false); setSelfPickupOtpInput(""); }}"""
content = content.replace(target_ui_5_2, replacement_ui_5_2)

# Oh wait! In hooks/useEventCars.js, doMarkSelfPickup was replaced but it called `setSelfPickupOtpInput?.("")` which might not work if useEventCars doesn't have access to that state.
# Ah, I shouldn't reset those states inside the hook unless they are passed into the hook. Let me check if useEventCars accepts those.

with open(f_ui, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
