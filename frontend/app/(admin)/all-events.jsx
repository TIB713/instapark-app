import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";

export default function AllEvents() {
  const router = useRouter();
  const { setCurrentEventId } = useAppStore();
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/events");
        setEvents(data || []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const filtered = events
    .filter((e) => filter === "all" || e.status === filter)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const open = async (e) => {
    setCurrentEventId(e.id);
    await AsyncStorage.setItem("current_event_id", e.id);
    router.push("/(admin)/event-detail");
  };

  return (
    <View className="flex-1 bg-[#F9FAFB]" testID="all-events-screen">
      <SafeAreaView edges={["top"]} className="bg-[#7C3AED]">
        <View className="bg-[#7C3AED] px-5 py-4 rounded-b-[30px] flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="bg-white/10 rounded-full p-2 mr-3">
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-black flex-1">All Events</Text>
        </View>
      </SafeAreaView>
      <View className="flex-row gap-2 px-4 pt-4">
        {["all", "active", "closed"].map((f) => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} className={`px-4 py-2 rounded-full ${filter === f ? "bg-[#7C3AED]" : "bg-white border border-gray-200"}`}>
            <Text className={`text-xs font-bold ${filter === f ? "text-white" : "text-gray-600"}`}>{f.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView className="flex-1 px-4 pt-4">
        {loading && <ActivityIndicator color="#7C3AED" />}
        {filtered.map((e) => (
          <TouchableOpacity key={e.id} onPress={() => open(e)} activeOpacity={0.7}
            className="bg-white rounded-2xl p-4 mb-3 flex-row items-center"
            style={{ borderLeftWidth: 4, borderLeftColor: e.status === "active" ? "#22C55E" : "#9CA3AF" }}>
            <View className="flex-1">
              <Text className="font-black text-[#7C3AED]">{e.name}</Text>
              <Text className="text-gray-500 text-xs mt-1">{e.date}{e.start_time ? ` · ${e.start_time}—${e.end_time}` : ""}</Text>
              <Text className="text-gray-500 text-xs">{e.venue}</Text>
              <View className="flex-row items-center mt-1">
                <View className={`px-2 py-0.5 rounded-full ${e.status === "active" ? "bg-green-100" : "bg-gray-100"}`}>
                  <Text className={`text-[10px] font-bold ${e.status === "active" ? "text-green-700" : "text-gray-700"}`}>{e.status?.toUpperCase()}</Text>
                </View>
                <Text className="text-gray-400 text-xs ml-2">Max {e.max_cars}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
        {!loading && filtered.length === 0 && <Text className="text-gray-400 text-center mt-10">No events</Text>}
      </ScrollView>
    </View>
  );
}
