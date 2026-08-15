import { useEffect, useState, useRef, useCallback, memo } from "react";
import { confirmDialog } from "../../../lib/confirmDialog";
import { Screen, TopBar, Card, Btn, Modal, Sheet, EmptyState } from '../../../components/valet/ui';
import { theme } from '../../../utils/theme';
import { rs, rp } from '../../../utils/responsive';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal as RNModal,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system";
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../../lib/api";
import { useAppStore } from "../../../lib/store";
import { enqueueCheckinAction } from "../../../lib/offline";

const REQUIRED_PHOTO_ORDER = ["front", "right", "back", "left"];

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

function statusMeta(duty_status) {
  if (duty_status === "available") return { color: theme.colors.success, bg: theme.colors.successLight, label: "Available" };
  if (duty_status === "busy") return { color: theme.colors.warning, bg: theme.colors.warningLight, label: "Busy" };
  return { color: theme.colors.textSecondary, bg: theme.colors.surfaceAlt, label: "Offline" };
}

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

const VehicleDetailsSection = memo(({
  plate, setPlate, guestName, setGuestName, color, setColor, make, setMake, carType, setCarType, notes, setNotes, errors, setErrors, instantPark, eventAllowsInstantPark,
  pendingLookup, setPendingLookup, lookupApplied, setLookupApplied, plateLookedUp, setPlateLookedUp, setGuestPhone, setAltGuestPhone,
  lookupPlate, confirmLookup, rejectLookup, clearGuestOnly
}) => {
  return (
    <>
      <Lbl>LICENSE PLATE *</Lbl>
      <View style={[inputRow, errors.plate && { borderColor: theme.colors.danger, marginBottom: 0 }]}>
        <Ionicons name="car-outline" size={20} color={theme.colors.primary} />
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
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="characters"
          maxLength={11}
          style={textInput}
        />
      </View>
      {errors.plate && <Text style={{ color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.plate}</Text>}
      {pendingLookup && (
        <View style={{ backgroundColor: theme.colors.successLight, borderWidth: rp(1), borderColor: theme.colors.success, borderRadius: rp(16), padding: rp(12), marginBottom: rp(16) }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: rp(10) }}>
            <Ionicons name="help-circle" size={20} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: rs(12), fontWeight: "900", color: theme.colors.primary }}>PREVIOUS VISIT FOUND</Text>
              <Text style={{ fontSize: rs(11), color: theme.colors.success, marginTop: rp(1) }}>
                {pendingLookup.guest_name ? `${pendingLookup.guest_name} — ` : ""}Use these saved details?
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: rp(12), marginTop: rp(10) }}>
            <TouchableOpacity onPress={confirmLookup} activeOpacity={0.7} style={{ backgroundColor: theme.colors.primary, borderRadius: rp(10), paddingVertical: rp(6), paddingHorizontal: rp(14) }}>
              <Text style={{ fontSize: rs(12), fontWeight: "800", color: "#FFFFFF" }}>Use These Details</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={rejectLookup} style={{ paddingVertical: rp(6), paddingHorizontal: rp(4) }}>
              <Text style={{ fontSize: rs(12), fontWeight: "800", color: theme.colors.textSecondary }}>Not This Guest</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {lookupApplied && !pendingLookup && (
        <View style={{ marginBottom: rp(16) }}>
          <Text style={{ fontSize: rs(11), color: theme.colors.primary, marginBottom: rp(8) }}>
            ✓ Details filled from previous visit
          </Text>
          <TouchableOpacity
            onPress={clearGuestOnly}
            style={{
              borderWidth: rp(1),
              borderColor: theme.colors.danger,
              backgroundColor: theme.colors.dangerLight,
              borderRadius: rp(10),
              paddingVertical: rp(8),
              paddingHorizontal: rp(14),
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: rp(6),
            }}
          >
            <Ionicons name="person-remove-outline" size={14} color={theme.colors.danger} />
            <Text style={{ fontSize: rs(12), fontWeight: "800", color: theme.colors.danger }}>
              Not this guest? Clear name &amp; phone
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <Lbl>{instantPark && eventAllowsInstantPark ? "GUEST NAME (OPTIONAL)" : "GUEST NAME *"}</Lbl>
      <View style={[inputRow, errors.guestName && { borderColor: theme.colors.danger, marginBottom: 0 }]}>
        <Ionicons name="person-outline" size={20} color={theme.colors.primary} />
        <TextInput value={guestName} onChangeText={(text) => { setGuestName(text); if (errors.guestName) setErrors(prev => ({ ...prev, guestName: undefined })); }} placeholder="Guest Name" placeholderTextColor={theme.colors.textMuted} style={textInput} />
      </View>
      {errors.guestName && <Text style={{ color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.guestName}</Text>}
      <Lbl>{eventAllowsInstantPark && instantPark ? "VEHICLE COLOR (OPTIONAL)" : "VEHICLE COLOR *"}</Lbl>
      <View style={[inputRow, errors.color && { borderColor: theme.colors.danger, marginBottom: 0 }]}>
        <Ionicons name="color-palette-outline" size={20} color={theme.colors.primary} />
        <TextInput value={color} onChangeText={(text) => { setColor(text); if (errors.color) setErrors(prev => ({ ...prev, color: undefined })); }} placeholder="Black" placeholderTextColor={theme.colors.textMuted} style={textInput} />
      </View>
      {errors.color && <Text style={{ color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.color}</Text>}
      <Lbl>{eventAllowsInstantPark && instantPark ? "VEHICLE MAKE/MODEL (OPTIONAL)" : "VEHICLE MAKE/MODEL *"}</Lbl>
      <View style={[inputRow, errors.make && { borderColor: theme.colors.danger, marginBottom: 0 }]}>
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

const GuestContactSection = memo(({ guestPhone, setGuestPhone, altGuestPhone, setAltGuestPhone, errors, setErrors, instantPark, eventAllowsInstantPark }) => {
  return (
    <>
      <Lbl>{instantPark && eventAllowsInstantPark ? "GUEST MOBILE (OPTIONAL)" : "GUEST MOBILE *"}</Lbl>
      <View style={[inputRow, errors.guestPhone && { borderColor: theme.colors.danger, marginBottom: 0 }]}>
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
      <View style={[inputRow, errors.altGuestPhone && { borderColor: theme.colors.danger, marginBottom: 0 }]}>
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

const PhotoGridSection = memo(({ photos, errors, takePhoto, onRemovePhoto }) => {
  return (
    <>
      <Lbl>VEHICLE PHOTOS * (ALL REQUIRED EXCEPT EXTRA)</Lbl>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: rp(10), marginBottom: errors.photos ? 0 : rp(16), borderWidth: errors.photos ? rp(1) : 0, borderColor: theme.colors.danger, borderRadius: rp(16), padding: errors.photos ? rp(8) : 0 }}>
        {["front", "right", "back", "left", "extra"].map((label) => (
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
      {errors.photos && <Text style={{ color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.photos}</Text>}
    </>
  );
});

export default function AddCar() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const { currentEventId } = useAppStore();
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
  const photosRef = useRef(photos);
  useEffect(() => { photosRef.current = photos; }, [photos]);
  const resizedPhotosRef = useRef({});
  const resizeQueueRef = useRef(Promise.resolve());
  
  const [nextPhotoLabel, setNextPhotoLabel] = useState(null);
  const [pendingLookup, setPendingLookup] = useState(null);
  const [lookupApplied, setLookupApplied] = useState(false);
  const [plateLookedUp, setPlateLookedUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [prefilledCarId, setPrefilledCarId] = useState(null);
  const [passToken, setPassToken] = useState(null);
  const [guestName, setGuestName] = useState("");
  const [isPreRegistered, setIsPreRegistered] = useState(false);
  const [eventAllowsInstantPark, setEventAllowsInstantPark] = useState(false);
  const [instantPark, setInstantPark] = useState(false);
  
  const [qrToken, setQrToken] = useState("");
  const [keyTagNumber, setKeyTagNumber] = useState("");
  const [qrCardId, setQrCardId] = useState("");
  
  const params = useLocalSearchParams();
  const returnTo = params.returnTo || "/(supervisor)/(tabs)/scan";

  // Driver assignment
  const [drivers, setDrivers] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [selectedDriverId, setSelectedDriverId] = useState(null);

  // Camera state
  const [showPhotoCamera, setShowPhotoCamera] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [currentCameraLabel, setCurrentCameraLabel] = useState(null);
  const [isTakingPicture, setIsTakingPicture] = useState(false);

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
    if (params.prefill_qr_token) {
      setQrToken(params.prefill_qr_token || "");
      setKeyTagNumber(params.prefill_key_tag_number || "");
      setQrCardId(params.prefill_qr_card_id || "");
    }
    if (!params.prefill_plate && !params.prefill_qr_token) {
      confirmDialog.info("Missing QR card", "Please scan a vehicle key-tag first.", () => router.replace("/(supervisor)/(tabs)/scan"));
    }
  }, [params.prefill_plate, params.prefill_qr_token, params.prefill_key_tag_number, params.prefill_qr_card_id, router]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/events/${currentEventId}`);
        setEventGates(data.gates || []);
        if (data.gates?.[0]) setSelectedGate(data.gates[0]);
        setEventAllowsInstantPark(!!data.allow_instant_park);
      } catch { }
      try {
        const draft = await AsyncStorage.getItem("add_car_draft");
        const savedPhotos = await AsyncStorage.getItem("add_car_photos");
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
        if (savedPhotos) {
          setPhotos(JSON.parse(savedPhotos));
          photosRef.current = JSON.parse(savedPhotos);
        }
      } catch { }
    })();
  }, [currentEventId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/events/${currentEventId}/drivers`);
        const roster = (data || []).filter((d) => d.assigned);
        const rank = { available: 0, busy: 1, offline: 2 };
        roster.sort((a, b) => {
          const r = (rank[a.duty_status] ?? 2) - (rank[b.duty_status] ?? 2);
          if (r !== 0) return r;
          return new Date(a.duty_status_updated_at || 0) - new Date(b.duty_status_updated_at || 0);
        });
        setDrivers(roster);
      } catch { }
      setLoadingDrivers(false);
    })();
  }, [currentEventId]);

  const handlePickDriver = (driver) => {
    if (driver.duty_status === "busy") {
      confirmDialog.confirm(
        "Driver is busy",
        `${driver.name} is currently busy${driver.current_car_plate ? ` with car ${driver.current_car_plate}` : ""}. Assign this car to them anyway?`,
        () => setSelectedDriverId(driver.id)
      );
      return;
    }
    setSelectedDriverId(driver.id);
  };

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
    confirmDialog.destructiveConfirm(
      "Clear guest details?",
      "This will remove the guest name and phone number. The car details will stay the same.",
      () => {
            setGuestName("");
            setGuestPhone("");
            setAltGuestPhone("");
          },
      "Yes, Clear"
    );
  };

  const draftRef = useRef({});
  useEffect(() => {
    draftRef.current = { plate, color, make, notes, guestPhone, selectedGate, carType, altGuestPhone, hasDamage, damageNotes, damageTypes, guestName, errors };
  });

  const onRemovePhoto = useCallback((label) => {
    const np = { ...photosRef.current, [label]: null };
    photosRef.current = np;
    setPhotos(np);
    delete resizedPhotosRef.current[label];
  }, []);

  const takePhoto = useCallback(async (label) => {
    if (!cameraPermission?.granted) {
      const req = await requestCameraPermission();
      if (!req.granted) {
        confirmDialog.info("Camera permission needed", "");
        return;
      }
    }
    setCurrentCameraLabel(label);
    setShowPhotoCamera(true);
  }, [cameraPermission]);

  const capturePhoto = async () => {
    if (cameraRef.current && !isTakingPicture && currentCameraLabel) {
      setIsTakingPicture(true);
      try {
        const d = draftRef.current;
        AsyncStorage.setItem("add_car_draft", JSON.stringify({ plate: d.plate, color: d.color, make: d.make, notes: d.notes, guestPhone: d.guestPhone, selectedGate: d.selectedGate, carType: d.carType, altGuestPhone: d.altGuestPhone, hasDamage: d.hasDamage, damageNotes: d.damageNotes, damageTypes: d.damageTypes, guestName: d.guestName })).catch(() => { });
        
        const photo = await cameraRef.current.takePictureAsync({ skipProcessing: true });
        
        if (photo && photo.uri) {
          const rawUri = photo.uri;
          const label = currentCameraLabel;
          
          const np = { ...photosRef.current, [label]: rawUri };
          photosRef.current = np;
          setPhotos(np);
          
          if (d.errors.photos && np.front && np.back && np.left && np.right) {
            setErrors(prev => ({ ...prev, photos: undefined }));
          }
          AsyncStorage.setItem("add_car_photos", JSON.stringify(np)).catch(() => { });
          
          const idx = REQUIRED_PHOTO_ORDER.indexOf(label);
          if (idx !== -1) {
            const nextLabel = REQUIRED_PHOTO_ORDER.slice(idx + 1).find(l => !np[l]);
            if (nextLabel) {
              setCurrentCameraLabel(nextLabel);
            } else {
              setShowPhotoCamera(false);
            }
          } else {
            setShowPhotoCamera(false);
          }
          
          resizeQueueRef.current = resizeQueueRef.current.then(() =>
            ImageManipulator.manipulateAsync(
              rawUri,
              [{ resize: { width: 1280 } }],
              { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
            )
              .then((resized) => { resizedPhotosRef.current[label] = resized.uri; })
              .catch(() => { resizedPhotosRef.current[label] = rawUri; })
          );
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsTakingPicture(false);
      }
    }
  };

  const getUploadReadyPhotos = (photosObj) => {
    const out = {};
    for (const [label, uri] of Object.entries(photosObj)) {
      out[label] = uri ? (resizedPhotosRef.current[label] || uri) : uri;
    }
    return out;
  };

  const uploadPhotosInBackground = async (carId, photosObj) => {
    try {
      const entries = Object.entries(photosObj).filter(([, uri]) => !!uri);
      const results = await Promise.allSettled(entries.map(async ([label, uri]) => {
        const fd = new FormData();
        fd.append("file", { uri, type: "image/jpeg", name: "photo.jpg" });
        fd.append("folder", `checkin/${carId}`);
        const up = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        return { label, url: up.data.url };
      }));
      const urls = [];
      const labels = [];
      results.forEach(r => {
        if (r.status === "fulfilled") {
          urls.push(r.value.url);
          labels.push(r.value.label);
        }
      });
      if (urls.length > 0) {
        await api.post(`/cars/${carId}/photos`, { urls, type: "checkin", labels });
      }
    } catch { }
  };

  const submit = async () => {
    setSubmitting(true);
    const errs = {};
    if (!plate.trim()) errs.plate = "License plate is required";
    else if (!validatePlate(plate.trim())) errs.plate = "Please enter a valid Indian vehicle number plate.";
    if (!color.trim() && !(eventAllowsInstantPark && instantPark)) errs.color = "Vehicle color is required";
    if (!make.trim() && !(eventAllowsInstantPark && instantPark)) errs.make = "Vehicle make/model is required";
    const skipGuestDetails = eventAllowsInstantPark && instantPark;
    if (!skipGuestDetails && !guestName.trim()) errs.guestName = "Guest name is required";
    if (!selectedDriverId) errs.driver = "Please select a driver to hand this car to";
    let phoneToSave = "";
    if (!skipGuestDetails && !guestPhone.trim()) errs.guestPhone = "Guest mobile number is required";
    else if (guestPhone.trim()) {
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
    if (Object.keys(errs).length > 0) {
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    confirmDialog.confirm(
      "Confirm check-in",
      `Confirm check-in for ${plate}?`,
      () => {
        setSubmitting(true);
        doSubmit(phoneToSave, altPhoneToSave);
      }
    );
  };

  const doSubmit = async (phoneToSave, altPhoneToSave) => {
    const photoLocalPaths = { front: null, back: null, left: null, right: null, extra: null };
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        await Promise.all(Object.entries(getUploadReadyPhotos(photos)).map(async ([label, uri]) => {
          if (!uri) return;
          const localPath = `${FileSystem.documentDirectory}checkin_${plate.trim()}_${label}_${Date.now()}.jpg`;
          await FileSystem.copyAsync({ from: uri, to: localPath });
          photoLocalPaths[label] = localPath;
        }));
        await enqueueCheckinAction({
          eventId: currentEventId,
          plate: plate.trim().toUpperCase(),
          color: color.trim(),
          make: make.trim(),
          notes: notes.trim(),
          gate: selectedGate,
          guestPhone: phoneToSave,
          checkInDriverId: selectedDriverId,
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
        await AsyncStorage.removeItem("add_car_draft");
        await AsyncStorage.removeItem("add_car_photos");
        confirmDialog.info("Saved offline", "Vehicle check-in queued. Will sync when connected.");
        router.back();
        return;
      }

      let car;
      if (isPreRegistered && prefilledCarId) {
        const { data } = await api.patch(`/cars/${prefilledCarId}/complete-checkin`, {
          check_in_driver_id: selectedDriverId,
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
        const { data } = await api.post("/cars", {
          qr_token: qrToken,
          plate: plate.trim().toUpperCase(),
          color: color.trim(),
          make: make.trim(),
          notes: notes.trim(),
          gate: selectedGate || "",
          event_id: currentEventId,
          check_in_driver_id: selectedDriverId,
          car_type: carType,
          alt_guest_phone: altPhoneToSave || null,
          has_damage: hasDamage,
          damage_notes: damageNotes.trim() || null,
          damage_types: damageTypes,
          instant_park: eventAllowsInstantPark && instantPark,
          ...(guestName.trim() ? { guest_name: guestName.trim() } : {}),
          ...(phoneToSave ? { guest_phone: phoneToSave } : {}),
        });
        car = data;
        if (car.warning) {
          await new Promise((resolve) => {
            confirmDialog.info("⚠️ Almost full", "This event is almost at capacity.", resolve);
          });
        }
      }
      try { await api.post(`/slots/event/${currentEventId}/initialize`); } catch { }
      
      Promise.all(Object.entries(getUploadReadyPhotos(photos)).map(async ([label, uri]) => {
        if (!uri) return;
        const localPath = `${FileSystem.documentDirectory}checkin_${plate.trim()}_${label}_${Date.now()}.jpg`;
        try { await FileSystem.copyAsync({ from: uri, to: localPath }); photoLocalPaths[label] = localPath; } catch { }
      })).catch(() => { });
      
      try { await AsyncStorage.removeItem("add_car_photos"); } catch { }
      try { await AsyncStorage.removeItem("add_car_draft"); } catch { }
      router.replace({
        pathname: "/(supervisor)/(tabs)/qr-display",
        params: {
          token: car.qr_token,
          plate: car.plate,
          carId: car.id,
          ...(phoneToSave ? { guestPhone: phoneToSave } : {}),
        },
      });
      uploadPhotosInBackground(car.id, getUploadReadyPhotos(photos)).finally(() => {
        Object.values(photoLocalPaths).forEach(path => {
          if (path) FileSystem.deleteAsync(path, { idempotent: true }).catch(() => { });
        });
      });
    } catch (err) {
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
            checkInDriverId: selectedDriverId,
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
          await AsyncStorage.removeItem("add_car_draft");
          await AsyncStorage.removeItem("add_car_photos");
          confirmDialog.info("Saved for retry", "Connection was too slow to confirm. This check-in has been queued and will sync automatically — you don't need to redo it.");
          router.back();
          return;
        } catch {
          confirmDialog.info("Error", "Could not save this check-in for retry. Please check your connection and try again.");
        }
      } else {
        const msg = err.response?.data?.detail || "Check-in failed";
        if (typeof msg === "string" && msg.includes("full")) confirmDialog.info("Event full", "No more cars can be checked in.");
        else if (typeof msg === "string" && msg.includes("Duplicate")) confirmDialog.info("Duplicate", "Plate already checked in.");
        else confirmDialog.info("Error", typeof msg === "string" ? msg : "Failed");
      }
    } finally { setSubmitting(false); }
  };

  return (
    <Screen scroll={false} testID="add-car-screen">
      <TopBar
        title="Add Car & Assign Driver"
        onBack={() => router.replace(returnTo)}
        rightNode={
          <TouchableOpacity onPress={() => router.push({ pathname: "/(supervisor)/(tabs)/scan", params: { returnTo } })}>
            <Ionicons name="qr-code-outline" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        }
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1, paddingHorizontal: rp(20), paddingTop: rp(18) }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: rp(100)  + tabBarHeight}}>
          
          {keyTagNumber ? (
            <View style={{
              backgroundColor: theme.colors.primaryLight, borderWidth: rp(1), borderColor: theme.colors.border,
              borderRadius: rp(16), padding: rp(12), marginBottom: rp(16),
              flexDirection: "row", alignItems: "center", gap: rp(10)
            }}>
              <Ionicons name="pricetag" size={20} color="#3B82F6" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: rs(12), fontWeight: "900", color: theme.colors.primary }}>
                  KEY TAG SCANNED
                </Text>
                <Text style={{ fontSize: rs(18), color: theme.colors.primary, marginTop: rp(2), fontWeight: "bold", letterSpacing: rs(1) }}>
                  #{keyTagNumber}
                </Text>
              </View>
            </View>
          ) : null}
          {isPreRegistered && (
            <View style={{
              backgroundColor: theme.colors.successLight, borderWidth: rp(1), borderColor: theme.colors.success,
              borderRadius: rp(16), padding: rp(12), marginBottom: rp(16),
              flexDirection: "row", alignItems: "center", gap: rp(10)
            }}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: rs(12), fontWeight: "900", color: theme.colors.primary }}>
                  PRE-REGISTERED GUEST
                </Text>
                {guestName ? (
                  <Text style={{ fontSize: rs(11), color: theme.colors.success, marginTop: rp(1) }}>
                    {guestName} — details pre-filled, please verify
                  </Text>
                ) : null}
              </View>
            </View>
          )}
          {isPreRegistered && guestNotes ? (
            <View style={{
              backgroundColor: theme.colors.warningLight,
              borderWidth: rp(1),
              borderColor: theme.colors.warning,
              borderRadius: rp(16),
              padding: rp(12),
              marginBottom: rp(16),
              flexDirection: "row",
              alignItems: "flex-start",
              gap: rp(10),
            }}>
              <Ionicons name="information-circle" size={20} color={theme.colors.warning} style={{ marginTop: rp(1) }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: rs(12), fontWeight: "900", color: theme.colors.warning }}>GUEST INSTRUCTIONS</Text>
                <Text style={{ fontSize: rs(13), color: theme.colors.warning, marginTop: rp(4), lineHeight: 18 }}>{guestNotes}</Text>
              </View>
            </View>
          ) : null}
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

          <Card style={{ marginBottom: rp(16) }}>
            <VehicleDetailsSection
              plate={plate} setPlate={setPlate}
              guestName={guestName} setGuestName={setGuestName}
              color={color} setColor={setColor}
              make={make} setMake={setMake}
              carType={carType} setCarType={setCarType}
              notes={notes} setNotes={setNotes}
              errors={errors} setErrors={setErrors}
              instantPark={instantPark} eventAllowsInstantPark={eventAllowsInstantPark}
              pendingLookup={pendingLookup} setPendingLookup={setPendingLookup}
              lookupApplied={lookupApplied} setLookupApplied={setLookupApplied}
              plateLookedUp={plateLookedUp} setPlateLookedUp={setPlateLookedUp}
              setGuestPhone={setGuestPhone} setAltGuestPhone={setAltGuestPhone}
              lookupPlate={lookupPlate} confirmLookup={confirmLookup} rejectLookup={rejectLookup} clearGuestOnly={clearGuestOnly}
            />
          </Card>
          <Card style={{ marginBottom: rp(16) }}>
            <DamageSection
              hasDamage={hasDamage} setHasDamage={setHasDamage}
              damageTypes={damageTypes} setDamageTypes={setDamageTypes}
              damageNotes={damageNotes} setDamageNotes={setDamageNotes}
              showOtherDamage={showOtherDamage} setShowOtherDamage={setShowOtherDamage}
            />
          </Card>
          <Card style={{ marginBottom: rp(16) }}>
            <GuestContactSection
              guestPhone={guestPhone} setGuestPhone={setGuestPhone}
              altGuestPhone={altGuestPhone} setAltGuestPhone={setAltGuestPhone}
              errors={errors} setErrors={setErrors}
              instantPark={instantPark} eventAllowsInstantPark={eventAllowsInstantPark}
            />
          </Card>
          <Card style={{ marginBottom: rp(16) }}>
            <EntryGateSection
              eventGates={eventGates} selectedGate={selectedGate} setSelectedGate={setSelectedGate}
            />
          </Card>
          <Card style={{ marginBottom: rp(16) }}>
            <PhotoGridSection
              photos={photos} errors={errors} takePhoto={takePhoto} onRemovePhoto={onRemovePhoto}
            />
          </Card>

          <Card style={{ marginBottom: rp(24) }}>
            <Lbl>ASSIGN TO DRIVER *</Lbl>
            {loadingDrivers ? (
              <ActivityIndicator style={{ marginTop: rp(10), marginBottom: rp(16) }} color={theme.colors.primary} />
            ) : drivers.length === 0 ? (
              <Text style={{ color: theme.colors.textMuted, fontSize: rs(13), marginBottom: rp(16) }}>No drivers rostered on this event yet.</Text>
            ) : (
              <View style={{ backgroundColor: theme.colors.surface, borderRadius: rp(16), borderWidth: rp(1), borderColor: errors.driver ? theme.colors.danger : theme.colors.border, overflow: "hidden" }}>
                {drivers.map((d, idx) => {
                  const meta = statusMeta(d.duty_status);
                  const selected = selectedDriverId === d.id;
                  return (
                    <TouchableOpacity key={d.id} onPress={() => { handlePickDriver(d); if (errors.driver) setErrors(prev => ({ ...prev, driver: undefined })); }} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: rp(14), paddingHorizontal: rp(16), borderTopWidth: idx === 0 ? 0 : rp(1), borderTopColor: theme.colors.border, backgroundColor: selected ? theme.colors.successLight : theme.colors.surface }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "800", color: theme.colors.textPrimary, fontSize: rs(14) }}>{d.name}</Text>
                        {d.duty_status === "busy" && d.current_car_plate && (
                          <Text style={{ color: theme.colors.textMuted, fontSize: rs(11), marginTop: rp(2) }}>Busy with {d.current_car_plate}</Text>
                        )}
                      </View>
                      <View style={{ backgroundColor: meta.bg, paddingHorizontal: rp(10), paddingVertical: rp(8), borderRadius: rp(99), marginRight: rp(10) }}>
                        <Text style={{ color: meta.color, fontWeight: "800", fontSize: rs(10) }}>{meta.label}</Text>
                      </View>
                      {selected && <Ionicons name="checkmark-circle" size={22} color={theme.colors.success} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            {errors.driver && <Text style={{ color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(4) }}>* {errors.driver}</Text>}
          </Card>

          <Btn variant="accent" onPress={submit} disabled={submitting} style={{ marginBottom: rp(16) }}>
            {submitting ? "CHECKING IN..." : "CHECK IN VEHICLE"}
          </Btn>
          <View style={{ height: rp(40) }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <RNModal visible={showPhotoCamera} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
          <View style={{ flex: 1 }}>
            <CameraView ref={cameraRef} mode="picture" style={{ flex: 1 }} />
            
            <View style={{ position: "absolute", top: rp(16), left: rp(16), right: rp(16), alignItems: "center" }}>
              <View style={{ backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: rp(16), paddingVertical: rp(8), borderRadius: rp(99) }}>
                <Text style={{ color: "#FFF", fontSize: rs(14), fontWeight: "800" }}>Take {currentCameraLabel?.toUpperCase()} photo</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setShowPhotoCamera(false)}
              style={{ position: "absolute", top: rp(16), left: rp(16), backgroundColor: "rgba(0,0,0,0.5)", padding: rp(12), borderRadius: rp(99) }}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={{ position: "absolute", bottom: rp(40), left: 0, right: 0, alignItems: "center" }}>
              <TouchableOpacity
                disabled={isTakingPicture}
                onPress={capturePhoto}
                style={{ width: rp(70), height: rp(70), borderRadius: rp(35), borderWidth: rp(4), borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}
              >
                {isTakingPicture ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <View style={{ width: rp(54), height: rp(54), backgroundColor: "#FFFFFF", borderRadius: rp(27) }} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </RNModal>
    </Screen>
  );
}
