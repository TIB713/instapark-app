import { useState, useEffect } from "react";
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
  const [keyHookStart, setKeyHookStart] = useState(isHotelOwner ? "51" : "1");
  const [keyHookEnd, setKeyHookEnd] = useState(isHotelOwner ? "100" : "50");
  const [zones, setZones] = useState([{ name: "A", slots: 20 }]);
  const [gates, setGates] = useState(["Main Gate"]);
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
        key_hook_start: parseInt(keyHookStart) || 1,
        key_hook_end: parseInt(keyHookEnd) || 50,
        key_hooks: (parseInt(keyHookEnd) || 50) - (parseInt(keyHookStart) || 1) + 1,
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
      const detail = e.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map(d => d.msg || JSON.stringify(d)).join(", ")
        : typeof detail === "string"
        ? detail
        : "Failed to create event";
      Alert.alert("Error", message);
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
            <Text style={{ color: "#fff", fontSize: rs(20), fontWeight: "900", marginLeft: rp(12), flex: 1 }}>
              {isHotelOwner ? "Create Special Event" : "Create Event"}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1, paddingHorizontal: rp(20), paddingTop: rp(20) }} keyboardShouldPersistTaps="handled">
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
            <View style={[inputRowStyle, { backgroundColor: "#F3F4F6", marginBottom: rp(4) }]}>
              <Ionicons name="location-outline" size={18} color="#9CA3AF" />
              <View style={{ flex: 1, marginLeft: rp(10) }}>
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
            <Text style={{ color: "#9CA3AF", fontSize: rs(12), marginBottom: rp(16) }}>
              Auto-filled from your hotel
            </Text>
          )}

          <View style={{ flexDirection: "row", gap: rp(12) }}>
            <View style={{ flex: 1 }}>
              <Label>START DATE</Label>
              <TouchableOpacity onPress={() => setShowDP(true)} style={inputBoxStyle} testID="start-date-btn">
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
              <TouchableOpacity onPress={() => setZones(zones.filter((_, k) => k !== i))}>
                <Ionicons name="close-circle" size={24} color="#F43F5E" />
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
            onPress={() => setZones([...zones, { name: "", slots: 10 }])}
            style={{ backgroundColor: "#EDE9FE", borderRadius: rp(16), paddingVertical: rp(12), alignItems: "center", marginBottom: rp(16), flexDirection: "row", justifyContent: "center" }}
          >
            <Ionicons name="add" size={18} color="#7C3AED" />
            <Text style={{ color: "#7C3AED", fontWeight: "800", marginLeft: rp(6), letterSpacing: rs(1) }}>ADD ZONE</Text>
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

          <View style={{ flexDirection: "row", gap: rp(12) }}>
            <View style={{ flex: 1 }}>
              <Label>KEY HOOKS FROM</Label>
              <InputRow icon="key-outline">
                <TextInput
                  value={keyHookStart}
                  onChangeText={setKeyHookStart}
                  placeholder={isHotelOwner ? "51" : "1"}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  maxLength={4}
                  style={textInputStyle}
                />
              </InputRow>
            </View>
            <View style={{ flex: 1 }}>
              <Label>KEY HOOKS TO</Label>
              <InputRow icon="key-outline">
                <TextInput
                  value={keyHookEnd}
                  onChangeText={setKeyHookEnd}
                  placeholder={isHotelOwner ? "100" : "50"}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  maxLength={4}
                  style={textInputStyle}
                />
              </InputRow>
            </View>
          </View>
          {isHotelOwner && (
            <Text style={{ color: "#9CA3AF", fontSize: rs(12), marginBottom: rp(16) }}>
              Hotel's daily events use 1-50 by default — pick a different range for this special event to avoid overlap
            </Text>
          )}

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
          <View style={{ height: rp(40) }} />
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
    <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(3), marginBottom: rp(8), marginTop: rp(4) }}>
      {children}
    </Text>
  );
}

function InputRow({ icon, children }) {
  return (
    <View style={inputRowStyle}>
      <Ionicons name={icon} size={18} color="#7C3AED" />
      <View style={{ flex: 1, marginLeft: rp(10) }}>{children}</View>
    </View>
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
const textInputStyle = {
  paddingVertical: rp(14),
  fontSize: rs(15),
  color: "#111827",
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
const primaryBtn = {
  backgroundColor: "#7C3AED",
  borderRadius: rp(16),
  paddingVertical: rp(16),
  alignItems: "center",
  marginBottom: rp(16),
  shadowColor: "#7C3AED",
  shadowOpacity: 0.3,
  shadowRadius: rp(16),
  shadowOffset: { width: 0, height: rp(6) },
  elevation: 6,
};
const primaryBtnText = {
  color: "#fff",
  fontWeight: "900",
  fontSize: rs(15),
  letterSpacing: rs(2),
};
