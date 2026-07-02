import { useEffect, useState } from "react";
import { rs, rp } from '../../utils/responsive';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";
import { enqueueCheckinAction } from "../../lib/offline";
import { updateJourney } from "../../lib/locationTracking";

const validatePlate = (plate) => {
  const cleaned = plate.replace(/[-\s]/g, "").toUpperCase();
  const standard = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}$/.test(cleaned);
  const bharat = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/.test(cleaned);
  return standard || bharat;
};

function Lbl({ children }) {
  return (
    <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(3), marginBottom: rp(8), marginTop: rp(4) }}>
      {children}
    </Text>
  );
}

export default function CheckIn() {
  const router = useRouter();
  const { driver, currentEventId } = useAppStore();
  const resolvedDriverId = driver?.id;
  const [plate, setPlate] = useState("");
  const [color, setColor] = useState("");
  const [make, setMake] = useState("");
  const [notes, setNotes] = useState("");
  const [guestNotes, setGuestNotes] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [eventGates, setEventGates] = useState([]);
  const [selectedGate, setSelectedGate] = useState("");
  const [carType, setCarType] = useState("normal");
  const [altGuestPhone, setAltGuestPhone] = useState("");
  const [hasDamage, setHasDamage] = useState(false);
  const [damageNotes, setDamageNotes] = useState("");
  const [photos, setPhotos] = useState({ front: null, back: null, left: null, right: null, extra: null });
  const [lookupBanner, setLookupBanner] = useState(null);
  const [plateLookedUp, setPlateLookedUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [prefilledCarId, setPrefilledCarId] = useState(null); 
  const [passToken, setPassToken] = useState(null); 
  const [guestName, setGuestName] = useState(""); 
  const [isPreRegistered, setIsPreRegistered] = useState(false); 
  const params = useLocalSearchParams(); 

  useEffect(() => { 
    if (params.prefill_plate) { 
      setPlate(params.prefill_plate || ""); 
      setMake(params.prefill_make || ""); 
      setColor(params.prefill_color || ""); 
      setGuestPhone(params.prefill_phone || ""); 
      setGuestName(params.prefill_name || ""); 
      setPassToken(params.prefill_pass_token || null); 
      setPrefilledCarId(params.prefill_car_id || null); 
      setIsPreRegistered(true); 
      setGuestNotes(params.prefill_guest_notes || "");
    } 
  }, [params.prefill_plate]); 

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/events/${currentEventId}`);
        setEventGates(data.gates || []);
        if (data.gates?.[0]) setSelectedGate(data.gates[0]);
      } catch {}
      try {
        const draft = await AsyncStorage.getItem("checkin_draft");
        const savedPhotos = await AsyncStorage.getItem("checkin_photos");
        if (draft) {
          const d = JSON.parse(draft);
          setPlate(d.plate || "");
          setColor(d.color || "");
          setMake(d.make || "");
          setNotes(d.notes || "");
          setGuestPhone(d.guestPhone || "");
          setSelectedGate(d.selectedGate || "");
          if (d.carType) setCarType(d.carType);
          if (d.altGuestPhone) setAltGuestPhone(d.altGuestPhone);
          if (d.hasDamage) setHasDamage(d.hasDamage);
          if (d.damageNotes) setDamageNotes(d.damageNotes);
          if (d.guestName) setGuestName(d.guestName);
        }
        if (savedPhotos) setPhotos(JSON.parse(savedPhotos));
      } catch {}
    })();
  }, [currentEventId]);

  const lookupPlate = async (plateValue) => {
    if (!validatePlate(plateValue) || plateValue === plateLookedUp) return;
    setPlateLookedUp(plateValue);
    try {
      const { data } = await api.get(`/cars/plate-lookup/${plateValue}`, { params: { event_id: currentEventId } });
      if (data.found) {
        setMake(prev => prev || data.make || "");
        setColor(prev => prev || data.color || "");
        setGuestPhone(prev => prev || data.guest_phone || "");
        setAltGuestPhone(prev => prev || data.alt_guest_phone || "");
        setCarType(prev => (prev === "normal" && data.car_type ? data.car_type : prev));
        setLookupBanner(data);
        setGuestName(prev => prev || data.guest_name || "");
      }
    } catch {}
  };

  const takePhoto = async (label) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Camera permission needed"); return; }
    try {
      await AsyncStorage.setItem("checkin_draft", JSON.stringify({ plate, color, make, notes, guestPhone, selectedGate, carType, altGuestPhone, hasDamage, damageNotes, guestName }));
      await AsyncStorage.setItem("checkin_photos", JSON.stringify(photos));
    } catch {}
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled) {
      const asset = result.assets[0];
      const compressed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: rp(1280) } }],
        { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG }
      );
      const finalUri = compressed.uri;
      const np = { ...photos, [label]: finalUri };
      setPhotos(np);
      try { await AsyncStorage.setItem("checkin_photos", JSON.stringify(np)); } catch {}
    }
    try { await AsyncStorage.removeItem("checkin_draft"); } catch {}
  };

  const uploadPhotosInBackground = async (carId, photosObj) => {
    try {
      const urls = [];
      const labels = [];
      for (const [label, uri] of Object.entries(photosObj)) {
        if (!uri) continue;
        try {
          const fd = new FormData();
          fd.append("file", { uri, type: "image/jpeg", name: "photo.jpg" });
          fd.append("folder", `checkin/${carId}`);
          const up = await api.post("/upload", fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          urls.push(up.data.url);
          labels.push(label);
        } catch {}
      }
      if (urls.length > 0) {
        await api.post(`/cars/${carId}/photos`, { urls, type: "checkin", labels });
      }
    } catch {}
  };

  const submit = async () => { 
    if (!plate.trim()) { Alert.alert("Required", "License plate is required"); return; } 
    if (!validatePlate(plate.trim())) { 
      Alert.alert("Invalid Plate", "Please enter a valid Indian vehicle number plate."); 
      return; 
    } 
    if (!color.trim()) { Alert.alert("Required", "Vehicle color is required"); return; } 
    if (!make.trim()) { Alert.alert("Required", "Vehicle make/model is required"); return; } 
    if (!guestName.trim()) { Alert.alert("Required", "Guest name is required"); return; }
    let phoneToSave = "";
    if (guestPhone.trim()) {
      const normalizeIndianPhone = (p) => p.replace(/^(\+91|91|0)/, "").replace(/[\s\-()]/g, "");
      const normalized = normalizeIndianPhone(guestPhone.trim());
      const isValidIndian = /^\d{10}$/.test(normalized);
      const isValidIntl = /^\+\d{10,15}$/.test(guestPhone.trim());
      if (!isValidIndian && !isValidIntl) {
        Alert.alert("Invalid Phone", "Enter a 10-digit Indian number, or an international number starting with + (e.g. +44...)");
        return;
      }
      phoneToSave = isValidIndian ? normalized : guestPhone.trim();
    }
    let altPhoneToSave = "";
    if (altGuestPhone.trim()) {
      const normalizeIndianPhone = (p) => p.replace(/^(\+91|91|0)/, "").replace(/[\s\-()]/g, "");
      const normalized = normalizeIndianPhone(altGuestPhone.trim());
      const isValidIndian = /^\d{10}$/.test(normalized);
      const isValidIntl = /^\+\d{10,15}$/.test(altGuestPhone.trim());
      if (!isValidIndian && !isValidIntl) {
        Alert.alert("Invalid Alternate Phone", "Enter a 10-digit Indian number, or an international number starting with +");
        return;
      }
      altPhoneToSave = isValidIndian ? normalized : altGuestPhone.trim();
    }
    if (!photos.front || !photos.back || !photos.left || !photos.right) { Alert.alert("Required", "Front, back, left, and right photos are all required"); return; } 
    setSubmitting(true); 
    try { 
      // 1. Copy photos to local storage first for safety
      const photoLocalPaths = { front: null, back: null, left: null, right: null, extra: null };
      for (const [label, uri] of Object.entries(photos)) {
        if (!uri) continue;
        const localPath = `${FileSystem.documentDirectory}checkin_${plate.trim()}_${label}_${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: uri, to: localPath });
        photoLocalPaths[label] = localPath;
      }

      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        await enqueueCheckinAction({
          eventId: currentEventId,
          plate: plate.trim().toUpperCase(),
          color: color.trim(),
          make: make.trim(),
          notes: notes.trim(),
          gate: selectedGate,
          guestPhone: phoneToSave,
          checkInDriverId: resolvedDriverId,
          photoLocalPaths,
          isPreRegistered,
          prefilledCarId,
          carType,
          altGuestPhone: altPhoneToSave || null,
          hasDamage,
          damageNotes: damageNotes.trim() || null,
          guestName: guestName.trim(),
        });
        await AsyncStorage.removeItem("checkin_draft");
        await AsyncStorage.removeItem("checkin_photos");
        Alert.alert("Saved Offline", "Vehicle check-in queued. Will sync when connected.");
        router.back();
        return;
      }

      let car; 
      if (isPreRegistered && prefilledCarId) { 
        // Complete check-in for PRE_REGISTERED car 
        const { data } = await api.patch(`/cars/${prefilledCarId}/complete-checkin`, { 
          check_in_driver_id: resolvedDriverId, 
          gate: selectedGate || "", 
          make: make.trim(), 
          color: color.trim(), 
          notes: notes.trim(), 
          plate: plate.trim().toUpperCase(), 
          car_type: carType,
          alt_guest_phone: altPhoneToSave || null,
          has_damage: hasDamage,
          damage_notes: damageNotes.trim() || null,
          guest_name: guestName.trim(),
        }); 
        car = data; 
      } else { 
        // Normal check-in 
        const { data } = await api.post("/cars", { 
          plate: plate.trim().toUpperCase(), 
          color: color.trim(), 
          make: make.trim(), 
          notes: notes.trim(), 
          gate: selectedGate || "", 
          event_id: currentEventId, 
          check_in_driver_id: resolvedDriverId, 
          car_type: carType,
          alt_guest_phone: altPhoneToSave || null,
          has_damage: hasDamage,
          damage_notes: damageNotes.trim() || null,
          guest_name: guestName.trim(),
          ...(phoneToSave ? { guest_phone: phoneToSave } : {}), 
        }); 
        car = data; 
        if (car.warning) { 
          await new Promise((resolve) => { 
            Alert.alert("⚠️ Almost Full", "This event is almost at capacity.", [{ text: "OK", onPress: resolve }]); 
          }); 
        } 
      } 
      try { await api.post(`/slots/event/${currentEventId}/initialize`); } catch {} 
      try { await AsyncStorage.removeItem("checkin_photos"); } catch {} 
      try { await AsyncStorage.removeItem("checkin_draft"); } catch {} 
      // Start GPS journey tracking from this moment — driver now walks to park the car
      try { await updateJourney(car.id, "checkin"); } catch {}
      router.replace({ 
        pathname: "/(driver)/qr-display", 
        params: { 
          token: car.qr_token, 
          plate: car.plate, 
          carId: car.id, 
          ...(phoneToSave ? { guestPhone: phoneToSave } : {}), 
        }, 
      }); 
      // Use original photo URIs for online background upload
      uploadPhotosInBackground(car.id, photos).finally(() => { 
        Object.values(photoLocalPaths).forEach(path => { 
          if (path) FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {}); 
        }); 
      }); 
    } catch (err) { 
      const msg = err.response?.data?.detail || "Check-in failed"; 
      if (typeof msg === "string" && msg.includes("full")) Alert.alert("Event Full", "No more cars can be checked in."); 
      else if (typeof msg === "string" && msg.includes("Duplicate")) Alert.alert("Duplicate", "Plate already checked in."); 
      else Alert.alert("Error", typeof msg === "string" ? msg : "Failed"); 
    } finally { setSubmitting(false); } 
  }; 


  return (
    <View style={{ flex: 1, backgroundColor: "#ECFDF5" }} testID="checkin-screen">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#059669" }}>
        <View
          style={{
            backgroundColor: "#059669",
            borderBottomLeftRadius: 44,
            borderBottomRightRadius: 44,
            paddingHorizontal: rp(20),
            paddingTop: rp(8),
            paddingBottom: rp(24),
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(8,145,178,0.5)",
              borderBottomLeftRadius: 44,
              borderBottomRightRadius: 44,
            }}
          />
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(8) }}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: rs(20), fontWeight: "900", marginLeft: rp(12), flex: 1 }}>
              Check In Vehicle
            </Text>
            <TouchableOpacity 
              onPress={() => router.push("/(driver)/scanner")} 
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(8), marginLeft: "auto" }} 
            > 
              <Ionicons name="qr-code-outline" size={22} color="#fff" /> 
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1, paddingHorizontal: rp(20), paddingTop: rp(18) }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: rp(100) }}
        >
          {isPreRegistered && ( 
            <View style={{ 
              backgroundColor: "#ECFDF5", borderWidth: rp(1), borderColor: "#6EE7B7", 
              borderRadius: rp(16), padding: rp(12), marginBottom: rp(16), 
              flexDirection: "row", alignItems: "center", gap: rp(10) 
            }}> 
              <Ionicons name="checkmark-circle" size={20} color="#059669" /> 
              <View style={{ flex: 1 }}> 
                <Text style={{ fontSize: rs(12), fontWeight: "900", color: "#059669" }}> 
                  PRE-REGISTERED GUEST 
                </Text> 
                {guestName ? ( 
                  <Text style={{ fontSize: rs(11), color: "#065F46", marginTop: rp(1) }}> 
                    {guestName} — details pre-filled, please verify 
                  </Text> 
                ) : null} 
              </View> 
            </View> 
          )} 
          {isPreRegistered && guestNotes ? (
            <View style={{
              backgroundColor: "#FEF3C7",
              borderWidth: rp(1),
              borderColor: "#FDE68A",
              borderRadius: rp(16),
              padding: rp(12),
              marginBottom: rp(16),
              flexDirection: "row",
              alignItems: "flex-start",
              gap: rp(10),
            }}>
              <Ionicons name="information-circle"
                size={20} color="#D97706"
                style={{ marginTop: rp(1) }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: rs(12), fontWeight: "900",
                  color: "#92400E" }}>
                  GUEST INSTRUCTIONS
                </Text>
                <Text style={{ fontSize: rs(13), color: "#78350F",
                  marginTop: rp(4), lineHeight: 18 }}>
                  {guestNotes}
                </Text>
              </View>
            </View>
          ) : null}
          {lookupBanner && lookupBanner.guest_name && (
            <View style={{ backgroundColor: "#ECFDF5", borderWidth: rp(1), borderColor: "#6EE7B7", borderRadius: rp(16), padding: rp(12), marginBottom: rp(16) }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: rp(10) }}>
                <Ionicons name="checkmark-circle" size={20} color="#059669" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: rs(12), fontWeight: "900", color: "#059669" }}>PREVIOUS VISIT FOUND</Text>
                  <Text style={{ fontSize: rs(11), color: "#065F46", marginTop: rp(1) }}>{lookupBanner.guest_name} — details pre-filled below</Text>
                </View>
              </View>
            </View>
          )}
          <Lbl>GUEST NAME *</Lbl>
          <View style={inputRow}>
            <Ionicons name="person-outline" size={20} color="#059669" />
            <TextInput value={guestName} onChangeText={setGuestName} placeholder="Guest Name" placeholderTextColor="#9CA3AF" style={textInput} />
          </View>
          <Lbl>LICENSE PLATE *</Lbl>
          <View style={inputRow}>
            <Ionicons name="car-outline" size={20} color="#059669" />
            <TextInput
              testID="plate-input"
              value={plate}
              onChangeText={(v) => setPlate(v.replace(/[^A-Za-z0-9-]/g, "").toUpperCase())}
              onBlur={() => lookupPlate(plate.trim().toUpperCase())}
              placeholder="GJ01AB1234"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              maxLength={10}
              style={textInput}
            />
          </View>
          <Lbl>COLOR</Lbl>
          <View style={inputRow}>
            <Ionicons name="color-palette-outline" size={20} color="#059669" />
            <TextInput value={color} onChangeText={setColor} placeholder="Black" placeholderTextColor="#9CA3AF" style={textInput} />
          </View>
          <Lbl>MAKE / MODEL</Lbl>
          <View style={inputRow}>
            <Ionicons name="construct-outline" size={20} color="#059669" />
            <TextInput value={make} onChangeText={setMake} placeholder="Honda Civic" placeholderTextColor="#9CA3AF" style={textInput} />
          </View>
          <Lbl>CAR TYPE *</Lbl>
          <View style={{ flexDirection: "row", gap: rp(8), marginBottom: rp(16) }}>
            {["normal", "premium"].map((ct) => (
              <TouchableOpacity
                key={ct}
                onPress={() => setCarType(ct)}
                style={{
                  paddingHorizontal: rp(14),
                  paddingVertical: rp(8),
                  borderRadius: rp(99),
                  backgroundColor: carType === ct ? "#059669" : "#fff",
                  borderWidth: rp(1),
                  borderColor: "#059669",
                }}
              >
                <Text style={{ fontSize: rs(12), fontWeight: "800", color: carType === ct ? "#fff" : "#059669", letterSpacing: rs(0.5), textTransform: "capitalize" }}>{ct}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Lbl>NOTES</Lbl>
          <View style={[inputRow, { alignItems: "flex-start", paddingTop: rp(12) }]}>
            <Ionicons name="document-text-outline" size={20} color="#059669" />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Special notes..."
              placeholderTextColor="#9CA3AF"
              style={[textInput, { minHeight: 60, textAlignVertical: "top" }]}
            />
          </View>
          <Lbl>EXISTING SCRATCH / DAMAGE?</Lbl>
          <View style={{ flexDirection: "row", gap: rp(8), marginBottom: rp(16) }}>
            <TouchableOpacity onPress={() => setHasDamage(true)} style={{ paddingHorizontal: rp(14), paddingVertical: rp(8), borderRadius: rp(99), backgroundColor: hasDamage ? "#059669" : "#fff", borderWidth: rp(1), borderColor: "#059669" }}>
              <Text style={{ fontSize: rs(12), fontWeight: "800", color: hasDamage ? "#fff" : "#059669", letterSpacing: rs(0.5) }}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setHasDamage(false)} style={{ paddingHorizontal: rp(14), paddingVertical: rp(8), borderRadius: rp(99), backgroundColor: !hasDamage ? "#059669" : "#fff", borderWidth: rp(1), borderColor: "#059669" }}>
              <Text style={{ fontSize: rs(12), fontWeight: "800", color: !hasDamage ? "#fff" : "#059669", letterSpacing: rs(0.5) }}>No</Text>
            </TouchableOpacity>
          </View>
          {hasDamage && (
            <>
              <Lbl>DAMAGE DESCRIPTION (OPTIONAL)</Lbl>
              <View style={[inputRow, { alignItems: "flex-start", paddingTop: rp(12) }]}>
                <Ionicons name="alert-circle-outline" size={20} color="#059669" />
                <TextInput
                  value={damageNotes}
                  onChangeText={setDamageNotes}
                  multiline
                  placeholder="Describe scratches, dents, etc..."
                  placeholderTextColor="#9CA3AF"
                  style={[textInput, { minHeight: 60, textAlignVertical: "top" }]}
                />
              </View>
            </>
          )}
          <Lbl>GUEST MOBILE (OPTIONAL)</Lbl>
          <View style={inputRow}>
            <Ionicons name="phone-portrait-outline" size={20} color="#059669" />
            <TextInput
              value={guestPhone}
              onChangeText={setGuestPhone}
              placeholder="10-digit mobile number"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              maxLength={10}
              style={textInput}
            />
          </View>
          <Lbl>ALTERNATE MOBILE (OPTIONAL)</Lbl>
          <View style={inputRow}>
            <Ionicons name="phone-portrait-outline" size={20} color="#059669" />
            <TextInput
              value={altGuestPhone}
              onChangeText={setAltGuestPhone}
              placeholder="10-digit mobile number"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              maxLength={10}
              style={textInput}
            />
          </View>

          {eventGates.length > 0 && (
            <>
              <Lbl>ENTRY GATE</Lbl>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: rp(8), paddingBottom: rp(4) }} style={{ marginBottom: rp(12) }}>
                {eventGates.map((g) => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setSelectedGate(g)}
                    style={{
                      paddingHorizontal: rp(14),
                      paddingVertical: rp(8),
                      borderRadius: rp(99),
                      backgroundColor: selectedGate === g ? "#059669" : "#fff",
                      borderWidth: rp(1),
                      borderColor: "#059669",
                    }}
                  >
                    <Text style={{ fontSize: rs(12), fontWeight: "800", color: selectedGate === g ? "#fff" : "#059669", letterSpacing: rs(0.5) }}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          <Lbl>VEHICLE PHOTOS * (ALL REQUIRED EXCEPT EXTRA)</Lbl>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: rp(10), marginBottom: rp(16) }}>
            {["front", "back", "left", "right", "extra"].map((label) => (
              <View key={label} style={{ width: rp(80), height: rp(80) }}>
                {photos[label] ? (
                  <>
                    <Image source={{ uri: photos[label] }} style={{ width: rp(80), height: rp(80), borderRadius: rp(16) }} />
                    <TouchableOpacity
                      onPress={() => setPhotos({ ...photos, [label]: null })}
                      style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: rp(99), padding: rp(2) }}
                    >
                      <Ionicons name="close-circle" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    onPress={() => takePhoto(label)}
                    style={{
                      width: rp(80),
                      height: rp(80),
                      borderRadius: rp(16),
                      borderWidth: rp(2),
                      borderColor: "#059669",
                      borderStyle: "dashed",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#fff",
                    }}
                  >
                    <Ionicons name="camera-outline" size={24} color="#059669" />
                    <Text style={{ fontSize: rs(9), color: "#059669", marginTop: rp(2), fontWeight: "900", textTransform: "uppercase" }}>{label}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={submit}
            disabled={submitting}
            testID="submit-checkin"
            style={{
              backgroundColor: "#059669",
              borderRadius: rp(16),
              paddingVertical: rp(16),
              alignItems: "center",
              marginBottom: rp(16),
              shadowColor: "#059669",
              shadowOpacity: 0.3,
              shadowRadius: rp(14),
              shadowOffset: { width: 0, height: rp(6) },
              elevation: 6,
            }}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(15), letterSpacing: rs(2) }}>CHECK IN VEHICLE</Text>}
          </TouchableOpacity>
          <View style={{ height: rp(40) }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const inputRow = {
  backgroundColor: "#fff",
  borderRadius: rp(16),
  borderWidth: rp(1),
  borderColor: "#E5E7EB",
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: rp(14),
  marginBottom: rp(16),
};
const textInput = {
  flex: 1,
  paddingVertical: rp(14),
  marginLeft: rp(10),
  fontSize: rs(15),
  color: "#111827",
};
