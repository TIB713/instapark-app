import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl, ActivityIndicator, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteItem as secureDelete } from "../../lib/secure";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";

export default function DriverHome() {
  const router = useRouter();
  const { driver, setCurrentEventId, signOut } = useAppStore();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!driver?.id) { setLoading(false); return; }
    try {
      const { data: evs } = await api.get("/events");
      const active = (evs || []).filter((e) => e.status === "active");
      const assigned = [];
      for (const e of active) {
        try {
          const { data: drs } = await api.get(`/events/${e.id}/drivers`);
          if ((drs || []).some((d) => d.id === driver.id && d.assigned)) assigned.push(e);
        } catch {}
      }
      setEvents(assigned);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [driver?.id]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleSignOut = () => {
    const doSignOut = async () => {
      await secureDelete("auth_token");
      await AsyncStorage.multiRemove(["driver_session", "current_event_id"]);
      signOut();
      router.replace("/(auth)/login");
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Sign out?")) doSignOut();
      return;
    }
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: doSignOut },
    ]);
  };

  const openEvent = async (e) => {
    setCurrentEventId(e.id);
    await AsyncStorage.setItem("current_event_id", e.id);
    router.push("/(driver)/tasks");
  };

  return (
    <View className="flex-1 bg-[#F9FAFB]" testID="driver-home">
      <SafeAreaView edges={["top"]} className="bg-[#0F2044]">
        <View className="bg-[#0F2044] px-5 py-4 rounded-b-[40px] flex-row items-center">
          <View className="flex-1">
            <Text className="text-white text-2xl font-black">My Events</Text>
            <Text className="text-white/70 text-sm mt-1">{driver?.name}</Text>
          </View>
          <TouchableOpacity onPress={handleSignOut} testID="driver-signout" className="bg-white/10 rounded-full p-3">
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(); }} />}
      >
        {loading && <ActivityIndicator color="#0F2044" />}
        {!loading && events.length === 0 && (
          <View className="items-center mt-20">
            <Ionicons name="calendar-outline" size={64} color="#9CA3AF" />
            <Text className="text-gray-500 text-center mt-3 px-8">No active events assigned.{"\n"}Contact your admin.</Text>
          </View>
        )}
        {events.map((e) => (
          <TouchableOpacity key={e.id} onPress={() => openEvent(e)} activeOpacity={0.7}
            className="bg-white rounded-2xl p-4 mb-3 flex-row items-center" style={{ borderLeftWidth: 4, borderLeftColor: "#22C55E" }}>
            <View className="flex-1">
              <Text className="font-black text-[#0F2044] text-base">{e.name}</Text>
              <View className="flex-row items-center mt-1">
                <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                <Text className="text-gray-500 text-xs ml-1">{e.date}</Text>
              </View>
              <View className="flex-row items-center mt-1">
                <Ionicons name="location-outline" size={14} color="#6B7280" />
                <Text className="text-gray-500 text-xs ml-1">{e.venue}</Text>
              </View>
              <View className="bg-green-100 self-start px-2 py-0.5 rounded-full mt-2">
                <Text className="text-green-700 text-[10px] font-bold">ACTIVE</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
