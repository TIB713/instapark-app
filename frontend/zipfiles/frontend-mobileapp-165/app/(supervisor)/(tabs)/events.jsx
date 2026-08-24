import { useCallback, useState } from "react";
import { rs, rp } from '../../../utils/responsive';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppStore } from "../../../lib/store";
import { theme } from "../../../utils/theme";
import { Card, Screen, TopBar, StatusPill, Chip, EmptyState } from "../../../components/valet/ui";
import { useSupervisorEvents } from "../../../hooks/useSupervisorEvents";

export default function SupervisorEventsTab() {
  const router = useRouter();
  const { setCurrentEventId } = useAppStore();
  const { events, loading, refreshing, wsStatus, fetchAll, setRefreshing } = useSupervisorEvents();

  const [filter, setFilter] = useState("active");
  const [searchQuery, setSearchQuery] = useState("");

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const openEvent = async (e) => {
    setCurrentEventId(e.id);
    await AsyncStorage.setItem("current_event_id", e.id);
    router.push("/(supervisor)/(tabs)/event-detail");
  };

  const filteredEvents = events.filter(e => {
    const searchMatch = !searchQuery || 
      e.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      e.venue?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!searchMatch) return false;
    
    if (filter === "all") return true;
    if (filter === "active") return e.status === "active";
    if (filter === "closed") return e.status !== "active";
    return true;
  });

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <TopBar 
        eyebrow="SUPERVISOR"
        title="Events" 
        subtitle={<StatusPill label={`${events.length} TOTAL`} tone="onDark" style={{ alignSelf: 'center', marginTop: rp(4) }} />} 
      >
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: theme.radius.pill,
          paddingHorizontal: rp(theme.spacing.md),
          paddingVertical: rp(8),
        }}>
          <Ionicons name="search" size={20} color="#FFFFFF" style={{ marginRight: rp(8) }} />
          <TextInput
            placeholder="Search event or venue..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            style={{ flex: 1, color: '#FFFFFF', fontSize: rs(14) }}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
        </View>
      </TopBar>

      {wsStatus === "disconnected" && (
        <View style={{ marginHorizontal: rp(theme.spacing.lg), marginTop: rp(theme.spacing.sm), backgroundColor: theme.colors.warningLight, padding: rp(theme.spacing.sm), borderRadius: rp(theme.spacing.md), flexDirection: "row", alignItems: "center", gap: rp(theme.spacing.sm) }}>
          <Ionicons name="cloud-offline-outline" size={16} color={theme.colors.warning} />
          <Text style={{ color: theme.colors.warning, fontSize: rs(12) }}>Live updates paused — reconnecting...</Text>
        </View>
      )}

      {/* Filter Chips */}
      <View style={{ paddingHorizontal: rp(theme.spacing.lg), marginTop: rp(theme.spacing.md), marginBottom: rp(theme.spacing.md) }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: rp(8) }}>
          <Chip label="All" active={filter === "all"} onPress={() => setFilter("all")} />
          <Chip label="Active" active={filter === "active"} onPress={() => setFilter("active")} />
          <Chip label="Closed" active={filter === "closed"} onPress={() => setFilter("closed")} />
        </ScrollView>
      </View>

      <View style={{ paddingHorizontal: rp(theme.spacing.lg), paddingBottom: rp(40) }}>
        {loading ? (
          <View style={{ marginTop: rp(40), alignItems: "center" }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : filteredEvents.length === 0 ? (
          <EmptyState 
            icon={<Ionicons name="calendar-outline" size={48} color={theme.colors.textMuted} />}
            title="No events found" 
            body="Try a different search or filter."
            style={{ marginTop: rp(40) }}
          />
        ) : (
          filteredEvents.map((e) => {
            const isActive = e.status === "active";
            const iconBg = isActive ? theme.colors.successLight : theme.colors.primaryLight;
            const iconColor = isActive ? theme.colors.success : theme.colors.primary;
            
            return (
              <Card
                key={e.id}
                testID={`event-card-${e.id}`}
                onPress={() => openEvent(e)}
                style={{ marginBottom: rp(theme.spacing.md) }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{
                    width: rp(48),
                    height: rp(48),
                    borderRadius: theme.radius.md,
                    backgroundColor: iconBg,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: rp(theme.spacing.md)
                  }}>
                    <Ionicons name="calendar" size={24} color={iconColor} />
                  </View>
                  
                  <View style={{ flex: 1, paddingRight: rp(10) }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: rp(theme.spacing.sm), flexWrap: "wrap" }}>
                      <Text style={{ fontWeight: "900", color: theme.colors.textPrimary, fontSize: rs(16) }}>{e.name}</Text>
                      {isActive && (
                        <View style={{ backgroundColor: theme.colors.danger, borderRadius: rp(4), paddingHorizontal: rp(6), paddingVertical: rp(2) }}>
                          <Text style={{ color: "#FFFFFF", fontSize: rs(9), fontWeight: "900" }}>LIVE</Text>
                        </View>
                      )}
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
                    
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: rp(6) }}>
                      <Ionicons name="location" size={12} color={theme.colors.textSecondary} />
                      <Text style={{ color: theme.colors.textSecondary, fontSize: rs(12), marginLeft: rp(4) }} numberOfLines={1}>
                        {e.venue} · {e.date} · {e.start_time}–{e.end_time}
                      </Text>
                    </View>
                  </View>
                  
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                </View>
              </Card>
            );
          })
        )}
      </View>
    </Screen>
  );
}
