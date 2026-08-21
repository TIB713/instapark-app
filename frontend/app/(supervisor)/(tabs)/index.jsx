import { useCallback, useState } from "react";
import { rs, rp } from '../../../utils/responsive';
import { todayIST } from '../../../utils/time';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppStore } from "../../../lib/store";
import { theme } from "../../../utils/theme";
import api from "../../../lib/api";
import { Card, Screen, StatusPill } from "../../../components/valet/ui";
import Heading from "../../../components/Heading";
import { useSupervisorEvents } from "../../../hooks/useSupervisorEvents";

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

export default function SupervisorDashboard() {
  const router = useRouter();
  const { user, setCurrentEventId } = useAppStore();
  const { events, hotel, loading, refreshing, wsStatus, fetchAll, setRefreshing } = useSupervisorEvents();

  const [freeDrivers, setFreeDrivers] = useState(0);
  const [openIncidents, setOpenIncidents] = useState([]);
  const [happeningStats, setHappeningStats] = useState({});

  const todayStr = todayIST();
  const todayDaily = events.find(e => e.hotel_id === user?.hotel_id && e.date === todayStr && e.event_type === "hotel_daily");
  const active = events.filter((e) => e.status === "active").slice(0, 5);
  const past = events.filter((e) => e.status !== "active").slice(0, 5);
  const spotlightEvents = active.length > 0 ? active : (todayDaily ? [todayDaily] : []);

  const fetchExtras = async () => {
    try {
      const { data } = await api.get("/drivers");
      setFreeDrivers((data || []).filter(d => d.is_active).length);
    } catch {
      setFreeDrivers(0);
    }
    
    try {
      let openList = [];
      await Promise.all(active.map(async (event) => {
        try {
          const { data } = await api.get(`/incidents/event/${event.id}`);
          const activeIncidents = (data || []).filter(i => i.status !== "RESOLVED" && i.status !== "DISMISSED");
          activeIncidents.forEach(inc => {
             inc.event_id = event.id;
             inc.event_name = event.name;
          });
          openList = openList.concat(activeIncidents);
        } catch {}
      }));
      setOpenIncidents(openList);
    } catch {
      setOpenIncidents(0);
    }

    if (spotlightEvents.length > 0) {
      try {
        const statsMap = {};
        await Promise.all(spotlightEvents.map(async (event) => {
          try {
            const { data } = await api.get(`/events/${event.id}/stats`);
            statsMap[event.id] = data;
          } catch {}
        }));
        setHappeningStats(statsMap);
      } catch {
        setHappeningStats({});
      }
    } else {
      setHappeningStats({});
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAll();
      if (events.length > 0) fetchExtras();
    }, [fetchAll, events.length, active.length, spotlightEvents.length])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
    fetchExtras();
  };

  const openEvent = async (e, showQr = false) => {
    setCurrentEventId(e.id);
    await AsyncStorage.setItem("current_event_id", e.id);
    if (showQr) {
      router.push({ pathname: "/(supervisor)/(tabs)/event-detail", params: { showQr: "true" } });
    } else {
      router.push("/(supervisor)/(tabs)/event-detail");
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surfaceAlt, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const isConnected = wsStatus === 'connected';

  return (
    <Screen scroll={true} onRefresh={onRefresh} refreshing={refreshing}>
      {/* HERO HEADER */}
      <View style={{
        backgroundColor: theme.colors.primary,
        borderBottomLeftRadius: theme.radius.xxxl || rp(32),
        borderBottomRightRadius: theme.radius.xxxl || rp(32),
        paddingBottom: rp(theme.spacing.xl),
      }}>
        <SafeAreaView edges={['top']} />
        <View style={{ paddingHorizontal: rp(theme.spacing.xl), paddingTop: rp(theme.spacing.md) }}>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: rs(10), fontWeight: "800", letterSpacing: rs(2), color: theme.colors.accent, textTransform: 'uppercase', marginBottom: rp(4) }}>
                SUPERVISOR CONSOLE
              </Text>
              <Heading level="display" style={{ color: '#FFFFFF', marginBottom: rp(8) }} numberOfLines={1}>
                Hi, {user?.name || 'Supervisor'}
              </Heading>
              
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isConnected ? theme.colors.successLight : theme.colors.warningLight,
                paddingHorizontal: rp(theme.spacing.md),
                paddingVertical: rp(theme.spacing.xs),
                borderRadius: theme.radius.pill,
                alignSelf: 'flex-start',
              }}>
                <Text style={{
                  color: isConnected ? theme.colors.success : theme.colors.warning,
                  fontSize: rs(10),
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                }}>
                  {isConnected ? "● Live sync on" : "● Reconnecting"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => router.push("/(supervisor)/(tabs)/profile")}
              style={{ width: rp(44), height: rp(44), borderRadius: rp(22), backgroundColor: "rgba(255,255,255,0.15)", alignItems: 'center', justifyContent: 'center' }}
              activeOpacity={0.7}
            >
              <Heading level="subtitle" style={{ color: '#FFFFFF' }}>{(user?.name || 'S').charAt(0).toUpperCase()}</Heading>
            </TouchableOpacity>
          </View>

          {/* 4 Compact Metric Tiles */}
          <View style={{ flexDirection: 'row', gap: rp(theme.spacing.sm), marginTop: rp(theme.spacing.xl) }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: theme.radius.lg, paddingVertical: rp(10), alignItems: 'center' }}>
              <Heading level="subtitle" style={{ color: '#FFFFFF' }}>{events.length}</Heading>
              <Text style={{ fontSize: rs(10), color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', fontWeight: 'bold', marginTop: rp(2) }}>Events</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: theme.radius.lg, paddingVertical: rp(10), alignItems: 'center' }}>
              <Heading level="subtitle" style={{ color: theme.colors.success }}>{active.length}</Heading>
              <Text style={{ fontSize: rs(10), color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', fontWeight: 'bold', marginTop: rp(2) }}>Active</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: theme.radius.lg, paddingVertical: rp(10), alignItems: 'center' }}>
              <Heading level="subtitle" style={{ color: '#FFFFFF' }}>{freeDrivers}</Heading>
              <Text style={{ fontSize: rs(10), color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', fontWeight: 'bold', marginTop: rp(2) }}>Drivers</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: theme.radius.lg, paddingVertical: rp(10), alignItems: 'center' }}>
              <Heading level="subtitle" style={{ color: openIncidents.length > 0 ? theme.colors.danger : '#FFFFFF' }}>{openIncidents.length}</Heading>
              <Text style={{ fontSize: rs(10), color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', fontWeight: 'bold', marginTop: rp(2) }}>Alerts</Text>
            </View>
          </View>

        </View>
      </View>

      <View style={{ paddingHorizontal: rp(theme.spacing.lg), marginTop: rp(theme.spacing.lg), gap: rp(theme.spacing.lg), paddingBottom: rp(80) }}>
        
        {/* HAPPENING NOW SPOTLIGHT */}
        {spotlightEvents.length > 0 && (
          <View>
            <Text style={labelStyle}>HAPPENING NOW</Text>
            {spotlightEvents.map((event) => {
              const eventStats = happeningStats[event.id];
              return (
                <Card key={event.id} onPress={() => openEvent(event)} style={{ borderRadius: theme.radius.xl, padding: rp(theme.spacing.lg), marginBottom: rp(theme.spacing.md) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: rp(theme.spacing.md) }}>
                    <View style={{ width: rp(40), height: rp(40), borderRadius: rp(20), backgroundColor: theme.colors.successLight, alignItems: 'center', justifyContent: 'center', marginRight: rp(theme.spacing.md) }}>
                      <Ionicons name="calendar" size={20} color={theme.colors.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: rp(theme.spacing.sm), flexWrap: 'wrap' }}>
                        <Heading level="subtitle">{event.name}</Heading>
                        {event.status === 'active' && (
                          <View style={{ backgroundColor: theme.colors.success, borderRadius: rp(4), paddingHorizontal: rp(6), paddingVertical: rp(2) }}>
                            <Text style={{ color: "#FFFFFF", fontSize: rs(9), fontWeight: "900" }}>LIVE</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: rp(4) }}>
                        <Ionicons name="location-outline" size={12} color={theme.colors.textSecondary} />
                        <Text style={{ color: theme.colors.textSecondary, fontSize: rs(12), marginLeft: rp(4) }} numberOfLines={1}>
                          {event.venue} · {event.start_time}–{event.end_time}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: rp(theme.spacing.md) }}>
                    {eventStats ? (
                      <>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: rs(11), color: theme.colors.textSecondary, textTransform: 'uppercase', fontWeight: 'bold' }}>Cars</Text>
                          <Text style={{ fontSize: rs(16), fontWeight: 'bold', color: theme.colors.textPrimary, marginTop: rp(2) }}>{eventStats.total_cars ?? '—'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: rs(11), color: theme.colors.textSecondary, textTransform: 'uppercase', fontWeight: 'bold' }}>Parked</Text>
                          <Text style={{ fontSize: rs(16), fontWeight: 'bold', color: theme.colors.textPrimary, marginTop: rp(2) }}>{eventStats.still_parked ?? '—'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: rs(11), color: theme.colors.textSecondary, textTransform: 'uppercase', fontWeight: 'bold' }}>Delivered</Text>
                          <Text style={{ fontSize: rs(16), fontWeight: 'bold', color: theme.colors.textPrimary, marginTop: rp(2) }}>{eventStats.total_delivered ?? '—'}</Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: rs(11), color: theme.colors.textSecondary, textTransform: 'uppercase', fontWeight: 'bold' }}>Max cars</Text>
                          <Text style={{ fontSize: rs(16), fontWeight: 'bold', color: theme.colors.textPrimary, marginTop: rp(2) }}>{event.max_cars || 0}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: rs(11), color: theme.colors.textSecondary, textTransform: 'uppercase', fontWeight: 'bold' }}>Gates</Text>
                          <Text style={{ fontSize: rs(16), fontWeight: 'bold', color: theme.colors.textPrimary, marginTop: rp(2) }}>{event.gates?.length || 0}</Text>
                        </View>
                      </>
                    )}
                  </View>

                  {eventStats && (
                    <View style={{ marginTop: rp(theme.spacing.md) }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: rp(6) }}>
                        <Text style={{ fontSize: rs(10), fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: rs(1) }}>Capacity</Text>
                        <Text style={{ fontSize: rs(11), color: theme.colors.textSecondary }}>
                          {eventStats.still_parked ?? 0}/{event.max_cars || 0} · {event.max_cars ? Math.round(((eventStats.still_parked ?? 0) / event.max_cars) * 100) : 0}%
                        </Text>
                      </View>
                      <View style={{ height: rp(6), backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(3), overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${event.max_cars ? Math.min(100, Math.round(((eventStats.still_parked ?? 0) / event.max_cars) * 100)) : 0}%`, backgroundColor: theme.colors.accent }} />
                      </View>
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        )}

        {/* QUICK ACTIONS */}
        <View>
          <Text style={labelStyle}>QUICK ACTIONS</Text>
          <View style={{ flexDirection: 'row', gap: rp(theme.spacing.md) }}>
            <Card
              onPress={() => router.push("/(supervisor)/(tabs)/scan")}
              style={{ flex: 1, borderRadius: theme.radius.xl, padding: rp(16), minHeight: rp(96) }}
            >
              <View style={{ width: rp(32), height: rp(32), borderRadius: rp(16), backgroundColor: theme.colors.accentLight, alignItems: 'center', justifyContent: 'center', marginBottom: rp(theme.spacing.sm) }}>
                <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.accentForeground} />
              </View>
              <Text style={{ fontWeight: 'bold', fontSize: rs(14), color: theme.colors.textPrimary }}>Check In</Text>
              <Text style={{ fontSize: rs(11), color: theme.colors.textSecondary, marginTop: rp(2) }}>Add a car</Text>
            </Card>

            <Card
              onPress={() => router.push("/(supervisor)/(tabs)/team")}
              style={{ flex: 1, borderRadius: theme.radius.xl, padding: rp(16), minHeight: rp(96) }}
            >
              <View style={{ width: rp(32), height: rp(32), borderRadius: rp(16), backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: rp(theme.spacing.sm) }}>
                <Ionicons name="people-outline" size={18} color={theme.colors.primary} />
              </View>
              <Text style={{ fontWeight: 'bold', fontSize: rs(14), color: theme.colors.textPrimary }}>Team</Text>
              <Text style={{ fontSize: rs(11), color: theme.colors.textSecondary, marginTop: rp(2) }}>Manage staff</Text>
            </Card>

            <Card
              onPress={() => router.push("/(supervisor)/(tabs)/events")}
              style={{ flex: 1, borderRadius: theme.radius.xl, padding: rp(16), minHeight: rp(96) }}
            >
              <View style={{ width: rp(32), height: rp(32), borderRadius: rp(16), backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: rp(theme.spacing.sm) }}>
                <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
              </View>
              <Text style={{ fontWeight: 'bold', fontSize: rs(14), color: theme.colors.textPrimary }}>Active events</Text>
              <Text style={{ fontSize: rs(11), color: theme.colors.textSecondary, marginTop: rp(2) }}>{active.length} active</Text>
            </Card>
          </View>
        </View>

        {/* ALERTS SECTION */}
        <View>
          <Text style={labelStyle}>ALERTS</Text>
          {openIncidents.length > 0 ? (
            openIncidents.map(inc => (
              <Card 
                key={inc.id}
                onPress={() => {
                  setCurrentEventId(inc.event_id);
                  AsyncStorage.setItem("current_event_id", inc.event_id.toString());
                  router.push({ pathname: "/(supervisor)/(tabs)/event-detail", params: { tab: "incidents" } }); 
                }}
                style={{ flexDirection: 'row', alignItems: 'center', padding: rp(theme.spacing.lg), borderRadius: theme.radius.xl, marginBottom: rp(theme.spacing.sm) }}
              >
                <View style={{ width: rp(40), height: rp(40), borderRadius: rp(20), backgroundColor: theme.colors.dangerLight, alignItems: 'center', justifyContent: 'center', marginRight: rp(theme.spacing.md) }}>
                  <Ionicons name="alert-circle" size={20} color={theme.colors.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: rs(15), fontWeight: '800', color: theme.colors.textPrimary }}>{inc.plate || "Unknown Car"}</Text>
                  <Text style={{ fontSize: rs(12), color: theme.colors.textSecondary, marginTop: rp(2) }}>{inc.event_name} • {inc.description || "Incident"}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              </Card>
            ))
          ) : (
            <Card style={{ flexDirection: 'row', alignItems: 'center', padding: rp(theme.spacing.lg), borderRadius: theme.radius.xl }}>
              <View style={{ width: rp(40), height: rp(40), borderRadius: rp(20), backgroundColor: theme.colors.successLight, alignItems: 'center', justifyContent: 'center', marginRight: rp(theme.spacing.md) }}>
                <Ionicons name="alert-circle-outline" size={20} color={theme.colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: rs(15), fontWeight: '800', color: theme.colors.textPrimary }}>All clear</Text>
                <Text style={{ fontSize: rs(12), color: theme.colors.textSecondary, marginTop: rp(2) }}>No unresolved incidents on any event</Text>
              </View>
            </Card>
          )}
        </View>

        {/* MY HOTEL */}
        {user?.hotel_id && hotel && (
          <View>
            <Text style={labelStyle}>MY HOTEL</Text>
            <Card style={{ flexDirection: "row", alignItems: "center", padding: rp(theme.spacing.lg), borderRadius: theme.radius.xl }}>
              <View style={{ backgroundColor: theme.colors.primaryLight, padding: rp(10), borderRadius: theme.radius.md, marginRight: rp(14) }}>
                <Ionicons name="business" size={24} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Heading level="subtitle">{hotel.name}</Heading>
                <Text style={{ fontSize: rs(12), color: theme.colors.textSecondary, marginTop: rp(2) }}>Primary Assigned Location</Text>
              </View>
            </Card>
          </View>
        )}



        {/* RECENT EVENTS */}
        {past.length > 0 && (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rp(theme.spacing.sm) }}>
              <Text style={[labelStyle, { marginBottom: 0 }]}>RECENT EVENTS</Text>
              <TouchableOpacity onPress={() => router.push("/(supervisor)/(tabs)/events")}>
                <Text style={{ fontSize: rs(12), fontWeight: '700', color: theme.colors.primary }}>SEE ALL</Text>
              </TouchableOpacity>
            </View>
            {past.map((e) => (
              <Card key={e.id} onPress={() => openEvent(e)} style={{ borderRadius: theme.radius.lg, padding: rp(theme.spacing.md), marginBottom: rp(theme.spacing.sm) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: rp(44), height: rp(44), borderRadius: theme.radius.lg, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: rp(theme.spacing.md) }}>
                    <Ionicons name="car-sport-outline" size={24} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1, paddingRight: rp(8) }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: rp(theme.spacing.sm), flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: rs(15), fontWeight: '800', color: theme.colors.textPrimary }}>{e.name}</Text>
                      {e.event_type === "hotel_daily" && (
                        <View style={{ backgroundColor: theme.colors.info, borderRadius: rp(6), paddingHorizontal: rp(6), paddingVertical: rp(2) }}>
                          <Text style={{ color: theme.colors.surface, fontSize: rs(9), fontWeight: "800" }}>🏨 AUTO</Text>
                        </View>
                      )}
                      {e.event_type === "hotel_special" && (
                        <View style={{ backgroundColor: theme.colors.info, borderRadius: rp(6), paddingHorizontal: rp(6), paddingVertical: rp(2) }}>
                          <Text style={{ color: theme.colors.surface, fontSize: rs(9), fontWeight: "800" }}>🏨 SPECIAL</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: rs(12), color: theme.colors.textSecondary, marginTop: rp(4) }} numberOfLines={1}>
                      {e.venue} · {e.date}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                </View>
              </Card>
            ))}
          </View>
        )}

      </View>
    </Screen>
  );
}

const labelStyle = {
  fontSize: rs(11),
  fontWeight: "700",
  color: theme.colors.textSecondary,
  letterSpacing: rs(3),
  textTransform: "uppercase",
  marginBottom: rp(theme.spacing.sm),
};
