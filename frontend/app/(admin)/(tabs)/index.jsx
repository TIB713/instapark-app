import { confirmDialog } from "../../../lib/confirmDialog";
import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../../lib/api";
import { useAppStore } from "../../../lib/store";
import { rs, rp } from "../../../utils/responsive";
import { theme } from "../../../utils/theme";
import { todayIST } from "../../../utils/time";

import { Screen, Card } from "../../../components/valet/ui";
import { SectionHead } from "../../../components/admin/SectionHead";
import { Hero } from "../../../components/admin/Hero";

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

export default function Dashboard() {
  const router = useRouter();
  const { user, setCurrentEventId } = useAppStore();
  const [events, setEvents] = useState([]);
  const [allFetchedEvents, setAllFetchedEvents] = useState([]);
  const [totalEventsCount, setTotalEventsCount] = useState(0);
  const [totalSpecialEventsCount, setTotalSpecialEventsCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [activeTodayCount, setActiveTodayCount] = useState(0);
  const [avgRating, setAvgRating] = useState("—");
  const [drivers, setDrivers] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isHotelOwner = user?.provider_type === "hotel_owner";

  const fetchAll = useCallback(async () => {
    try {
      const { data: evs } = await api.get("/events");
      const seen = new Set();
      const unique = (evs || []).filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
      const sorted = unique.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTotalEventsCount(unique.length);
      setTotalSpecialEventsCount(unique.filter(e => e.event_type === "hotel_special").length);
      setActiveCount(unique.filter(e => e.status === "active").length);
      const today = todayIST();
      setActiveTodayCount(unique.filter(e => e.date === today && e.status === "active").length);

      try {
        const { data: stats } = await api.get("/providers/me/stats");
        setAvgRating(stats.platform_avg_rating || "—");
      } catch {
        setAvgRating("—");
      }
      setAllFetchedEvents(sorted);
      const recent = sorted.slice(0, 5);
      setEvents(recent);
      try {
        const { data: drs } = await api.get("/drivers");
        setDrivers(drs || []);
      } catch {
        setDrivers([]);
      }
      try {
        const { data: sups } = await api.get("/supervisors");
        setSupervisors(sups || []);
      } catch {
        setSupervisors([]);
      }
      try {
        const { data: hts } = await api.get("/hotels");
        setHotels(hts || []);
      } catch {
        setHotels([]);
      }
    } catch (err) { }
    finally {
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
    const doSignOut = async () => {
      await useAppStore.getState().signOut();
      router.replace("/(auth)/login");
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Sign out?")) doSignOut();
      return;
    }
    confirmDialog.destructiveConfirm("Sign out", "Are you sure you want to sign out?", doSignOut, "Sign Out");
  };

  const openEvent = async (e) => {
    setCurrentEventId(e.id);
    await AsyncStorage.setItem("current_event_id", e.id);
    router.push("/(admin)/(tabs)/event-detail");
  };

  const specialEvents = allFetchedEvents.filter(e => e.event_type === "hotel_special");
  const dailyEvents = allFetchedEvents.filter(e => e.event_type === "hotel_daily");
  const todayStr = todayIST();
  const todaySpecial = specialEvents.filter(e => e.date === todayStr);
  const todayDaily = dailyEvents.find(e => e.date === todayStr);
  const active = events.filter((e) => e.status === "active");
  const upcoming = events.filter((e) => e.status === "upcoming");
  const past = events.filter((e) => e.status === "closed");

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const heroStats = isHotelOwner ? [
    { value: totalSpecialEventsCount, label: "EVENTS" },
    { value: activeTodayCount, label: "ACTIVE" },
    { value: supervisors.length, label: "SUPERS" },
    { value: drivers.length, label: "DRIVERS" }
  ] : [
    { value: totalEventsCount, label: "EVENTS" },
    { value: activeCount, label: "ACTIVE" },
    { value: supervisors.length, label: "SUPERS" },
    { value: drivers.length, label: "DRIVERS" }
  ];

  const pulseStats = isHotelOwner ? [
    { icon: "star", value: avgRating, label: "RATING", color: theme.colors.primary },
    { icon: "calendar", value: totalSpecialEventsCount, label: "SPECIAL", color: theme.colors.accent },
    { icon: "qr-code", value: "-", label: "QR CODES", color: theme.colors.success }
  ] : [
    { icon: "business", value: hotels.length, label: "HOTELS", color: theme.colors.primary },
    { icon: "star", value: avgRating, label: "RATING", color: theme.colors.accent },
    { icon: "qr-code", value: "-", label: "QR CODES", color: theme.colors.success }
  ];

  const renderListCard = (e) => {
    const isLive = e.status === "active";
    const isDaily = e.event_type === "hotel_daily";

    return (
      <Card key={e.id} onPress={() => openEvent(e)} style={{ flexDirection: "row", alignItems: "center", marginBottom: rp(theme.spacing.md), padding: rp(theme.spacing.lg), borderRadius: rp(28) }}>
        <View style={{ width: rp(48), height: rp(48), borderRadius: rp(16), backgroundColor: isLive ? theme.colors.successLight : theme.colors.primaryLight, justifyContent: "center", alignItems: "center", marginRight: rp(theme.spacing.md) }}>
          <Ionicons name="calendar-outline" size={rs(24)} color={isLive ? theme.colors.success : theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: rp(theme.spacing.sm), marginBottom: rp(4) }}>
            <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: theme.fontWeight.bold, fontSize: rs(theme.fontSize.bodyLarge), color: theme.colors.textPrimary }} numberOfLines={1}>
              {e.name}
            </Text>
            {isLive ? (
              <View style={{ backgroundColor: theme.colors.successLight, paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(theme.radius.pill) }}>
                <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.success, fontSize: rs(9), fontWeight: theme.fontWeight.bold, textTransform: 'uppercase' }}>Live</Text>
              </View>
            ) : isDaily ? (
              <View style={{ backgroundColor: theme.colors.infoLight, paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(theme.radius.pill) }}>
                <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.info, fontSize: rs(9), fontWeight: theme.fontWeight.bold, textTransform: 'uppercase' }}>Daily</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: theme.colors.warningLight, paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(theme.radius.pill) }}>
                <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.warning, fontSize: rs(9), fontWeight: theme.fontWeight.bold, textTransform: 'uppercase' }}>{e.status}</Text>
              </View>
            )}
          </View>
          <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, fontSize: rs(theme.fontSize.caption) }} numberOfLines={1}>
            {e.venue} • {e.date} • {e.start_time}—{e.end_time}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={rs(20)} color={theme.colors.textMuted} />
      </Card>
    );
  };

  const renderPastEvent = (e) => {
    return (
      <TouchableOpacity key={e.id} onPress={() => openEvent(e)} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", paddingVertical: rp(theme.spacing.md), borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
        <View style={{ width: rp(40), height: rp(40), borderRadius: rp(12), backgroundColor: theme.colors.surface, justifyContent: "center", alignItems: "center", marginRight: rp(theme.spacing.md) }}>
          <Ionicons name="time-outline" size={rs(20)} color={theme.colors.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: theme.fontFamily.semibold, fontWeight: theme.fontWeight.semibold, fontSize: rs(theme.fontSize.body), color: theme.colors.textPrimary }} numberOfLines={1}>{e.name}</Text>
          <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, fontSize: rs(theme.fontSize.caption), marginTop: rp(2) }} numberOfLines={1}>{e.date} • {e.venue}</Text>
        </View>
        <Ionicons name="chevron-forward" size={rs(16)} color={theme.colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfaceAlt }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: rp(100) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Hero
          eyebrow="Admin control room"
          title={`Hi, ${user?.name?.split(" ")[0] || "Admin"}`}
          // badges={[{ label: isHotelOwner ? "Owner Access" : "Admin Access", tone: "warning" }]}
          rightAction={{ text: user?.name?.[0]?.toUpperCase() || "A", onPress: () => router.push("/(admin)/(tabs)/profile") }}
          stats={heroStats}
        />

        <View style={{ paddingHorizontal: rp(theme.spacing.xl), marginTop: rp(theme.spacing.xl) }}>
          <SectionHead title="Company pulse" />
          <View style={{ flexDirection: "row", gap: rp(theme.spacing.md) }}>
            {pulseStats.map((stat, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: stat.color, borderRadius: rp(20), padding: rp(theme.spacing.md), alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={stat.icon} size={rs(20)} color="rgba(255,255,255,0.8)" style={{ marginBottom: rp(theme.spacing.sm) }} />
                <Text style={{ fontFamily: theme.fontFamily.headline, color: "#FFFFFF", fontSize: rs(theme.fontSize.title), fontWeight: theme.fontWeight.bold, marginBottom: rp(2) }}>{stat.value}</Text>
                <Text style={{ fontFamily: theme.fontFamily.bold, color: "rgba(255,255,255,0.8)", fontSize: rs(9), fontWeight: theme.fontWeight.bold, textTransform: "uppercase", letterSpacing: 0.5 }}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: rp(theme.spacing.xl), marginTop: rp(theme.spacing.xxxl) }}>
          <SectionHead title="Quick actions" />
          <View style={{ flexDirection: "row", gap: rp(theme.spacing.md), marginBottom: rp(theme.spacing.md) }}>
            <Card
              onPress={() => router.push(isHotelOwner ? { pathname: "/(admin)/(tabs)/create-event", params: { type: "special" } } : "/(admin)/(tabs)/create-event")}
              style={{ flex: 1, minHeight: rp(104), justifyContent: "space-between", alignItems: "flex-start", borderRadius: rp(theme.radius.xl), backgroundColor: theme.colors.accent }}
            >
              <View style={{ width: rp(40), height: rp(40), borderRadius: rp(12), backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: "center", alignItems: "center" }}>
                <Ionicons name="add" size={rs(20)} color={theme.colors.accentForeground} />
              </View>
              <View>
                <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: theme.fontWeight.bold, fontSize: rs(theme.fontSize.bodyLarge), color: theme.colors.accentForeground }}>New event</Text>
                <Text style={{ fontFamily: theme.fontFamily.regular, color: 'rgba(63, 1, 99, 0.6)', fontSize: rs(theme.fontSize.caption), marginTop: rp(2) }}>Create manually</Text>
              </View>
            </Card>

            {!isHotelOwner ? (
              <Card onPress={() => router.push("/(admin)/(tabs)/hotels")} style={{ flex: 1, minHeight: rp(104), justifyContent: "space-between", alignItems: "flex-start", borderRadius: rp(theme.radius.xl) }}>
                <View style={{ width: rp(40), height: rp(40), borderRadius: rp(12), backgroundColor: theme.colors.infoLight, justifyContent: "center", alignItems: "center" }}>
                  <Ionicons name="business" size={rs(20)} color={theme.colors.info} />
                </View>
                <View>
                  <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: theme.fontWeight.bold, fontSize: rs(theme.fontSize.bodyLarge), color: theme.colors.textPrimary }}>Hotels</Text>
                  <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, fontSize: rs(theme.fontSize.caption), marginTop: rp(2) }}>Contracts</Text>
                </View>
              </Card>
            ) : (
              <Card onPress={() => router.push("/(admin)/(tabs)/all-events")} style={{ flex: 1, minHeight: rp(104), justifyContent: "space-between", alignItems: "flex-start", borderRadius: rp(theme.radius.xl) }}>
                <View style={{ width: rp(40), height: rp(40), borderRadius: rp(12), backgroundColor: theme.colors.primaryLight, justifyContent: "center", alignItems: "center" }}>
                  <Ionicons name="calendar" size={rs(20)} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: theme.fontWeight.bold, fontSize: rs(theme.fontSize.bodyLarge), color: theme.colors.textPrimary }}>All Events</Text>
                  <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, fontSize: rs(theme.fontSize.caption), marginTop: rp(2) }}>View schedule</Text>
                </View>
              </Card>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: rp(theme.spacing.md) }}>
            <Card onPress={() => router.push("/(admin)/(tabs)/manage-employees")} style={{ flex: 1, minHeight: rp(104), justifyContent: "space-between", alignItems: "flex-start", borderRadius: rp(theme.radius.xl) }}>
              <View style={{ width: rp(40), height: rp(40), borderRadius: rp(12), backgroundColor: theme.colors.primaryLight, justifyContent: "center", alignItems: "center" }}>
                <Ionicons name="people" size={rs(20)} color={theme.colors.primary} />
              </View>
              <View>
                <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: theme.fontWeight.bold, fontSize: rs(theme.fontSize.bodyLarge), color: theme.colors.textPrimary }}>Team</Text>
                <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, fontSize: rs(theme.fontSize.caption), marginTop: rp(2) }}>Employees</Text>
              </View>
            </Card>

            <Card onPress={() => router.push("/(admin)/(tabs)/all-events")} style={{ flex: 1, minHeight: rp(104), justifyContent: "space-between", alignItems: "flex-start", borderRadius: rp(theme.radius.xl) }}>
              <View style={{ width: rp(40), height: rp(40), borderRadius: rp(12), backgroundColor: theme.colors.primaryLight, justifyContent: "center", alignItems: "center" }}>
                <Ionicons name="calendar" size={rs(20)} color={theme.colors.primary} />
              </View>
              <View>
                <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: theme.fontWeight.bold, fontSize: rs(theme.fontSize.bodyLarge), color: theme.colors.textPrimary }}>All Events</Text>
                <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, fontSize: rs(theme.fontSize.caption), marginTop: rp(2) }}>View schedule</Text>
              </View>
            </Card>
          </View>
        </View>

        {isHotelOwner ? (
          <View style={{ paddingHorizontal: rp(theme.spacing.xl), marginTop: rp(theme.spacing.xxxl) }}>
            <SectionHead
              title="Today's operations"
              actionLabel="See all"
              onActionPress={() => router.push("/(admin)/(tabs)/all-events")}
            />
            {todayDaily ? renderListCard(todayDaily) : null}
            {todaySpecial.map(renderListCard)}
            {!todayDaily && todaySpecial.length === 0 && (
              <View style={{ paddingVertical: rp(theme.spacing.xl), alignItems: 'center' }}>
                <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, fontSize: rs(theme.fontSize.body) }}>No events scheduled for today.</Text>
              </View>
            )}

            {specialEvents.filter(e => e.status !== "active").length > 0 && (
              <View style={{ marginTop: rp(theme.spacing.lg) }}>
                <SectionHead title="Past special events" />
                {specialEvents.filter(e => e.status !== "active").slice(0, 5).map(renderPastEvent)}
              </View>
            )}
          </View>
        ) : (
          <>
            <View style={{ paddingHorizontal: rp(theme.spacing.xl), marginTop: rp(theme.spacing.xxxl) }}>
              <SectionHead
                title="Active events"
                actionLabel="See all"
                onActionPress={() => router.push("/(admin)/(tabs)/all-events")}
              />
              {active.length === 0 ? (
                <View style={{ paddingVertical: rp(theme.spacing.xl), alignItems: 'center' }}>
                  <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textMuted, fontSize: rs(theme.fontSize.body) }}>No active events right now.</Text>
                </View>
              ) : (
                active.map(renderListCard)
              )}
            </View>

            {past.length > 0 && (
              <View style={{ paddingHorizontal: rp(theme.spacing.xl), marginTop: rp(theme.spacing.xl) }}>
                <SectionHead title="Past events" />
                {past.slice(0, 5).map(renderPastEvent)}
              </View>
            )}
          </>
        )}

        {/* Simple sign out button at the bottom for testing since header profile links elsewhere */}
        <TouchableOpacity onPress={handleSignOut} style={{ alignSelf: 'center', marginTop: rp(theme.spacing.xxxl), padding: rp(theme.spacing.md) }}>
          <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.danger, fontSize: rs(theme.fontSize.body), fontWeight: theme.fontWeight.bold }}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
