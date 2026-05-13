import { useState } from "react";
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
  const { setCurrentEventId } = useAppStore();
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("23:00");
  const [venue, setVenue] = useState("");
  const [maxCars, setMaxCars] = useState("200");
  const [zones, setZones] = useState([{ name: "A", slots: 20 }]);
  const [gates, setGates] = useState(["Main Entrance"]);
  const [showDP, setShowDP] = useState(false);
  const [showEDP, setShowEDP] = useState(false);
  const [showSTP, setShowSTP] = useState(false);
  const [showETP, setShowETP] = useState(false);
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      const { data } = await api.post("/events", {
        name: name.trim(),
        date: format(date, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        start_time: startTime,
        end_time: endTime,
        venue: venue.trim(),
        max_cars: parseInt(maxCars) || 200,
        zones: zones.filter((z) => z.name.trim()),
        gates: gates.filter((g) => g.trim()),
        is_template: false,
      });
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
    <View className="flex-1 bg-[#F9FAFB]" testID="create-event-screen">
      <SafeAreaView edges={["top"]} className="bg-[#7C3AED]">
        <View className="bg-[#7C3AED] px-5 py-4 rounded-b-[30px] flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-white/10 rounded-full p-2 mr-3"
            testID="back-btn"
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-black flex-1">
            Create Event
          </Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-5 pt-5" keyboardShouldPersistTaps="handled">
          <Field label="EVENT NAME">
            <TextInput
              testID="event-name-input"
              value={name}
              onChangeText={setName}
              placeholder="Wedding Reception"
              className="text-base text-gray-900 py-3"
            />
          </Field>

          <Field label="VENUE">
            <TextInput
              testID="event-venue-input"
              value={venue}
              onChangeText={setVenue}
              placeholder="Grand Ballroom"
              className="text-base text-gray-900 py-3"
            />
          </Field>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="START DATE">
                <TouchableOpacity
                  onPress={() => setShowDP(true)}
                  className="flex-row items-center py-3"
                  testID="start-date-btn"
                >
                  <Ionicons name="calendar-outline" size={18} color="#7C3AED" />
                  <Text className="ml-2 text-gray-900">
                    {format(date, "MMM d, yyyy")}
                  </Text>
                </TouchableOpacity>
              </Field>
            </View>
            <View className="flex-1">
              <Field label="END DATE">
                <TouchableOpacity
                  onPress={() => setShowEDP(true)}
                  className="flex-row items-center py-3"
                >
                  <Ionicons name="calendar-outline" size={18} color="#7C3AED" />
                  <Text className="ml-2 text-gray-900">
                    {format(endDate, "MMM d, yyyy")}
                  </Text>
                </TouchableOpacity>
              </Field>
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="START TIME">
                <TouchableOpacity
                  onPress={() => setShowSTP(true)}
                  className="flex-row items-center py-3"
                >
                  <Ionicons name="time-outline" size={18} color="#7C3AED" />
                  <Text className="ml-2 text-gray-900">{startTime}</Text>
                </TouchableOpacity>
              </Field>
            </View>
            <View className="flex-1">
              <Field label="END TIME">
                <TouchableOpacity
                  onPress={() => setShowETP(true)}
                  className="flex-row items-center py-3"
                >
                  <Ionicons name="time-outline" size={18} color="#7C3AED" />
                  <Text className="ml-2 text-gray-900">{endTime}</Text>
                </TouchableOpacity>
              </Field>
            </View>
          </View>

          <Field label="MAX CARS">
            <TextInput
              value={maxCars}
              onChangeText={setMaxCars}
              keyboardType="numeric"
              className="text-base text-gray-900 py-3"
            />
          </Field>

          <Text className="text-xs font-bold text-gray-500 tracking-widest mb-2 mt-3">
            PARKING ZONES
          </Text>
          {zones.map((z, i) => (
            <View
              key={i}
              className="bg-white rounded-2xl p-3 mb-2 flex-row items-center gap-2"
            >
              <TextInput
                value={z.name}
                onChangeText={(v) => {
                  const n = [...zones];
                  n[i].name = v;
                  setZones(n);
                }}
                placeholder="Zone"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2"
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
                className="w-20 border border-gray-200 rounded-xl px-3 py-2"
              />
              <TouchableOpacity
                onPress={() => setZones(zones.filter((_, k) => k !== i))}
              >
                <Ionicons name="close-circle" size={24} color="#DC2626" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            onPress={() => setZones([...zones, { name: "", slots: 10 }])}
            className="bg-white rounded-2xl py-3 items-center border border-dashed border-gray-300 mb-3"
          >
            <Text className="text-[#7C3AED] font-bold">+ Add Zone</Text>
          </TouchableOpacity>

          <Text className="text-xs font-bold text-gray-500 tracking-widest mb-2 mt-3">
            ENTRY GATES
          </Text>
          {gates.map((g, i) => (
            <View
              key={i}
              className="bg-white rounded-2xl p-3 mb-2 flex-row items-center gap-2"
            >
              <TextInput
                value={g}
                onChangeText={(v) => {
                  const n = [...gates];
                  n[i] = v;
                  setGates(n);
                }}
                placeholder="Gate name"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2"
              />
              <TouchableOpacity
                onPress={() => setGates(gates.filter((_, k) => k !== i))}
              >
                <Ionicons name="close-circle" size={24} color="#DC2626" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            onPress={() => setGates([...gates, ""])}
            className="bg-white rounded-2xl py-3 items-center border border-dashed border-gray-300 mb-6"
          >
            <Text className="text-[#7C3AED] font-bold">+ Add Gate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="save-event-btn"
            onPress={save}
            disabled={saving}
            activeOpacity={0.7}
            className="bg-[#7C3AED] rounded-2xl py-4 items-center mb-10"
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-black tracking-widest">
                CREATE EVENT
              </Text>
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

function Field({ label, children }) {
  return (
    <View className="mb-3">
      <Text className="text-xs font-bold text-gray-500 tracking-widest mb-2">
        {label}
      </Text>
      <View className="bg-white rounded-2xl px-4 border border-gray-200">
        {children}
      </View>
    </View>
  );
}
