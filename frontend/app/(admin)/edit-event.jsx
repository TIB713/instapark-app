import { useEffect, useState } from "react";
import { rs, rp } from '../../utils/responsive';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

          
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format, parse } from "date-fns";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";
import VenuePicker from "../../components/VenuePicker";

export default function EditEvent() {
  const router = useRouter();
  const { user } = useAppStore();
  const { eventId } = useLocalSearchParams();
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
  const [keyHooks, setKeyHooks] = useState("50");
  const [allowInstantPark, setAllowInstantPark] = useState(false);
  const [zones, setZones] = useState([]);
  const [gates, setGates] = useState([]);
  const [showDP, setShowDP] = useState(false);
  const [showEDP, setShowEDP] = useState(false);
  const [showSTP, setShowSTP] = useState(false);
  const [showETP, setShowETP] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const isHotelDailyEdit =
    user?.provider_type === "hotel_owner" && eventData?.event_type === "hotel_daily";

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
        setKeyHooks(String(data.key_hooks || 50));
        setAllowInstantPark(!!data.allow_instant_park);
        setStartTime(data.start_time || "18:00");
        setEndTime(data.end_time || "23:00");
        if (data.date) setDate(parse(data.date, "yyyy-MM-dd", new Date()));
        if (data.end_date) setEndDate(parse(data.end_date, "yyyy-MM-dd", new Date()));
        setZones(data.zones || []);
        setGates(data.gates || []);
      } catch (e) {
        Alert.alert("Error", "Failed to load event");
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  const save = async () => {
    if (!isHotelDailyEdit) {
      const errs = {};
      if (!name.trim()) errs.name = "Event name is required";
      if (!venue.trim()) errs.venue = "Venue is required";
      setFormErrors(errs);
      if (Object.keys(errs).length > 0) return;
    }
    const endDT = new Date(`${format(endDate, "yyyy-MM-dd")}T${endTime}:00`);
    const startDT = new Date(`${format(date, "yyyy-MM-dd")}T${startTime}:00`);
    if (endDT <= startDT) {
      Alert.alert("Invalid", "End must be after start");
      return;
    }
    if (totalSlots > maxCarsInt) {
      Alert.alert(
        "Invalid Zones",
        `Total slots (${totalSlots}) cannot exceed max cars (${maxCarsInt}). Please reduce zone slots.`
      );
      return;
    }
    setSaving(true);
    try {
      if (isHotelDailyEdit) {
        await api.patch(`/events/${eventId}`, {
          gate_timer_minutes: parseInt(gateTimerMinutes) || 5,
          allow_instant_park: allowInstantPark,
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
          key_hooks: parseInt(keyHooks) || 50,
          zones: zones.filter((z) => z.name?.trim()),
          gates: gates.filter((g) => g?.trim()),
          gate_timer_minutes: parseInt(gateTimerMinutes) || 5,
          allow_instant_park: allowInstantPark,
        });
      }
      router.back();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F5F3FF", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F3FF" }} testID="edit-event-screen">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#7C3AED" }}>
        <View style={headerWrap}>
          <View style={headerOverlay} />
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity onPress={() => router.back()} style={iconBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: rs(20), fontWeight: "900", marginLeft: rp(12), flex: 1 }}>
              {isHotelDailyEdit ? "Edit Today's Parking" : "Edit Event"}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1, paddingHorizontal: rp(20), paddingTop: rp(20) }} keyboardShouldPersistTaps="handled">
          {!isHotelDailyEdit && (
            <>
              <Label>EVENT NAME</Label>
              <View style={[inputRowStyle, formErrors.name && { borderColor: "#EF4444" }]}>
                <Ionicons name="calendar-outline" size={18} color="#7C3AED" />
                <TextInput value={name} onChangeText={(txt) => {
                  setName(txt);
                  if (formErrors.name) setFormErrors(prev => ({ ...prev, name: null }));
                }} style={{ flex: 1, marginLeft: rp(10), paddingVertical: rp(14), fontSize: rs(15), color: "#111827" }} />
              </View>
              {formErrors.name && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(-12), marginBottom: rp(12) }}>* {formErrors.name}</Text>}

              <Label>VENUE</Label>
              <View style={[inputRowStyle, formErrors.venue && { borderColor: "#EF4444" }]}>
                <Ionicons name="location-outline" size={18} color="#7C3AED" />
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
              {formErrors.venue && <Text style={{ color: "#EF4444", fontSize: rs(11), fontWeight: "600", marginTop: rp(-12), marginBottom: rp(12) }}>* {formErrors.venue}</Text>}

              <View style={{ flexDirection: "row", gap: rp(12) }}>
                <View style={{ flex: 1 }}>
                  <Label>START DATE</Label>
                  <TouchableOpacity onPress={() => setShowDP(true)} style={inputBoxStyle}>
                    <Ionicons name="calendar-outline" size={18} color="#7C3AED" />
                    <Text style={{ marginLeft: rp(10), color: "#111827", flex: 1, fontSize: rs(14) }}>{format(date, "MMM d, yyyy")}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Label>END DATE</Label>
                  <TouchableOpacity onPress={() => setShowEDP(true)} style={inputBoxStyle}>
                    <Ionicons name="calendar-outline" size={18} color="#7C3AED" />
                    <Text style={{ marginLeft: rp(10), color: "#111827", flex: 1, fontSize: rs(14) }}>{format(endDate, "MMM d, yyyy")}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          <View style={{ flexDirection: "row", gap: rp(12) }}>
            <View style={{ flex: 1 }}>
              <Label>START TIME</Label>
              <TouchableOpacity onPress={() => setShowSTP(true)} style={inputBoxStyle}>
                <Ionicons name="time-outline" size={18} color="#7C3AED" />
                <Text style={{ marginLeft: rp(10), color: "#111827", flex: 1 }}>{startTime}</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Label>END TIME</Label>
              <TouchableOpacity onPress={() => setShowETP(true)} style={inputBoxStyle}>
                <Ionicons name="time-outline" size={18} color="#7C3AED" />
                <Text style={{ marginLeft: rp(10), color: "#111827", flex: 1 }}>{endTime}</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          <Label>MAX CARS</Label>
          <View style={inputRowStyle}>
            <Ionicons name="car-outline" size={18} color="#7C3AED" />
            <TextInput value={maxCars} onChangeText={setMaxCars} keyboardType="numeric" style={{ flex: 1, marginLeft: rp(10), paddingVertical: rp(14), fontSize: rs(15), color: "#111827" }} />
          </View>
          <Label>GATE WAIT TIMER (MINUTES)</Label>
          <View style={inputRowStyle}>
            <Ionicons name="timer-outline" size={18} color="#7C3AED" />
            <TextInput value={gateTimerMinutes} onChangeText={setGateTimerMinutes} keyboardType="numeric" style={{ flex: 1, marginLeft: rp(10), paddingVertical: rp(14), fontSize: rs(15), color: "#111827" }} />
          </View>

          <View style={{ backgroundColor: "#EEF2FF", borderWidth: rp(1), borderColor: "#C7D2FE", borderRadius: rp(16), padding: rp(12), marginTop: rp(4), marginBottom: rp(16), flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1, marginRight: rp(10) }}>
              <Text style={{ fontSize: rs(12), fontWeight: "900", color: "#3730A3" }}>⚡ INSTANT PARK</Text>
              <Text style={{ fontSize: rs(11), color: "#4338CA", marginTop: rp(2) }}>
                Let drivers skip guest name & phone at check-in for this event
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setAllowInstantPark(v => !v)}
              style={{ width: rp(52), height: rp(30), borderRadius: rp(15), padding: rp(3), backgroundColor: allowInstantPark ? "#4F46E5" : "#E5E7EB" }}
            >
              <View style={{ width: rp(24), height: rp(24), borderRadius: rp(12), backgroundColor: "#fff", marginLeft: allowInstantPark ? rp(22) : 0 }} />
            </TouchableOpacity>
          </View>

          <Label>PARKING ZONES</Label>
          {zones.length === 0 && (
            <Text style={{ color: "#9CA3AF", fontSize: rs(14), textAlign: "center", marginBottom: rp(8) }}>
              No parking zones added yet. Tap Add Zone to create one.
            </Text>
          )}
          {zones.map((z, i) => (
            <View key={i} style={{ backgroundColor: "#fff", borderRadius: rp(16), padding: rp(12), marginBottom: rp(8), flexDirection: "row", alignItems: "center", gap: rp(8), borderWidth: rp(1), borderColor: "#E5E7EB" }}>
              <Ionicons name="location" size={18} color="#7C3AED" />
              <TextInput
                value={z.name}
                onChangeText={(v) => {
                  const n = [...zones];
                  n[i].name = v;
                  setZones(n);
                }}
                placeholder="Zone"
                placeholderTextColor="#9CA3AF"
                style={{ flex: 1, borderWidth: rp(1), borderColor: "#E5E7EB", borderRadius: rp(12), paddingHorizontal: rp(12), paddingVertical: rp(10) }}
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
                placeholderTextColor="#9CA3AF"
                style={{ width: rp(70), borderWidth: rp(1), borderColor: "#E5E7EB", borderRadius: rp(12), paddingHorizontal: rp(10), paddingVertical: rp(10), textAlign: "center" }}
              />
              <TouchableOpacity
                onPress={() => setZones(zones.filter((_, idx) => idx !== i))}
                style={{ padding: rp(4) }}
              >
                <Ionicons name="remove-circle-outline" size={20} color="#F43F5E" />
              </TouchableOpacity>
            </View>
          ))}
          <Text
            style={{
              color: totalSlots > maxCarsInt ? "#F43F5E" : "#059669",
              fontWeight: "700",
              fontSize: rs(13),
              textAlign: "right",
              marginBottom: rp(8),
            }}
          >
            Total slots: {totalSlots} / {maxCarsInt}
          </Text>
          <TouchableOpacity
            onPress={() => setZones([...zones, { name: `Zone ${String.fromCharCode(65 + zones.length)}`, slots: 50 }])}
            style={{ flexDirection: "row", alignItems: "center", gap: rp(6), paddingVertical: rp(10) }}
          >
            <Ionicons name="add-circle-outline" size={20} color="#7C3AED" />
            <Text style={{ color: "#7C3AED", fontWeight: "700", fontSize: rs(13) }}>Add Zone</Text>
          </TouchableOpacity>

          <Label>ENTRY GATES</Label>
          {gates.map((g, i) => (
            <View key={i} style={{ backgroundColor: "#fff", borderRadius: rp(16), padding: rp(12), marginBottom: rp(8), flexDirection: "row", alignItems: "center", gap: rp(8), borderWidth: rp(1), borderColor: "#E5E7EB" }}>
              <Ionicons name="enter-outline" size={18} color="#7C3AED" />
              <TextInput
                value={g}
                onChangeText={(v) => {
                  const n = [...gates];
                  n[i] = v;
                  setGates(n);
                }}
                placeholder="Gate name"
                placeholderTextColor="#9CA3AF"
                style={{ flex: 1, borderWidth: rp(1), borderColor: "#E5E7EB", borderRadius: rp(12), paddingHorizontal: rp(12), paddingVertical: rp(10) }}
              />
              <TouchableOpacity onPress={() => setGates(gates.filter((_, k) => k !== i))}>
                <Ionicons name="close-circle" size={24} color="#F43F5E" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            onPress={() => setGates([...gates, ""])}
            style={{ backgroundColor: "#EDE9FE", borderRadius: rp(16), paddingVertical: rp(12), alignItems: "center", marginBottom: rp(24), flexDirection: "row", justifyContent: "center" }}
          >
            <Ionicons name="add" size={18} color="#7C3AED" />
            <Text style={{ color: "#7C3AED", fontWeight: "800", marginLeft: rp(6), letterSpacing: rs(1) }}>ADD GATE</Text>
          </TouchableOpacity>
          
          <Label>KEY HOOKS (Total hooks on key board)</Label>
          <View style={inputRowStyle}>
            <Ionicons name="key-outline" size={20} color="#7C3AED" />
            <TextInput
              value={keyHooks}
              onChangeText={setKeyHooks}
              placeholder="50"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={4}
              style={{ flex: 1, marginLeft: rp(10), paddingVertical: rp(14), fontSize: rs(15), color: "#111827" }}
            />
          </View>

          <TouchableOpacity
            onPress={save}
            disabled={saving}
            activeOpacity={0.85}
            style={{
              backgroundColor: "#7C3AED",
              borderRadius: rp(16),
              paddingVertical: rp(16),
              alignItems: "center",
              marginTop: rp(8),
              marginBottom: rp(16),
              shadowColor: "#7C3AED",
              shadowOpacity: 0.3,
              shadowRadius: rp(16),
              shadowOffset: { width: 0, height: rp(6) },
              elevation: 6,
            }}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(15), letterSpacing: rs(2) }}>SAVE CHANGES</Text>}
          </TouchableOpacity>
          <View style={{ height: rp(40) }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {showDP && <DateTimePicker value={date} mode="date" onChange={(_, d) => { setShowDP(false); if (d) setDate(d); }} />}
      {showEDP && <DateTimePicker value={endDate} mode="date" onChange={(_, d) => { setShowEDP(false); if (d) setEndDate(d); }} />}
      {showSTP && <DateTimePicker value={new Date(`2024-01-01T${startTime}:00`)} mode="time" is24Hour onChange={(_, d) => { setShowSTP(false); if (d) setStartTime(fmtTime(d)); }} />}
      {showETP && <DateTimePicker value={new Date(`2024-01-01T${endTime}:00`)} mode="time" is24Hour onChange={(_, d) => { setShowETP(false); if (d) setEndTime(fmtTime(d)); }} />}
    </View>
  );
}

function Label({ children }) {
  return (
    <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(3), marginBottom: rp(8), marginTop: rp(4) }}>
      {children}
    </Text>
  );
}

const headerWrap = {
  backgroundColor: "#7C3AED",
  borderBottomLeftRadius: 44,
  borderBottomRightRadius: 44,
  paddingHorizontal: rp(20),
  paddingTop: rp(8),
  paddingBottom: rp(24),
};
const headerOverlay = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(79,70,229,0.5)",
  borderBottomLeftRadius: 44,
  borderBottomRightRadius: 44,
};
const iconBtn = {
  backgroundColor: "rgba(255,255,255,0.15)",
  borderRadius: rp(99),
  padding: rp(8),
};
const inputRowStyle = {
  backgroundColor: "#fff",
  borderRadius: rp(16),
  borderWidth: rp(1),
  borderColor: "#E5E7EB",
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: rp(16),
  marginBottom: rp(16),
};
const inputBoxStyle = {
  backgroundColor: "#fff",
  borderRadius: rp(16),
  borderWidth: rp(1),
  borderColor: "#E5E7EB",
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: rp(14),
  paddingVertical: rp(14),
  marginBottom: rp(16),
};
