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
  Modal,
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
import { updateJourney, markJourneyAccepted } from "../../lib/locationTracking";

const REQUIRED_PHOTO_ORDER = ["front", "back", "left", "right"];

const validatePlate = (plate) => {
  const cleaned = plate.replace(/[-\s]/g, "").toUpperCase();
  const standard = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}$/.test(cleaned);
  const bharat = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/.test(cleaned);
  return standard || bharat;
};

const DAMAGE_OPTIONS = [
  "Front Bumper Scratch",
  "Rear Bumper Scratch",
  "Front Bumper Dent",
  "Rear Bumper Dent",
  "Left Door Scratch",
  "Right Door Scratch",
  "Side Mirror Damage",
  "Windshield Crack",
  "Headlight Damage",
  "Taillight Damage",
  "Wheel Rim Scratch",
];

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
  const [damageTypes, setDamageTypes] = useState([]);
  const [showOtherDamage, setShowOtherDamage] = useState(false);
  const [photos, setPhotos] = useState({ front: null, back: null, left: null, right: null, extra: null });
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [pendingLookup, setPendingLookup] = useState(null);
  const [lookupApplied, setLookupApplied] = useState(false);
  const [plateLookedUp, setPlateLookedUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
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
      } catch { }
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
          if (d.damageTypes) setDamageTypes(d.damageTypes);
          if (d.guestName) setGuestName(d.guestName);
        }
        if (savedPhotos) setPhotos(JSON.parse(savedPhotos));
      } catch { }
    })();
  }, [currentEventId]);

  const lookupPlate = async (plateValue) => {
    if (!validatePlate(plateValue) || plateValue === plateLookedUp) return;
    setPlateLookedUp(plateValue);
    try {
      const { data } = await api.get(`/cars/plate-lookup/${plateValue}`, { params: { event_id: currentEventId } });
      if (data.found) {
        setPendingLookup(data);
      }
    } catch { }
  };

  const confirmLookup = () => {
    if (!pendingLookup) return;
    setMake(prev => prev || pendingLookup.make || "");
    setColor(prev => prev || pendingLookup.color || "");
    setGuestPhone(prev => prev || pendingLookup.guest_phone || "");
    setAltGuestPhone(prev => prev || pendingLookup.alt_guest_phone || "");
    setCarType(prev => (prev === "normal" && pendingLookup.car_type ? pendingLookup.car_type : prev));
    setGuestName(prev => prev || pendingLookup.guest_name || "");
    setLookupApplied(true);
    setPendingLookup(null);
  };

  const rejectLookup = () => {
    setPendingLookup(null);
    setLookupApplied(false);
  };

  const clearGuestOnly = () => {
    Alert.alert(
      "Clear Guest Details?",
      "This will remove the guest name and phone number. The car details will stay the same.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Clear",
          style: "destructive",
          onPress: () => {
            setGuestName("");
            setGuestPhone("");
            setAltGuestPhone("");
          },
        },
      ]
    );
  };

  const takePhoto = async (label) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Camera permission needed"); return; }
    try {
      await AsyncStorage.setItem("checkin_draft", JSON.stringify({ plate, color, make, notes, guestPhone, selectedGate, carType, altGuestPhone, hasDamage, damageNotes, damageTypes, guestName }));
      await AsyncStorage.setItem("checkin_photos", JSON.stringify(photos));
    } catch { }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled) {
      const asset = result.assets[0];
      const compressed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: rp(1280) } }],
        { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG }
      );
      const finalUri = compressed.uri;
      setPendingPhoto({ label, uri: finalUri });
      setShowPhotoPreview(true);
    }
    try { await AsyncStorage.removeItem("checkin_draft"); } catch { }
  };

  const confirmPendingPhoto = async () => {
    if (!pendingPhoto) return;
    const { label, uri } = pendingPhoto;
    const np = { ...photos, [label]: uri };
    setPhotos(np);
    if (errors.photos && np.front && np.back && np.left && np.right) {
      setErrors(prev => ({ ...prev, photos: undefined }));
    }
    try { await AsyncStorage.setItem("checkin_photos", JSON.stringify(np)); } catch { }
    setShowPhotoPreview(false);
    setPendingPhoto(null);
    const idx = REQUIRED_PHOTO_ORDER.indexOf(label);
    if (idx !== -1) {
      const nextLabel = REQUIRED_PHOTO_ORDER.slice(idx + 1).find(l => !np[l]);
      if (nextLabel) {
        takePhoto(nextLabel);
      }
    }
  };

  const retakePendingPhoto = () => {
    const label = pendingPhoto?.label;
    setShowPhotoPreview(false);
    setPendingPhoto(null);
    if (label) takePhoto(label);
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
        } catch { }
      }
      if (urls.length > 0) {
        await api.post(`/cars/${carId}/photos`, { urls, type: "checkin", labels });
      }
    } catch { }
  };

  const submit = async () => {
    const errs = {};
    if (!plate.trim()) errs.plate = "License plate is required";
    else if (!validatePlate(plate.trim())) errs.plate = "Please enter a valid Indian vehicle number plate.";
    if (!color.trim()) errs.color = "Vehicle color is required";
    if (!make.trim()) errs.make = "Vehicle make/model is required";
    if (!guestName.trim()) errs.guestName = "Guest name is required";
    let phoneToSave = "";
    if (guestPhone.trim()) {
      const normalizeIndianPhone = (p) => p.replace(/^(\+91|91|0)/, "").replace(/[\s\-()]/g, "");
      const normalized = normalizeIndianPhone(guestPhone.trim());
      const isValidIndian = /^\d{10}$/.test(normalized);
      const isValidIntl = /^\+\d{10,15}$/.test(guestPhone.trim());
      if (!isValidIndian && !isValidIntl) {
        errs.guestPhone = "Enter a 10-digit Indian number, or an international number starting with + (e.g. +44...)";
      } else {
        phoneToSave = isValidIndian ? normalized : guestPhone.trim();
      }
    }
    let altPhoneToSave = "";
    if (altGuestPhone.trim()) {
      const normalizeIndianPhone = (p) => p.replace(/^(\+91|91|0)/, "").replace(/[\s\-()]/g, "");
      const normalized = normalizeIndianPhone(altGuestPhone.trim());
      const isValidIndian = /^\d{10}$/.test(normalized);
      const isValidIntl = /^\+\d{10,15}$/.test(altGuestPhone.trim());
      if (!isValidIndian && !isValidIntl) {
        errs.altGuestPhone = "Enter a 10-digit Indian number, or an international number starting with +";
      } else {
        altPhoneToSave = isValidIndian ? normalized : altGuestPhone.trim();
      }
    }
    if (!photos.front || !photos.back || !photos.left || !photos.right) errs.photos = "Front, back, left, and right photos are all required";

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    Alert.alert(
      "Confirm Check-In",
      `Confirm check-in for ${plate}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => doSubmit(phoneToSave, altPhoneToSave) }
      ]
    );
  };

  const doSubmit = async (phoneToSave, altPhoneToSave) => {
    setSubmitting(true);
    const photoLocalPaths = { front: null, back: null, left: null, right: null, extra: null };
    try {
      // 1. Copy photos to local storage first for safety
      await Promise.all(Object.entries(photos).map(async ([label, uri]) => {
        if (!uri) return;
        const localPath = `${FileSystem.documentDirectory}checkin_${plate.trim()}_${label}_${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: uri, to: localPath });
        photoLocalPaths[label] = localPath;
      }));

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
          damageTypes,
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
          damage_types: damageTypes,
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
          damage_types: damageTypes,
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
      api.post(`/slots/event/${currentEventId}/initialize`).catch(() => { });
      try { await AsyncStorage.removeItem("checkin_photos"); } catch { }
      try { await AsyncStorage.removeItem("checkin_draft"); } catch { }
      // Start GPS journey tracking from this moment — driver now walks to park the car
      updateJourney(car.id, "checkin").catch(() => { });
      markJourneyAccepted(car.id).catch(() => { });
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
          if (path) FileSystem.deleteAsync(path, { idempotent: true }).catch(() => { });
        });
      });
    } catch (err) {
      console.log("CHECKIN ERROR STATUS:", err.response?.status);
      console.log("CHECKIN ERROR DATA:", JSON.stringify(err.response?.data));
      console.log("CHECKIN ERROR MESSAGE:", err.message);
      const gotServerResponse = !!err.response;
      if (!gotServerResponse) {
        try {
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
            damageTypes,
            guestName: guestName.trim(),
          });
          await AsyncStorage.removeItem("checkin_draft");
          await AsyncStorage.removeItem("checkin_photos");
          Alert.alert("Saved for Retry", "Connection was too slow to confirm. This check-in has been queued and will sync automatically — you don't need to redo it.");
          router.back();
          return;
        } catch {
          Alert.alert("Error", "Could not save this check-in for retry. Please check your connection and try again.");
        }
      } else {
        const msg = err.response?.data?.detail || "Check-in failed";
        const isAlreadyCheckedIn = typeof msg === "string" && msg.includes("already active in this event");
        if (typeof msg === "string" && msg.includes("full")) {
          Alert.alert("Event Full", "No more cars can be checked in.");
        } else if (isAlreadyCheckedIn || (typeof msg === "string" && msg.includes("Duplicate"))) {
          Alert.alert(
            "Already Checked In",
            "This vehicle appears to already be checked in for this event — it may have been created by a previous attempt. Please check the car list before re-submitting.",
          );
        } else {
          Alert.alert("Error", typeof msg === "string" ? msg : "Failed");
        }
        // Clear stale draft so the NEXT check-in doesn't inherit this one's photos/fields
        try { await AsyncStorage.removeItem("checkin_draft"); } catch { }
        try { await AsyncStorage.removeItem("checkin_photos"); } catch { }
        setPhotos({ front: null, back: null, left: null, right: null, extra: null });
      }
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
              Check In Vehicle v2
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
                <Text style={{
                  fontSize: rs(12), fontWeight: "900",
                  color: "#92400E"
                }}>
                  GUEST INSTRUCTIONS
                </Text>
                <Text style={{
                  fontSize: rs(13), color: "#78350F",
                  marginTop: rp(4), lineHeight: 18
                }}>
                  {guestNotes}
                </Text>
              </View>
            </View>
          ) : null}
          <Lbl>LICENSE PLATE *</Lbl>
          <View style={[inputRow, errors.plate && { borderColor: "#EF4444", marginBottom: 0 }]}>
            <Ionicons name="car-outline" size={20} color="#059669" />
            <TextInput
              testID="plate-input"
              value={plate}
              onChangeText={(v) => {
                if (errors.plate) setErrors(prev => ({ ...prev, plate: undefined }));
                const cleaned = v.replace(/[^A-Za-z0-9-]/g, "").toUpperCase();
                setPlate(cleaned);
                if (cleaned === "") {
                  setPendingLookup(null);
                  setPlateLookedUp(false);
                  if (lookupApplied) {
                    setMake("");
                    setColor("");
                    setGuestName("");
                    setGuestPhone("");
                    setAltGuestPhone("");
                    setCarType("normal");
                    setLookupApplied(false);
                  }
                }
              }}
              onBlur={() => lookupPlate(plate.trim().toUpperCase())}
              placeholder="GJ01AB1234"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              maxLength={10}
              style={textInput}
            />
          </View>
          {errors.plate && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.plate}</Text>}
          {pendingLookup && (
            <View style={{ backgroundColor: "#ECFDF5", borderWidth: rp(1), borderColor: "#6EE7B7", borderRadius: rp(16), padding: rp(12), marginBottom: rp(16) }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: rp(10) }}>
                <Ionicons name="help-circle" size={20} color="#059669" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: rs(12), fontWeight: "900", color: "#059669" }}>PREVIOUS VISIT FOUND</Text>
                  <Text style={{ fontSize: rs(11), color: "#065F46", marginTop: rp(1) }}>
                    {pendingLookup.guest_name ? `${pendingLookup.guest_name} — ` : ""}Use these saved details?
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: rp(12), marginTop: rp(10) }}>
                <TouchableOpacity onPress={confirmLookup} style={{ backgroundColor: "#059669", borderRadius: rp(10), paddingVertical: rp(6), paddingHorizontal: rp(14) }}>
                  <Text style={{ fontSize: rs(12), fontWeight: "800", color: "#fff" }}>Use These Details</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={rejectLookup} style={{ paddingVertical: rp(6), paddingHorizontal: rp(4) }}>
                  <Text style={{ fontSize: rs(12), fontWeight: "800", color: "#6B7280" }}>Not This Guest</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {lookupApplied && !pendingLookup && (
            <View style={{ marginBottom: rp(16) }}>
              <Text style={{ fontSize: rs(11), color: "#059669", marginBottom: rp(8) }}>
                ✓ Details filled from previous visit
              </Text>
              <TouchableOpacity
                onPress={clearGuestOnly}
                style={{
                  borderWidth: rp(1),
                  borderColor: "#FCA5A5",
                  backgroundColor: "#FEF2F2",
                  borderRadius: rp(10),
                  paddingVertical: rp(8),
                  paddingHorizontal: rp(14),
                  alignSelf: "flex-start",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: rp(6),
                }}
              >
                <Ionicons name="person-remove-outline" size={14} color="#DC2626" />
                <Text style={{ fontSize: rs(12), fontWeight: "800", color: "#DC2626" }}>
                  Not this guest? Clear name &amp; phone
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <Lbl>GUEST NAME *</Lbl>
          <View style={[inputRow, errors.guestName && { borderColor: "#EF4444", marginBottom: 0 }]}>
            <Ionicons name="person-outline" size={20} color="#059669" />
            <TextInput value={guestName} onChangeText={(text) => { setGuestName(text); if (errors.guestName) setErrors(prev => ({ ...prev, guestName: undefined })); }} placeholder="Guest Name" placeholderTextColor="#9CA3AF" style={textInput} />
          </View>
          {errors.guestName && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.guestName}</Text>}
          <Lbl>COLOR</Lbl>
          <View style={[inputRow, errors.color && { borderColor: "#EF4444", marginBottom: 0 }]}>
            <Ionicons name="color-palette-outline" size={20} color="#059669" />
            <TextInput value={color} onChangeText={(text) => { setColor(text); if (errors.color) setErrors(prev => ({ ...prev, color: undefined })); }} placeholder="Black" placeholderTextColor="#9CA3AF" style={textInput} />
          </View>
          {errors.color && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.color}</Text>}
          <Lbl>MAKE / MODEL</Lbl>
          <View style={[inputRow, errors.make && { borderColor: "#EF4444", marginBottom: 0 }]}>
            <Ionicons name="construct-outline" size={20} color="#059669" />
            <TextInput value={make} onChangeText={(text) => { setMake(text); if (errors.make) setErrors(prev => ({ ...prev, make: undefined })); }} placeholder="Honda Civic" placeholderTextColor="#9CA3AF" style={textInput} />
          </View>
          {errors.make && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.make}</Text>}
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
              <Lbl>SELECT DAMAGE TYPE (TAP ALL THAT APPLY)</Lbl>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: rp(8), marginBottom: rp(16) }}>
                {DAMAGE_OPTIONS.map((opt) => {
                  const selected = damageTypes.includes(opt);
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setDamageTypes(prev => selected ? prev.filter(t => t !== opt) : [...prev, opt])}
                      style={{ paddingHorizontal: rp(14), paddingVertical: rp(8), borderRadius: rp(99), backgroundColor: selected ? "#059669" : "#fff", borderWidth: rp(1), borderColor: "#059669" }}
                    >
                      <Text style={{ fontSize: rs(12), fontWeight: "800", color: selected ? "#fff" : "#059669", letterSpacing: rs(0.5) }}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  onPress={() => setShowOtherDamage(!showOtherDamage)}
                  style={{ paddingHorizontal: rp(14), paddingVertical: rp(8), borderRadius: rp(99), backgroundColor: showOtherDamage ? "#059669" : "#fff", borderWidth: rp(1), borderColor: "#059669" }}
                >
                  <Text style={{ fontSize: rs(12), fontWeight: "800", color: showOtherDamage ? "#fff" : "#059669", letterSpacing: rs(0.5) }}>Other</Text>
                </TouchableOpacity>
              </View>
              {showOtherDamage && (
                <>
                  <Lbl>OTHER DAMAGE (DESCRIBE)</Lbl>
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
            </>
          )}
          <Text style={{ fontSize: rs(11), color: "#6B7280", marginBottom: rp(6) }}>Mobile number is optional — guest can scan the QR instead.</Text>
          <Lbl>GUEST MOBILE (OPTIONAL)</Lbl>
          <View style={[inputRow, errors.guestPhone && { borderColor: "#EF4444", marginBottom: 0 }]}>
            <Ionicons name="phone-portrait-outline" size={20} color="#059669" />
            <TextInput
              value={guestPhone}
              onChangeText={(text) => { setGuestPhone(text); if (errors.guestPhone) setErrors(prev => ({ ...prev, guestPhone: undefined })); }}
              placeholder="10-digit mobile number"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              maxLength={10}
              style={textInput}
            />
          </View>
          {errors.guestPhone && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.guestPhone}</Text>}
          <Lbl>ALTERNATE MOBILE (OPTIONAL)</Lbl>
          <View style={[inputRow, errors.altGuestPhone && { borderColor: "#EF4444", marginBottom: 0 }]}>
            <Ionicons name="phone-portrait-outline" size={20} color="#059669" />
            <TextInput
              value={altGuestPhone}
              onChangeText={(text) => { setAltGuestPhone(text); if (errors.altGuestPhone) setErrors(prev => ({ ...prev, altGuestPhone: undefined })); }}
              placeholder="10-digit mobile number"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              maxLength={10}
              style={textInput}
            />
          </View>
          {errors.altGuestPhone && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.altGuestPhone}</Text>}

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
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: rp(10), marginBottom: errors.photos ? 0 : rp(16), borderWidth: errors.photos ? rp(1) : 0, borderColor: "#EF4444", borderRadius: rp(16), padding: errors.photos ? rp(8) : 0 }}>
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
          {errors.photos && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.photos}</Text>}

          <Modal visible={showPhotoPreview} transparent animationType="fade">
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", padding: rp(20) }}>
              <View style={{ backgroundColor: "#fff", borderRadius: rp(20), padding: rp(16), width: "100%" }}>
                <Text style={{ fontSize: rs(14), fontWeight: "900", color: "#111827", marginBottom: rp(12), textTransform: "uppercase", textAlign: "center" }}>
                  {pendingPhoto?.label} Photo
                </Text>
                {pendingPhoto && (
                  <Image source={{ uri: pendingPhoto.uri }} style={{ width: "100%", height: rp(280), borderRadius: rp(16), marginBottom: rp(16) }} resizeMode="cover" />
                )}
                <View style={{ flexDirection: "row", gap: rp(10) }}>
                  <TouchableOpacity onPress={retakePendingPhoto} style={{ flex: 1, paddingVertical: rp(14), borderRadius: rp(14), borderWidth: rp(1), borderColor: "#059669", alignItems: "center" }}>
                    <Text style={{ color: "#059669", fontWeight: "800" }}>Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={confirmPendingPhoto} style={{ flex: 1, paddingVertical: rp(14), borderRadius: rp(14), backgroundColor: "#059669", alignItems: "center" }}>
                    <Text style={{ color: "#fff", fontWeight: "800" }}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

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
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(15), letterSpacing: rs(2) }}>CHECK IN VEHICLE v2</Text>}
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


