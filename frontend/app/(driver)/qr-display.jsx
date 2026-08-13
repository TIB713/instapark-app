import { View, Text, Share } from "react-native";
import { rs, rp } from '../../utils/responsive';
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { Screen, TopBar, Btn } from '../../components/valet/ui';
import { theme } from '../../utils/theme';

export default function DriverQRDisplay() {
  const router = useRouter();
  const { token, plate, mode = "checkin", keyTag } = useLocalSearchParams();
  const guestUrl = `${process.env.EXPO_PUBLIC_API_URL || "https://instapark.docusafe.ai/api/v1"}/qr-redirect/${token}`;
  
  const isParkMode = mode === "park";

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.primary }} testID="driver-qr-screen">
      <TopBar 
        title={isParkMode ? "Key Tag Card" : "Guest QR Code"} 
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
            {isParkMode ? "KEY TAG CARD" : "GUEST QR CODE"}
          </Text>
          <Text style={{ fontSize: rs(28), fontWeight: "900", color: theme.colors.textPrimary, marginTop: rp(6) }}>{plate}</Text>
          <Text style={{ color: theme.colors.textSecondary, marginTop: rp(4), marginBottom: rp(24), fontSize: rs(13) }}>
            {isParkMode ? "Attach this to the parked car" : "Show this to the guest"}
          </Text>
          <View style={{ padding: rp(14), backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(20) }}>
            <QRCode value={guestUrl} size={220} color={theme.colors.primary} />
          </View>
          {isParkMode && (
            <Text style={{ fontSize: rs(24), fontWeight: "900", color: theme.colors.textPrimary, marginTop: rp(16) }}>
              Tag #{keyTag}
            </Text>
          )}
          <Text style={{ color: theme.colors.textSecondary, fontSize: rs(11), marginTop: isParkMode ? rp(8) : rp(18), textAlign: "center" }}>
            {isParkMode ? "Leave this card with the car" : "Guest scans this to request their car"}
          </Text>
        </View>

        <View style={{ width: "100%", marginTop: rp(20), gap: rp(10) }}>
          <Btn 
            variant="dark" 
            onPress={() => Share.share({ message: isParkMode ? `Key Tag ${keyTag} for ${plate}. Scan to request: ${guestUrl}` : `Valet QR for ${plate}. Scan to request: ${guestUrl}` })}
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
