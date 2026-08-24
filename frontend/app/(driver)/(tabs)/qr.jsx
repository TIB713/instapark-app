import { View, Text, Share, BackHandler } from "react-native";
import { rs, rp } from '../../../utils/responsive';
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { Screen, TopBar, Btn } from '../../../components/valet/ui';
import { theme } from '../../../utils/theme';

import { useDriverTasksContext } from "../../../context/DriverTasksContext";
import { Plate, Chip } from '../../../components/valet/ui';
import Heading from "../../../components/Heading";

export default function DriverQRDisplay() {
  const router = useRouter();
  const { token, plate, mode = "checkin", code, keyTagNumber } = useLocalSearchParams();
  const guestUrl = `${process.env.EXPO_PUBLIC_GUEST_URL || "https://app.instapark.co"}/v/${token}`;
  
  const isParkMode = mode === "park";

  // Override the hardware back button so it doesn't trigger the exit app logic from _layout
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.back();
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [router])
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.primary }} testID="driver-qr-screen">
      <TopBar 
        title={isParkMode ? "Guest QR & Code" : "Guest QR Code"} 
        onBack={() => router.back()} 
      />

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: rp(24) }}>
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: theme.radius.xl,
            padding: rp(32),
            alignItems: "center",
            width: "100%",
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: rp(24),
            shadowOffset: { width: 0, height: rp(12) },
            elevation: 12,
          }}
        >
          <Text style={{ fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(3) }}>
            {isParkMode ? "VEHICLE CODE & QR" : "GUEST QR CODE"}
          </Text>
          <Heading level="display" style={{ marginTop: rp(6) }}>{plate}</Heading>
          {keyTagNumber && (
            <View style={{ backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: rp(12), paddingVertical: rp(6), borderRadius: rp(12), marginTop: rp(8) }}>
              <Text style={{ fontSize: rs(14), fontWeight: "900", color: theme.colors.primary }}>
                Key Tag #{keyTagNumber}
              </Text>
            </View>
          )}
          <Text style={{ color: theme.colors.textSecondary, marginTop: keyTagNumber ? rp(12) : rp(4), marginBottom: rp(24), fontSize: rs(13) }}>
            {isParkMode ? "Reference for guest retrieval" : "Show this to the guest"}
          </Text>
          <View style={{ padding: rp(14), backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(20) }}>
            <QRCode value={guestUrl} size={220} color={theme.colors.primary} />
          </View>
          {isParkMode && (
            <View style={{ marginTop: rp(16), alignItems: "center" }}>
              <Text style={{ fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(1) }}>4-DIGIT CODE</Text>
              <Heading level="display" style={{ marginTop: rp(4) }}>
                {code || "—"}
              </Heading>
            </View>
          )}
          <Text style={{ color: theme.colors.textSecondary, fontSize: rs(11), marginTop: isParkMode ? rp(8) : rp(18), textAlign: "center" }}>
            {isParkMode ? "Guest scans QR or uses code to request car" : "Guest scans this to request their car"}
          </Text>
        </View>

        <View style={{ width: "100%", marginTop: rp(20), gap: rp(10) }}>
          <Btn 
            variant="dark" 
            onPress={() => Share.share({ message: isParkMode ? `4-Digit Code ${code} for ${plate}. Scan to request: ${guestUrl}` : `Valet QR for ${plate}. Scan to request: ${guestUrl}` })}
          >
            <Ionicons name="share-outline" size={20} color="#fff" /> SHARE
          </Btn>
          <Btn 
            variant="outline" 
            onPress={() => router.replace("/(driver)/(tabs)")}
          >
            DONE
          </Btn>
        </View>
      </View>
    </View>
  );
}
