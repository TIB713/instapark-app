import { confirmDialog } from "../../../lib/confirmDialog";
import { useState, useEffect, useRef, useCallback } from "react";
import { rs, rp } from '../../../utils/responsive'; 
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, Keyboard } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera"; 
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router"; 
import { Ionicons } from "@expo/vector-icons"; 
import { SafeAreaView } from "react-native-safe-area-context"; 
import api from "../../../lib/api"; 
import { useAppStore } from "../../../lib/store";
import { theme } from "../../../utils/theme";
import { Screen, TopBar, Btn, Card } from "../../../components/valet/ui";
import { useSupervisorEvents } from "../../../hooks/useSupervisorEvents";
import AlreadyCheckedInModal from "../../../components/valet/AlreadyCheckedInModal";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

export default function ScanQrCard() { 
  const router = useRouter(); 
  const tabBarHeight = useBottomTabBarHeight();
  const { setCurrentEventId } = useAppStore();
  const { returnTo, cameFromDetail } = useLocalSearchParams();
  const targetScreen = returnTo || "/(supervisor)/(tabs)/add-car"; 
  const [permission, requestPermission] = useCameraPermissions(); 
  const [scanComplete, setScanComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkinMode, setCheckinMode] = useState(null); // null | "scan" | "code"
  const [codeInput, setCodeInput] = useState("");
  const scanned = useRef(false);
  const lastScannedValue = useRef(null);

  const { events, loading: eventsLoading, fetchAll } = useSupervisorEvents();
  const [selectedScanEventId, setSelectedScanEventId] = useState(null);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(null);

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
    if (permission && !permission.granted) { 
      requestPermission(); 
    } 
  }, [permission]); 

  
  const handleCodeSubmit = async () => {
    if (!selectedScanEventId) return;
    if (!codeInput || codeInput.length !== 4) {
      confirmDialog.info("Invalid Code", "Please enter a 4-digit code.");
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    try {
      const { data: card } = await api.get(`/qr-cards/lookup-by-code/${codeInput}?event_id=${selectedScanEventId}&include_bound=true`);
      if (card.status && card.status !== "empty") {
        setAlreadyCheckedIn(card);
        setLoading(false);
        return;
      }
      router.replace({
        pathname: targetScreen,
        params: {
          prefill_qr_token: card.qr_token,
          prefill_key_tag_number: card.key_tag_number,
          prefill_qr_card_id: card.id,
        },
      });
      setCodeInput("");
    } catch (err) {
      const msg = err.response?.data?.detail || "Could not verify code";
      confirmDialog.confirm("Invalid Code", msg, () => { setCodeInput(""); });
    } finally {
      setLoading(false);
    }
  };

  const handleScan = useCallback(async (result) => {
    if (!selectedScanEventId) return;
    if (scanned.current) return;
    if (result.data === lastScannedValue.current) return;

    scanned.current = true;
    lastScannedValue.current = result.data;
    setScanComplete(true);
    setLoading(true);

    try {
      const { data } = result;
      let token = data;
      if (data.includes("/qr-redirect/")) {
        token = data.split("/qr-redirect/")[1].split("?")[0].trim();
      } else if (data.includes("/v/")) {
        token = data.split("/v/")[1].split("?")[0].trim();
      } else if (data.includes("/pass/")) {
        confirmDialog.info(
          "Not a key-tag card",
          "This QR is a pre-registration pass, not a vehicle key-tag.",
          () => { setScanComplete(false); setLoading(false); scanned.current = false; lastScannedValue.current = null; }
        );
        return;
      }

      const { data: card } = await api.get(`/qr-cards/lookup/${token}?event_id=${selectedScanEventId}&include_bound=true`);

      if (card.status && card.status !== "empty") {
        setAlreadyCheckedIn(card);
        return;
      }

      router.replace({
        pathname: targetScreen,
        params: {
          prefill_qr_token: card.qr_token,
          prefill_key_tag_number: card.key_tag_number,
          prefill_qr_card_id: card.id,
        },
      });
      setCodeInput("");
    } catch (err) {
      const msg = err.response?.data?.detail || "Could not verify QR card";
      confirmDialog.confirm("Invalid QR", msg, () => { setScanComplete(false); setLoading(false); scanned.current = false; lastScannedValue.current = null; });
    } finally {
      setLoading(false);
    }

    setTimeout(() => {
      scanned.current = false;
    }, 2000);
  }, [router, selectedScanEventId, targetScreen]);

  if (!permission) return ( 
    <View style={{ flex: 1, backgroundColor: theme.colors.primary, justifyContent: "center", alignItems: "center" }}> 
      <ActivityIndicator color={theme.colors.surface} size="large" /> 
    </View> 
  ); 

  if (!permission.granted) return ( 
    <View style={{ flex: 1, backgroundColor: theme.colors.primary, justifyContent: "center", alignItems: "center", padding: rp(theme.spacing.xxl) }}> 
      <Ionicons name="camera-outline" size={64} color={theme.colors.surface} /> 
      <Text style={{ color: theme.colors.surface, fontSize: rs(18), fontWeight: "900", marginTop: rp(theme.spacing.lg), textAlign: "center" }}> 
        Camera Permission Required 
      </Text> 
      <Text style={{ color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: rp(theme.spacing.sm), marginBottom: rp(theme.spacing.xxl) }}> 
        Camera access is needed to scan key-tag QR cards. 
      </Text> 
      <TouchableOpacity onPress={requestPermission} 
        style={{ backgroundColor: theme.colors.accent, borderRadius: rp(theme.radius.md), paddingVertical: rp(14), paddingHorizontal: rp(theme.spacing.xxxl) }}> 
        <Text style={{ color: theme.colors.primary, fontWeight: "900", letterSpacing: rs(2) }}>GRANT PERMISSION</Text> 
      </TouchableOpacity> 
    </View> 
  ); 

  if (eventsLoading && !selectedScanEventId) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.primary, justifyContent: "center", alignItems: "center" }}> 
        <ActivityIndicator color={theme.colors.surface} size="large" /> 
      </View>
    );
  }

  if (activeEvents.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.primary, justifyContent: "center", alignItems: "center", padding: rp(theme.spacing.xxl) }}> 
        <Ionicons name="calendar-outline" size={64} color={theme.colors.surface} /> 
        <Text style={{ color: theme.colors.surface, fontSize: rs(18), fontWeight: "900", marginTop: rp(theme.spacing.lg), textAlign: "center" }}> 
          No Active Event
        </Text> 
        <Text style={{ color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: rp(theme.spacing.sm) }}> 
          You're not currently assigned to an active event. Check the Events tab.
        </Text> 
      </View>
    );
  }

  if (activeEvents.length > 1 && !selectedScanEventId) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.primary }}>
        <SafeAreaView edges={["top"]} />
        <ScrollView contentContainerStyle={{ padding: rp(theme.spacing.lg) }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rp(theme.spacing.xl) }}> 
            <TouchableOpacity onPress={() => cameFromDetail ? router.back() : router.replace("/(supervisor)/(tabs)")} 
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(theme.spacing.sm) }}> 
              <Ionicons name="chevron-back" size={22} color={theme.colors.surface} /> 
            </TouchableOpacity> 
            <Text style={{ color: theme.colors.surface, fontSize: rs(18), fontWeight: "900", marginLeft: rp(theme.spacing.md) }}> 
              Select Event to Scan For
            </Text> 
          </View>
          {activeEvents.map(e => (
            <Card key={e.id} onPress={() => {
              setCurrentEventId(e.id);
              setSelectedScanEventId(e.id);
            }} style={{ marginBottom: rp(theme.spacing.md) }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View>
                  <Text style={{ fontSize: rs(16), fontWeight: "bold", color: theme.colors.textPrimary }}>{e.name}</Text>
                  <Text style={{ fontSize: rs(14), color: theme.colors.textSecondary, marginTop: rp(4) }}>{e.date}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </View>
            </Card>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (checkinMode === null) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.primary }}>
        <SafeAreaView edges={["top"]} style={{ backgroundColor: theme.colors.primary }}> 
          <View style={{ flexDirection: "row", alignItems: "center", padding: rp(theme.spacing.lg) }}> 
            <TouchableOpacity onPress={() => cameFromDetail ? router.back() : router.replace("/(supervisor)/(tabs)")} 
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(theme.spacing.sm) }}> 
              <Ionicons name="chevron-back" size={22} color={theme.colors.surface} /> 
            </TouchableOpacity> 
            <Text style={{ color: theme.colors.surface, fontSize: rs(18), fontWeight: "900", marginLeft: rp(theme.spacing.md) }}> 
              Check-In Vehicle
            </Text> 
          </View> 
        </SafeAreaView> 
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: rp(24), paddingBottom: rp(24) + tabBarHeight }}>
          <TouchableOpacity onPress={() => setCheckinMode("scan")} style={{ backgroundColor: theme.colors.surface, borderRadius: rp(16), padding: rp(24), marginBottom: rp(16), width: "100%", alignItems: "center", flexDirection: "row", justifyContent: "center" }}>
            <Ionicons name="qr-code-outline" size={32} color={theme.colors.textPrimary} style={{ marginRight: rp(12) }} />
            <Text style={{ color: theme.colors.textPrimary, fontSize: rs(18), fontWeight: "900" }}>Scan QR Card</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCheckinMode("code")} style={{ backgroundColor: theme.colors.surface, borderRadius: rp(16), padding: rp(24), width: "100%", alignItems: "center", flexDirection: "row", justifyContent: "center" }}>
            <Ionicons name="keypad-outline" size={32} color={theme.colors.textPrimary} style={{ marginRight: rp(12) }} />
            <Text style={{ color: theme.colors.textPrimary, fontSize: rs(18), fontWeight: "900" }}>Enter Code</Text>
          </TouchableOpacity>
        </View>
        <AlreadyCheckedInModal
          visible={!!alreadyCheckedIn}
          plate={alreadyCheckedIn?.plate}
          carType={alreadyCheckedIn?.car_type}
          onDismiss={() => {
            setAlreadyCheckedIn(null);
            setScanComplete(false);
            scanned.current = false;
            lastScannedValue.current = null;
          }}
        />
      </View>
    );
  }

  if (checkinMode === "code") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.primary }}>
        <SafeAreaView edges={["top"]} />
        <View style={{ flexDirection: "row", alignItems: "center", padding: rp(16) }}>
          <TouchableOpacity onPress={() => setCheckinMode(null)} style={{ padding: rp(8), backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 99 }}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: rs(18), fontWeight: "900", marginLeft: rp(12) }}>Enter 4-Digit Code</Text>
        </View>
        <View style={{ padding: rp(24), alignItems: "center", flex: 1, justifyContent: "center", paddingBottom: rp(24) + tabBarHeight }}>
          <TextInput
            value={codeInput}
            onChangeText={setCodeInput}
            placeholder="0000"
            placeholderTextColor="rgba(255,255,255,0.5)"
            keyboardType="number-pad"
            maxLength={4}
            style={{ fontSize: rs(48), fontWeight: "900", color: "#fff", letterSpacing: rs(8), textAlign: "center", borderBottomWidth: 2, borderBottomColor: theme.colors.accent, paddingBottom: rp(8), marginBottom: rp(24), minWidth: rp(200) }}
          />
          <TouchableOpacity onPress={handleCodeSubmit} style={{ backgroundColor: theme.colors.accent, borderRadius: rp(16), paddingVertical: rp(14), paddingHorizontal: rp(32), width: "100%", alignItems: "center" }}>
            {loading ? <ActivityIndicator color={theme.colors.primary} /> : <Text style={{ color: theme.colors.primary, fontWeight: "900", letterSpacing: rs(2) }}>VERIFY</Text>}
          </TouchableOpacity>
        </View>
        <AlreadyCheckedInModal
          visible={!!alreadyCheckedIn}
          plate={alreadyCheckedIn?.plate}
          carType={alreadyCheckedIn?.car_type}
          onDismiss={() => {
            setAlreadyCheckedIn(null);
            setScanComplete(false);
            scanned.current = false;
            lastScannedValue.current = null;
          }}
        />
      </View>
    );
  }

  return ( 
    <View style={{ flex: 1, backgroundColor: theme.colors.primary }}> 
      <SafeAreaView edges={["top"]} style={{ backgroundColor: theme.colors.primary }}> 
        <View style={{ flexDirection: "row", alignItems: "center", padding: rp(theme.spacing.lg) }}> 
          <TouchableOpacity onPress={() => setCheckinMode(null)} 
            style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(theme.spacing.sm) }}> 
            <Ionicons name="chevron-back" size={22} color={theme.colors.surface} /> 
          </TouchableOpacity> 
          <Text style={{ color: theme.colors.surface, fontSize: rs(18), fontWeight: "900", marginLeft: rp(theme.spacing.md) }}> 
            Scan Vehicle Key-Tag Card
          </Text> 
        </View> 
      </SafeAreaView> 

      <CameraView 
        style={{ flex: 1 }} 
        facing="back" 
        onBarcodeScanned={scanComplete ? undefined : handleScan} 
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }} 
      > 
        <View style={styles.overlay}> 
          <View style={styles.topOverlay} /> 
          <View style={{ flexDirection: "row" }}> 
            <View style={styles.sideOverlay} /> 
            <View style={styles.scanBox}> 
              <View style={[styles.corner, styles.topLeft]} /> 
              <View style={[styles.corner, styles.topRight]} /> 
              <View style={[styles.corner, styles.bottomLeft]} /> 
              <View style={[styles.corner, styles.bottomRight]} /> 
              {/* Scanner pulse line */}
              <View style={styles.laserLine} />
            </View> 
            <View style={styles.sideOverlay} /> 
          </View> 
          <View style={[styles.bottomOverlay, { paddingBottom: tabBarHeight }]}> 
            {loading ? ( 
              <ActivityIndicator color={theme.colors.surface} size="large" /> 
            ) : ( 
              <Text style={{ color: theme.colors.surface, fontWeight: "700", fontSize: rs(14), textAlign: "center", paddingHorizontal: rp(theme.spacing.xxl) }}> 
                Point camera at the key-tag QR card
              </Text> 
            )} 
            {scanComplete && !loading && (
              <TouchableOpacity
                onPress={() => { setScanComplete(false); scanned.current = false; lastScannedValue.current = null; }}
                style={{ marginTop: rp(theme.spacing.lg), backgroundColor: theme.colors.accent, borderRadius: rp(14), paddingVertical: rp(theme.spacing.md), paddingHorizontal: rp(theme.spacing.xxxl) }}> 
                <Text style={{ color: theme.colors.primary, fontWeight: "900", letterSpacing: rs(2) }}>SCAN AGAIN</Text> 
              </TouchableOpacity> 
            )} 
          </View> 
        </View> 
      </CameraView> 

      <AlreadyCheckedInModal
        visible={!!alreadyCheckedIn}
        plate={alreadyCheckedIn?.plate}
        carType={alreadyCheckedIn?.car_type}
        reason={alreadyCheckedIn?.status}
        reservedByName={alreadyCheckedIn?.reserved_by_name}
        onDismiss={() => {
          setAlreadyCheckedIn(null);
          setScanComplete(false);
          scanned.current = false;
          lastScannedValue.current = null;
          setCodeInput("");
        }}
      />
    </View> 
  ); 
} 

const SCAN_BOX_SIZE = 240; 
const styles = StyleSheet.create({ 
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, 
  topOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }, 
  bottomOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }, 
  sideOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }, 
  scanBox: { width: SCAN_BOX_SIZE, height: SCAN_BOX_SIZE, justifyContent: "center", alignItems: "center" }, 
  laserLine: { width: "100%", height: rp(2), backgroundColor: theme.colors.accent, shadowColor: theme.colors.accent, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  corner: { position: "absolute", width: rp(theme.spacing.xxl), height: rp(theme.spacing.xxl), borderColor: theme.colors.accent, borderWidth: rp(3) }, 
  topLeft: { top: 0, left: 0, borderBottomWidth: rp(0), borderRightWidth: rp(0) }, 
  topRight: { top: 0, right: 0, borderBottomWidth: rp(0), borderLeftWidth: rp(0) }, 
  bottomLeft: { bottom: 0, left: 0, borderTopWidth: rp(0), borderRightWidth: rp(0) }, 
  bottomRight: { bottom: 0, right: 0, borderTopWidth: rp(0), borderLeftWidth: rp(0) }, 
}); 

