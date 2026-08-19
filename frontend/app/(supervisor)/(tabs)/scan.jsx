import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native"; 
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router"; 
import { Ionicons } from "@expo/vector-icons"; 
import { useAppStore } from "../../../lib/store";
import { theme } from "../../../utils/theme";
import { Screen, TopBar, Btn, Card } from "../../../components/valet/ui";
import { useSupervisorEvents } from "../../../hooks/useSupervisorEvents";

export default function CheckInEntry() { 
  const router = useRouter(); 
  const { setCurrentEventId } = useAppStore();
  const { returnTo, cameFromDetail } = useLocalSearchParams();
  const targetScreen = returnTo || "/(supervisor)/(tabs)/add-car"; 

  const { events, loading: eventsLoading, fetchAll } = useSupervisorEvents();
  const [selectedScanEventId, setSelectedScanEventId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      setSelectedScanEventId(null);
      fetchAll();
    }, [fetchAll])
  );

  const activeEvents = events.filter(e => e.status === "active");

  useEffect(() => {
    if (!eventsLoading && activeEvents.length === 1 && !selectedScanEventId) {
      setCurrentEventId(activeEvents[0].id);
      setSelectedScanEventId(activeEvents[0].id);
    }
  }, [eventsLoading, activeEvents, selectedScanEventId, setCurrentEventId]);

  useEffect(() => {
    if (selectedScanEventId) {
      router.replace({ pathname: "/(supervisor)/(tabs)/add-car", params: { returnTo: targetScreen, cameFromDetail } });
    }
  }, [selectedScanEventId]);

  if (eventsLoading) {
    return (
      <Screen>
        <TopBar title="Select Event" onBack={cameFromDetail ? () => router.back() : null} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  if (activeEvents.length === 0) {
    return (
      <Screen>
        <TopBar title="Check In" onBack={cameFromDetail ? () => router.back() : null} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Ionicons name="calendar-outline" size={64} color={theme.colors.border} style={{ marginBottom: 16 }} />
          <Text style={{ fontSize: 20, color: theme.colors.textDark, marginBottom: 8 }}>
            No Active Events
          </Text>
          <Text style={{ fontSize: 14, color: theme.colors.textLight, textAlign: "center", lineHeight: 20 }}>
            There are no active events or hotels assigned to you right now.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title="Select Event" onBack={cameFromDetail ? () => router.back() : null} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 13, color: theme.colors.textLight, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
          Choose an Event for Check-In
        </Text>
        {activeEvents.map(e => (
          <TouchableOpacity
            key={e.id}
            activeOpacity={0.8}
            onPress={() => {
              setCurrentEventId(e.id);
              setSelectedScanEventId(e.id);
            }}
          >
            <Card style={{ padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: theme.colors.textDark, marginBottom: 4 }}>
                  {e.name}
                </Text>
                <Text style={{ fontSize: 13, color: theme.colors.textLight }}>
                  {e.venue} {'\u00B7'} {e.date}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.border} />
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Screen>
  );
}
