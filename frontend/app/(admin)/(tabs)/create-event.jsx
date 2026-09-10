import { useState, useEffect, useRef } from "react";
import { confirmDialog } from "../../../lib/confirmDialog";
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";
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

export default function CreateEvent() {
  const router = useRouter();
  const { user, setCurrentEventId } = useAppStore();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const isHotelOwner = user?.provider_type === "hotel_owner";
  const scrollViewRef = useRef(null);
  const fieldRefs = useRef({});

  const [eventType, setEventType] = useState(isHotelOwner ? "hotel_special" : "");
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
  const [hostName, setHostName] = useState("");
  const [hostEmail, setHostEmail] = useState("");
  const [maxCars, setMaxCars] = useState("200");
  const [gateTimerMinutes, setGateTimerMinutes] = useState("5");
  const [autoCloseGraceMinutes, setAutoCloseGraceMinutes] = useState("30");
  const [zones, setZones] = useState([{ name: "A", slots: 20 }]);
  const [gates, setGates] = useState(["Main Gate"]);
  const [showDP, setShowDP] = useState(false);
  const [showEDP, setShowEDP] = useState(false);
  const [showSTP, setShowSTP] = useState(false);
  const [showETP, setShowETP] = useState(false);
  const [saving, setSaving] = useState(false);
  const [myHotel, setMyHotel] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (isHotelOwner) {
      api.get("/hotels")
        .then(({ data }) => {
          if (data && data.length > 0) {
            setMyHotel(data[0]);
            setVenue(data[0].name || "");
          }
        })
        .catch((e) => {
          console.log("Error fetching hotel for hotel owner:", e);
        });
    }
  }, [isHotelOwner]);

  const totalSlots = zones.reduce((sum, z) => sum + (parseInt(z.slots) || 0), 0);
  const maxCarsInt = parseInt(maxCars) || 200;

  const fmtTime = (d) => {
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  };

  const save = async () => {
    const errs = {};
    if (!name.trim()) errs.name = "Event name is required";
    if (!venue.trim()) errs.venue = "Venue is required";
    if (!maxCars || parseInt(maxCars) < 1) errs.maxCars = "Max cars must be at least 1";
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      scrollToFirstError(["name", "venue", "maxCars"], errs, fieldRefs, scrollViewRef);
      return;
    }
    const startDT = new Date(`${format(date, "yyyy-MM-dd")}T${startTime}:00`);
    if (startDT < new Date()) {
      confirmDialog.info("Start time is in the past", "The event start date and time cannot be in the past.");
      return;
    }
    const endDT = new Date(`${format(endDate, "yyyy-MM-dd")}T${endTime}:00`);
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
      const payload = {
        name: name.trim(),
        date: format(date, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        start_time: startTime,
        end_time: endTime,
        venue: venue.trim(),
        max_cars: parseInt(maxCars) || 200,
        gate_timer_minutes: parseInt(gateTimerMinutes) || 5,
        auto_close_grace_minutes: parseInt(autoCloseGraceMinutes) || 30,
        zones: zones.filter((z) => z.name.trim()),
        gates: gates.filter((g) => g.trim()),
        is_template: false,
      };

      let res;
      if (isHotelOwner) {
        if (!myHotel) {
          confirmDialog.info("No hotel found", "Please contact support.");
          setSaving(false);
          return;
        }
        res = await api.post(`/hotels/${myHotel.id}/events`, payload);
      } else {
        // Normal valet provider
        res = await api.post("/events", {
          ...payload,
          event_type: "regular", // default for valet provider
        });
      }

      const { data } = res;
      if (hostName.trim() && hostEmail.trim()) {
        try {
          await api.patch(`/events/${data.id}/host`, {
            host_name: hostName.trim(),
            host_email: hostEmail.trim()
          });
        } catch (err) {
          confirmDialog.info("Host invite failed", "Event created, but host invite failed to send.");
        }
      }
      setCurrentEventId(data.id);
      await AsyncStorage.setItem("current_event_id", data.id);
      router.replace("/(admin)/(tabs)/event-detail");
    } catch (e) {
      const detail = e.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map(d => d.msg || JSON.stringify(d)).join(", ")
        : typeof detail === "string"
          ? detail
          : "Failed to create event";
      if (message && message.toLowerCase().includes("event limit reached")) {
        confirmDialog.info("Event limit reached", "You've used up your available events for this account. Contact your admin to increase your limit, or archive an old event to free up space.");
      } else if (message && (message.toLowerCase().includes("exceeds the available limit") || message.toLowerCase().includes("exceeding the available limit"))) {
        confirmDialog.info("Capacity Limit Reached", `The car/QR capacity for this ${isHotelOwner ? 'hotel' : 'account'} has been reached. Please reduce the number of cars for this event, or contact your provider/superadmin to increase the allocation.`);
      } else {
        confirmDialog.info("Couldn't create event", message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfaceAlt }} testID="create-event-screen">
      <Hero
        eyebrow="New event"
        title={isHotelOwner ? "Create Special Event" : "Create Event"}
        onBack={() => router.back()}
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView ref={scrollViewRef} style={{ flex: 1, paddingHorizontal: rp(theme.spacing.xl), paddingTop: rp(theme.spacing.lg) }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: rp(theme.spacing.xxxl) + (insets?.bottom || 0) + tabBarHeight }}>

          <FieldLabel>EVENT NAME</FieldLabel>
          <Field icon="calendar-outline" error={formErrors.name}>
            <TextInput
              ref={el => { if (fieldRefs.current) fieldRefs.current.name = el; }}
              testID="event-name-input"
              value={name}
              onChangeText={(txt) => {
                setName(txt);
                if (formErrors.name) setFormErrors(prev => ({ ...prev, name: null }));
              }}
              placeholder="Wedding Reception"
              style={fieldTextInputStyle}
            />
          </Field>
          {formErrors.name && <Text style={errorTextStyle}>* {formErrors.name}</Text>}

          <FieldLabel>HOST NAME (OPTIONAL)</FieldLabel>
          <Field icon="person-outline">
            <TextInput
              value={hostName}
              onChangeText={setHostName}
              placeholder="e.g. John Doe"
              style={fieldTextInputStyle}
            />
          </Field>

          <FieldLabel>HOST EMAIL (OPTIONAL)</FieldLabel>
          <Field icon="mail-outline">
            <TextInput
              value={hostEmail}
              onChangeText={setHostEmail}
              placeholder="e.g. host@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              style={fieldTextInputStyle}
            />
          </Field>

          <FieldLabel>VENUE</FieldLabel>
          {isHotelOwner ? (
            <View ref={el => { if (fieldRefs.current) fieldRefs.current.venue = el; }} style={[inputBoxStyle, { backgroundColor: theme.colors.surfaceAlt }]}>
              <Ionicons name="location-outline" size={rs(18)} color={theme.colors.textMuted} />
              <View style={{ flex: 1, marginLeft: rp(10) }}>
                <TextInput
                  testID="event-venue-input"
                  value={venue}
                  editable={false}
                  placeholder="Grand Ballroom"
                  style={[fieldTextInputStyle, { fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, paddingVertical: 0 }]}
                />
              </View>
            </View>
          ) : (
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
          )}
          {isHotelOwner && (
            <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, fontSize: rs(theme.fontSize.caption), marginBottom: rp(theme.spacing.md), marginTop: rp(-8) }}>
              Auto-filled from your hotel
            </Text>
          )}

          <View style={{ flexDirection: "row", gap: rp(theme.spacing.md) }}>
            <View style={{ flex: 1 }}>
              <FieldLabel>START DATE</FieldLabel>
              <TouchableOpacity onPress={() => setShowDP(true)} style={inputBoxStyle} testID="start-date-btn">
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

          <FieldLabel>MAX CARS</FieldLabel>
          <Field icon="car-outline" error={formErrors.maxCars}>
            <TextInput
              ref={el => { if (fieldRefs.current) fieldRefs.current.maxCars = el; }}
              value={maxCars}
              onChangeText={(txt) => {
                setMaxCars(txt);
                if (formErrors.maxCars) setFormErrors(prev => ({ ...prev, maxCars: null }));
              }}
              keyboardType="numeric"
              style={fieldTextInputStyle}
            />
          </Field>
          {formErrors.maxCars && <Text style={errorTextStyle}>* {formErrors.maxCars}</Text>}

          <FieldLabel>PARKING ZONES</FieldLabel>
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
              <TouchableOpacity onPress={() => setZones(zones.filter((_, k) => k !== i))}>
                <Ionicons name="close-circle" size={rs(24)} color={theme.colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
          <Text
            style={{
              color: totalSlots > maxCarsInt ? theme.colors.danger : theme.colors.success,
              fontWeight: theme.fontWeight.bold,
              fontSize: rs(theme.fontSize.caption),
              textAlign: "right",
              marginBottom: rp(theme.spacing.sm),
            }}
          >
            Total slots: {totalSlots} / {maxCarsInt}
          </Text>
          <TouchableOpacity
            onPress={() => setZones([...zones, { name: "", slots: 10 }])}
            style={{ backgroundColor: theme.colors.primaryLight, borderRadius: rp(theme.radius.md), paddingVertical: rp(12), alignItems: "center", marginBottom: rp(theme.spacing.md), flexDirection: "row", justifyContent: "center" }}
          >
            <Ionicons name="add" size={rs(18)} color={theme.colors.primary} />
            <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.primary, fontWeight: theme.fontWeight.bold, marginLeft: rp(6), letterSpacing: rs(1) }}>ADD ZONE</Text>
          </TouchableOpacity>

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
                  placeholder="5"
                  keyboardType="number-pad"
                  maxLength={2}
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
                  placeholder="30"
                  keyboardType="number-pad"
                  maxLength={3}
                  style={fieldTextInputStyle}
                />
              </Field>
            </View>
          </View>

          <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, fontSize: rs(theme.fontSize.caption), marginBottom: rp(theme.spacing.md), marginTop: rp(-8) }}>
            How long a guest has to reach the gate before the car is sent back to parking.
          </Text>
          {isHotelOwner && (
            <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, fontSize: rs(theme.fontSize.caption), marginBottom: rp(theme.spacing.md) }}>
              Hotel's daily events use 1-50 by default — pick a different range for this special event to avoid overlap
            </Text>
          )}

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
                  CREATE EVENT
                </Text>
              </>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {showDP && (
        <DateTimePicker
          value={date}
          mode="date"
          minimumDate={new Date()}
          onChange={(_, d) => {
            setShowDP(false);
            if (d) setDate(d);
          }}
        />
      )}
      {showEDP && (
        <DateTimePicker
          value={endDate}
          mode="date"
          minimumDate={date}
          onChange={(_, d) => {
            setShowEDP(false);
            if (d) setEndDate(d);
          }}
        />
      )}
      {showSTP && (
        <DateTimePicker
          value={new Date(`2024-01-01T${startTime}:00`)}
          mode="time"
          is24Hour
          onChange={(_, d) => {
            setShowSTP(false);
            if (d) setStartTime(fmtTime(d));
          }}
        />
      )}
      {showETP && (
        <DateTimePicker
          value={new Date(`2024-01-01T${endTime}:00`)}
          mode="time"
          is24Hour
          onChange={(_, d) => {
            setShowETP(false);
            if (d) setEndTime(fmtTime(d));
          }}
        />
      )}
    </View>
  );
}
