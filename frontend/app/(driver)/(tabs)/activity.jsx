import React, { useState, useCallback, useEffect } from "react";
import { View, FlatList, Text, ActivityIndicator, RefreshControl } from "react-native";
import { Screen, TopBar, EmptyState, SectionTitle, Chip, Card, StatusPill, Plate, Btn } from "../../../components/valet/ui";
import { useRouter } from "expo-router";
import { theme } from "../../../utils/theme";
import { useAppStore } from "../../../lib/store";
import api from "../../../lib/api";
import { rp, rs } from "../../../utils/responsive";
import { Ionicons } from "@expo/vector-icons";
import { fmtDuration } from "../../../utils/time";

export default function ActivityScreen() {
  const router = useRouter();
  const { driver, currentEventId } = useAppStore();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");

  const fetchActivity = useCallback(async () => {
    if (!driver?.id || !currentEventId) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get(`/drivers/${driver.id}/events/${currentEventId}/cars`);
      setCars(data || []);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }, [driver?.id, currentEventId]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchActivity();
    setRefreshing(false);
  };

  const filteredCars = cars.filter(car => {
    if (filter === "all") return true;
    if (filter === "check_in") return car.role_in_event === "check_in" || car.role_in_event === "both";
    if (filter === "retrieval") return car.role_in_event === "retrieval" || car.role_in_event === "both";
    return true;
  });

  const renderItem = ({ item }) => {
    let roleText = "Checked In";
    let roleIcon = "log-in-outline";
    let roleColor = "#10B981";
    
    if (item.role_in_event === "retrieval") {
      roleText = "Delivered";
      roleIcon = "log-out-outline";
      roleColor = "#6366F1";
    } else if (item.role_in_event === "both") {
      roleText = "Checked In & Delivered";
      roleIcon = "swap-horizontal-outline";
      roleColor = "#8B5CF6";
    }

    const ts = item.role_in_event === "retrieval" || item.role_in_event === "both" 
      ? item.delivered_at || item.retrieval_requested_at 
      : item.check_in_time;
      
    const timeStr = ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' }) : "";

    let statusLabel = item.status;
    let statusTone = "primary";
    
    switch (item.status) {
      case "REGISTERED":
        statusLabel = "Registered";
        statusTone = "neutral";
        break;
      case "CHECKED_IN": statusLabel = "Checked In"; statusTone = "primary"; break;
      case "PARKED": statusLabel = "Parked"; statusTone = "success"; break;
      case "DELIVERED": statusLabel = "Delivered"; statusTone = "neutral"; break;
      case "RETRIEVAL_REQUESTED": statusLabel = "Requested"; statusTone = "danger"; break;
      case "ACCEPTED": statusLabel = "Accepted"; statusTone = "warning"; break;
      case "BEING_FETCHED": statusLabel = "Fetching"; statusTone = "accent"; break;
      case "AWAITING_REPARK": statusLabel = "Awaiting Re-park"; statusTone = "danger"; break;
      case "PRE_REGISTERED": statusLabel = "Pre-registered"; statusTone = "neutral"; break;
      default: break;
    }

    let durationCaption = null;
    if ((item.role_in_event === "check_in" || item.role_in_event === "both") && item.park_minutes != null) {
      durationCaption = `Parked in ${fmtDuration(item.park_minutes)}`;
    }
    if ((item.role_in_event === "retrieval" || item.role_in_event === "both") && item.retrieval_to_gate_minutes != null) {
      durationCaption = `Retrieved in ${fmtDuration(item.retrieval_to_gate_minutes)}`;
    }

    let reparkCaption = null;
    if (item.repark_minutes != null) {
      reparkCaption = `Re-parked, +${fmtDuration(item.repark_minutes)}`;
    }

    return (
      <Card style={{ marginBottom: rp(12) }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: rp(12) }}>
          <Plate value={item.plate} />
          <StatusPill label={statusLabel} tone={statusTone} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name={roleIcon} size={16} color={roleColor} style={{ marginRight: rp(4) }} />
            <Text style={{ fontSize: rs(12), color: roleColor, fontWeight: "600" }}>{roleText}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: rs(12), color: "#6B7280" }}>{timeStr}</Text>
            {durationCaption && (
              <Text style={{ fontSize: rs(11), color: theme.colors.textSecondary, marginTop: rp(2) }}>
                {durationCaption}
              </Text>
            )}
            {reparkCaption && (
              <Text style={{ fontSize: rs(11), color: theme.colors.textSecondary, marginTop: rp(2) }}>
                {reparkCaption}
              </Text>
            )}
          </View>
        </View>
      </Card>
    );
  };

  if (!currentEventId) {
    return (
      <Screen scroll={false}>
        <TopBar title="My Activity" />
        <EmptyState
          icon={<Ionicons name="calendar-outline" size={64} color={theme.colors.textMuted} />}
          title="No event selected"
          body="Select an event from your Profile to view your activity."
          cta={<Btn onPress={() => router.push('/(driver)/(tabs)/profile')}>Go to Profile</Btn>}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <TopBar title="My Activity" />
      
      <View style={{ flexDirection: "row", paddingHorizontal: rp(20), paddingVertical: rp(12), gap: rp(8) }}>
        <Chip label="All" active={filter === "all"} onPress={() => setFilter("all")} />
        <Chip label="Check-ins" active={filter === "check_in"} onPress={() => setFilter("check_in")} />
        <Chip label="Retrievals" active={filter === "retrieval"} onPress={() => setFilter("retrieval")} />
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: rp(40) }} />
      ) : (
        <FlatList
          data={filteredCars}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: rp(20), paddingBottom: rp(40), paddingTop: rp(8) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState title="No activity yet for this event" body="Cars you check in or deliver will appear here" />}
        />
      )}
    </Screen>
  );
}
