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
import { enqueueCheckinAction } from "../../../lib/offline";

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

const VehicleDetailsSection = memo(({
  plate, setPlate, guestName, setGuestName, color, setColor, make, setMake, carType, setCarType, notes, setNotes, errors, setErrors, instantPark, eventAllowsInstantPark,
  pendingLookup, setPendingLookup, lookupApplied, setLookupApplied, plateLookedUp, setPlateLookedUp, setGuestPhone, setAltGuestPhone,
  lookupPlate, confirmLookup, rejectLookup, clearGuestOnly, fieldRefs
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
      <View ref={el => { if (fieldRefs.current) fieldRefs.current.guestName = el; }}  style={[inputRow, errors.guestName && { borderColor: theme.colors.danger, marginBottom: 0 }]}>
        <Ionicons name="person-outline" size={20} color={theme.colors.primary} />
        <TextInput ref={el => { if (fieldRefs.current) fieldRefs.current.guestName = el; }}  value={guestName} onChangeText={(text) => { setGuestName(text); if (errors.guestName) setErrors(prev => ({ ...prev, guestName: undefined })); }} placeholder="Guest Name" placeholderTextColor={theme.colors.textMuted} style={textInput} />
      </View>
      {errors.guestName && <Text style={{ color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.guestName}</Text>}
      <Lbl>{eventAllowsInstantPark && instantPark ? "VEHICLE COLOR (OPTIONAL)" : "VEHICLE COLOR *"}</Lbl>
      <View ref={el => { if (fieldRefs.current) fieldRefs.current.color = el; }}  style={[inputRow, errors.color && { borderColor: theme.colors.danger, marginBottom: 0 }]}>
        <Ionicons name="color-palette-outline" size={20} color={theme.colors.primary} />
        <TextInput ref={el => { if (fieldRefs.current) fieldRefs.current.color = el; }}  value={color} onChangeText={(text) => { setColor(text); if (errors.color) setErrors(prev => ({ ...prev, color: undefined })); }} placeholder="Black" placeholderTextColor={theme.colors.textMuted} style={textInput} />
      </View>
      {errors.color && <Text style={{ color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(4), marginBottom: rp(8) }}>* {errors.color}</Text>}
      <Lbl>{eventAllowsInstantPark && instantPark ? "VEHICLE MAKE/MODEL (OPTIONAL)" : "VEHICLE MAKE/MODEL *"}</Lbl>
      <View ref={el => { if (fieldRefs.current) fieldRefs.current.make = el; }}  style={[inputRow, errors.make && { borderColor: theme.colors.danger, marginBottom: 0 }]}>
        <Ionicons name="construct-outline" size={20} color={theme.colors.primary} />
        <TextInput ref={el => { if (fieldRefs.current) fieldRefs.current.make = el; }}  value={make} onChangeText={(text) => { setMake(text); if (errors.make) setErrors(prev => ({ ...prev, make: undefined })); }} placeholder="Honda Civic" placeholderTextColor={theme.colors.textMuted} style={textInput} />
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
  const [eventGates, setEventGates] = useState([]);
  const [selectedGate, setSelectedGate] = useState("");
  const [carType, setCarType] = useState("normal");
  const [altGuestPhone, setAltGuestPhone] = useState("");
  const [hasDamage, setHasDamage] = useState(false);
  const [damageNotes, setDamageNotes] = useState("");
  const [damageTypes, setDamageTypes] = useState([]);
  const [showOtherDamage, setShowOtherDamage] = useState(false);
  
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
  
  const params = useLocalSearchParams();
  const returnTo = params.returnTo || "/(supervisor)/(tabs)/scan";

  useFocusEffect(
    useCallback(() => {
      if (!params.prefill_plate) {
        setPlate("");
        setColor("");
        setMake("");
        setNotes("");
        setGuestNotes("");
        setGuestPhone("");
        setSelectedGate("");
        setCarType("normal");
        setAltGuestPhone("");
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
        setInstantPark(false);
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
        setEventAllowsInstantPark(!!data.allow_instant_park);
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
          if (d.altGuestPhone) setAltGuestPhone(d.altGuestPhone);
          if (d.hasDamage) setHasDamage(d.hasDamage);
          if (d.damageNotes) setDamageNotes(d.damageNotes);
          if (d.damageTypes) setDamageTypes(d.damageTypes);
          if (d.guestName) setGuestName(d.guestName);
        }
      } catch { }
    })();
  }, [currentEventId]);

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
    setAltGuestPhone("");
    setLookupApplied(false);
  };

  useEffect(() => {
    if (!submitting) {
      const draft = { plate, color, make, notes, guestPhone, selectedGate, carType, altGuestPhone, hasDamage, damageNotes, damageTypes, guestName };
      AsyncStorage.setItem("add_car_draft", JSON.stringify(draft)).catch(() => { });
    }
  }, [plate, color, make, notes, guestPhone, selectedGate, carType, altGuestPhone, hasDamage, damageNotes, damageTypes, guestName, submitting]);

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
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setSubmitting(false);
      scrollToFirstError(['plate', 'color', 'make', 'guestName', 'guestPhone', 'altGuestPhone'], errs, fieldRefs, scrollViewRef);
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
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        if (isPreRegistered && prefilledCarId) {
          await enqueueCheckinAction({
            action: "complete_prereg",
            carId: prefilledCarId,
            color: color.trim(),
            make: make.trim(),
            notes: notes.trim(),
            gate: selectedGate,
          });
          await AsyncStorage.removeItem("add_car_draft");
          confirmDialog.info("Saved offline", "Pre-registered check-in queued. Will sync when connected.");
          router.back();
          return;
        } else {
          const tempId = `offline_${Date.now()}`;
          await enqueueCheckinAction({
            eventId: currentEventId,
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
          });
          await AsyncStorage.removeItem("add_car_draft");
          confirmDialog.info("Saved offline", "Vehicle check-in queued. Will sync when connected.");
          router.replace({
            pathname: "/(supervisor)/(tabs)/qr-display",
            params: { carId: tempId, plate: plate.trim().toUpperCase(), checkinCode: "SYNC", token: "sync_pending" },
          });
          return;
        }
      }

      try { await api.post(`/slots/event/${currentEventId}/initialize`); } catch { }
      
      if (isPreRegistered && prefilledCarId) {
        const { data: updatedCar } = await api.patch(`/cars/${prefilledCarId}/complete-checkin`, {
          color: color.trim(),
          make: make.trim(),
          notes: notes.trim(),
          gate: selectedGate,
        });
        await AsyncStorage.removeItem("add_car_draft");
        router.replace({
          pathname: "/(supervisor)/(tabs)/qr-display",
          params: { carId: updatedCar.id, plate: updatedCar.plate, checkinCode: updatedCar.checkin_code, token: updatedCar.retrieval_token },
        });
        return;
      }

      const payload = {
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

      const { data: car } = await api.post("/cars", payload);
      await AsyncStorage.removeItem("add_car_draft");
      router.replace({
        pathname: "/(supervisor)/(tabs)/qr-display",
        params: { carId: car.id, plate: car.plate, checkinCode: car.checkin_code, token: car.retrieval_token },
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
            isPreRegistered,
            prefilledCarId,
            carType,
            altGuestPhone: altPhoneToSave || null,
            hasDamage,
            damageNotes: damageNotes.trim() || null,
            damageTypes,
            guestName: guestName.trim(),
            instantPark: eventAllowsInstantPark && instantPark,
          });
          await AsyncStorage.removeItem("add_car_draft");
          confirmDialog.info("Saved for retry", "Connection was too slow to confirm. This check-in has been queued and will sync automatically.");
          router.replace({
            pathname: "/(supervisor)/(tabs)/qr-display",
            params: { carId: `offline_${Date.now()}`, plate: plate.trim().toUpperCase(), checkinCode: "SYNC", token: "sync_pending" },
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
    } finally { setSubmitting(false); }
  };

  return (
    <Screen scroll={false} testID="add-car-screen">
      <TopBar
        title="Check In Car"
        onBack={() => router.replace(returnTo)}
        rightNode={
          <TouchableOpacity onPress={() => router.push({ pathname: "/(supervisor)/(tabs)/scan", params: { returnTo } })}>
            <Ionicons name="qr-code-outline" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        }
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView ref={scrollViewRef} style={{ flex: 1, paddingHorizontal: rp(20), paddingTop: rp(18) }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: rp(100)  + tabBarHeight}}>
          
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
              altGuestPhone={altGuestPhone} setAltGuestPhone={setAltGuestPhone}
              errors={errors} setErrors={setErrors}
              instantPark={instantPark} eventAllowsInstantPark={eventAllowsInstantPark}
              fieldRefs={fieldRefs}
            />
          </Card>
          <Card style={{ marginBottom: rp(16) }}>
            <EntryGateSection
              eventGates={eventGates} selectedGate={selectedGate} setSelectedGate={setSelectedGate}
            />
          </Card>

          <Btn variant="accent" onPress={submit} disabled={submitting} style={{ marginBottom: rp(16) }}>
            {submitting ? "CHECKING IN..." : "CHECK IN VEHICLE"}
          </Btn>
          <View style={{ height: rp(40) }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
