import { useState, useEffect } from "react"; 
import { 
  View, Text, TouchableOpacity, Share, ActivityIndicator, Alert, 
} from "react-native"; 
import { useRouter } from "expo-router"; 
import { Ionicons } from "@expo/vector-icons"; 
import { SafeAreaView } from "react-native-safe-area-context"; 
import QRCode from "react-native-qrcode-svg"; 
import api from "../../lib/api"; 
import { useAppStore } from "../../lib/store";
 
export default function PreRegisterQR() { 
  const router = useRouter(); 
  const { user } = useAppStore();
  const isHotelOwner = user?.provider_type === "hotel_owner";
  const themeColor = isHotelOwner ? "#1D4ED8" : "#7C3AED";
  const overlayColor = isHotelOwner ? "rgba(29,78,216,0.5)" : "rgba(79,70,229,0.5)";
  const qrColor = isHotelOwner ? "#1D4ED8" : "#4F46E5";

  const [loading, setLoading] = useState(true); 
  const [qrToken, setQrToken] = useState(null); 
  const [name, setName] = useState(""); 
 
  useEffect(() => { 
    if (isHotelOwner) {
      api.get("/hotels")
        .then(({ data }) => {
          if (data && data.length > 0) {
            setQrToken(data[0].hotel_qr_token);
            setName(data[0].name);
          }
        })
        .catch(() => Alert.alert("Error", "Failed to load hotel QR code"))
        .finally(() => setLoading(false));
    } else {
      api.get("/providers/me/qr-token") 
        .then(({ data }) => { 
          setQrToken(data.provider_qr_token); 
          setName(data.name); 
        }) 
        .catch(() => Alert.alert("Error", "Failed to load QR code")) 
        .finally(() => setLoading(false)); 
    }
  }, [isHotelOwner]); 
 
  const preRegisterUrl = qrToken 
    ? (isHotelOwner 
        ? `${process.env.EXPO_PUBLIC_GUEST_URL}/hotel-register/${qrToken}`
        : `${process.env.EXPO_PUBLIC_GUEST_URL}/pre-register/${qrToken}`) 
    : ""; 
 
  const handleShare = () => { 
    if (!preRegisterUrl) return; 
    Share.share({ 
      message: `Pre-register your vehicle for ${name}. Visit: ${preRegisterUrl}`, 
    }); 
  }; 
 
  return ( 
    <View style={{ flex: 1, backgroundColor: themeColor }}> 
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: overlayColor }} /> 
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}> 
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 8 }}> 
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={{ backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 99, padding: 10 }} 
          > 
            <Ionicons name="chevron-back" size={22} color="#fff" /> 
          </TouchableOpacity> 
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", marginLeft: 14, flex: 1, letterSpacing: 0.5 }}> 
            {isHotelOwner ? "Hotel Registration QR" : "Pre-Registration QR"}
          </Text> 
        </View> 
 
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}> 
          {loading ? ( 
            <ActivityIndicator size="large" color="#fff" /> 
          ) : ( 
            <> 
              <View style={{ backgroundColor: "#fff", borderRadius: 32, padding: 32, alignItems: "center", width: "100%", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 }}> 
                <Text style={{ fontSize: 11, fontWeight: "800", color: themeColor, letterSpacing: 3 }}> 
                  {isHotelOwner ? "HOTEL GUEST REGISTRATION" : "EVENT GUEST PRE-REGISTRATION"}
                </Text> 
                <Text style={{ fontSize: 20, fontWeight: "900", color: "#111827", marginTop: 6, textAlign: "center" }}> 
                  {name} 
                </Text> 
                <Text style={{ color: "#9CA3AF", marginTop: 4, marginBottom: 24, fontSize: 13, textAlign: "center" }}> 
                  {isHotelOwner ? "Guests scan this to register their vehicle" : "For event guests only — use Hotel QR for hotel valet"}
                </Text> 
                <View style={{ padding: 14, backgroundColor: isHotelOwner ? "#EFF6FF" : "#F5F3FF", borderRadius: 20 }}> 
                  {qrToken ? ( 
                    <QRCode value={preRegisterUrl} size={220} color={qrColor} /> 
                  ) : ( 
                    <View style={{ width: 220, height: 220, justifyContent: "center", alignItems: "center" }}> 
                      <Text style={{ color: "#9CA3AF" }}>QR unavailable</Text> 
                    </View> 
                  )} 
                </View> 
                <Text style={{ color: "#9CA3AF", fontSize: 11, marginTop: 18, textAlign: "center" }}> 
                  Guest scans this to pre-register their vehicle 
                </Text> 
              </View> 
 
              <TouchableOpacity 
                onPress={handleShare} 
                style={{ backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1.5, borderColor: "#fff", borderRadius: 16, paddingVertical: 14, marginTop: 24, width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center" }} 
              > 
                <Ionicons name="share-outline" size={20} color="#fff" /> 
                <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: 2, marginLeft: 8 }}>SHARE LINK</Text> 
              </TouchableOpacity> 
            </> 
          )} 
        </View> 
      </SafeAreaView> 
    </View> 
  ); 
} 
