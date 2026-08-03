import { View, Text, TouchableOpacity, Share } from "react-native";
import { rs, rp } from '../../utils/responsive';
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";

export default function DriverQRDisplay() {
  const router = useRouter();
  const { token, plate, mode = "checkin", keyTag } = useLocalSearchParams();
  const guestUrl = `${process.env.EXPO_PUBLIC_GUEST_URL}/v/${token}`;
  
  const isParkMode = mode === "park";

  return (
    <View style={{ flex: 1, backgroundColor: "#059669" }} testID="driver-qr-screen">
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(8,145,178,0.5)",
        }}
      />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: rp(20), paddingTop: rp(8) }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ backgroundColor: "rgba(255,255,255,0.18)", borderRadius: rp(99), padding: rp(10) }}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: rs(20), fontWeight: "900", marginLeft: rp(14), flex: 1 }}>
            {isParkMode ? "Key Tag Card" : "Guest QR Code"}
          </Text>
        </View>

        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: rp(24) }}>
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: rp(32),
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
            <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#059669", letterSpacing: rs(3) }}>
              {isParkMode ? "KEY TAG CARD" : "GUEST QR CODE"}
            </Text>
            <Text style={{ fontSize: rs(28), fontWeight: "900", color: "#111827", marginTop: rp(6) }}>{plate}</Text>
            <Text style={{ color: "#9CA3AF", marginTop: rp(4), marginBottom: rp(24), fontSize: rs(13) }}>
              {isParkMode ? "Attach this to the parked car" : "Show this to the guest"}
            </Text>
            <View style={{ padding: rp(14), backgroundColor: "#ECFDF5", borderRadius: rp(20) }}>
              <QRCode value={guestUrl} size={220} color="#0891B2" />
            </View>
            {isParkMode && (
              <Text style={{ fontSize: rs(24), fontWeight: "900", color: "#111827", marginTop: rp(16) }}>
                Tag #{keyTag}
              </Text>
            )}
            <Text style={{ color: "#9CA3AF", fontSize: rs(11), marginTop: isParkMode ? rp(8) : rp(18), textAlign: "center" }}>
              {isParkMode ? "Leave this card with the car" : "Guest scans this to request their car"}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => Share.share({ message: isParkMode ? `Key Tag ${keyTag} for ${plate}. Scan to request: ${guestUrl}` : `Valet QR for ${plate}. Scan to request: ${guestUrl}` })}
            style={{
              backgroundColor: "rgba(255,255,255,0.15)",
              borderWidth: rp(1.5),
              borderColor: "#fff",
              borderRadius: rp(16),
              paddingVertical: rp(14),
              marginTop: rp(20),
              width: "100%",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="share-outline" size={20} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2), marginLeft: rp(8) }}>SHARE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace("/(driver)/tasks")}
            style={{
              backgroundColor: "#fff",
              borderRadius: rp(16),
              paddingVertical: rp(14),
              marginTop: rp(10),
              width: "100%",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#059669", fontWeight: "900", letterSpacing: rs(2) }}>DONE</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
