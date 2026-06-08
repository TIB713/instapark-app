import { useEffect, useState } from "react";
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

          
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format, parse } from "date-fns";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";

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
  const [maxCars, setMaxCars] = useState("200");
  const [keyHooks, setKeyHooks] = useState("50");
  const [zones, setZones] = useState([]);
  const [gates, setGates] = useState([]);
  const [showDP, setShowDP] = useState(false);
  const [showEDP, setShowEDP] = useState(false);
  const [showSTP, setShowSTP] = useState(false);
  const [showETP, setShowETP] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user?.provider_type === "hotel_owner" && eventData?.event_type === "hotel_daily") {
        Alert.alert(
          "Access Restricted",
          "Daily operations are automatically managed and cannot be edited manually.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      }
    }, [user, eventData, router])
  );

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
        setMaxCars(String(data.max_cars || 200));
        setKeyHooks(String(data.key_hooks || 50));
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
    if (!name.trim() || !venue.trim()) {
      Alert.alert("Required", "Name and venue required");
      return;
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
      await api.patch(`/events/${eventId}`, {
        name: name.trim(),
        date: format(date, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        start_time: startTime,
        end_time: endTime,
        venue: venue.trim(),
        max_cars: parseInt(maxCars) || 200,
        key_hooks: parseInt(keyHooks) || 50,
        zones: zones.filter((z) => z.name?.trim()),
        gates: gates.filter((g) => g?.trim()),
      });
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
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", marginLeft: 12, flex: 1 }}>
              Edit Event
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }} keyboardShouldPersistTaps="handled">
          <Label>EVENT NAME</Label>
          <View style={inputRowStyle}>
            <Ionicons name="calendar-outline" size={18} color="#7C3AED" />
            <TextInput value={name} onChangeText={setName} style={{ flex: 1, marginLeft: 10, paddingVertical: 14, fontSize: 15, color: "#111827" }} />
          </View>

          <Label>VENUE</Label>
          <View style={inputRowStyle}>
            <Ionicons name="location-outline" size={18} color="#7C3AED" />
            <TextInput value={venue} onChangeText={setVenue} style={{ flex: 1, marginLeft: 10, paddingVertical: 14, fontSize: 15, color: "#111827" }} />
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Label>START DATE</Label>
              <TouchableOpacity onPress={() => setShowDP(true)} style={inputBoxStyle}>
                <Ionicons name="calendar-outline" size={18} color="#7C3AED" />
                <Text style={{ marginLeft: 10, color: "#111827", flex: 1, fontSize: 14 }}>{format(date, "MMM d, yyyy")}</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Label>END DATE</Label>
              <TouchableOpacity onPress={() => setShowEDP(true)} style={inputBoxStyle}>
                <Ionicons name="calendar-outline" size={18} color="#7C3AED" />
                <Text style={{ marginLeft: 10, color: "#111827", flex: 1, fontSize: 14 }}>{format(endDate, "MMM d, yyyy")}</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Label>START TIME</Label>
              <TouchableOpacity onPress={() => setShowSTP(true)} style={inputBoxStyle}>
                <Ionicons name="time-outline" size={18} color="#7C3AED" />
                <Text style={{ marginLeft: 10, color: "#111827", flex: 1 }}>{startTime}</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Label>END TIME</Label>
              <TouchableOpacity onPress={() => setShowETP(true)} style={inputBoxStyle}>
                <Ionicons name="time-outline" size={18} color="#7C3AED" />
                <Text style={{ marginLeft: 10, color: "#111827", flex: 1 }}>{endTime}</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          <Label>MAX CARS</Label>
          <View style={inputRowStyle}>
            <Ionicons name="car-outline" size={18} color="#7C3AED" />
            <TextInput value={maxCars} onChangeText={setMaxCars} keyboardType="numeric" style={{ flex: 1, marginLeft: 10, paddingVertical: 14, fontSize: 15, color: "#111827" }} />
          </View>

          <Label>PARKING ZONES</Label>
          {zones.map((z, i) => (
            <View key={i} style={{ backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#E5E7EB" }}>
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
                style={{ flex: 1, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
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
                style={{ width: 70, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10, textAlign: "center" }}
              />
              <TouchableOpacity onPress={() => setZones(zones.filter((_, k) => k !== i))}>
                <Ionicons name="close-circle" size={24} color="#F43F5E" />
              </TouchableOpacity>
            </View>
          ))}
          <Text
            style={{
              color: totalSlots > maxCarsInt ? "#F43F5E" : "#059669",
              fontWeight: "700",
              fontSize: 13,
              textAlign: "right",
              marginBottom: 8,
            }}
          >
            Total slots: {totalSlots} / {maxCarsInt}
          </Text>
          <TouchableOpacity
            onPress={() => setZones([...zones, { name: "", slots: 10 }])}
            style={{ backgroundColor: "#EDE9FE", borderRadius: 16, paddingVertical: 12, alignItems: "center", marginBottom: 16, flexDirection: "row", justifyContent: "center" }}
          >
            <Ionicons name="add" size={18} color="#7C3AED" />
            <Text style={{ color: "#7C3AED", fontWeight: "800", marginLeft: 6, letterSpacing: 1 }}>ADD ZONE</Text>
          </TouchableOpacity>

          <Label>ENTRY GATES</Label>
          {gates.map((g, i) => (
            <View key={i} style={{ backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#E5E7EB" }}>
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
                style={{ flex: 1, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
              />
              <TouchableOpacity onPress={() => setGates(gates.filter((_, k) => k !== i))}>
                <Ionicons name="close-circle" size={24} color="#F43F5E" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            onPress={() => setGates([...gates, ""])}
            style={{ backgroundColor: "#EDE9FE", borderRadius: 16, paddingVertical: 12, alignItems: "center", marginBottom: 24, flexDirection: "row", justifyContent: "center" }}
          >
            <Ionicons name="add" size={18} color="#7C3AED" />
            <Text style={{ color: "#7C3AED", fontWeight: "800", marginLeft: 6, letterSpacing: 1 }}>ADD GATE</Text>
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
              style={{ flex: 1, marginLeft: 10, paddingVertical: 14, fontSize: 15, color: "#111827" }}
            />
          </View>

          <TouchableOpacity
            onPress={save}
            disabled={saving}
            activeOpacity={0.85}
            style={{
              backgroundColor: "#7C3AED",
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: "center",
              marginTop: 8,
              marginBottom: 16,
              shadowColor: "#7C3AED",
              shadowOpacity: 0.3,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15, letterSpacing: 2 }}>SAVE CHANGES</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
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
    <Text style={{ fontSize: 11, fontWeight: "800", color: "#6B7280", letterSpacing: 3, marginBottom: 8, marginTop: 4 }}>
      {children}
    </Text>
  );
}

const headerWrap = {
  backgroundColor: "#7C3AED",
  borderBottomLeftRadius: 44,
  borderBottomRightRadius: 44,
  paddingHorizontal: 20,
  paddingTop: 8,
  paddingBottom: 24,
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
  borderRadius: 99,
  padding: 8,
};
const inputRowStyle = {
  backgroundColor: "#fff",
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 16,
  marginBottom: 16,
};
const inputBoxStyle = {
  backgroundColor: "#fff",
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 14,
  paddingVertical: 14,
  marginBottom: 16,
};
