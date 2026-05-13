import { View, Text, TouchableOpacity, Share } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";

export default function AdminQRDisplay() {
  const router = useRouter();
  const { token, plate } = useLocalSearchParams();
  const guestUrl = `${process.env.EXPO_PUBLIC_GUEST_URL}/v/${token}`;
  return (
    <View className="flex-1 bg-[#F9FAFB]" testID="qr-screen">
      <SafeAreaView edges={["top"]} className="bg-[#7C3AED]">
        <View className="bg-[#7C3AED] px-5 py-4 rounded-b-[30px] flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="bg-white/10 rounded-full p-2 mr-3">
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-black flex-1">Guest QR Code</Text>
        </View>
      </SafeAreaView>
      <View className="flex-1 items-center justify-center px-6">
        <View className="bg-white rounded-3xl p-8 items-center shadow-lg" style={{ width: "100%" }}>
          <Text className="text-3xl font-black text-[#7C3AED]">{plate}</Text>
          <Text className="text-gray-500 mt-1 mb-6">Show this to the guest</Text>
          <QRCode value={guestUrl} size={220} color="#4F46E5" />
          <Text className="text-gray-400 text-xs mt-6 text-center">Guest scans this to request their car</Text>
        </View>
        <TouchableOpacity
          onPress={() => Share.share({ message: `Valet QR for ${plate}. Scan to request: ${guestUrl}` })}
          className="border border-[#7C3AED] rounded-2xl px-8 py-3 mt-6 flex-row items-center"
        >
          <Ionicons name="share-outline" size={20} color="#7C3AED" />
          <Text className="text-[#7C3AED] font-black tracking-widest ml-2">SHARE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
