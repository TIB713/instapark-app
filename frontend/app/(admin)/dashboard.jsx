import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteItem as secureDelete } from "../../lib/secure";
import { format } from "date-fns";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

export default function Dashboard() {
  const router = useRouter();
  const { user, setCurrentEventId, signOut } = useAppStore();
  const [events, setEvents] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const { data: evs } = await api.get("/events");
      // Auto-close expired active events
      const now = new Date();
      for (const e of evs) {
        if (e.status === "active" && e.end_date && e.end_time) {
          const endDT = new Date(`${e.end_date}T${e.end_time}:00`);
          if (now > endDT) {
            try {
              await api.post(`/events/${e.id}/close`);
            } catch {}
          }
        }
      }
      const { data: refreshed } = await api.get("/events");
      setEvents(refreshed || []);
      try {
        const { data: drs } = await api.get("/drivers");
        setDrivers(drs || []);
      } catch {
        setDrivers([]);
      }
    } catch (err) {
      // 401 handled by interceptor
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await secureDelete("auth_token");
          await AsyncStorage.multiRemove([
            "driver_session",
            "current_event_id",
          ]);
          signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const openEvent = async (e) => {
    setCurrentEventId(e.id);
    await AsyncStorage.setItem("current_event_id", e.id);
    router.push("/(admin)/event-detail");
  };

  const active = events.filter((e) => e.status === "active");
  const past = events.filter((e) => e.status !== "active");
  const totalCars = events.reduce((s, e) => s + (e.total_cars || 0), 0);
  const avgRating =
    events.filter((e) => e.avg_rating).length > 0
      ? (
          events.reduce((s, e) => s + (e.avg_rating || 0), 0) /
          events.filter((e) => e.avg_rating).length
        ).toFixed(1)
      : "—";

  if (loading) {
    return (
      <View className="flex-1 bg-[#F9FAFB] justify-center items-center">
        <ActivityIndicator size="large" color="#0F2044" />
      </View>
    );
  }

  return (
    <View testID="admin-dashboard" className="flex-1 bg-[#F9FAFB]">
      <SafeAreaView edges={["top"]} className="bg-[#0F2044]">
        <View className="bg-[#0F2044] px-6 pt-2 pb-10 rounded-b-[40px]">
          <View className="flex-row justify-between items-start">
            <View className="flex-1">
              <Text className="text-white/70 text-sm">{greeting()},</Text>
              <Text className="text-white text-2xl font-black mt-1">
                {user?.name || "Admin"}
              </Text>
            </View>
            <TouchableOpacity
              testID="signout-btn"
              onPress={handleSignOut}
              className="bg-white/10 rounded-full p-3"
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        className="flex-1 -mt-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        >
          <TouchableOpacity
            testID="stat-total-events"
            onPress={() => router.push("/(admin)/all-events")}
            activeOpacity={0.7}
            className="bg-white rounded-2xl px-5 py-4 border-l-4 border-[#1A3C6E] shadow-sm"
            style={{ minWidth: 140 }}
          >
            <Text className="text-xs font-bold text-gray-500 tracking-widest">
              TOTAL EVENTS
            </Text>
            <Text className="text-3xl font-black text-[#0F2044] mt-1">
              {events.length}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="stat-active"
            onPress={() => router.push("/(admin)/all-events")}
            activeOpacity={0.7}
            className="bg-white rounded-2xl px-5 py-4 border-l-4 border-green-500 shadow-sm"
            style={{ minWidth: 140 }}
          >
            <View className="flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
              <Text className="text-xs font-bold text-gray-500 tracking-widest">
                ACTIVE NOW
              </Text>
            </View>
            <Text className="text-3xl font-black text-[#0F2044] mt-1">
              {active.length}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="stat-drivers"
            onPress={() => router.push("/(admin)/manage-drivers")}
            activeOpacity={0.7}
            className="bg-white rounded-2xl px-5 py-4 border-l-4 border-purple-500 shadow-sm"
            style={{ minWidth: 140 }}
          >
            <Text className="text-xs font-bold text-gray-500 tracking-widest">
              TOTAL DRIVERS
            </Text>
            <Text className="text-3xl font-black text-[#0F2044] mt-1">
              {drivers.length}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="stat-rating"
            onPress={() => router.push("/(admin)/all-events")}
            activeOpacity={0.7}
            className="bg-white rounded-2xl px-5 py-4 border-l-4 border-amber-500 shadow-sm"
            style={{ minWidth: 140 }}
          >
            <Text className="text-xs font-bold text-gray-500 tracking-widest">
              ⭐ AVG RATING
            </Text>
            <Text className="text-3xl font-black text-[#0F2044] mt-1">
              {avgRating}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View className="px-4 mt-6 gap-3">
          <TouchableOpacity
            testID="quick-new-event"
            onPress={() => router.push("/(admin)/create-event")}
            activeOpacity={0.7}
            className="bg-[#0F2044] rounded-2xl px-5 py-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center">
              <Ionicons name="add-circle" size={22} color="#fff" />
              <Text className="text-white font-bold text-base ml-3">
                New Event
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            testID="quick-manage-drivers"
            onPress={() => router.push("/(admin)/manage-drivers")}
            activeOpacity={0.7}
            className="bg-[#1A3C6E] rounded-2xl px-5 py-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center">
              <Ionicons name="people" size={22} color="#fff" />
              <Text className="text-white font-bold text-base ml-3">
                Manage Drivers
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View className="px-4 mt-8">
          <View className="flex-row items-center mb-3">
            <Text className="text-lg font-black text-[#0F2044]">
              Active Events
            </Text>
            <View className="ml-2 bg-green-100 px-2.5 py-0.5 rounded-full">
              <Text className="text-green-700 font-bold text-xs">
                {active.length}
              </Text>
            </View>
          </View>
          {active.length === 0 ? (
            <Text className="text-gray-400 text-sm">No active events</Text>
          ) : (
            active.map((e) => (
              <TouchableOpacity
                key={e.id}
                testID={`active-event-${e.id}`}
                onPress={() => openEvent(e)}
                activeOpacity={0.7}
                className="bg-white rounded-2xl p-4 mb-3 border-l-4 border-green-500 flex-row items-center"
              >
                <View className="flex-1">
                  <Text className="font-black text-[#0F2044] text-base">
                    {e.name}
                  </Text>
                  <Text className="text-gray-500 text-xs mt-1">
                    {e.date} · {e.start_time}—{e.end_time}
                  </Text>
                  <Text className="text-gray-500 text-xs mt-0.5">{e.venue}</Text>
                  <View className="flex-row items-center mt-2">
                    <View className="bg-green-100 px-2 py-0.5 rounded-full">
                      <Text className="text-green-700 font-bold text-[10px]">
                        ACTIVE
                      </Text>
                    </View>
                    <Text className="text-gray-500 text-xs ml-2">
                      {e.total_cars || 0}/{e.max_cars} cars
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ))
          )}
        </View>

        {past.length > 0 && (
          <View className="px-4 mt-6">
            <Text className="text-lg font-black text-[#0F2044] mb-3">
              Past Events
            </Text>
            {past.slice(0, 5).map((e) => (
              <TouchableOpacity
                key={e.id}
                onPress={() => openEvent(e)}
                activeOpacity={0.7}
                className="bg-white rounded-2xl p-4 mb-3 border-l-4 border-gray-300 flex-row items-center"
              >
                <View className="flex-1">
                  <Text className="font-black text-gray-700 text-base">
                    {e.name}
                  </Text>
                  <Text className="text-gray-400 text-xs mt-1">
                    {e.date} · {e.venue}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
