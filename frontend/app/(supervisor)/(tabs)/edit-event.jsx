import { confirmDialog } from "../../../lib/confirmDialog";
import { useEffect, useState, useRef } from "react";
import { rs, rp } from '../../../utils/responsive';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format, parse } from "date-fns";
import api from "../../../lib/api";
import { useAppStore } from "../../../lib/store";
import VenuePicker from "../../../components/VenuePicker";
import { scrollToFirstError } from "../../../lib/scrollToFirstError";
import { theme } from "../../../utils/theme";
import { Screen, TopBar, Btn } from "../../../components/valet/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

export default function EditEvent() {
  const router = useRouter();
  const { user } = useAppStore();
  const { eventId } = useLocalSearchParams();
  const scrollViewRef = useRef(null);
  const fieldRefs = useRef({});
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("23:00");
  const [venue, setVenue] = useState("");
  const [venuePlaceId, setVenuePlaceId] = useState(null);
  const [venueAddress, setVenueAddress] = useState(null);
  const [venueLat, setVenueLat] = useState(null);
  const [venueLng, setVenueLng] = useState(null);
  const [maxCars, setMaxCars] = useState("200");
  const [gateTimerMinutes, setGateTimerMinutes] = useState("5");
  const [autoCloseGraceMinutes, setAutoCloseGraceMinutes] = useState("30");
  const [zones, setZones] = useState([]);
  const [gates, setGates] = useState([]);
  const [showDP, setShowDP] = useState(false);
  const [showEDP, setShowEDP] = useState(false);
  const [showSTP, setShowSTP] = useState(false);
  const [showETP, setShowETP] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const isHotelDailyEdit = eventData?.event_type === "hotel_daily";

  const totalSlots = zones.reduce((sum, z) => sum + (parseInt(z.slots) || 0), 0);
  const maxCarsInt = parseInt(maxCars) || 200;

  const fmtTime = (d) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/events/${eventId}`);
        setEventData(data);
        setName(data.name || "");
        setVenue(data.venue || "");
        setVenuePlaceId(data.venue_place_id || null);
        setVenueAddress(data.venue_address || null);
        setVenueLat(data.venue_lat || null);
        setVenueLng(data.venue_lng || null);
        setMaxCars(String(data.max_cars || 200));
        setGateTimerMinutes(String(data.gate_timer_minutes || 5));
        setAutoCloseGraceMinutes(String(data.auto_close_grace_minutes ?? 30));
        setStartTime(data.start_time || "18:00");
        setEndTime(data.end_time || "23:00");
        if (data.date) setDate(parse(data.date, "yyyy-MM-dd", new Date()));
        if (data.end_date) setEndDate(parse(data.end_date, "yyyy-MM-dd", new Date()));
        setZones(data.zones || []);
        setGates(data.gates || []);
      } catch (e) {
        confirmDialog.info("Couldn't load event", "Something went wrong loading the event details. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  const save = async () => {
    const errs = {};
    if (!isHotelDailyEdit && !name.trim()) errs.name = "Event name is required";
    if (!venue.trim()) errs.venue = "Venue is required";
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      scrollToFirstError(["name", "venue"], errs, fieldRefs, scrollViewRef);
      return;
    }
    const endDT = new Date(`${format(endDate, "yyyy-MM-dd")}T${endTime}:00`);
    const startDT = new Date(`${format(date, "yyyy-MM-dd")}T${startTime}:00`);
    if (endDT <= startDT) {
      confirmDialog.info("End time before start time", "The event's end time must be after the start time.");
      return;
    }
    if (totalSlots > maxCarsInt) {
      confirmDialog.info(
        "Invalid zones",
        `Total slots (${totalSlots}) cannot exceed max cars (${maxCarsInt}). Please reduce zone slots.`
      );
      return;
    }
    setSaving(true);
    try {
      if (isHotelDailyEdit) {
        await api.patch(`/events/${eventId}`, {
          gate_timer_minutes: parseInt(gateTimerMinutes) || 5,
          auto_close_grace_minutes: parseInt(autoCloseGraceMinutes) || 30,
          start_time: startTime,
          end_time: endTime,
          venue: venue.trim(),
          venue_place_id: venuePlaceId,
          venue_address: venueAddress,
          venue_lat: venueLat,
          venue_lng: venueLng,
          gates: gates.filter((g) => g?.trim()),
        });
      } else {
        await api.patch(`/events/${eventId}`, {
          name: name.trim(),
          date: format(date, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
          start_time: startTime,
          end_time: endTime,
          venue: venue.trim(),
          venue_place_id: venuePlaceId,
          venue_address: venueAddress,
          venue_lat: venueLat,
          venue_lng: venueLng,
          max_cars: parseInt(maxCars) || 200,
          zones: zones.filter((z) => z.name?.trim()),
          gates: gates.filter((g) => g?.trim()),
          gate_timer_minutes: parseInt(gateTimerMinutes) || 5,
          auto_close_grace_minutes: parseInt(autoCloseGraceMinutes) || 30,
        });
      }
      router.back();
    } catch (e) {
      confirmDialog.info("Couldn't save", e.response?.data?.detail || "Something went wrong saving. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Screen scroll={false}>
      <TopBar title={isHotelDailyEdit ? "Edit Today's Parking" : "Edit Event"} onBack={() => router.back()} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView ref={scrollViewRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: rp(theme.spacing.xl), paddingBottom: rp(theme.spacing.xxxl) + (insets?.bottom || 0) + tabBarHeight }}>
          {!isHotelDailyEdit && (
            <>
              <Text style={modalLabel}>EVENT NAME</Text>
              <View ref={el => { if (fieldRefs.current) fieldRefs.current.name = el; }} style={[inputRowStyle, formErrors.name && modalInputError]}>
                <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
                <TextInput value={name} onChangeText={(txt) => {
                  setName(txt);
                  if (formErrors.name) setFormErrors(prev => ({ ...prev, name: null }));
                }} style={{ flex: 1, marginLeft: rp(10), paddingVertical: rp(14), fontSize: rs(15), color: theme.colors.textPrimary, fontFamily: theme.fontFamily.regular }} />
              </View>
              {formErrors.name && <Text style={modalErrorText}>* {formErrors.name}</Text>}

              <View style={{ flexDirection: "row", gap: rp(12) }}>
                <View style={{ flex: 1 }}>
                  <Text style={modalLabel}>START DATE</Text>
                  <TouchableOpacity onPress={() => setShowDP(true)} style={inputBoxStyle}>
                    <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
                    <Text style={{ marginLeft: rp(10), color: theme.colors.textPrimary, flex: 1, fontSize: rs(14), fontFamily: theme.fontFamily.regular }}>{format(date, "MMM d, yyyy")}</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={modalLabel}>END DATE</Text>
                  <TouchableOpacity onPress={() => setShowEDP(true)} style={inputBoxStyle}>
                    <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
                    <Text style={{ marginLeft: rp(10), color: theme.colors.textPrimary, flex: 1, fontSize: rs(14), fontFamily: theme.fontFamily.regular }}>{format(endDate, "MMM d, yyyy")}</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          <Text style={modalLabel}>VENUE</Text>
          <View ref={el => { if (fieldRefs.current) fieldRefs.current.venue = el; }} style={[inputRowStyle, formErrors.venue && modalInputError]}>
            <Ionicons name="location-outline" size={18} color={theme.colors.primary} />
            <VenuePicker
              value={venue}
              onSelect={(val) => {
                setVenue(val.venue || "");
                setVenuePlaceId(val.venue_place_id);
                setVenueAddress(val.venue_address);
                setVenueLat(val.venue_lat);
                setVenueLng(val.venue_lng);
                if (formErrors.venue) setFormErrors(prev => ({ ...prev, venue: null }));
              }}
              placeholder="Search venue e.g. ITC Narmada"
            />
          </View>
          {formErrors.venue && <Text style={modalErrorText}>* {formErrors.venue}</Text>}

          <View style={{ flexDirection: "row", gap: rp(12) }}>
            <View style={{ flex: 1 }}>
              <Text style={modalLabel}>START TIME</Text>
              <TouchableOpacity onPress={() => setShowSTP(true)} style={inputBoxStyle}>
                <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
                <Text style={{ marginLeft: rp(10), color: theme.colors.textPrimary, flex: 1, fontFamily: theme.fontFamily.regular }}>{startTime}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={modalLabel}>END TIME</Text>
              <TouchableOpacity onPress={() => setShowETP(true)} style={inputBoxStyle}>
                <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
                <Text style={{ marginLeft: rp(10), color: theme.colors.textPrimary, flex: 1, fontFamily: theme.fontFamily.regular }}>{endTime}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {!isHotelDailyEdit && (
            <>
              <Text style={modalLabel}>MAX CARS</Text>
              <View style={inputRowStyle}>
                <Ionicons name="car-outline" size={18} color={theme.colors.primary} />
                <TextInput value={maxCars} onChangeText={setMaxCars} keyboardType="numeric" style={{ flex: 1, marginLeft: rp(10), paddingVertical: rp(14), fontSize: rs(15), color: theme.colors.textPrimary, fontFamily: theme.fontFamily.regular }} />
              </View>
            </>
          )}
          <Text style={modalLabel}>GATE WAIT TIMER (MINUTES)</Text>
          <View style={inputRowStyle}>
            <Ionicons name="timer-outline" size={18} color={theme.colors.primary} />
            <TextInput value={gateTimerMinutes} onChangeText={setGateTimerMinutes} keyboardType="numeric" style={{ flex: 1, marginLeft: rp(10), paddingVertical: rp(14), fontSize: rs(15), color: theme.colors.textPrimary, fontFamily: theme.fontFamily.regular }} />
          </View>

          <Text style={modalLabel}>AUTO-CLOSE GRACE PERIOD (MINUTES)</Text>
          <View style={inputRowStyle}>
            <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
            <TextInput value={autoCloseGraceMinutes} onChangeText={setAutoCloseGraceMinutes} keyboardType="numeric" style={{ flex: 1, marginLeft: rp(10), paddingVertical: rp(14), fontSize: rs(15), color: theme.colors.textPrimary, fontFamily: theme.fontFamily.regular }} />
          </View>

          {!isHotelDailyEdit && (
            <>
              <Text style={modalLabel}>PARKING ZONES</Text>
              {zones.length === 0 && (
                <Text style={{ color: theme.colors.textMuted, fontSize: rs(14), textAlign: "center", marginBottom: rp(8), fontFamily: theme.fontFamily.regular }}>
                  No parking zones added yet. Tap Add Zone to create one.
                </Text>
              )}
              {zones.map((z, i) => (
                <View key={i} style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(16), padding: rp(12), marginBottom: rp(8), flexDirection: "row", alignItems: "center", gap: rp(8), borderWidth: rp(1), borderColor: theme.colors.border }}>
                  <Ionicons name="location" size={18} color={theme.colors.primary} />
                  <TextInput
                    value={z.name}
                    onChangeText={(v) => {
                      const n = [...zones];
                      n[i].name = v;
                      setZones(n);
                    }}
                    placeholder="Zone"
                    placeholderTextColor={theme.colors.textMuted}
                    style={{ flex: 1, borderWidth: rp(1), borderColor: theme.colors.border, borderRadius: rp(12), paddingHorizontal: rp(12), paddingVertical: rp(10), color: theme.colors.textPrimary, fontFamily: theme.fontFamily.regular }}
                  />
                  <TextInput
                    value={String(z.slots)}
                    onChangeText={(v) => {
                      const n = [...zones];
                      n[i].slots = parseInt(v) || 0;
                      setZones(n);
                    }}
                    keyboardType="numeric"
                    placeholder="Slots"
                    placeholderTextColor={theme.colors.textMuted}
                    style={{ width: rp(70), borderWidth: rp(1), borderColor: theme.colors.border, borderRadius: rp(12), paddingHorizontal: rp(10), paddingVertical: rp(10), textAlign: "center", color: theme.colors.textPrimary, fontFamily: theme.fontFamily.regular }}
                  />
                  <TouchableOpacity
                    onPress={() => setZones(zones.filter((_, idx) => idx !== i))}
                    style={{ padding: rp(4) }}
                  >
                    <Ionicons name="remove-circle-outline" size={20} color={theme.colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              <Text
                style={{
                  color: totalSlots > maxCarsInt ? theme.colors.danger : theme.colors.success,
                  fontWeight: "700",
                  fontSize: rs(13),
                  textAlign: "right",
                  marginBottom: rp(8),
                  fontFamily: theme.fontFamily.bold,
                }}
              >
                Total slots: {totalSlots} / {maxCarsInt}
              </Text>
              <TouchableOpacity
                onPress={() => setZones([...zones, { name: `Zone ${String.fromCharCode(65 + zones.length)}`, slots: 50 }])}
                style={{ flexDirection: "row", alignItems: "center", gap: rp(6), paddingVertical: rp(10) }}
              >
                <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
                <Text style={{ color: theme.colors.primary, fontWeight: "700", fontSize: rs(13), fontFamily: theme.fontFamily.bold }}>Add Zone</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={modalLabel}>ENTRY GATES</Text>
          {gates.map((g, i) => (
            <View key={i} style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(16), padding: rp(12), marginBottom: rp(8), flexDirection: "row", alignItems: "center", gap: rp(8), borderWidth: rp(1), borderColor: theme.colors.border }}>
              <Ionicons name="enter-outline" size={18} color={theme.colors.primary} />
              <TextInput
                value={g}
                onChangeText={(v) => {
                  const n = [...gates];
                  n[i] = v;
                  setGates(n);
                }}
                placeholder="Gate name"
                placeholderTextColor={theme.colors.textMuted}
                style={{ flex: 1, borderWidth: rp(1), borderColor: theme.colors.border, borderRadius: rp(12), paddingHorizontal: rp(12), paddingVertical: rp(10), color: theme.colors.textPrimary, fontFamily: theme.fontFamily.regular }}
              />
              <TouchableOpacity onPress={() => setGates(gates.filter((_, k) => k !== i))}>
                <Ionicons name="close-circle" size={24} color={theme.colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            onPress={() => setGates([...gates, ""])}
            style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(16), paddingVertical: rp(12), alignItems: "center", marginBottom: rp(24), flexDirection: "row", justifyContent: "center", borderWidth: rp(1), borderColor: theme.colors.border }}
          >
            <Ionicons name="add" size={18} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.primary, fontWeight: "800", marginLeft: rp(6), letterSpacing: rs(1), fontFamily: theme.fontFamily.bold }}>ADD GATE</Text>
          </TouchableOpacity>

          <Btn onPress={save} disabled={saving} style={{ marginTop: rp(theme.spacing.sm) }}>
            {saving ? <ActivityIndicator color="#fff" /> : "SAVE CHANGES"}
          </Btn>
          <View style={{ height: rp(40) }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {showDP && <DateTimePicker value={date} mode="date" onChange={(_, d) => { setShowDP(false); if (d) setDate(d); }} />}
      {showEDP && <DateTimePicker value={endDate} mode="date" onChange={(_, d) => { setShowEDP(false); if (d) setEndDate(d); }} />}
      {showSTP && <DateTimePicker value={new Date(`2024-01-01T${startTime}:00`)} mode="time" is24Hour onChange={(_, d) => { setShowSTP(false); if (d) setStartTime(fmtTime(d)); }} />}
      {showETP && <DateTimePicker value={new Date(`2024-01-01T${endTime}:00`)} mode="time" is24Hour onChange={(_, d) => { setShowETP(false); if (d) setEndTime(fmtTime(d)); }} />}
    </Screen>
  );
}

const modalLabel = { fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(2), marginBottom: rp(theme.spacing.sm), marginTop: rp(theme.spacing.sm), fontFamily: theme.fontFamily.bold };
const modalInputError = { borderColor: theme.colors.danger };
const modalErrorText = { color: theme.colors.danger, fontSize: rs(11), fontWeight: "600", marginTop: rp(-12), marginBottom: rp(theme.spacing.md), fontFamily: theme.fontFamily.regular };
const inputRowStyle = {
  backgroundColor: theme.colors.surfaceAlt,
  borderRadius: rp(14),
  borderWidth: rp(1),
  borderColor: theme.colors.border,
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: rp(16),
  marginBottom: rp(theme.spacing.lg),
};
const inputBoxStyle = {
  ...inputRowStyle,
  paddingVertical: rp(14),
};
