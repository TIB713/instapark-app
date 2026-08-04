import { useState, useEffect, useRef, useCallback } from "react";
import { rs, rp } from '../../utils/responsive'; 
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from "react-native"; 
import { CameraView, useCameraPermissions } from "expo-camera"; 
import { useRouter, useLocalSearchParams } from "expo-router"; 
import { Ionicons } from "@expo/vector-icons"; 
import { SafeAreaView } from "react-native-safe-area-context"; 
import api from "../../lib/api"; 
import { useAppStore } from "../../lib/store";

export default function ScanQrCard() { 
  const router = useRouter(); 
  const { currentEventId } = useAppStore();
  const { returnTo } = useLocalSearchParams();
  const targetScreen = returnTo || "/(supervisor)/add-car"; 
  const [permission, requestPermission] = useCameraPermissions(); 
  const [scanComplete, setScanComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const scanned = useRef(false);
  const lastScannedValue = useRef(null);

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
      let token = data;
      if (data.includes("/qr-redirect/")) {
        token = data.split("/qr-redirect/")[1].split("?")[0].trim();
      } else if (data.includes("/v/")) {
        token = data.split("/v/")[1].split("?")[0].trim();
      } else if (data.includes("/pass/")) {
        Alert.alert(
          "Not a Key-Tag Card",
          "This QR is a pre-registration pass, not a vehicle key-tag.",
          [{ text: "Scan Again", onPress: () => { setScanComplete(false); setLoading(false); scanned.current = false; lastScannedValue.current = null; } }]
        );
        return;
      }

      const { data: card } = await api.get(`/qr-cards/lookup/${token}?event_id=${currentEventId}`);

      router.replace({
        pathname: targetScreen,
        params: {
          prefill_qr_token: card.qr_token,
          prefill_key_tag_number: card.key_tag_number,
          prefill_qr_card_id: card.id,
        },
      });
    } catch (err) {
      const msg = err.response?.data?.detail || "Could not verify QR card";
      Alert.alert("Invalid QR", msg, [
        { text: "Scan Again", onPress: () => { setScanComplete(false); setLoading(false); scanned.current = false; lastScannedValue.current = null; } },
        { text: "Cancel", onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }

    setTimeout(() => {
      scanned.current = false;
    }, 2000);
  }, [router, currentEventId, targetScreen]);

  if (!permission) return ( 
    <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}> 
      <ActivityIndicator color="#fff" size="large" /> 
    </View> 
  ); 

  if (!permission.granted) return ( 
    <View style={{ flex: 1, backgroundColor: "#0F2044", justifyContent: "center", alignItems: "center", padding: rp(24) }}> 
      <Ionicons name="camera-outline" size={64} color="#fff" /> 
      <Text style={{ color: "#fff", fontSize: rs(18), fontWeight: "900", marginTop: rp(16), textAlign: "center" }}> 
        Camera Permission Required 
      </Text> 
      <Text style={{ color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: rp(8), marginBottom: rp(24) }}> 
        Camera access is needed to scan key-tag QR cards. 
      </Text> 
      <TouchableOpacity onPress={requestPermission} 
        style={{ backgroundColor: "#059669", borderRadius: rp(16), paddingVertical: rp(14), paddingHorizontal: rp(32) }}> 
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
            </View> 
            <View style={styles.sideOverlay} /> 
          </View> 
          <View style={styles.bottomOverlay}> 
            {loading ? ( 
              <ActivityIndicator color="#fff" size="large" /> 
            ) : ( 
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: rs(14), textAlign: "center", paddingHorizontal: rp(24) }}> 
                Point camera at the key-tag QR card
              </Text> 
            )} 
            {scanComplete && !loading && (
              <TouchableOpacity
                onPress={() => { setScanComplete(false); scanned.current = false; lastScannedValue.current = null; }}
                style={{ marginTop: rp(16), backgroundColor: "#059669", borderRadius: rp(14), paddingVertical: rp(12), paddingHorizontal: rp(32) }}> 
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
  scanBox: { width: SCAN_BOX_SIZE, height: SCAN_BOX_SIZE }, 
  corner: { position: "absolute", width: rp(24), height: rp(24), borderColor: "#059669", borderWidth: rp(3) }, 
  topLeft: { top: 0, left: 0, borderBottomWidth: rp(0), borderRightWidth: rp(0) }, 
  topRight: { top: 0, right: 0, borderBottomWidth: rp(0), borderLeftWidth: rp(0) }, 
  bottomLeft: { bottom: 0, left: 0, borderTopWidth: rp(0), borderRightWidth: rp(0) }, 
  bottomRight: { bottom: 0, right: 0, borderTopWidth: rp(0), borderLeftWidth: rp(0) }, 
}); 

