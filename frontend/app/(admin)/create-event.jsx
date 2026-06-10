import { useState, useEffect } from "react";
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";

export default function CreateEvent() {
  const router = useRouter();
  const { user, setCurrentEventId } = useAppStore();

  const isHotelOwner = user?.provider_type === "hotel_owner";
  const [eventType, setEventType] = useState(isHotelOwner ? "hotel_special" : "");
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("23:00");
  const [venue, setVenue] = useState("");
  const [maxCars, setMaxCars] = useState("200");
  const [keyHooks, setKeyHooks] = useState("50");
  const [zones, setZones] = useState([{ name: "A", slots: 20 }]);
  const [gates, setGates] = useState(["Main Entrance"]);
  const [showDP, setShowDP] = useState(false);
  const [showEDP, setShowEDP] = useState(false);
  const [showSTP, setShowSTP] = useState(false);
  const [showETP, setShowETP] = useState(false);
  const [saving, setSaving] = useState(false);
  const [myHotel, setMyHotel] = useState(null);

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
    if (!name.trim() || !venue.trim()) {
      Alert.alert("Required", "Name and venue required");
      return;
    }
    const startDT = new Date(`${format(date, "yyyy-MM-dd")}T${startTime}:00`);
    if (startDT < new Date()) {
      Alert.alert("Invalid", "Start date and time has already passed");
      return;
    }
    const endDT = new Date(`${format(endDate, "yyyy-MM-dd")}T${endTime}:00`);
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
      const payload = {
        name: name.trim(),
        date: format(date, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        start_time: startTime,
        end_time: endTime,
        venue: venue.trim(),
        max_cars: parseInt(maxCars) || 200,
        key_hooks: parseInt(keyHooks) || 50,
        zones: zones.filter((z) => z.name.trim()),
        gates: gates.filter((g) => g.trim()),
        is_template: false,
      };

      let res;
      if (isHotelOwner) {
        if (!myHotel) {
          Alert.alert("No hotel found", "Please contact support.");
          setSaving(false);
          return;
        }
        res = await api.post(`/hotels/${myHotel.id}/events`, payload);
      } else {
        // Normal valet provider
        res = await api.post("/events", {
          ...payload,
          event_type: "event", // default for valet provider
        });
      }

      const { data } = res;
      setCurrentEventId(data.id);
      await AsyncStorage.setItem("current_event_id", data.id);
      router.replace("/(admin)/event-detail");
    } catch (e) {
      Alert.alert("Error", e.response?.data?.detail || "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F3FF" }} testID="create-event-screen">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#7C3AED" }}>
        <View style={headerWrap}>
          <View style={headerOverlay} />
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity onPress={() => router.back()} style={iconBtn} testID="back-btn">
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", marginLeft: 12, flex: 1 }}>
              {isHotelOwner ? "Create Special Event" : "Create Event"}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }} keyboardShouldPersistTaps="handled">
          <Label>EVENT NAME</Label>
          <InputRow icon="calendar-outline">
            <TextInput
              testID="event-name-input"
              value={name}
              onChangeText={setName}
              placeholder="Wedding Reception"
              placeholderTextColor="#9CA3AF"
              style={textInputStyle}
            />
          </InputRow>

          <Label>VENUE</Label>
          {isHotelOwner ? (
            <View style={[inputRowStyle, { backgroundColor: "#F3F4F6", marginBottom: 4 }]}>
              <Ionicons name="location-outline" size={18} color="#9CA3AF" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <TextInput
                  testID="event-venue-input"
                  value={venue}
                  editable={false}
                  placeholder="Grand Ballroom"
                  placeholderTextColor="#9CA3AF"
                  style={[textInputStyle, { color: "#6B7280" }]}
                />
              </View>
            </View>
          ) : (
            <InputRow icon="location-outline">
              <TextInput
                testID="event-venue-input"
                value={venue}
                onChangeText={setVenue}
                placeholder="Grand Ballroom"
                placeholderTextColor="#9CA3AF"
                style={textInputStyle}
              />
            </InputRow>
          )}
          {isHotelOwner && (
            <Text style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 16 }}>
              Auto-filled from your hotel
            </Text>
          )}

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Label>START DATE</Label>
              <TouchableOpacity onPress={() => setShowDP(true)} style={inputBoxStyle} testID="start-date-btn">
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
          <InputRow icon="car-outline">
            <TextInput
              value={maxCars}
              onChangeText={setMaxCars}
              keyboardType="numeric"
              placeholderTextColor="#9CA3AF"
              style={textInputStyle}
            />
          </InputRow>

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
          <InputRow icon="key-outline">
            <TextInput
              value={keyHooks}
              onChangeText={setKeyHooks}
              placeholder="50"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={4}
              style={textInputStyle}
            />
          </InputRow>

          <TouchableOpacity
            testID="save-event-btn"
            onPress={save}
            disabled={saving}
            activeOpacity={0.85}
            style={primaryBtn}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={primaryBtnText}>CREATE EVENT</Text>
            )}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
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

function Label({ children }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: "800", color: "#6B7280", letterSpacing: 3, marginBottom: 8, marginTop: 4 }}>
      {children}
    </Text>
  );
}

function InputRow({ icon, children }) {
  return (
    <View style={inputRowStyle}>
      <Ionicons name={icon} size={18} color="#7C3AED" />
      <View style={{ flex: 1, marginLeft: 10 }}>{children}</View>
    </View>
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
const textInputStyle = {
  paddingVertical: 14,
  fontSize: 15,
  color: "#111827",
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
const primaryBtn = {
  backgroundColor: "#7C3AED",
  borderRadius: 16,
  paddingVertical: 16,
  alignItems: "center",
  marginBottom: 16,
  shadowColor: "#7C3AED",
  shadowOpacity: 0.3,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6,
};
const primaryBtnText = {
  color: "#fff",
  fontWeight: "900",
  fontSize: 15,
  letterSpacing: 2,
};
