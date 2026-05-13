import { View, Text, TouchableOpacity, Share } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";

export default function DriverQRDisplay() {
  const router = useRouter();
  const { token, plate } = useLocalSearchParams();
  const guestUrl = `${process.env.EXPO_PUBLIC_GUEST_URL}/v/${token}`;

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
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 8 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 99, padding: 10 }}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", marginLeft: 14, flex: 1 }}>
            Guest QR Code
          </Text>
        </View>

        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 32,
              padding: 32,
              alignItems: "center",
              width: "100%",
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 12 },
              elevation: 12,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#059669", letterSpacing: 3 }}>
              GUEST QR CODE
            </Text>
            <Text style={{ fontSize: 28, fontWeight: "900", color: "#111827", marginTop: 6 }}>{plate}</Text>
            <Text style={{ color: "#9CA3AF", marginTop: 4, marginBottom: 24, fontSize: 13 }}>Show this to the guest</Text>
            <View style={{ padding: 14, backgroundColor: "#ECFDF5", borderRadius: 20 }}>
              <QRCode value={guestUrl} size={220} color="#0891B2" />
            </View>
            <Text style={{ color: "#9CA3AF", fontSize: 11, marginTop: 18, textAlign: "center" }}>
              Guest scans this to request their car
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => Share.share({ message: `Valet QR for ${plate}. Scan to request: ${guestUrl}` })}
            style={{
              backgroundColor: "rgba(255,255,255,0.15)",
              borderWidth: 1.5,
              borderColor: "#fff",
              borderRadius: 16,
              paddingVertical: 14,
              marginTop: 20,
              width: "100%",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="share-outline" size={20} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: 2, marginLeft: 8 }}>SHARE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace("/(driver)/tasks")}
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              paddingVertical: 14,
              marginTop: 10,
              width: "100%",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#059669", fontWeight: "900", letterSpacing: 2 }}>DONE</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
