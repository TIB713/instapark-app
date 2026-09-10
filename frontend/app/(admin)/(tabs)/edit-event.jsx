import { confirmDialog } from "../../../lib/confirmDialog";
import { useEffect, useState, useRef } from "react";
import { rs, rp } from "../../../utils/responsive";
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
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format, parse } from "date-fns";
import api from "../../../lib/api";
import { useAppStore } from "../../../lib/store";
import VenuePicker from "../../../components/VenuePicker";

import { scrollToFirstError } from "../../../lib/scrollToFirstError";
import { theme } from "../../../utils/theme";
import { Field, FieldLabel, fieldTextInputStyle } from "../../../components/valet/ui";
import { Hero } from "../../../components/admin/Hero";

const inputBoxStyle = {
  backgroundColor: theme.colors.surface,
  borderRadius: rp(theme.radius.md),
  borderWidth: rp(1),
  borderColor: theme.colors.border,
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: rp(14),
  paddingVertical: rp(14),
  marginBottom: rp(theme.spacing.md),
};

const errorTextStyle = {
  color: theme.colors.danger,
  fontSize: rs(theme.fontSize.caption),
  fontWeight: theme.fontWeight.bold,
  marginTop: rp(-8),
  marginBottom: rp(12)
};

export default function EditEvent() {
  const router = useRouter();
  const { user } = useAppStore();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { eventId } = useLocalSearchParams();
  const scrollViewRef = useRef(null);
  const fieldRefs = useRef({});

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
      const detail = e.response?.data?.detail || "Something went wrong saving. Check your connection and try again.";
      if (typeof detail === "string" && (detail.toLowerCase().includes("exceeds the available limit") || detail.toLowerCase().includes("exceeding the available limit"))) {
        const isHotelOwner = user?.provider_type === "hotel_owner";
        confirmDialog.info("Capacity Limit Reached", `The car/QR capacity for this ${isHotelOwner ? 'hotel' : 'account'} has been reached. Please reduce the number of cars for this event, or contact your provider/superadmin to increase the allocation.`);
      } else {
        confirmDialog.info("Couldn't save", detail);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfaceAlt }} testID="edit-event-screen">
      <Hero
        eyebrow="Event settings"
        title={isHotelDailyEdit ? "Edit Today's Parking" : `Edit ${name || 'Event'}`}
        onBack={() => router.back()}
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView ref={scrollViewRef} style={{ flex: 1, paddingHorizontal: rp(theme.spacing.xl), paddingTop: rp(theme.spacing.lg) }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: rp(theme.spacing.xxxl) + (insets?.bottom || 0) + tabBarHeight }}>
          {!isHotelDailyEdit && (
            <>
              <FieldLabel>EVENT NAME</FieldLabel>
              <Field icon="calendar-outline" error={formErrors.name}>
                <TextInput
                  ref={el => { if (fieldRefs.current) fieldRefs.current.name = el; }}
                  value={name}
                  onChangeText={(txt) => {
                    setName(txt);
                    if (formErrors.name) setFormErrors(prev => ({ ...prev, name: null }));
                  }}
                  style={fieldTextInputStyle}
                />
              </Field>
              {formErrors.name && <Text style={errorTextStyle}>* {formErrors.name}</Text>}

              <View style={{ flexDirection: "row", gap: rp(theme.spacing.md) }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>START DATE</FieldLabel>
                  <TouchableOpacity onPress={() => setShowDP(true)} style={inputBoxStyle}>
                    <Ionicons name="calendar-outline" size={rs(18)} color={theme.colors.primary} />
                    <Text style={{ fontFamily: theme.fontFamily.bold, marginLeft: rp(10), color: theme.colors.textPrimary, flex: 1, fontSize: rs(theme.fontSize.body), fontWeight: theme.fontWeight.bold }}>{format(date, "MMM d, yyyy")}</Text>
                    <Ionicons name="chevron-down" size={rs(16)} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>END DATE</FieldLabel>
                  <TouchableOpacity onPress={() => setShowEDP(true)} style={inputBoxStyle}>
                    <Ionicons name="calendar-outline" size={rs(18)} color={theme.colors.primary} />
                    <Text style={{ fontFamily: theme.fontFamily.bold, marginLeft: rp(10), color: theme.colors.textPrimary, flex: 1, fontSize: rs(theme.fontSize.body), fontWeight: theme.fontWeight.bold }}>{format(endDate, "MMM d, yyyy")}</Text>
                    <Ionicons name="chevron-down" size={rs(16)} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          <FieldLabel>VENUE</FieldLabel>
          <View ref={el => { if (fieldRefs.current) fieldRefs.current.venue = el; }}>
            <Field icon="location-outline" error={formErrors.venue}>
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
            </Field>
            {formErrors.venue && <Text style={errorTextStyle}>* {formErrors.venue}</Text>}
          </View>

          <View style={{ flexDirection: "row", gap: rp(theme.spacing.md) }}>
            <View style={{ flex: 1 }}>
              <FieldLabel>START TIME</FieldLabel>
              <TouchableOpacity onPress={() => setShowSTP(true)} style={inputBoxStyle}>
                <Ionicons name="time-outline" size={rs(18)} color={theme.colors.primary} />
                <Text style={{ fontFamily: theme.fontFamily.bold, marginLeft: rp(10), color: theme.colors.textPrimary, flex: 1, fontSize: rs(theme.fontSize.body), fontWeight: theme.fontWeight.bold }}>{startTime}</Text>
                <Ionicons name="chevron-down" size={rs(16)} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel>END TIME</FieldLabel>
              <TouchableOpacity onPress={() => setShowETP(true)} style={inputBoxStyle}>
                <Ionicons name="time-outline" size={rs(18)} color={theme.colors.primary} />
                <Text style={{ fontFamily: theme.fontFamily.bold, marginLeft: rp(10), color: theme.colors.textPrimary, flex: 1, fontSize: rs(theme.fontSize.body), fontWeight: theme.fontWeight.bold }}>{endTime}</Text>
                <Ionicons name="chevron-down" size={rs(16)} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {!isHotelDailyEdit && (
            <>
              <FieldLabel>MAX CARS</FieldLabel>
              <Field icon="car-outline">
                <TextInput value={maxCars} onChangeText={setMaxCars} keyboardType="numeric" style={fieldTextInputStyle} />
              </Field>
            </>
          )}

          {!isHotelDailyEdit && (
            <>
              <FieldLabel>PARKING ZONES</FieldLabel>
              {zones.length === 0 && (
                <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, fontSize: rs(theme.fontSize.body), textAlign: "center", marginBottom: rp(8) }}>
                  No parking zones added yet. Tap Add Zone to create one.
                </Text>
              )}
              {zones.map((z, i) => (
                <View key={i} style={{ backgroundColor: theme.colors.surface, borderRadius: rp(theme.radius.md), padding: rp(12), marginBottom: rp(8), flexDirection: "row", alignItems: "center", gap: rp(8), borderWidth: rp(1), borderColor: theme.colors.border }}>
                  <Ionicons name="location" size={rs(18)} color={theme.colors.primary} />
                  <TextInput
                    value={z.name}
                    onChangeText={(v) => {
                      const n = [...zones];
                      n[i].name = v;
                      setZones(n);
                    }}
                    placeholder="Zone"
                    placeholderTextColor={theme.colors.textMuted}
                    style={{ flex: 1, borderWidth: rp(1), borderColor: theme.colors.border, borderRadius: rp(theme.radius.sm), paddingHorizontal: rp(12), paddingVertical: rp(10), color: theme.colors.textPrimary, fontWeight: theme.fontWeight.bold }}
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
                    style={{ width: rp(70), borderWidth: rp(1), borderColor: theme.colors.border, borderRadius: rp(theme.radius.sm), paddingHorizontal: rp(10), paddingVertical: rp(10), textAlign: "center", color: theme.colors.textPrimary, fontWeight: theme.fontWeight.bold }}
                  />
                  <TouchableOpacity
                    onPress={() => setZones(zones.filter((_, idx) => idx !== i))}
                    style={{ padding: rp(4) }}
                  >
                    <Ionicons name="remove-circle-outline" size={rs(24)} color={theme.colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              <Text
                style={{
                  color: totalSlots > maxCarsInt ? theme.colors.danger : theme.colors.success,
                  fontWeight: theme.fontWeight.bold,
                  fontSize: rs(theme.fontSize.caption),
                  textAlign: "right",
                  marginBottom: rp(8),
                }}
              >
                Total slots: {totalSlots} / {maxCarsInt}
              </Text>
              <TouchableOpacity
                onPress={() => setZones([...zones, { name: `Zone ${String.fromCharCode(65 + zones.length)}`, slots: 50 }])}
                style={{ backgroundColor: theme.colors.primaryLight, borderRadius: rp(theme.radius.md), paddingVertical: rp(12), alignItems: "center", marginBottom: rp(theme.spacing.md), flexDirection: "row", justifyContent: "center" }}
              >
                <Ionicons name="add" size={rs(18)} color={theme.colors.primary} />
                <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.primary, fontWeight: theme.fontWeight.bold, marginLeft: rp(6), letterSpacing: rs(1) }}>ADD ZONE</Text>
              </TouchableOpacity>
            </>
          )}

          <FieldLabel>ENTRY GATES</FieldLabel>
          {gates.map((g, i) => (
            <View key={i} style={{ backgroundColor: theme.colors.surface, borderRadius: rp(theme.radius.md), padding: rp(12), marginBottom: rp(8), flexDirection: "row", alignItems: "center", gap: rp(8), borderWidth: rp(1), borderColor: theme.colors.border }}>
              <Ionicons name="enter-outline" size={rs(18)} color={theme.colors.primary} />
              <TextInput
                value={g}
                onChangeText={(v) => {
                  const n = [...gates];
                  n[i] = v;
                  setGates(n);
                }}
                placeholder="Gate name"
                placeholderTextColor={theme.colors.textMuted}
                style={{ flex: 1, borderWidth: rp(1), borderColor: theme.colors.border, borderRadius: rp(theme.radius.sm), paddingHorizontal: rp(12), paddingVertical: rp(10), color: theme.colors.textPrimary, fontWeight: theme.fontWeight.bold }}
              />
              <TouchableOpacity onPress={() => setGates(gates.filter((_, k) => k !== i))}>
                <Ionicons name="close-circle" size={rs(24)} color={theme.colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            onPress={() => setGates([...gates, ""])}
            style={{ backgroundColor: theme.colors.primaryLight, borderRadius: rp(theme.radius.md), paddingVertical: rp(12), alignItems: "center", marginBottom: rp(theme.spacing.lg), flexDirection: "row", justifyContent: "center" }}
          >
            <Ionicons name="add" size={rs(18)} color={theme.colors.primary} />
            <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.primary, fontWeight: theme.fontWeight.bold, marginLeft: rp(6), letterSpacing: rs(1) }}>ADD GATE</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", gap: rp(theme.spacing.md) }}>
            <View style={{ flex: 1 }}>
              <FieldLabel>WAIT TIMER (MINS)</FieldLabel>
              <Field icon="timer-outline">
                <TextInput
                  value={gateTimerMinutes}
                  onChangeText={setGateTimerMinutes}
                  keyboardType="numeric"
                  style={fieldTextInputStyle}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel>GRACE (MINS)</FieldLabel>
              <Field icon="time-outline">
                <TextInput
                  value={autoCloseGraceMinutes}
                  onChangeText={setAutoCloseGraceMinutes}
                  keyboardType="numeric"
                  style={fieldTextInputStyle}
                />
              </Field>
            </View>
          </View>
          <TouchableOpacity
            onPress={save}
            disabled={saving}
            style={{
              backgroundColor: theme.colors.accent,
              borderRadius: rp(theme.radius.md),
              paddingVertical: rp(16),
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: theme.colors.accent,
              shadowOpacity: 0.3,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
              marginTop: rp(theme.spacing.xl)
            }}
          >
            {saving ? (
              <ActivityIndicator color={theme.colors.accentForeground} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={rs(20)} color={theme.colors.accentForeground} style={{ marginRight: rp(8) }} />
                <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.accentForeground, fontWeight: theme.fontWeight.bold, fontSize: rs(theme.fontSize.bodyLarge) }}>
                  SAVE CHANGES
                </Text>
              </>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {showDP && <DateTimePicker value={date} mode="date" onChange={(_, d) => { setShowDP(false); if (d) setDate(d); }} />}
      {showEDP && <DateTimePicker value={endDate} mode="date" onChange={(_, d) => { setShowEDP(false); if (d) setEndDate(d); }} />}
      {showSTP && <DateTimePicker value={new Date(`2024-01-01T${startTime}:00`)} mode="time" is24Hour onChange={(_, d) => { setShowSTP(false); if (d) setStartTime(fmtTime(d)); }} />}
      {showETP && <DateTimePicker value={new Date(`2024-01-01T${endTime}:00`)} mode="time" is24Hour onChange={(_, d) => { setShowETP(false); if (d) setEndTime(fmtTime(d)); }} />}
    </View>
  );
}
