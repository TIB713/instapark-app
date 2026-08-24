import { useState, useEffect, useRef, useCallback } from "react";
import { confirmDialog } from "../../../lib/confirmDialog";
import { rs, rp } from '../../../utils/responsive'; 
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native"; 
import { CameraView, useCameraPermissions } from "expo-camera"; 
import { useRouter, useLocalSearchParams } from "expo-router"; 
import { Ionicons } from "@expo/vector-icons"; 
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"; 
import api from "../../../lib/api"; 
import { useAppStore } from "../../../lib/store";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { theme } from "../../../utils/theme";
 
export default function Scanner() { 
  const router = useRouter(); 
  const { currentEventId } = useAppStore();
  const { returnTo } = useLocalSearchParams();
  const targetScreen = returnTo || "/(driver)/(tabs)/checkin"; 
  const [permission, requestPermission] = useCameraPermissions(); 
  const [scanComplete, setScanComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const scanned = useRef(false);
  const lastScannedValue = useRef(null);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
 
  useEffect(() => { 
    if (permission && !permission.granted) { 
      requestPermission(); 
    } 
  }, [permission]); 
 
  const handleScan = useCallback(async (result) => {
    if (scanned.current) return;
    if (result.data === lastScannedValue.current) return;

    scanned.current = true;
    lastScannedValue.current = result.data;
    setScanComplete(true);
    setLoading(true);

    try {
      const { data } = result;
      let passToken = data;
      if (data.includes("/pass/")) {
        passToken = data.split("/pass/")[1].split("?")[0].trim();
      } else if (data.includes("/v/")) {
        confirmDialog.info(
          "Not a pre-registration pass",
          "This QR is a retrieval code, not a pre-registration pass.",
          () => { setScanComplete(false); setLoading(false); scanned.current = false; lastScannedValue.current = null; }
        );
        return;
      }

      const { data: pass } = await api.get(`/pass/${passToken}`);

      if (pass.status !== "PRE_REGISTERED") {
        confirmDialog.info(
          "Already checked in",
          `This vehicle (${pass.plate}) has already been checked in.`,
          () => router.back()
        );
        return;
      }

      if (currentEventId && pass.event_id !== currentEventId) {
        confirmDialog.confirm(
          "Not registered for this event",
          `${pass.guest_name || "This guest"} is pre-registered for "${pass.event_name}", not the event you're currently assigned to.`,
          () => { setScanComplete(false); setLoading(false); scanned.current = false; lastScannedValue.current = null; }
        );
        return;
      }

      router.replace({
        pathname: targetScreen,
        params: {
          prefill_car_id: pass.car_id,
          prefill_pass_token: passToken,
          prefill_plate: pass.plate,
          prefill_make: pass.make,
          prefill_color: pass.color,
          prefill_phone: pass.guest_phone || "",
          prefill_name: pass.guest_name || "",
          prefill_event_id: pass.event_id,
          prefill_guest_notes: pass.guest_notes || "",
        },
      });
    } catch (err) {
      const msg = err.response?.data?.detail || "Could not load pass details";
      confirmDialog.confirm("Invalid QR", msg, () => { setScanComplete(false); setLoading(false); scanned.current = false; lastScannedValue.current = null; });
    } finally {
      setLoading(false);
    }

    setTimeout(() => {
      scanned.current = false;
    }, 2000);
  }, [router]);
 
  if (!permission) return ( 
    <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}> 
      <ActivityIndicator color="#fff" size="large" /> 
    </View> 
  ); 
 
  if (!permission.granted) return ( 
    <View style={{ flex: 1, backgroundColor: theme.colors.primary, justifyContent: "center", alignItems: "center", padding: rp(24) }}> 
      <Ionicons name="camera-outline" size={64} color="#fff" /> 
      <Text style={{ color: "#fff", fontSize: rs(18), fontWeight: "900", marginTop: rp(16), textAlign: "center" }}> 
        Camera Permission Required 
      </Text> 
      <Text style={{ color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: rp(8), marginBottom: rp(24) }}> 
        Camera access is needed to scan guest pre-registration QR codes. 
      </Text> 
      <TouchableOpacity onPress={requestPermission} 
        style={{ backgroundColor: theme.colors.success, borderRadius: rp(16), paddingVertical: rp(14), paddingHorizontal: rp(32) }}> 
        <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2) }}>GRANT PERMISSION</Text> 
      </TouchableOpacity> 
    </View> 
  ); 
 
  return ( 
    <View style={{ flex: 1, backgroundColor: "#000" }}> 
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#000" }}> 
        <View style={{ flexDirection: "row", alignItems: "center", padding: rp(16) }}> 
          <TouchableOpacity onPress={() => router.back()} 
            style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(8) }}> 
            <Ionicons name="chevron-back" size={22} color="#fff" /> 
          </TouchableOpacity> 
          <Text style={{ color: "#fff", fontSize: rs(18), fontWeight: "900", marginLeft: rp(12) }}> 
            Scan Guest Pass 
          </Text> 
        </View> 
      </SafeAreaView> 
 
      <CameraView 
        style={{ flex: 1 }} 
        facing="back" 
        onBarcodeScanned={scanComplete ? undefined : handleScan} 
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }} 
      > 
        {/* Scanning overlay */} 
        <View style={styles.overlay}> 
          <View style={styles.topOverlay} /> 
          <View style={{ flexDirection: "row" }}> 
            <View style={styles.sideOverlay} /> 
            <View style={styles.scanBox}> 
              {/* Corner markers */} 
              <View style={[styles.corner, styles.topLeft]} /> 
              <View style={[styles.corner, styles.topRight]} /> 
              <View style={[styles.corner, styles.bottomLeft]} /> 
              <View style={[styles.corner, styles.bottomRight]} /> 
              <View style={styles.laserLine} />
            </View> 
            <View style={styles.sideOverlay} /> 
          </View> 
          <View style={[styles.bottomOverlay, { paddingBottom: tabBarHeight + insets.bottom }]}> 
            {loading ? ( 
              <ActivityIndicator color="#fff" size="large" /> 
            ) : ( 
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: rs(14), textAlign: "center", paddingHorizontal: rp(24) }}> 
                Point camera at guest's pre-registration QR code 
              </Text> 
            )} 
            {scanComplete && !loading && (
              <TouchableOpacity
                onPress={() => { setScanComplete(false); scanned.current = false; lastScannedValue.current = null; }}
                style={{ marginTop: rp(16), backgroundColor: theme.colors.success, borderRadius: rp(14), paddingVertical: rp(12), paddingHorizontal: rp(32) }}> 
                <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2) }}>SCAN AGAIN</Text> 
              </TouchableOpacity> 
            )} 
          </View> 
        </View> 
      </CameraView> 
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
  corner: { position: "absolute", width: rp(24), height: rp(24), borderColor: theme.colors.accent, borderWidth: rp(3) }, 
  laserLine: { width: "100%", height: rp(2), backgroundColor: theme.colors.accent, shadowColor: theme.colors.accent, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  topLeft: { top: 0, left: 0, borderBottomWidth: rp(0), borderRightWidth: rp(0) }, 
  topRight: { top: 0, right: 0, borderBottomWidth: rp(0), borderLeftWidth: rp(0) }, 
  bottomLeft: { bottom: 0, left: 0, borderTopWidth: rp(0), borderRightWidth: rp(0) }, 
  bottomRight: { bottom: 0, right: 0, borderTopWidth: rp(0), borderLeftWidth: rp(0) }, 
}); 
