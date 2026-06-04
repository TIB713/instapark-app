import { useState, useEffect } from "react"; 
import { 
  View, Text, TouchableOpacity, Share, ActivityIndicator, Alert, 
} from "react-native"; 
import { useRouter } from "expo-router"; 
import { Ionicons } from "@expo/vector-icons"; 
import { SafeAreaView } from "react-native-safe-area-context"; 
import QRCode from "react-native-qrcode-svg"; 
import api from "../../lib/api"; 
 
export default function PreRegisterQR() { 
  const router = useRouter(); 
  const [loading, setLoading] = useState(true); 
  const [providerQrToken, setProviderQrToken] = useState(null); 
  const [providerName, setProviderName] = useState(""); 
 
  useEffect(() => { 
    api.get("/providers/me/qr-token") 
      .then(({ data }) => { 
        setProviderQrToken(data.provider_qr_token); 
        setProviderName(data.name); 
      }) 
      .catch(() => Alert.alert("Error", "Failed to load QR code")) 
      .finally(() => setLoading(false)); 
  }, []); 
 
  const preRegisterUrl = providerQrToken 
    ? `${process.env.EXPO_PUBLIC_GUEST_URL}/pre-register/${providerQrToken}` 
    : ""; 
 
  const handleShare = () => { 
    if (!preRegisterUrl) return; 
    Share.share({ 
      message: `Pre-register your vehicle for ${providerName}. Visit: ${preRegisterUrl}`, 
    }); 
  }; 
 
  return ( 
    <View style={{ flex: 1, backgroundColor: "#7C3AED" }}> 
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(79,70,229,0.5)" }} /> 
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}> 
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 8 }}> 
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={{ backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 99, padding: 10 }} 
          > 
            <Ionicons name="chevron-back" size={22} color="#fff" /> 
          </TouchableOpacity> 
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", marginLeft: 14, flex: 1, letterSpacing: 0.5 }}> 
            Pre-Registration QR 
          </Text> 
        </View> 
 
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}> 
          {loading ? ( 
            <ActivityIndicator size="large" color="#fff" /> 
          ) : ( 
            <> 
              <View style={{ backgroundColor: "#fff", borderRadius: 32, padding: 32, alignItems: "center", width: "100%", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 }}> 
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#7C3AED", letterSpacing: 3 }}> 
                  EVENT GUEST PRE-REGISTRATION 
                </Text> 
                <Text style={{ fontSize: 20, fontWeight: "900", color: "#111827", marginTop: 6, textAlign: "center" }}> 
                  {providerName} 
                </Text> 
                <Text style={{ color: "#9CA3AF", marginTop: 4, marginBottom: 24, fontSize: 13, textAlign: "center" }}> 
                  For event guests only — use Hotel QR for hotel valet 
                </Text> 
                <View style={{ padding: 14, backgroundColor: "#F5F3FF", borderRadius: 20 }}> 
                  {preRegisterUrl ? ( 
                    <QRCode value={preRegisterUrl} size={220} color="#4F46E5" /> 
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
