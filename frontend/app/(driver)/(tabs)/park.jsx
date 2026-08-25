import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, ScrollView, Text, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { Screen, TopBar, EmptyState, SectionTitle, Btn, Card, Chip, Plate } from "../../../components/valet/ui";
import { theme } from '../../../utils/theme';
import { useDriverTasksContext } from "../../../context/DriverTasksContext";
import { Ionicons } from "@expo/vector-icons";
import { rp, rs } from "../../../utils/responsive";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

export default function ParkScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  
  const {
    parkState,
    setSelectedZone,
    selectSlot,
    setParkPhotos,
    takeParkPhoto,
    captureGPSPin,
    confirmPark
  } = useDriverTasksContext();

  const {
    showParkModal,
    selectedCar,
    eventZones,
    slots,
    selectedZone,
    selectedSlot,
    parkPhotos,
    takingParkPhoto,
    capturedGPS,
    capturingGPS,
    confirmingPark,
    driver
  } = parkState;

  useEffect(() => {
    if (!showParkModal) {
      router.push("/(driver)/(tabs)");
    }
  }, [showParkModal, router]);

  if (!showParkModal || !selectedCar) {
    return (
      <Screen>
        <TopBar title="Park" subtitle="Assign a slot and confirm" />
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState title="No car selected to park" body="Select a car from Tasks to begin parking" />
        </View>
      </Screen>
    );
  }

  let confirmLabel = "Confirm Parking";
  if (!selectedSlot) confirmLabel = "Select a slot";
  else if (parkPhotos.length === 0) confirmLabel = "Add a parking photo";
  else confirmLabel = `Confirm parking · ${selectedZone}-${selectedSlot}`;

  return (
    <Screen>
      <TopBar title="Park" subtitle="Assign a slot and confirm" />
      <ScrollView style={{ paddingHorizontal: rp(20), paddingTop: rp(16) }} showsVerticalScrollIndicator={false}>
        <Card style={{ marginBottom: rp(24), alignItems: "center" }}>
          <Text style={{ fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(3), marginBottom: rp(4) }}>VEHICLE IN CUSTODY</Text>
          <View style={{ marginTop: rp(8), marginBottom: rp(8) }}>
            <Plate
              value={selectedCar?.plate}
              style={{
                paddingHorizontal: rp(theme.spacing.md),
                paddingVertical: rp(theme.spacing.sm),
              }}
            />
          </View>
        </Card>

        {eventZones.length === 0 ? (
          <EmptyState title="No Parking Zones" body="Please ask your admin to set up zones" />
        ) : !slots.length ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginVertical: rp(32) }} />
        ) : (
          <>
            <SectionTitle>Select Zone</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: rp(8), marginBottom: rp(24) }}>
              {eventZones.map((z) => {
                const zoneSlots = slots.filter((s) => s.zone_name === z.name);
                const free = zoneSlots.filter((s) => !s.is_occupied).length;
                const isFull = zoneSlots.length > 0 && free === 0;
                return (
                  <TouchableOpacity
                    key={z.name}
                    onPress={() => { setSelectedZone(z.name); selectSlot(null); }}
                    style={{
                      paddingHorizontal: rp(14),
                      paddingVertical: rp(10),
                      borderRadius: rp(99),
                      backgroundColor: isFull ? theme.colors.danger : selectedZone === z.name ? theme.colors.primary : theme.colors.surface,
                      borderWidth: 1,
                      borderColor: isFull ? theme.colors.danger : selectedZone === z.name ? theme.colors.primary : theme.colors.border,
                    }}
                  >
                    <Text style={{ fontSize: rs(12), fontWeight: "800", color: isFull || selectedZone === z.name ? "#FFFFFF" : theme.colors.textSecondary }}>
                      {z.name} — <Text style={{ color: selectedZone === z.name ? theme.colors.accent : (isFull ? "#FFFFFF" : theme.colors.success) }}>{isFull ? "FULL" : `${free} free`}</Text>
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <SectionTitle>Select Slot</SectionTitle>
            <Card style={{ marginBottom: rp(24) }}>
              <View style={{ flexDirection: "row", gap: rp(12), marginBottom: rp(16), alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: rp(4) }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.success }} />
                  <Text style={{ fontSize: rs(11), color: theme.colors.textSecondary, fontWeight: "600" }}>Free</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: rp(4) }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.textMuted }} />
                  <Text style={{ fontSize: rs(11), color: theme.colors.textSecondary, fontWeight: "600" }}>Taken</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: rp(4) }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.accent }} />
                  <Text style={{ fontSize: rs(11), color: theme.colors.textSecondary, fontWeight: "600" }}>Set</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: rp(6) }}>
                {slots.filter((s) => s.zone_name === selectedZone).map((item, idx) => {
                  const isSel = selectedSlot === item.slot_number;
                  const heldByOther = item.held_by && item.held_by !== driver?.id && item.held_until && new Date(item.held_until) > new Date();
                  const bg = item.is_occupied ? theme.colors.dangerLight 
                    : heldByOther ? theme.colors.warningLight 
                    : isSel ? theme.colors.primary 
                    : theme.colors.successLight;
                  const borderStyle = isSel ? { borderWidth: 2, borderColor: theme.colors.accent } : {};
                  return (
                    <TouchableOpacity
                      key={`${item.zone_name}-${item.slot_number}-${idx}`}
                      disabled={item.is_occupied || heldByOther}
                      onPress={() => selectSlot(item.slot_number)}
                      style={[{ width: rp(56), height: rp(56), borderRadius: rp(14), backgroundColor: bg, alignItems: "center", justifyContent: "center" }, borderStyle]}
                    >
                      {item.is_occupied ? <Ionicons name="close" size={18} color={theme.colors.danger} /> : heldByOther ? <Ionicons name="time" size={18} color={theme.colors.warning} /> : <Text style={{ fontWeight: "900", color: isSel ? "#FFFFFF" : theme.colors.success }}>{item.slot_number}</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Card>

            <SectionTitle>Parking Photos</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: rp(10), marginBottom: rp(24) }}>
              {parkPhotos.map((uri, i) => (
                <View key={i} style={{ position: "relative", width: rp(80), height: rp(80) }}>
                  <Image source={{ uri }} style={{ width: "100%", height: "100%", borderRadius: rp(14), opacity: 0.6 }} />
                  <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="checkmark-circle" size={32} color={theme.colors.success} />
                  </View>
                  <TouchableOpacity
                    onPress={() => setParkPhotos(parkPhotos.filter((_, k) => k !== i))}
                    style={{ position: "absolute", top: -6, right: -6, backgroundColor: theme.colors.danger, borderRadius: rp(99), width: rp(22), height: rp(22), alignItems: "center", justifyContent: "center" }}
                  >
                    <Ionicons name="close" size={13} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
              {parkPhotos.length < 5 && (
                <TouchableOpacity
                  onPress={takeParkPhoto}
                  disabled={takingParkPhoto}
                  style={{ width: rp(80), height: rp(80), borderRadius: rp(14), borderWidth: rp(1.5), borderStyle: "dashed", borderColor: theme.colors.accent, backgroundColor: theme.colors.accentLight, alignItems: "center", justifyContent: "center" }}
                >
                  {takingParkPhoto ? <ActivityIndicator size="small" color={theme.colors.accentForeground} /> : <><Ionicons name="camera-outline" size={26} color={theme.colors.accentForeground} /><Text style={{ color: theme.colors.accentForeground, fontSize: rs(10), fontWeight: "800", marginTop: rp(4) }}>{parkPhotos.length === 0 ? "ADD" : "MORE"}</Text></>}
                </TouchableOpacity>
              )}
            </ScrollView>

            <Btn variant="outline" onPress={captureGPSPin} style={{ marginBottom: rp(24) }}>
              {capturingGPS ? "Saving GPS..." : capturedGPS ? "GPS Saved ✓" : "Save GPS Pin"}
            </Btn>

            <Btn variant="accent" disabled={!selectedSlot || confirmingPark} onPress={confirmPark}>
              {confirmingPark ? "Confirming..." : confirmLabel}
            </Btn>
            
            <View style={{ height: tabBarHeight + rp(24) }} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
