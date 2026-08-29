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
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../../lib/api";
import { useAppStore } from "../../../lib/store";
import { enqueueCheckinAction, enqueuePhotoAttach } from "../../../lib/offline";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";

import { scrollToFirstError } from "../../../lib/scrollToFirstError";

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
const PHOTO_LABELS = ["front", "right", "back", "left", "extra"];

const PhotoGridSection = memo(({ photos, errors, takePhoto, onRemovePhoto }) => {
  return (
    <View style={{ marginBottom: 20 }}>
      <Lbl>VEHICLE PHOTOS (OPTIONAL)</Lbl>
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
  plate, setPlate, guestName, setGuestName, color, setColor, make, setMake, carType, setCarType, notes, setNotes, errors, setErrors,
  pendingLookup, setPendingLookup, lookupApplied, setLookupApplied, plateLookedUp, setPlateLookedUp, setGuestPhone,
  lookupPlate, confirmLookup, rejectLookup, clearGuestOnly, fieldRefs
}) => {
  return (
    <>
      <Lbl>LICENSE PLATE *</Lbl>
      <View ref={el => { if (fieldRefs.current) fieldRefs.current.plate = el; }} style={[inputRow, errors.plate && { borderColor: theme.colors.danger, marginBottom: 0 }]}>
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
      <Lbl>GUEST NAME (OPTIONAL)</Lbl>
      <View ref={el => { if (fieldRefs.current) fieldRefs.current.guestName = el; }} style={[inputRow, errors.guestName && { borderColor: theme.colors.danger, marginBottom: 0 }]}>
        <Ionicons name="person-outline" size={20} color={theme.colors.primary} />
        <TextInput ref={el => { if (fieldRefs.current) fieldRefs.current.guestName = el; }} value={guestName} onChangeText={(text) => { setGuestName(text); if (errors.guestName) setErrors(prev => ({ ...prev, guestName: undefined })); }} placeholder="Guest Name" placeholderTextColor={theme.colors.textMuted} style={textInput} />
      </View>
      {errors.guestName && <Text style={{ color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.guestName}</Text>}
      <Lbl>VEHICLE COLOR (OPTIONAL)</Lbl>
      <View ref={el => { if (fieldRefs.current) fieldRefs.current.color = el; }} style={[inputRow, errors.color && { borderColor: theme.colors.danger, marginBottom: 0 }]}>
        <Ionicons name="color-palette-outline" size={20} color={theme.colors.primary} />
        <TextInput ref={el => { if (fieldRefs.current) fieldRefs.current.color = el; }} value={color} onChangeText={(text) => { setColor(text); if (errors.color) setErrors(prev => ({ ...prev, color: undefined })); }} placeholder="Black" placeholderTextColor={theme.colors.textMuted} style={textInput} />
      </View>
      {errors.color && <Text style={{ color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.color}</Text>}
      <Lbl>VEHICLE MAKE/MODEL (OPTIONAL)</Lbl>
      <View ref={el => { if (fieldRefs.current) fieldRefs.current.make = el; }} style={[inputRow, errors.make && { borderColor: theme.colors.danger, marginBottom: 0 }]}>
        <Ionicons name="construct-outline" size={20} color={theme.colors.primary} />
        <TextInput ref={el => { if (fieldRefs.current) fieldRefs.current.make = el; }} value={make} onChangeText={(text) => { setMake(text); if (errors.make) setErrors(prev => ({ ...prev, make: undefined })); }} placeholder="Honda Civic" placeholderTextColor={theme.colors.textMuted} style={textInput} />
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

const GuestContactSection = memo(({ guestPhone, setGuestPhone, errors, setErrors, fieldRefs }) => {
  return (
    <>
      <Lbl>GUEST MOBILE (OPTIONAL)</Lbl>
      <View ref={el => { if (fieldRefs.current) fieldRefs.current.guestPhone = el; }} style={[inputRow, errors.guestPhone && { borderColor: theme.colors.danger, marginBottom: 0 }]}>
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

export default function AddCar() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const { currentEventId } = useAppStore();
  const scrollViewRef = useRef(null);
  const fieldRefs = useRef({});

  const [plate, setPlate] = useState("");
  const [color, setColor] = useState("");
  const [make, setMake] = useState("");
  const [notes, setNotes] = useState("");
  const [guestNotes, setGuestNotes] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [eventInfo, setEventInfo] = useState(null);
  const [eventGates, setEventGates] = useState([]);
  const [selectedGate, setSelectedGate] = useState("");
  const [carType, setCarType] = useState("normal");
  const [hasDamage, setHasDamage] = useState(false);
  const [damageNotes, setDamageNotes] = useState("");
  const [damageTypes, setDamageTypes] = useState([]);
  const [showOtherDamage, setShowOtherDamage] = useState(false);

  const [pendingLookup, setPendingLookup] = useState(null);
  const [lookupApplied, setLookupApplied] = useState(false);
  const [plateLookedUp, setPlateLookedUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const isSubmittedRef = useRef(false);
  const qrCardIdRef = useRef("");

  useEffect(() => {
    qrCardIdRef.current = qrCardId;
  }, [qrCardId]);

  useEffect(() => {
    return () => {
      if (qrCardIdRef.current && !isSubmittedRef.current) {
        api.post(`/qr-cards/${qrCardIdRef.current}/release-reservation`).catch(() => { });
      }
    };
  }, []);
  const [errors, setErrors] = useState({});
  const [prefilledCarId, setPrefilledCarId] = useState(null);
  const [passToken, setPassToken] = useState(null);
  const [guestName, setGuestName] = useState("");
  const [isPreRegistered, setIsPreRegistered] = useState(false);

  const [qrToken, setQrToken] = useState("");
  const [keyTagNumber, setKeyTagNumber] = useState("");
  const [qrCardId, setQrCardId] = useState("");

  const [drivers, setDrivers] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [selectedDriverId, setSelectedDriverId] = useState(null);

  const [photos, setPhotos] = useState({ front: null, back: null, left: null, right: null, extra: null });
  const permissionGrantedRef = useRef(false);
  const resizedPhotosRef = useRef({});
  const resizeQueueRef = useRef(Promise.resolve());
  const uploadPromisesRef = useRef({});
  const [nextPhotoLabel, setNextPhotoLabel] = useState(null);

  const params = useLocalSearchParams();
  const returnTo = params.returnTo || "/(supervisor)/(tabs)/scan";

  useEffect(() => {
    if (params.prefill_qr_token) setQrToken(params.prefill_qr_token);
  }, [params.prefill_qr_token]);

  useEffect(() => {
    if (params.prefill_key_tag_number) setKeyTagNumber(String(params.prefill_key_tag_number));
  }, [params.prefill_key_tag_number]);

  useEffect(() => {
    if (params.prefill_qr_card_id) setQrCardId(params.prefill_qr_card_id);
  }, [params.prefill_qr_card_id]);

  useFocusEffect(
    useCallback(() => {
      if (!params.prefill_plate && !params.prefill_qr_token) {
        setPlate("");
        setColor("");
        setMake("");
        setNotes("");
        setGuestNotes("");
        setGuestPhone("");
        setSelectedGate("");
        setCarType("normal");

        setHasDamage(false);
        setDamageNotes("");
        setDamageTypes([]);
        setShowOtherDamage(false);
        setPendingLookup(null);
        setLookupApplied(false);
        setPlateLookedUp(false);
        setErrors({});
        setPrefilledCarId(null);
        setPassToken(null);
        setGuestName("");
        setIsPreRegistered(false);
      }
    }, [params.prefill_plate])
  );

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
  }, [params, router]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/events/${currentEventId}`);
        setEventGates(data.gates || []);
        if (data.gates?.[0]) setSelectedGate(data.gates[0]);
        setEventInfo(data);
      } catch { }
      try {
        const draft = await AsyncStorage.getItem("add_car_draft");
        if (draft) {
          const d = JSON.parse(draft);
          setPlate(d.plate || "");
          setColor(d.color || "");
          setMake(d.make || "");
          setNotes(d.notes || "");
          setGuestPhone(d.guestPhone || "");
          setSelectedGate(d.selectedGate || "");
          if (d.carType) setCarType(d.carType);

          if (d.hasDamage) setHasDamage(d.hasDamage);
          if (d.damageNotes) setDamageNotes(d.damageNotes);
          if (d.damageTypes) setDamageTypes(d.damageTypes);
          if (d.guestName) setGuestName(d.guestName);
        }
      } catch { }
    })();
  }, [currentEventId]);

  useEffect(() => {
    (async () => {
      if (!currentEventId) return;
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

  const lookupPlate = async (p) => {
    if (!p || p.length < 4 || isPreRegistered || lookupApplied) return;
    try {
      const { data } = await api.get(`/cars/lookup/${p}`);
      if (data) {
        setPendingLookup(data);
        setPlateLookedUp(true);
      } else {
        setPendingLookup(null);
        setPlateLookedUp(true);
      }
    } catch {
      setPendingLookup(null);
      setPlateLookedUp(true);
    }
  };

  const confirmLookup = () => {
    if (pendingLookup) {
      if (pendingLookup.make && !make) setMake(pendingLookup.make);
      if (pendingLookup.color && !color) setColor(pendingLookup.color);
      if (pendingLookup.guest_name && !guestName) setGuestName(pendingLookup.guest_name);
      if (pendingLookup.guest_phone && !guestPhone) setGuestPhone(pendingLookup.guest_phone);
      if (pendingLookup.car_type && carType === "normal") setCarType(pendingLookup.car_type);
      setLookupApplied(true);
      setPendingLookup(null);
    }
  };

  const rejectLookup = () => {
    setPendingLookup(null);
  };

  const clearGuestOnly = () => {
    setGuestName("");
    setGuestPhone("");

    setLookupApplied(false);
  };

  useEffect(() => {
    if (!submitting) {
      const draft = { plate, color, make, notes, guestPhone, selectedGate, carType, hasDamage, damageNotes, damageTypes, guestName };
      AsyncStorage.setItem("add_car_draft", JSON.stringify(draft)).catch(() => { });
    }
  }, [plate, color, make, notes, guestPhone, selectedGate, carType, hasDamage, damageNotes, damageTypes, guestName, submitting]);

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
        await resizeQueueRef.current.catch(() => { });
        const uri = resizedPhotosRef.current[label] || rawUri;
        const fd = new FormData();
        fd.append("file", { uri, type: "image/jpeg", name: "photo.jpg" });
        fd.append("folder", `checkin/temp_${Date.now()}`);
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
    if (!selectedDriverId) errs.driver = "Please select a driver to hand this car to";
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

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setSubmitting(false);
      scrollToFirstError(['plate', 'color', 'make', 'guestName', 'driver', 'guestPhone'], errs, fieldRefs, scrollViewRef);
      return;
    }

    confirmDialog.confirm(
      "Confirm check-in",
      `Confirm check-in for ${plate}?`,
      () => {
        doSubmit(phoneToSave);
      },
      () => {
        setSubmitting(false);
      }
    );
  };

  const doSubmit = async (phoneToSave) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      if (eventInfo?.is_checkin_open === false) {
        confirmDialog.info("Check-in not open yet", "Check-in opens 30 minutes before the event start time.");
        isSubmittingRef.current = false;
        setSubmitting(false);
        return;
      }
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

        if (isPreRegistered && prefilledCarId) {
          await enqueueCheckinAction({
            action: "complete_prereg",
            carId: prefilledCarId,
            checkInDriverId: selectedDriverId,
            color: color.trim(),
            make: make.trim(),
            notes: notes.trim(),
            gate: selectedGate,
            photoLocalPaths,
            photos: []
          });
          await AsyncStorage.removeItem("add_car_draft");
          confirmDialog.info("Saved offline", "Pre-registered check-in queued. Will sync when connected.");
          router.back();
          return;
        } else {
          const tempId = `offline_${Date.now()}`;
          await enqueueCheckinAction({
            eventId: currentEventId,
            qr_token: qrToken,
            qr_card_id: qrCardId,
            checkInDriverId: selectedDriverId,
            plate: plate.trim().toUpperCase(),
            color: color.trim(),
            make: make.trim(),
            notes: notes.trim(),
            gate: selectedGate,
            guestPhone: phoneToSave,
            isPreRegistered: false,
            carType,

            hasDamage,
            damageNotes: damageNotes.trim() || null,
            damageTypes,
            guestName: guestName.trim(),
            instantPark: true,
            photoLocalPaths,
            photos: []
          });
          await AsyncStorage.removeItem("add_car_draft");
          confirmDialog.info("Saved offline", "Vehicle check-in queued. Will sync when connected.");
          isSubmittedRef.current = true;
          router.replace({
            pathname: "/(supervisor)/(tabs)/qr-display",
            params: { carId: tempId, plate: plate.trim().toUpperCase(), checkinCode: "SYNC", token: "sync_pending", keyTagNumber, returnTo: "/(supervisor)/(tabs)/scan" },
          });
          return;
        }
      }

      try { await api.post(`/slots/event/${currentEventId}/initialize`); } catch { }

      let finalCarId;

      if (isPreRegistered && prefilledCarId) {
        const { data: updatedCar } = await api.patch(`/cars/${prefilledCarId}/complete-checkin`, {
          check_in_driver_id: selectedDriverId,
          color: color.trim(),
          make: make.trim(),
          notes: notes.trim(),
          gate: selectedGate,
        }, { timeout: 30000 });

        finalCarId = updatedCar.id;

        await AsyncStorage.removeItem("add_car_draft");
        router.replace({
          pathname: "/(supervisor)/(tabs)/qr-display",
          params: { carId: updatedCar.id, plate: updatedCar.plate, checkinCode: updatedCar.checkin_code, token: updatedCar.retrieval_token, returnTo: "/(supervisor)/(tabs)/scan" },
        });
      } else {
        const payload = {
          qr_token: qrToken || undefined,
          qr_card_id: qrCardId || undefined,
          check_in_driver_id: selectedDriverId,
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

          has_damage: hasDamage,
          damage_notes: damageNotes.trim() || null,
          damage_types: damageTypes,
          instant_park: true,
        };

        const { data: car } = await api.post("/cars", payload, { timeout: 30000 });

        finalCarId = car.id;

        await AsyncStorage.removeItem("add_car_draft");
        router.replace({
          pathname: "/(supervisor)/(tabs)/qr-display",
          params: { carId: car.id, plate: car.plate, checkinCode: car.checkin_code, token: qrToken, keyTagNumber: car.key_tag_number || keyTagNumber, returnTo: "/(supervisor)/(tabs)/scan" },
        });
      }

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
            await api.post(`/cars/${finalCarId}/photos`, { urls, type: "checkin", labels: successLabels }, { timeout: 30000 });
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
              const localPath = `${FileSystem.documentDirectory}checkin_retry_${finalCarId}_${label}_${Date.now()}.jpg`;
              await FileSystem.copyAsync({ from: uri, to: localPath });
              localPaths[label] = localPath;
              labelsToQueue.push(label);
            }));

            await enqueuePhotoAttach(finalCarId, { photoLocalPaths: localPaths, labels: labelsToQueue });
          } catch (qErr) {
            console.warn("Failed to enqueue photo attach fallback", qErr);
          }
        }
      })();

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
            isPreRegistered,
            prefilledCarId,
            carType,

            hasDamage,
            damageNotes: damageNotes.trim() || null,
            damageTypes,
            guestName: guestName.trim(),
            instantPark: true,
            photoLocalPaths,
            photos: urls
          });
          await AsyncStorage.removeItem("add_car_draft");
          confirmDialog.info("Saved for retry", "Connection was too slow to confirm. This check-in has been queued and will sync automatically.");
          isSubmittedRef.current = true;
          router.replace({
            pathname: "/(supervisor)/(tabs)/qr-display",
            params: { carId: `offline_${Date.now()}`, plate: plate.trim().toUpperCase(), checkinCode: "SYNC", token: "sync_pending", keyTagNumber, returnTo: "/(supervisor)/(tabs)/scan" },
          });
          return;
        } catch {
          confirmDialog.info("Couldn't save", "Something went wrong saving. Check your connection and try again.");
        }
      } else {
        const msg = err.response?.data?.detail || "Check-in failed";
        if (typeof msg === "string" && msg.includes("full")) confirmDialog.info("Event full", "No more cars can be checked in.");
        else if (typeof msg === "string" && msg.includes("Duplicate")) confirmDialog.info("Duplicate", "Plate already checked in.");
        else confirmDialog.info("Something went wrong", typeof msg === "string" ? msg : "Please check your connection and try again.");
      }
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (eventInfo?.is_checkin_open === false) {
    return (
      <Screen scroll={false} testID="add-car-screen">
        <TopBar title="Check In Car" />
        <EmptyState
          icon={<Ionicons name="time-outline" size={64} color={theme.colors.textMuted} />}
          title="Event is upcoming"
          body={`Check-in opens 30 minutes before the event start time${eventInfo?.start_time ? ` (${eventInfo.start_time})` : ""}.`}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} testID="add-car-screen">
      <TopBar
        title="Check In Car"
        onBack={() => {
          if (qrCardId && !isSubmittedRef.current) api.post(`/qr-cards/${qrCardId}/release-reservation`).catch(() => { });
          router.replace(returnTo);
        }}
        rightNode={
          <TouchableOpacity onPress={() => {
            if (qrCardId && !isSubmittedRef.current) api.post(`/qr-cards/${qrCardId}/release-reservation`).catch(() => { });
            router.push({ pathname: "/(supervisor)/(tabs)/scan", params: { returnTo } });
          }}>
            <Ionicons name="qr-code-outline" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        }
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView ref={scrollViewRef} style={{ flex: 1, paddingHorizontal: rp(20), paddingTop: rp(18) }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: rp(100) + tabBarHeight }}>

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


          <Card style={{ marginBottom: rp(16) }}>
            <VehicleDetailsSection
              plate={plate} setPlate={setPlate}
              guestName={guestName} setGuestName={setGuestName}
              color={color} setColor={setColor}
              make={make} setMake={setMake}
              carType={carType} setCarType={setCarType}
              notes={notes} setNotes={setNotes}
              errors={errors} setErrors={setErrors}

              pendingLookup={pendingLookup} setPendingLookup={setPendingLookup}
              lookupApplied={lookupApplied} setLookupApplied={setLookupApplied}
              plateLookedUp={plateLookedUp} setPlateLookedUp={setPlateLookedUp}
              setGuestPhone={setGuestPhone}
              lookupPlate={lookupPlate} confirmLookup={confirmLookup} rejectLookup={rejectLookup} clearGuestOnly={clearGuestOnly}
              fieldRefs={fieldRefs}
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

              errors={errors} setErrors={setErrors}

              fieldRefs={fieldRefs}
            />
          </Card>
          <Card style={{ marginBottom: rp(16) }}>
            <EntryGateSection
              eventGates={eventGates} selectedGate={selectedGate} setSelectedGate={setSelectedGate}
            />
          </Card>

          <Card style={{ marginBottom: rp(16) }}>
            <PhotoGridSection
              photos={photos}
              errors={errors}
              takePhoto={takePhoto}
              onRemovePhoto={onRemovePhoto}
            />
          </Card>

          <Card style={{ marginBottom: rp(24) }}>
            <Lbl>ASSIGN TO DRIVER *</Lbl>
            {loadingDrivers ? (
              <ActivityIndicator style={{ marginTop: rp(10), marginBottom: rp(16) }} color={theme.colors.primary} />
            ) : drivers.length === 0 ? (
              <Text style={{ color: theme.colors.textMuted, fontSize: rs(13), marginBottom: rp(16) }}>No drivers rostered on this event yet.</Text>
            ) : (
              <View ref={el => { if (fieldRefs.current) fieldRefs.current.driver = el; }} style={{ backgroundColor: theme.colors.surface, borderRadius: rp(16), borderWidth: rp(1), borderColor: errors.driver ? theme.colors.danger : theme.colors.border, overflow: "hidden" }}>
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

      <RNModal visible={!!nextPhotoLabel} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center", padding: rp(20) }}>
          <View style={{ backgroundColor: theme.colors.surface, padding: rp(24), borderRadius: rp(16), alignItems: "center", width: "100%", maxWidth: 360 }}>
            <Ionicons name="camera" size={48} color={theme.colors.primary} style={{ marginBottom: rp(16) }} />
            <Text style={{ fontSize: rs(18), fontWeight: "bold", color: theme.colors.textPrimary, marginBottom: rp(8), textAlign: "center" }}>
              Take {nextPhotoLabel?.toUpperCase()} Photo?
            </Text>
            <Text style={{ fontSize: rs(14), color: theme.colors.textSecondary, marginBottom: rp(24), textAlign: "center", lineHeight: rs(20) }}>
              Would you like to take the {nextPhotoLabel} photo now?
            </Text>
            <Btn style={{ width: "100%", marginBottom: rp(12) }} onPress={() => { const lbl = nextPhotoLabel; setNextPhotoLabel(null); setTimeout(() => takePhoto(lbl), 300); }}>
              Yes, Take Photo
            </Btn>
            <TouchableOpacity onPress={() => setNextPhotoLabel(null)} style={{ paddingVertical: rp(12), width: "100%", alignItems: "center" }}>
              <Text style={{ fontSize: rs(14), fontWeight: "800", color: theme.colors.textSecondary }}>No, Skip for Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </RNModal>
    </Screen>
  );
}