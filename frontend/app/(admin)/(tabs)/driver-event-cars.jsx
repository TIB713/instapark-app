import { useEffect, useState, useCallback } from "react";
import { rs, rp } from "../../../utils/responsive";
import { theme } from "../../../utils/theme";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "../../../lib/api";

import { Screen, TopBar, Card, StatusPill, EmptyState } from "../../../components/valet/ui";

export default function DriverEventCars() {
  const router = useRouter();
  const { driverId, eventId, eventName, driverName } = useLocalSearchParams();
  const [tab, setTab] = useState("parked");
  const [loading, setLoading] = useState(true);
  const [cars, setCars] = useState([]);
  const [incidents, setIncidents] = useState([]);

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        setLoading(true);
        try {
          const [carsRes, incidentsRes] = await Promise.all([
            api.get(`/superadmin/events/${eventId}/cars`),
            api.get(`/incidents/driver/${driverId}`),
          ]);
          setCars(carsRes.data || []);
          setIncidents((incidentsRes.data || []).filter(i => i.event_id === eventId));
        } catch (e) {
          console.error("Failed to fetch driver event details", e);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }, [eventId, driverId])
  );

  const parkedCars = cars.filter(c => c.check_in_driver_id === driverId);
  const retrievedCars = cars.filter(c => c.retrieval_driver_id === driverId);

  const formatTime = (timestamp) => {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  };

  return (
    <Screen scroll={false}>
      <TopBar
        eyebrow="DRIVER EVENT CARS"
        title={driverName}
        onBack={() => router.back()}
      >
        <Text style={{ fontFamily: theme.fontFamily.regular, color: "rgba(255,255,255,0.7)", fontSize: rs(13), marginTop: rp(2), textAlign: "center", marginBottom: rp(theme.spacing.lg) }}>{eventName}</Text>

        <View style={{ flexDirection: "row", backgroundColor: theme.colors.surface, marginHorizontal: rp(0), borderRadius: rp(20), padding: rp(4) }}>
          {[
            ["parked", "Parked"],
            ["retrieved", "Retrieved"],
            ["incidents", "Incidents"]
          ].map(([k, l]) => (
            <TouchableOpacity
              key={k}
              onPress={() => setTab(k)}
              style={{
                flex: 1,
                paddingVertical: rp(10),
                borderRadius: rp(16),
                backgroundColor: tab === k ? theme.colors.primary : "transparent",
                alignItems: "center",
              }}
            >
              <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: "800", fontSize: rs(13), color: tab === k ? "#fff" : theme.colors.textSecondary, letterSpacing: rs(1) }}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TopBar>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: rp(theme.spacing.lg), paddingBottom: rp(100) }}>
        {tab === "parked" && (
          parkedCars.length === 0 ? (
            <EmptyState icon="car-sport-outline" title="No cars" body="No cars in this category" />
          ) : (
            parkedCars.map(car => (
              <CarCard key={car.id} car={car} time={formatTime(car.check_in_time)} />
            ))
          )
        )}

        {tab === "retrieved" && (
          retrievedCars.length === 0 ? (
            <EmptyState icon="car-sport-outline" title="No cars" body="No cars in this category" />
          ) : (
            retrievedCars.map(car => (
              <CarCard key={car.id} car={car} time={formatTime(car.delivered_at)} forceDelivered={true} />
            ))
          )
        )}

        {tab === "incidents" && (
          incidents.length === 0 ? (
            <View style={{ alignItems: "center", marginTop: rp(60) }}>
              <View style={{ backgroundColor: theme.colors.successLight, width: rp(64), height: rp(64), borderRadius: rp(32), alignItems: "center", justifyContent: "center", marginBottom: rp(16) }}>
                <Ionicons name="checkmark" size={32} color={theme.colors.success} />
              </View>
              <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.success, fontWeight: "900", fontSize: rs(16) }}>No incidents in this event</Text>
            </View>
          ) : (
            incidents.map(inc => (
              <View key={inc.id} style={{ backgroundColor: theme.colors.dangerLight, borderRadius: rp(16), padding: rp(14), borderLeftWidth: rp(3), borderLeftColor: theme.colors.danger, marginBottom: rp(10) }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: rp(8) }}>
                  <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.danger, fontWeight: "900", fontSize: rs(15) }}>{inc.plate}</Text>
                  <Text style={{ fontFamily: theme.fontFamily.bold, color: theme.colors.danger, fontSize: rs(11), fontWeight: "700" }}>{formatTime(inc.created_at)}</Text>
                </View>
                <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.danger, fontSize: rs(14), lineHeight: 20 }}>{inc.description}</Text>
              </View>
            ))
          )
        )}
      </ScrollView>
    </Screen>
  );
}

function CarCard({ car, time, forceDelivered = false }) {
  const status = forceDelivered ? "DELIVERED" : car.status;

  const statusStyle = (s) => {
    switch (s) {
      case "CHECKED_IN": return { bg: theme.colors.infoLight, text: theme.colors.info };
      case "PARKED": return { bg: theme.colors.successLight, text: theme.colors.success };
      case "RETRIEVAL_REQUESTED": return { bg: theme.colors.warningLight, text: theme.colors.warning };
      case "ACCEPTED": return { bg: theme.colors.warningLight, text: theme.colors.warning };
      case "BEING_FETCHED": return { bg: theme.colors.primaryLight, text: theme.colors.primary };
      case "DELIVERED": return { bg: theme.colors.surfaceAlt, text: theme.colors.textMuted };
      default: return { bg: theme.colors.surfaceAlt, text: theme.colors.textSecondary };
    }
  };
  const style = statusStyle(status);

  const fmt = (ts) =>
    ts ? new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: 'Asia/Kolkata' }) : null;

  return (
    <Card style={{ marginBottom: rp(12), padding: rp(16) }}>

      {/* Row 1: plate badge + status badge */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: rp(10) }}>
        <View style={{ backgroundColor: theme.colors.textPrimary, paddingHorizontal: rp(12), paddingVertical: rp(5), borderRadius: rp(8) }}>
          <Text style={{ fontFamily: theme.fontFamily.bold, color: "#fff", fontWeight: "900", fontSize: rs(15), letterSpacing: rs(1) }}>
            {car.plate}
          </Text>
        </View>
        <View style={{ backgroundColor: style.bg, paddingHorizontal: rp(10), paddingVertical: rp(4), borderRadius: rp(99) }}>
          <Text style={{ fontFamily: theme.fontFamily.bold, color: style.text, fontSize: rs(10), fontWeight: "900" }}>
            {status.replace(/_/g, " ")}
          </Text>
        </View>
      </View>

      {/* Row 2: make · color */}
      <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(14), fontWeight: "700", color: theme.colors.textPrimary, marginBottom: rp(8) }}>
        {car.make}{car.color ? `  ·  ${car.color}` : ""}
      </Text>

      {/* Row 3: guest name if present */}
      {car.guest_name ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: rp(6), marginBottom: rp(8) }}>
          <Ionicons name="person-outline" size={13} color={theme.colors.textMuted} />
          <Text style={{ fontFamily: theme.fontFamily.semibold, fontSize: rs(12), color: theme.colors.textSecondary, fontWeight: "600" }}>{car.guest_name}</Text>
        </View>
      ) : null}

      {/* Row 4: zone/slot and gate pills */}
      {(car.zone && car.slot) || car.gate ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: rp(8), marginBottom: rp(8) }}>
          {car.zone && car.slot ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: rp(4), backgroundColor: theme.colors.primaryLight, paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}>
              <Ionicons name="location-outline" size={11} color={theme.colors.primary} />
              <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(11), color: theme.colors.primary, fontWeight: "700" }}>
                Zone {car.zone} · Slot {car.slot}
              </Text>
            </View>
          ) : null}
          {car.gate ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: rp(4), backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: rp(8), paddingVertical: rp(3), borderRadius: rp(99) }}>
              <Ionicons name="enter-outline" size={11} color={theme.colors.textSecondary} />
              <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(11), color: theme.colors.textSecondary, fontWeight: "700" }}>Gate {car.gate}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Row 5: check-in time → delivered time */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: rp(12), marginBottom: car.photo_url || car.notes ? 10 : 0 }}>
        {fmt(car.check_in_time) ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: rp(4) }}>
            <Ionicons name="log-in-outline" size={12} color={theme.colors.textMuted} />
            <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(11), color: theme.colors.textMuted }}>
              In {fmt(car.check_in_time)}
            </Text>
          </View>
        ) : null}
        {fmt(car.check_in_time) && fmt(car.delivered_at) ? (
          <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.border, fontSize: rs(11) }}>→</Text>
        ) : null}
        {fmt(car.delivered_at) ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: rp(4) }}>
            <Ionicons name="log-out-outline" size={12} color={theme.colors.success} />
            <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(11), color: theme.colors.success }}>
              Out {fmt(car.delivered_at)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Row 6: parked photo */}
      {car.photo_url ? (
        <Image
          source={{ uri: car.photo_url }}
          style={{ width: "100%", height: rp(130), borderRadius: rp(12), marginTop: rp(4), resizeMode: "cover" }}
        />
      ) : null}

      {/* Row 7: notes */}
      {car.notes ? (
        <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(12), color: theme.colors.textMuted, marginTop: rp(8), fontStyle: "italic" }}>
          {car.notes}
        </Text>
      ) : null}

    </Card>
  );
}
