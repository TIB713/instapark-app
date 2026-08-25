import React, { useState, useRef, useCallback, memo, useEffect } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  StyleSheet, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { Modal as RNModal } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { startLocationTracking, updateJourney, LOCATION_TASK_NAME } from "../../../lib/locationTracking";

import api from "../../../lib/api";
import { useAppStore } from "../../../lib/store";
import { useDriverTasksContext } from "../../../context/DriverTasksContext";
import { confirmDialog } from "../../../lib/confirmDialog";
import { enqueueCheckinAction, enqueuePhotoAttach } from "../../../lib/offline";
import { Screen, TopBar, Btn, Modal, EmptyState } from "../../../components/valet/ui";
import AlreadyCheckedInModal from "../../../components/valet/AlreadyCheckedInModal";
import Heading from "../../../components/Heading";
import { theme } from "../../../utils/theme";
import { rs, rp } from "../../../utils/responsive";
import { scrollToFirstError } from "../../../lib/scrollToFirstError";

const REQUIRED_PHOTO_COUNT = 2;
const PHOTO_LABELS = ["front", "right", "back", "left", "extra"];

const validatePlate = (plate) => {
  const cleaned = plate.replace(/[-\s]/g, "").toUpperCase();
  const standard = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}$/.test(cleaned);
  const bharat = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/.test(cleaned);
  return standard || bharat;
};

const DAMAGE_OPTIONS = [
  "Front Bumper Scratch", "Rear Bumper Scratch", "Front Bumper Dent",
  "Rear Bumper Dent", "Left Door Scratch", "Right Door Scratch",
  "Side Mirror Damage", "Windshield Crack", "Headlight Damage",
  "Taillight Damage", "Wheel Rim Scratch",
];

function Lbl({ children }) {
  return (
    <Text style={{ fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(3), marginBottom: rp(8), marginTop: rp(4) }}>
      {children}
    </Text>
  );
}

const inputRow = {
  backgroundColor: theme.colors.surface,
  borderRadius: rp(16),
  borderWidth: rp(1),
  borderColor: theme.colors.border,
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
  color: theme.colors.textPrimary,
};

const PhotoGridSection = memo(({ photos, errors, takePhoto, onRemovePhoto }) => {
  return (
    <View style={{ marginBottom: 20 }}>
      <Lbl>VEHICLE PHOTOS * (AT LEAST 2 REQUIRED)</Lbl>
      <View style={{ 
        flexDirection: "row", flexWrap: "wrap", gap: rp(10), 
        borderWidth: errors.photos ? rp(1) : 0, 
        borderColor: theme.colors.danger, 
        borderRadius: rp(16), 
        padding: errors.photos ? rp(8) : 0,
        marginBottom: errors.photos ? 0 : rp(16)
      }}>
        {PHOTO_LABELS.map((label) => (
          <View key={label} style={{ width: rp(80), height: rp(80) }}>
            {photos[label] ? (
              <>
                <Image source={{ uri: photos[label] }} style={{ width: rp(80), height: rp(80), borderRadius: rp(16), borderWidth: rp(1.5), borderColor: theme.colors.success, borderStyle: "dashed" }} />
                <TouchableOpacity
                  onPress={() => onRemovePhoto(label)}
                  style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: rp(99), padding: rp(2) }}
                >
                  <Ionicons name="close-circle" size={24} color={theme.colors.danger} />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={() => takePhoto(label)}
                style={{
                  width: rp(80), height: rp(80), borderRadius: rp(16),
                  backgroundColor: theme.colors.surface, borderWidth: rp(1.5), borderColor: theme.colors.border,
                  borderStyle: "dashed", alignItems: "center", justifyContent: "center"
                }}
              >
                <Ionicons name="camera-outline" size={28} color={theme.colors.textSecondary} />
                <Text style={{ color: theme.colors.textSecondary, fontSize: rs(10), fontWeight: "800", marginTop: rp(4), textTransform: "uppercase" }}>{label}</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
      {errors.photos && <Text style={{ color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(4) }}>* {errors.photos}</Text>}
    </View>
  );
});

const VehicleDetailsSection = memo(({
  plate, setPlate, guestName, setGuestName, color, setColor, make, setMake, carType, setCarType, notes, setNotes, errors, setErrors, instantPark, eventAllowsInstantPark, fieldRefs
}) => {
  return (
    <>
      <Lbl>LICENSE PLATE *</Lbl>
      <View ref={el => { if (fieldRefs.current) fieldRefs.current.plate = el; }}  style={[inputRow, errors.plate && { borderColor: theme.colors.danger, marginBottom: 0 }]}>
        <Ionicons name="car-outline" size={20} color={theme.colors.primary} />
        <TextInput
          testID="plate-input"
          value={plate}
          onChangeText={(v) => {
            if (errors.plate) setErrors(prev => ({ ...prev, plate: undefined }));
            const cleaned = v.replace(/[^A-Za-z0-9-]/g, "").toUpperCase();
            setPlate(cleaned);
          }}
          placeholder="GJ01AB1234"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="characters"
          maxLength={11}
          style={textInput}
        />
      </View>
      {errors.plate && <Text style={{ color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.plate}</Text>}
      
      <Lbl>{instantPark && eventAllowsInstantPark ? "GUEST NAME (OPTIONAL)" : "GUEST NAME *"}</Lbl>
      <View ref={el => { if (fieldRefs.current) fieldRefs.current.guestName = el; }}  style={[inputRow, errors.guestName && { borderColor: theme.colors.danger, marginBottom: 0 }]}>
        <Ionicons name="person-outline" size={20} color={theme.colors.primary} />
        <TextInput value={guestName} onChangeText={(text) => { setGuestName(text); if (errors.guestName) setErrors(prev => ({ ...prev, guestName: undefined })); }} placeholder="Guest Name" placeholderTextColor={theme.colors.textMuted} style={textInput} />
      </View>
      {errors.guestName && <Text style={{ color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.guestName}</Text>}
      
      <Lbl>{eventAllowsInstantPark && instantPark ? "VEHICLE COLOR (OPTIONAL)" : "VEHICLE COLOR *"}</Lbl>
      <View ref={el => { if (fieldRefs.current) fieldRefs.current.color = el; }}  style={[inputRow, errors.color && { borderColor: theme.colors.danger, marginBottom: 0 }]}>
        <Ionicons name="color-palette-outline" size={20} color={theme.colors.primary} />
        <TextInput value={color} onChangeText={(text) => { setColor(text); if (errors.color) setErrors(prev => ({ ...prev, color: undefined })); }} placeholder="Black" placeholderTextColor={theme.colors.textMuted} style={textInput} />
      </View>
      {errors.color && <Text style={{ color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.color}</Text>}
      
      <Lbl>{eventAllowsInstantPark && instantPark ? "VEHICLE MAKE/MODEL (OPTIONAL)" : "VEHICLE MAKE/MODEL *"}</Lbl>
      <View ref={el => { if (fieldRefs.current) fieldRefs.current.make = el; }}  style={[inputRow, errors.make && { borderColor: theme.colors.danger, marginBottom: 0 }]}>
        <Ionicons name="construct-outline" size={20} color={theme.colors.primary} />
        <TextInput value={make} onChangeText={(text) => { setMake(text); if (errors.make) setErrors(prev => ({ ...prev, make: undefined })); }} placeholder="Honda Civic" placeholderTextColor={theme.colors.textMuted} style={textInput} />
      </View>
      {errors.make && <Text style={{ color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.make}</Text>}
      
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
              backgroundColor: carType === ct ? theme.colors.primary : "#FFFFFF",
              borderWidth: rp(1),
              borderColor: theme.colors.primary,
            }}
          >
            <Text style={{ fontSize: rs(12), fontWeight: "800", color: carType === ct ? "#FFFFFF" : theme.colors.textSecondary, letterSpacing: rs(0.5), textTransform: "capitalize" }}>{ct}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Lbl>NOTES</Lbl>
      <View style={[inputRow, { alignItems: "flex-start", paddingTop: rp(12) }]}>
        <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} />
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Special notes..."
          placeholderTextColor={theme.colors.textMuted}
          style={[textInput, { minHeight: 60, textAlignVertical: "top" }]}
        />
      </View>
    </>
  );
});

const DamageSection = memo(({ hasDamage, setHasDamage, damageTypes, setDamageTypes, damageNotes, setDamageNotes, showOtherDamage, setShowOtherDamage }) => {
  return (
    <>
      <Lbl>EXISTING SCRATCH / DAMAGE?</Lbl>
      <View style={{ flexDirection: "row", gap: rp(8), marginBottom: rp(16) }}>
        <TouchableOpacity onPress={() => setHasDamage(true)} style={{ paddingHorizontal: rp(14), paddingVertical: rp(8), borderRadius: rp(99), backgroundColor: hasDamage ? theme.colors.primary : "#FFFFFF", borderWidth: rp(1), borderColor: theme.colors.primary }}>
          <Text style={{ fontSize: rs(12), fontWeight: "800", color: hasDamage ? "#FFFFFF" : theme.colors.textSecondary, letterSpacing: rs(0.5) }}>Yes</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setHasDamage(false)} style={{ paddingHorizontal: rp(14), paddingVertical: rp(8), borderRadius: rp(99), backgroundColor: !hasDamage ? theme.colors.primary : "#FFFFFF", borderWidth: rp(1), borderColor: theme.colors.primary }}>
          <Text style={{ fontSize: rs(12), fontWeight: "800", color: !hasDamage ? "#FFFFFF" : theme.colors.textSecondary, letterSpacing: rs(0.5) }}>No</Text>
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
                  style={{ paddingHorizontal: rp(14), paddingVertical: rp(8), borderRadius: rp(99), backgroundColor: selected ? theme.colors.primary : "#FFFFFF", borderWidth: rp(1), borderColor: theme.colors.primary }}
                >
                  <Text style={{ fontSize: rs(12), fontWeight: "800", color: selected ? "#FFFFFF" : theme.colors.textSecondary, letterSpacing: rs(0.5) }}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              onPress={() => setShowOtherDamage(!showOtherDamage)}
              style={{ paddingHorizontal: rp(14), paddingVertical: rp(8), borderRadius: rp(99), backgroundColor: showOtherDamage ? theme.colors.primary : "#FFFFFF", borderWidth: rp(1), borderColor: theme.colors.primary }}
            >
              <Text style={{ fontSize: rs(12), fontWeight: "800", color: showOtherDamage ? "#FFFFFF" : theme.colors.textSecondary, letterSpacing: rs(0.5) }}>Other</Text>
            </TouchableOpacity>
          </View>
          {showOtherDamage && (
            <>
              <Lbl>OTHER DAMAGE (DESCRIBE)</Lbl>
              <View style={[inputRow, { alignItems: "flex-start", paddingTop: rp(12) }]}>
                <Ionicons name="alert-circle-outline" size={20} color={theme.colors.primary} />
                <TextInput
                  value={damageNotes}
                  onChangeText={setDamageNotes}
                  multiline
                  placeholder="Describe scratches, dents, etc..."
                  placeholderTextColor={theme.colors.textMuted}
                  style={[textInput, { minHeight: 60, textAlignVertical: "top" }]}
                />
              </View>
            </>
          )}
        </>
      )}
    </>
  );
});

const GuestContactSection = memo(({ guestPhone, setGuestPhone, altGuestPhone, setAltGuestPhone, errors, setErrors, instantPark, eventAllowsInstantPark, fieldRefs }) => {
  return (
    <>
      <Lbl>{instantPark && eventAllowsInstantPark ? "GUEST MOBILE (OPTIONAL)" : "GUEST MOBILE *"}</Lbl>
      <View ref={el => { if (fieldRefs.current) fieldRefs.current.guestPhone = el; }}  style={[inputRow, errors.guestPhone && { borderColor: theme.colors.danger, marginBottom: 0 }]}>
        <Ionicons name="phone-portrait-outline" size={20} color={theme.colors.primary} />
        <TextInput
          value={guestPhone}
          onChangeText={(text) => { setGuestPhone(text); if (errors.guestPhone) setErrors(prev => ({ ...prev, guestPhone: undefined })); }}
          placeholder="10-digit mobile number"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="phone-pad"
          maxLength={10}
          style={textInput}
        />
      </View>
      {errors.guestPhone && <Text style={{ color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.guestPhone}</Text>}
      <Lbl>ALTERNATE MOBILE (OPTIONAL)</Lbl>
      <View ref={el => { if (fieldRefs.current) fieldRefs.current.altGuestPhone = el; }}  style={[inputRow, errors.altGuestPhone && { borderColor: theme.colors.danger, marginBottom: 0 }]}>
        <Ionicons name="phone-portrait-outline" size={20} color={theme.colors.primary} />
        <TextInput
          value={altGuestPhone}
          onChangeText={(text) => { setAltGuestPhone(text); if (errors.altGuestPhone) setErrors(prev => ({ ...prev, altGuestPhone: undefined })); }}
          placeholder="10-digit mobile number"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="phone-pad"
          maxLength={10}
          style={textInput}
        />
      </View>
      {errors.altGuestPhone && <Text style={{ color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.altGuestPhone}</Text>}
    </>
  );
});

const EntryGateSection = memo(({ eventGates, selectedGate, setSelectedGate }) => {
  if (eventGates.length === 0) return null;
  return (
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
              backgroundColor: selectedGate === g ? theme.colors.primary : "#FFFFFF",
              borderWidth: rp(1),
              borderColor: theme.colors.primary,
            }}
          >
            <Text style={{ fontSize: rs(12), fontWeight: "800", color: selectedGate === g ? "#FFFFFF" : theme.colors.textSecondary, letterSpacing: rs(0.5) }}>{g}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );
});

export default function Checkin() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { currentEventId, driver } = useAppStore();
  const { openParkModal } = useDriverTasksContext();
  const scrollViewRef = useRef(null);
  const fieldRefs = useRef({});
  
  const [qrToken, setQrToken] = useState("");
  const [keyTagNumber, setKeyTagNumber] = useState("");
  const [qrCardId, setQrCardId] = useState("");

  const [permission, requestPermission] = useCameraPermissions();
  const [scanComplete, setScanComplete] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const scanned = useRef(false);
  const lastScannedValue = useRef(null);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(null);
  
  let tabBarHeight = 0;
  try {
    tabBarHeight = useBottomTabBarHeight();
  } catch (e) {}
  
  const [plate, setPlate] = useState("");
  const [color, setColor] = useState("");
  const [make, setMake] = useState("");
  const [notes, setNotes] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [eventGates, setEventGates] = useState([]);
  const [selectedGate, setSelectedGate] = useState("");
  const [carType, setCarType] = useState("normal");
  const [altGuestPhone, setAltGuestPhone] = useState("");
  const [hasDamage, setHasDamage] = useState(false);
  const [damageNotes, setDamageNotes] = useState("");
  const [damageTypes, setDamageTypes] = useState([]);
  const [showOtherDamage, setShowOtherDamage] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [eventAllowsInstantPark, setEventAllowsInstantPark] = useState(false);
  const [instantPark, setInstantPark] = useState(false);

  const [photos, setPhotos] = useState({ front: null, back: null, left: null, right: null, extra: null });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successCar, setSuccessCar] = useState(null);

  const permissionGrantedRef = useRef(false);

  const resizedPhotosRef = useRef({});
  const resizeQueueRef = useRef(Promise.resolve());
  const uploadPromisesRef = useRef({});
  const [nextPhotoLabel, setNextPhotoLabel] = useState(null);

  useFocusEffect(
    useCallback(() => {
      if (params.prefill_qr_token) {
        setQrToken(params.prefill_qr_token);
      }
      if (params.prefill_key_tag_number) {
        setKeyTagNumber(params.prefill_key_tag_number);
      }
      if (params.prefill_qr_card_id) {
        setQrCardId(params.prefill_qr_card_id);
      }
    }, [params.prefill_qr_token, params.prefill_key_tag_number, params.prefill_qr_card_id])
  );

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/events/${currentEventId}`);
        setEventGates(data.gates || []);
        if (data.gates?.[0]) setSelectedGate(data.gates[0]);
        setEventAllowsInstantPark(!!data.allow_instant_park);
      } catch {}
    })();
  }, [currentEventId]);

  useEffect(() => {
    if (permission && !permission.granted) { 
      requestPermission(); 
    } 
  }, [permission]); 

  const handleScan = useCallback(async (result) => {
    if (scanned.current) return;
    if (result.data === lastScannedValue.current) return;

    scanned.current = true;
    lastScannedValue.current = result.data;
    setScanComplete(true);
    setScanLoading(true);

    try {
      const { data } = result;
      let token = data;
      if (data.includes("/qr-redirect/")) {
        token = data.split("/qr-redirect/")[1].split("?")[0].trim();
      } else if (data.includes("/v/")) {
        token = data.split("/v/")[1].split("?")[0].trim();
      } else if (data.includes("/pass/")) {
        confirmDialog.info(
          "Not a key-tag card",
          "This QR is a pre-registration pass, not a vehicle key-tag.",
          () => { setScanComplete(false); setScanLoading(false); scanned.current = false; lastScannedValue.current = null; }
        );
        return;
      }

      const { data: card } = await api.get(`/qr-cards/lookup/${token}?event_id=${currentEventId}&include_bound=true`);

      if (card.status && card.status !== "empty") {
        setAlreadyCheckedIn(card);
        return;
      }

      setQrToken(card.qr_token);
      setKeyTagNumber(card.key_tag_number);
      setQrCardId(card.id);
    } catch (err) {
      const msg = err.response?.data?.detail || "Could not verify QR card";
      confirmDialog.confirm("Invalid QR", msg, () => { setScanComplete(false); setScanLoading(false); scanned.current = false; lastScannedValue.current = null; });
    } finally {
      setScanLoading(false);
    }

    setTimeout(() => {
      scanned.current = false;
    }, 2000);
  }, [currentEventId]);

  const cancelScan = () => {
    setQrToken("");
    setKeyTagNumber("");
    setQrCardId("");
    setPhotos({ front: null, back: null, left: null, right: null, extra: null });
    setPlate("");
    setColor("");
    setMake("");
    setNotes("");
    setGuestPhone("");
    setSelectedGate(eventGates[0] || "");
    setCarType("normal");
    setAltGuestPhone("");
    setHasDamage(false);
    setDamageNotes("");
    setDamageTypes([]);
    setShowOtherDamage(false);
    setGuestName("");
    setInstantPark(false);
    setErrors({});
    setNextPhotoLabel(null);
  };

  const takePhoto = useCallback(async (label) => {
    if (!permissionGrantedRef.current) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { 
        confirmDialog.info("Camera permission needed", ""); 
        return; 
      }
      permissionGrantedRef.current = true;
    }
    
    const result = await ImagePicker.launchCameraAsync({ 
      quality: 0.7, 
      allowsEditing: false, 
      mediaTypes: ImagePicker.MediaTypeOptions.Images 
    });
    
    if (!result.canceled) {
      const rawUri = result.assets[0].uri;
      setPhotos(prev => {
        const next = { ...prev, [label]: rawUri };
        if (errors.photos && Object.values(next).filter(Boolean).length >= REQUIRED_PHOTO_COUNT) {
          setErrors(e => ({ ...e, photos: undefined }));
        }

        const currentIndex = PHOTO_LABELS.indexOf(label);
        const remaining = PHOTO_LABELS.slice(currentIndex + 1);
        const nextLabel = remaining.find(l => !next[l] && l !== label);
        if (nextLabel) {
          setNextPhotoLabel(nextLabel);
        }

        return next;
      });

      resizeQueueRef.current = resizeQueueRef.current.then(() =>
        ImageManipulator.manipulateAsync(rawUri, [{ resize: { width: 1280 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG })
          .then((resized) => { resizedPhotosRef.current[label] = resized.uri; })
          .catch(() => { resizedPhotosRef.current[label] = rawUri; })
      );

      uploadPromisesRef.current[label] = (async () => {
        await resizeQueueRef.current.catch(() => {});
        const uri = resizedPhotosRef.current[label] || rawUri;
        const fd = new FormData();
        fd.append("file", { uri, type: "image/jpeg", name: "photo.jpg" });
        fd.append("folder", `checkin/temp_${Date.now()}`); // temp until actual id is returned from server
        const up = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 30000 });
        return up.data.url;
      })();
    }
  }, [errors.photos]);

  const onRemovePhoto = useCallback((label) => {
    setPhotos(prev => ({ ...prev, [label]: null }));
    delete uploadPromisesRef.current[label];
    delete resizedPhotosRef.current[label];
  }, []);

  const submit = async () => {
    setSubmitting(true);
    const errs = {};
    if (!plate.trim()) errs.plate = "License plate is required";
    else if (!validatePlate(plate.trim())) errs.plate = "Please enter a valid Indian vehicle number plate.";
    if (!color.trim() && !(eventAllowsInstantPark && instantPark)) errs.color = "Vehicle color is required";
    if (!make.trim() && !(eventAllowsInstantPark && instantPark)) errs.make = "Vehicle make/model is required";
    const skipGuestDetails = eventAllowsInstantPark && instantPark;
    if (!skipGuestDetails && !guestName.trim()) errs.guestName = "Guest name is required";
    
    let phoneToSave = "";
    if (!skipGuestDetails && !guestPhone.trim()) errs.guestPhone = "Guest mobile number is required";
    else if (guestPhone.trim()) {
      const normalizeIndianPhone = (p) => p.replace(/^(\+91|91|0)/, "").replace(/[\s\-()]/g, "");
      const normalized = normalizeIndianPhone(guestPhone.trim());
      const isValidIndian = /^\d{10}$/.test(normalized);
      const isValidIntl = /^\+\d{10,15}$/.test(guestPhone.trim());
      if (!isValidIndian && !isValidIntl) {
        errs.guestPhone = "Enter a 10-digit Indian number, or an international number starting with +";
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

    const validPhotosCount = Object.values(photos).filter(Boolean).length;
    if (validPhotosCount < REQUIRED_PHOTO_COUNT) {
      errs.photos = `Please upload at least ${REQUIRED_PHOTO_COUNT} photos.`;
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setSubmitting(false);
      scrollToFirstError(['plate', 'color', 'make', 'guestName', 'guestPhone', 'altGuestPhone', 'photos'], errs, fieldRefs, scrollViewRef);
      return;
    }

    confirmDialog.confirm(
      "Confirm check-in",
      `Confirm check-in for ${plate}?`,
      () => {
        doSubmit(phoneToSave, altPhoneToSave);
      },
      () => {
        setSubmitting(false);
      }
    );
  };

  const doSubmit = async (phoneToSave, altPhoneToSave) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      const entries = Object.entries(photos).filter(([, uri]) => !!uri);
      
      const photoLocalPaths = { front: null, back: null, left: null, right: null, extra: null };
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        await Promise.all(Object.entries(photos).map(async ([label, uri]) => {
          if (!uri) return;
          const localPath = `${FileSystem.documentDirectory}checkin_${plate.trim().toUpperCase()}_${label}_${Date.now()}.jpg`;
          await FileSystem.copyAsync({ from: uri, to: localPath });
          photoLocalPaths[label] = localPath;
        }));
        
        await enqueueCheckinAction({
            eventId: currentEventId,
            qr_token: qrToken,
            qr_card_id: qrCardId,
            plate: plate.trim().toUpperCase(),
            color: color.trim(),
            make: make.trim(),
            notes: notes.trim(),
            gate: selectedGate,
            guestPhone: phoneToSave,
            isPreRegistered: false,
            carType,
            altGuestPhone: altPhoneToSave || null,
            hasDamage,
            damageNotes: damageNotes.trim() || null,
            damageTypes,
            guestName: guestName.trim(),
            instantPark: eventAllowsInstantPark && instantPark,
            photoLocalPaths,
            photos: []
        });
        
        setSuccessCar({ plate: plate.trim().toUpperCase(), checkin_code: "SYNC", id: "offline" });
        setShowSuccessModal(true);
        
        const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
        if (!running) {
          const started = await startLocationTracking();
          if (!started) {
            confirmDialog.info(
              "Location permission needed",
              "InstaPark couldn't start sharing your location. Your supervisor won't be able to see you on the map. Please enable location permission for this app in your device settings."
            );
          }
        }
        await updateJourney("offline", "checkin");
        
        return;
      }

      const payload = {
        qr_token: qrToken || undefined,
        qr_card_id: qrCardId || undefined,
        plate: plate.trim().toUpperCase(),
        color: color.trim(),
        make: make.trim(),
        notes: notes.trim(),
        gate: selectedGate,
        event_id: currentEventId,
        guest_phone: phoneToSave || null,
        guest_name: guestName.trim() || null,
        is_pre_registered: false,
        car_type: carType,
        alt_guest_phone: altPhoneToSave || null,
        has_damage: hasDamage,
        damage_notes: damageNotes.trim() || null,
        damage_types: damageTypes,
        instant_park: eventAllowsInstantPark && instantPark,
      };

      const { data: car } = await api.post("/cars", payload, { timeout: 30000 });
      
      setSuccessCar(car);
      setShowSuccessModal(true);
      
      const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
      if (!running) {
        const started = await startLocationTracking();
        if (!started) {
          confirmDialog.info(
            "Location permission needed",
            "InstaPark couldn't start sharing your location. Your supervisor won't be able to see you on the map. Please enable location permission for this app in your device settings."
          );
        }
      }
      await updateJourney(car.id, "checkin");
      
      // Decoupled Background Photo Upload
      (async () => {
        try {
          const results = await Promise.allSettled(entries.map(async ([label]) => {
            const url = await uploadPromisesRef.current[label];
            return { label, url };
          }));
          
          const urls = [];
          const successLabels = [];
          const failedLabels = [];
          
          results.forEach((r, idx) => {
            if (r.status === "fulfilled") {
              urls.push(r.value.url);
              successLabels.push(entries[idx][0]);
            } else {
              failedLabels.push(entries[idx][0]);
            }
          });
          
          if (urls.length > 0) {
            await api.post(`/cars/${car.id}/photos`, { urls, type: "checkin", labels: successLabels }, { timeout: 30000 });
          }
          
          if (failedLabels.length > 0) {
            throw new Error("Some photos failed to upload initially");
          }
        } catch (bgErr) {
          // Fallback to queueing for retry
          try {
            const localPaths = {};
            const labelsToQueue = [];
            await Promise.all(entries.map(async ([label, uri]) => {
              if (!uri) return;
              const localPath = `${FileSystem.documentDirectory}checkin_retry_${car.id}_${label}_${Date.now()}.jpg`;
              await FileSystem.copyAsync({ from: uri, to: localPath });
              localPaths[label] = localPath;
              labelsToQueue.push(label);
            }));
            
            await enqueuePhotoAttach(car.id, { photoLocalPaths: localPaths, labels: labelsToQueue });
          } catch (qErr) {
            console.warn("Failed to enqueue photo attach fallback", qErr);
          }
        }
      })();

    } catch (e) {
      confirmDialog.info("Error", e.response?.data?.detail || "Could not complete check-in. Please try again.");
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleDone = () => {
    setShowSuccessModal(false);
    setSuccessCar(null);
    cancelScan();
  };

  const handlePark = () => {
    const carToPark = successCar;
    setShowSuccessModal(false);
    setSuccessCar(null);
    cancelScan();
    if (carToPark && carToPark.id !== "offline") {
      openParkModal(carToPark);
      router.push("/(driver)/(tabs)/park");
    }
  };

  if (!currentEventId) {
    return (
      <Screen scroll={false}>
        <TopBar title="Check In Vehicle" />
        <EmptyState
          icon={<Ionicons name="calendar-outline" size={64} color={theme.colors.textMuted} />}
          title="No event selected"
          body="Select an event from your Profile before checking in cars."
          cta={<Btn onPress={() => router.push('/(driver)/(tabs)/profile')}>Go to Profile</Btn>}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: theme.colors.surface }} />
      <TopBar title="Check In" hideBack />
      
      {!qrToken ? (
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {(!permission || !permission.granted) ? (
            <View style={{ flex: 1, backgroundColor: theme.colors.primary, justifyContent: "center", alignItems: "center", padding: rp(24) }}> 
              <Ionicons name="camera-outline" size={64} color="#fff" /> 
              <Text style={{ color: "#fff", fontSize: rs(18), fontWeight: "900", marginTop: rp(16), textAlign: "center" }}> 
                Camera Permission Required 
              </Text> 
              <Text style={{ color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: rp(8), marginBottom: rp(24) }}> 
                Camera access is needed to scan key-tag QR cards. 
              </Text> 
              <TouchableOpacity onPress={requestPermission} 
                style={{ backgroundColor: theme.colors.success, borderRadius: rp(16), paddingVertical: rp(14), paddingHorizontal: rp(32) }}> 
                <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2) }}>GRANT PERMISSION</Text> 
              </TouchableOpacity> 
            </View> 
          ) : (
            <CameraView 
              style={{ flex: 1 }} 
              facing="back" 
              onBarcodeScanned={scanComplete ? undefined : handleScan} 
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }} 
            > 
              <View style={styles.overlay}> 
                <View style={styles.topOverlay} /> 
                <View style={{ flexDirection: "row" }}> 
                  <View style={styles.sideOverlay} /> 
                  <View style={styles.scanBox}> 
                    <View style={[styles.corner, styles.topLeft]} /> 
                    <View style={[styles.corner, styles.topRight]} /> 
                    <View style={[styles.corner, styles.bottomLeft]} /> 
                    <View style={[styles.corner, styles.bottomRight]} /> 
                    <View style={styles.laserLine} />
                  </View> 
                  <View style={styles.sideOverlay} /> 
                </View> 
                <View style={[styles.bottomOverlay, { paddingBottom: tabBarHeight }]}> 
                  {scanLoading ? ( 
                    <ActivityIndicator color="#fff" size="large" /> 
                  ) : ( 
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: rs(14), textAlign: "center", paddingHorizontal: rp(24) }}> 
                      Point camera at the key-tag QR card
                    </Text> 
                  )} 
                  {scanComplete && !scanLoading && (
                    <TouchableOpacity
                      onPress={() => { setScanComplete(false); scanned.current = false; lastScannedValue.current = null; }}
                      style={{ marginTop: rp(16), backgroundColor: theme.colors.success, borderRadius: rp(14), paddingVertical: rp(12), paddingHorizontal: rp(32) }}> 
                      <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2) }}>SCAN AGAIN</Text> 
                    </TouchableOpacity> 
                  )} 
                </View> 
              </View> 
            </CameraView> 
          )}
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? rp(60) : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            <View style={{ padding: rp(20) }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: rp(16), backgroundColor: theme.colors.surfaceAlt, padding: rp(12), borderRadius: rp(12) }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: rp(8) }}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                  <Text style={{ fontSize: rs(13), fontWeight: "700", color: theme.colors.textDark }}>Key-Tag Scanned</Text>
                </View>
                <TouchableOpacity onPress={cancelScan} style={{ paddingHorizontal: rp(12), paddingVertical: rp(6), backgroundColor: "#FFFFFF", borderRadius: rp(8) }}>
                  <Text style={{ color: theme.colors.primary, fontWeight: "700", fontSize: rs(12) }}>Change Card</Text>
                </TouchableOpacity>
              </View>
              
              {eventAllowsInstantPark && (
                <View style={{ backgroundColor: theme.colors.primaryLight, borderWidth: rp(1), borderColor: "#C7D2FE", borderRadius: rp(16), padding: rp(12), marginBottom: rp(16), flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flex: 1, marginRight: rp(10) }}>
                    <Text style={{ fontSize: rs(12), fontWeight: "900", color: theme.colors.primary }}>⚡ INSTANT PARK</Text>
                    <Text style={{ fontSize: rs(11), color: theme.colors.primary, marginTop: rp(2) }}>
                      Guest doesn't want to share personal details — skip name & phone
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setInstantPark(v => !v)}
                    style={{ width: rp(52), height: rp(30), borderRadius: rp(15), padding: rp(3), backgroundColor: instantPark ? theme.colors.primary : theme.colors.border }}
                  >
                    <View style={{ width: rp(24), height: rp(24), borderRadius: rp(12), backgroundColor: theme.colors.surface, marginLeft: instantPark ? rp(22) : 0 }} />
                  </TouchableOpacity>
                </View>
              )}
              
              <VehicleDetailsSection 
                plate={plate} setPlate={setPlate} guestName={guestName} setGuestName={setGuestName} 
                color={color} setColor={setColor} make={make} setMake={setMake} 
                carType={carType} setCarType={setCarType} notes={notes} setNotes={setNotes} 
                errors={errors} setErrors={setErrors} instantPark={instantPark} eventAllowsInstantPark={eventAllowsInstantPark}
                fieldRefs={fieldRefs}
              />

              
              <GuestContactSection 
                guestPhone={guestPhone} setGuestPhone={setGuestPhone} altGuestPhone={altGuestPhone} setAltGuestPhone={setAltGuestPhone}
                errors={errors} setErrors={setErrors} instantPark={instantPark} eventAllowsInstantPark={eventAllowsInstantPark}
                fieldRefs={fieldRefs}
              />
              
              <EntryGateSection eventGates={eventGates} selectedGate={selectedGate} setSelectedGate={setSelectedGate} />
              
              <DamageSection 
                hasDamage={hasDamage} setHasDamage={setHasDamage} damageTypes={damageTypes} setDamageTypes={setDamageTypes}
                damageNotes={damageNotes} setDamageNotes={setDamageNotes} showOtherDamage={showOtherDamage} setShowOtherDamage={setShowOtherDamage}
              />
              
              <PhotoGridSection 
                photos={photos} 
                errors={errors} 
                takePhoto={takePhoto} 
                onRemovePhoto={onRemovePhoto} 
              />
              
              <Btn onPress={submit} disabled={submitting} style={{ marginTop: rp(10), marginBottom: rp(40) }}>
                {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>CHECK IN VEHICLE</Text>}
              </Btn>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
      
      <RNModal visible={!!nextPhotoLabel} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Next Photo</Text>
            <Text style={styles.modalSub}>Now capture the {nextPhotoLabel?.toUpperCase()} of the vehicle</Text>
            <View style={{ gap: rp(12), width: '100%', marginTop: rp(10) }}>
              <Btn onPress={() => {
                const label = nextPhotoLabel;
                setNextPhotoLabel(null);
                takePhoto(label);
              }}>
                <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>Continue</Text>
              </Btn>
              <Btn variant="secondary" onPress={() => setNextPhotoLabel(null)}>
                <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>Done for now</Text>
              </Btn>
            </View>
          </View>
        </View>
      </RNModal>

      <Modal open={showSuccessModal} onClose={handleDone} title="Check-In Complete">
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={32} color="#FFFFFF" />
        </View>
        <Text style={styles.modalSub}>Vehicle {successCar?.plate} is now checked in.</Text>
        <View style={{ gap: rp(12), width: '100%', marginTop: rp(10) }}>
          <Btn onPress={handlePark}>
            <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>Continue to Parking</Text>
          </Btn>
          <Btn variant="secondary" onPress={handleDone}>
            <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>Done</Text>
          </Btn>
        </View>
      </Modal>

      <AlreadyCheckedInModal
        visible={!!alreadyCheckedIn}
        plate={alreadyCheckedIn?.plate}
        carType={alreadyCheckedIn?.car_type}
        onDismiss={() => {
          setAlreadyCheckedIn(null);
          setScanComplete(false);
          setScanLoading(false);
          scanned.current = false;
          lastScannedValue.current = null;
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 32, 68, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: rp(20),
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    width: "100%",
    borderRadius: rp(24),
    padding: rp(30),
    alignItems: "center",
  },
  modalTitle: {
    fontSize: rs(24),
    fontWeight: "900",
    color: theme.colors.textDark,
    marginBottom: rp(8),
  },
  successIcon: {
    width: rp(64),
    height: rp(64),
    borderRadius: rp(32),
    backgroundColor: theme.colors.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: rp(20),
    alignSelf: "center",
  },
  modalSub: {
    fontSize: rs(15),
    color: theme.colors.textLight,
    textAlign: "center",
    marginBottom: rp(30),
  },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, 
  topOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }, 
  bottomOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }, 
  sideOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }, 
  scanBox: { width: 240, height: 240, justifyContent: "center", alignItems: "center" }, 
  corner: { position: "absolute", width: rp(24), height: rp(24), borderColor: theme.colors.accent, borderWidth: rp(3) }, 
  laserLine: { width: "100%", height: rp(2), backgroundColor: theme.colors.accent, shadowColor: theme.colors.accent, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  topLeft: { top: 0, left: 0, borderBottomWidth: rp(0), borderRightWidth: rp(0) }, 
  topRight: { top: 0, right: 0, borderBottomWidth: rp(0), borderLeftWidth: rp(0) }, 
  bottomLeft: { bottom: 0, left: 0, borderTopWidth: rp(0), borderRightWidth: rp(0) }, 
  bottomRight: { bottom: 0, right: 0, borderTopWidth: rp(0), borderLeftWidth: rp(0) }, 
});