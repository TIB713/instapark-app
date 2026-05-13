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
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format, parse } from "date-fns";
import api from "../../lib/api";

export default function EditEvent() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("23:00");
  const [venue, setVenue] = useState("");
  const [maxCars, setMaxCars] = useState("200");
  const [zones, setZones] = useState([]);
  const [gates, setGates] = useState([]);
  const [showDP, setShowDP] = useState(false);
  const [showEDP, setShowEDP] = useState(false);
  const [showSTP, setShowSTP] = useState(false);
  const [showETP, setShowETP] = useState(false);

  const fmtTime = (d) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/events/${eventId}`);
        setName(data.name || "");
        setVenue(data.venue || "");
        setMaxCars(String(data.max_cars || 200));
        setStartTime(data.start_time || "18:00");
        setEndTime(data.end_time || "23:00");
        if (data.date) setDate(parse(data.date, "yyyy-MM-dd", new Date()));
        if (data.end_date)
          setEndDate(parse(data.end_date, "yyyy-MM-dd", new Date()));
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
      <View className="flex-1 bg-[#F9FAFB] justify-center items-center">
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F9FAFB]" testID="edit-event-screen">
      <SafeAreaView edges={["top"]} className="bg-[#7C3AED]">
        <View className="bg-[#7C3AED] px-5 py-4 rounded-b-[30px] flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-white/10 rounded-full p-2 mr-3"
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-black flex-1">
            Edit Event
          </Text>
        </View>
      </SafeAreaView>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-5 pt-5" keyboardShouldPersistTaps="handled">
          <Text className="text-xs font-bold text-gray-500 mb-2 tracking-widest">EVENT NAME</Text>
          <View className="bg-white rounded-2xl px-4 border border-gray-200 mb-3">
            <TextInput value={name} onChangeText={setName} className="py-3" />
          </View>
          <Text className="text-xs font-bold text-gray-500 mb-2 tracking-widest">VENUE</Text>
          <View className="bg-white rounded-2xl px-4 border border-gray-200 mb-3">
            <TextInput value={venue} onChangeText={setVenue} className="py-3" />
          </View>
          <View className="flex-row gap-3 mb-3">
            <TouchableOpacity onPress={() => setShowDP(true)} className="flex-1 bg-white rounded-2xl px-4 py-3 border border-gray-200">
              <Text className="text-xs text-gray-500 mb-1">START DATE</Text>
              <Text className="text-gray-900">{format(date, "MMM d, yyyy")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowEDP(true)} className="flex-1 bg-white rounded-2xl px-4 py-3 border border-gray-200">
              <Text className="text-xs text-gray-500 mb-1">END DATE</Text>
              <Text className="text-gray-900">{format(endDate, "MMM d, yyyy")}</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row gap-3 mb-3">
            <TouchableOpacity onPress={() => setShowSTP(true)} className="flex-1 bg-white rounded-2xl px-4 py-3 border border-gray-200">
              <Text className="text-xs text-gray-500 mb-1">START TIME</Text>
              <Text className="text-gray-900">{startTime}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowETP(true)} className="flex-1 bg-white rounded-2xl px-4 py-3 border border-gray-200">
              <Text className="text-xs text-gray-500 mb-1">END TIME</Text>
              <Text className="text-gray-900">{endTime}</Text>
            </TouchableOpacity>
          </View>
          <Text className="text-xs font-bold text-gray-500 mb-2 tracking-widest">MAX CARS</Text>
          <View className="bg-white rounded-2xl px-4 border border-gray-200 mb-4">
            <TextInput value={maxCars} onChangeText={setMaxCars} keyboardType="numeric" className="py-3" />
          </View>

          <TouchableOpacity onPress={save} disabled={saving} activeOpacity={0.7} className="bg-[#7C3AED] rounded-2xl py-4 items-center mb-10">
            {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-black tracking-widest">SAVE CHANGES</Text>}
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
