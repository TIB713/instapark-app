import { confirmDialog } from "../../../lib/confirmDialog";
import { useEffect, useState, useCallback } from "react";
import { rs, rp } from "../../../utils/responsive";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Modal } from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../../lib/api";
import { useAppStore } from "../../../lib/store";
import { theme } from "../../../utils/theme";
import { Card, Chip } from "../../../components/valet/ui";
import { Hero } from "../../../components/admin/Hero";

export default function AllEvents() {
  const router = useRouter();
  const { filter: incomingFilter } = useLocalSearchParams();
  const { setCurrentEventId, user } = useAppStore();
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState(incomingFilter || "all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [cloningId, setCloningId] = useState(null);

  const isHotelOwner = user?.provider_type === "hotel_owner";

  const [openMenuId, setOpenMenuId] = useState(null);

  const fetchEvents = useCallback(async () => {
    try {
      const { data } = await api.get("/events");
      setEvents(data || []);
    } catch { }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [fetchEvents])
  );

  const filtered = events
    .filter((e) => {
      // 1. Status Filter
      if (filter !== "all" && filter !== "special" && filter !== "daily") {
        if (e.status !== filter) return false;
      }

      // 2. Event Type Filter (from dashboard params)
      if (filter === "special" && e.event_type !== "hotel_special") return false;
      if (filter === "daily" && e.event_type !== "hotel_daily") return false;

      // 3. Search Filter
      if (search) {
        const q = search.toLowerCase();
        if (!e.name?.toLowerCase().includes(q) && !e.venue?.toLowerCase().includes(q)) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const open = async (e) => {
    setCurrentEventId(e.id);
    await AsyncStorage.setItem("current_event_id", e.id);
    router.push("/(admin)/(tabs)/event-detail");
  };

  const cloneEvent = async (e, evt) => {
    e.stopPropagation();
    confirmDialog.confirm(
      "Clone event",
      `Create a copy of "${evt.name}"?`,
      async () => {
        try {
          await api.post(`/events/${evt.id}/clone`);
          await fetchEvents();
          confirmDialog.info("Cloned!", `Event cloned successfully.`);
        } catch {
          confirmDialog.info("Couldn't clone event", "Something went wrong cloning the event. Check your connection and try again.");
        } finally {
          setCloningId(null);
        }
      }
    );
  };

  const closeEvent = (eventId) => {
    confirmDialog.destructiveConfirm("Close event", "Are you sure? This cannot be undone.", async () => {
      try {
        await api.post(`/events/${eventId}/close`);
        await fetchEvents();
      } catch (err) {
        confirmDialog.info("Error", err.response?.data?.detail || "Could not close event");
      }
    }, "Close");
  };

  const reopenEvent = (eventId) => {
    confirmDialog.confirm("Reactivate event", "Are you sure you want to reopen this event?", async () => {
      try {
        await api.post(`/events/${eventId}/reopen`);
        await fetchEvents();
      } catch (e) {
        confirmDialog.info("Couldn't reactivate event", "Something went wrong reopening the event. Check your connection and try again.");
      }
    }, "Reactivate");
  };

  const activateEventManually = (eventId) => {
    confirmDialog.confirm("Activate event", "Are you sure you want to manually activate this event early?", async () => {
      try {
        await api.post(`/events/${eventId}/activate`);
        await fetchEvents();
      } catch (err) {
        confirmDialog.info("Error", err.response?.data?.detail || "Could not activate event");
      }
    });
  };

  const activeCount = events.filter(e => e.status === "active").length;
  const closedCount = events.filter(e => e.status === "closed").length;
  const totalCapacity = events.reduce((sum, e) => sum + (parseInt(e.max_cars) || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfaceAlt }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: rp(100) }} showsVerticalScrollIndicator={false}>
        <Hero
          eyebrow="Operations"
          title="Events"
          rightAction={{ icon: "add", tone: "accent", onPress: () => router.push("/(admin)/(tabs)/create-event") }}
          stats={[
            { value: events.length, label: "TOTAL" },
            { value: activeCount, label: "LIVE" },
            { value: closedCount, label: "CLOSED" },
            { value: totalCapacity, label: "CAPACITY" }
          ]}
        />

        <View style={{ paddingHorizontal: rp(theme.spacing.xl), marginTop: rp(theme.spacing.xl) }}>
          <View style={{ marginBottom: rp(theme.spacing.lg) }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: rp(8) }}>
              {["all", "active", "upcoming", "closed", ...(isHotelOwner ? ["special", "daily"] : [])].map((f) => (
                <Chip
                  key={f}
                  label={f.charAt(0).toUpperCase() + f.slice(1)}
                  active={filter === f}
                  onPress={() => setFilter(f)}
                />
              ))}
            </ScrollView>
          </View>

          <View style={{ backgroundColor: theme.colors.surface, borderRadius: rp(theme.radius.pill), flexDirection: "row", alignItems: "center", paddingHorizontal: rp(theme.spacing.lg), marginBottom: rp(theme.spacing.xl), shadowColor: theme.colors.primary, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
            <Ionicons name="search-outline" size={rs(20)} color={theme.colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name or venue..."
              placeholderTextColor={theme.colors.textMuted}
              style={{ flex: 1, marginLeft: rp(theme.spacing.sm), paddingVertical: rp(14), fontSize: rs(theme.fontSize.body), color: theme.colors.textPrimary }}
            />
          </View>

          {loading && <ActivityIndicator color={theme.colors.primary} style={{ marginTop: rp(theme.spacing.xl) }} />}

          {filtered.map((e) => {
            const isActive = e.status === "active";
            const iconBg = isActive ? theme.colors.successLight : theme.colors.primaryLight;
            const iconColor = isActive ? theme.colors.success : theme.colors.primary;
            return (
              <Card
                key={e.id}
                onPress={() => open(e)}
                style={{
                  marginBottom: rp(theme.spacing.md),
                  padding: rp(theme.spacing.lg),
                  flexDirection: "row",
                  alignItems: "center",
                  borderRadius: rp(24),
                }}
              >
                <View style={{ width: rp(48), height: rp(48), borderRadius: rp(16), backgroundColor: iconBg, justifyContent: "center", alignItems: "center", marginRight: rp(theme.spacing.md) }}>
                  <Ionicons name="calendar" size={rs(24)} color={iconColor} />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: rp(theme.spacing.sm), marginBottom: rp(4) }}>
                    <Text style={{ fontWeight: theme.fontWeight.bold, fontSize: rs(theme.fontSize.bodyLarge), color: theme.colors.textPrimary }} numberOfLines={1}>{e.name}</Text>
                    <View style={{ backgroundColor: iconBg, paddingHorizontal: rp(8), paddingVertical: rp(2), borderRadius: rp(theme.radius.pill) }}>
                      <Text style={{ color: iconColor, fontSize: rs(9), fontWeight: theme.fontWeight.bold, textTransform: 'uppercase' }}>{e.status}</Text>
                    </View>
                  </View>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: rs(theme.fontSize.caption) }} numberOfLines={1}>
                    {e.venue} · {e.date}{e.start_time ? ` · ${e.start_time}—${e.end_time}` : ""}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TouchableOpacity
                    onPress={(ev) => { ev.stopPropagation(); setOpenMenuId(e.id); }}
                    style={{ padding: rp(4) }}
                  >
                    <Ionicons name="ellipsis-vertical" size={rs(20)} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })}

          {!loading && filtered.length === 0 && (
            <View style={{ alignItems: "center", paddingVertical: rp(40) }}>
              <Ionicons name="calendar-outline" size={48} color={theme.colors.textMuted} />
              <Text style={{ fontSize: rs(theme.fontSize.bodyLarge), fontWeight: theme.fontWeight.bold, color: theme.colors.textPrimary, marginTop: rp(theme.spacing.md) }}>No events found</Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: rs(theme.fontSize.body), marginTop: rp(4) }}>
                Try adjusting your search or filter.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={!!openMenuId} transparent animationType="fade" onRequestClose={() => setOpenMenuId(null)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setOpenMenuId(null)}
        >
          <View style={{
            width: '85%',
            backgroundColor: theme.colors.surface,
            borderRadius: rp(16),
            paddingVertical: rp(8),
            shadowColor: theme.colors.primary,
            shadowOpacity: 0.15,
            shadowRadius: rp(16),
            shadowOffset: { width: 0, height: rp(4) },
            elevation: 5
          }}>
            {(() => {
              const evt = events.find(e => e.id === openMenuId);
              if (!evt) return null;
              const isClosed = evt.status === "closed";
              return (
                <>
                  <TouchableOpacity
                    style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => {
                      setOpenMenuId(null);
                      cloneEvent({ stopPropagation: () => { } }, evt);
                    }}
                  >
                    <Ionicons name="copy-outline" size={20} color={theme.colors.primary} />
                    <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Clone Event</Text>
                  </TouchableOpacity>
                  <View style={{ height: rp(1), backgroundColor: theme.colors.surfaceAlt }} />

                  {!isClosed && (
                    <>
                      <TouchableOpacity
                        style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                        onPress={() => {
                          setOpenMenuId(null);
                          router.push({ pathname: "/(admin)/(tabs)/edit-event", params: { eventId: evt.id } });
                        }}
                      >
                        <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
                        <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Edit Event</Text>
                      </TouchableOpacity>
                      <View style={{ height: rp(1), backgroundColor: theme.colors.surfaceAlt }} />
                    </>
                  )}

                  {isClosed && user?.role && ["owner", "admin", "superadmin"].includes(user.role) && (
                    <>
                      <TouchableOpacity
                        style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                        onPress={() => {
                          setOpenMenuId(null);
                          reopenEvent(evt.id);
                        }}
                      >
                        <Ionicons name="play-circle" size={20} color={theme.colors.success} />
                        <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Reactivate Event</Text>
                      </TouchableOpacity>
                      <View style={{ height: rp(1), backgroundColor: theme.colors.surfaceAlt }} />
                    </>
                  )}

                  {evt.status === "upcoming" && user?.role && ["owner", "admin", "superadmin"].includes(user.role) && (
                    <>
                      <TouchableOpacity
                        style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                        onPress={() => {
                          setOpenMenuId(null);
                          activateEventManually(evt.id);
                        }}
                      >
                        <Ionicons name="flash" size={20} color={theme.colors.warning} />
                        <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Activate Manually</Text>
                      </TouchableOpacity>
                      <View style={{ height: rp(1), backgroundColor: theme.colors.surfaceAlt }} />
                    </>
                  )}

                  {evt.status === "active" && (
                    <>
                      <TouchableOpacity
                        style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                        onPress={() => {
                          setOpenMenuId(null);
                          closeEvent(evt.id);
                        }}
                      >
                        <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
                        <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>Close Event</Text>
                      </TouchableOpacity>
                      <View style={{ height: rp(1), backgroundColor: theme.colors.surfaceAlt }} />
                    </>
                  )}

                  <TouchableOpacity
                    style={{ paddingVertical: rp(14), paddingHorizontal: rp(20), flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => {
                      setOpenMenuId(null);
                      open(evt);
                    }}
                  >
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
                    <Text style={{ marginLeft: rp(12), fontSize: rs(16), fontWeight: '600', color: theme.colors.textPrimary }}>View Details</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
