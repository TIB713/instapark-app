import { useState } from "react"; 
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Share, 
  Modal, 
  TextInput, 
  ActivityIndicator, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
} from "react-native"; 
import { useRouter, useLocalSearchParams } from "expo-router"; 
import { Ionicons } from "@expo/vector-icons"; 
import { SafeAreaView } from "react-native-safe-area-context"; 
import QRCode from "react-native-qrcode-svg"; 
import api from "../../lib/api"; 
 
export default function AdminQRDisplay() { 
  const router = useRouter(); 
  const { token, plate, carId, guestPhone: initialPhone } = useLocalSearchParams(); 
  const guestUrl = `${process.env.EXPO_PUBLIC_GUEST_URL}/v/${token}`; 
 
  const [smsModalVisible, setSmsModalVisible] = useState(false); 
  const [phone, setPhone] = useState(initialPhone || ""); 
  const [sending, setSending] = useState(false); 
  const [loadingPhone, setLoadingPhone] = useState(false); 

  const handleOpenSmsModal = async () => { 
    setSmsModalVisible(true); 
    if (!carId) return; 
    setLoadingPhone(true); 
    try { 
      const { data } = await api.get(`/cars/${carId}`); 
      setPhone(data.guest_phone || ""); 
    } catch { 
      // fallback to whatever is already in state 
    } finally { 
      setLoadingPhone(false); 
    } 
  }; 
 
  const handleSendSms = async () => { 
    if (!phone.trim() || !/^\d{10}$/.test(phone.trim())) { 
      Alert.alert("Invalid Phone", "Please enter a valid 10-digit mobile number."); 
      return; 
    } 
    if (!carId) { 
      Alert.alert("Error", "Car ID not available. Cannot send SMS."); 
      return; 
    } 
    setSending(true); 
    try { 
      await api.post(`/cars/${carId}/send-sms`, { phone: phone.trim() });
      setSmsModalVisible(false); 
      Alert.alert("SMS Sent", `Retrieval link sent to ${phone.trim()}`); 
    } catch (err) { 
      const msg = err.response?.data?.detail || "Failed to send SMS"; 
      Alert.alert("Error", typeof msg === "string" ? msg : "Failed to send SMS"); 
    } finally { 
      setSending(false); 
    } 
  }; 
 
  return ( 
    <View style={{ flex: 1, backgroundColor: "#7C3AED" }} testID="qr-screen"> 
      <View 
        style={{ 
          position: "absolute", 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: "rgba(79,70,229,0.5)", 
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
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", marginLeft: 14, flex: 1, letterSpacing: 0.5 }}> 
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
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#7C3AED", letterSpacing: 3 }}> 
              GUEST QR CODE 
            </Text> 
            <Text style={{ fontSize: 28, fontWeight: "900", color: "#111827", marginTop: 6 }}>{plate}</Text> 
            <Text style={{ color: "#9CA3AF", marginTop: 4, marginBottom: 24, fontSize: 13 }}>Show this to the guest</Text> 
            <View style={{ padding: 14, backgroundColor: "#F5F3FF", borderRadius: 20 }}> 
              <QRCode value={guestUrl} size={220} color="#4F46E5" /> 
            </View> 
            <Text style={{ color: "#9CA3AF", fontSize: 11, marginTop: 18, textAlign: "center" }}> 
              Guest scans this to request their car 
            </Text> 
          </View> 
 
          {/* Share button */} 
          <TouchableOpacity 
            onPress={() => Share.share({ message: `Valet QR for ${plate}. Scan to request: ${guestUrl}` })} 
            style={{ 
              backgroundColor: "rgba(255,255,255,0.15)", 
              borderWidth: 1.5, 
              borderColor: "#fff", 
              borderRadius: 16, 
              paddingVertical: 14, 
              marginTop: 24, 
              width: "100%", 
              flexDirection: "row", 
              alignItems: "center", 
              justifyContent: "center", 
            }} 
          > 
            <Ionicons name="share-outline" size={20} color="#fff" /> 
            <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: 2, marginLeft: 8 }}>SHARE</Text> 
          </TouchableOpacity> 
 
          {/* Send SMS button */} 
          <TouchableOpacity 
            onPress={handleOpenSmsModal} 
            style={{ 
              backgroundColor: "#fff", 
              borderRadius: 16, 
              paddingVertical: 14, 
              marginTop: 12, 
              width: "100%", 
              flexDirection: "row", 
              alignItems: "center", 
              justifyContent: "center", 
            }} 
          > 
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#7C3AED" /> 
            <Text style={{ color: "#7C3AED", fontWeight: "900", letterSpacing: 2, marginLeft: 8 }}>SEND SMS TO GUEST</Text> 
          </TouchableOpacity> 
        </View> 
      </SafeAreaView> 
 
      {/* SMS Modal */} 
      <Modal 
        visible={smsModalVisible} 
        transparent 
        animationType="slide" 
        onRequestClose={() => setSmsModalVisible(false)} 
      > 
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"} 
          style={{ flex: 1, justifyContent: "flex-end" }} 
        > 
          <View 
            style={{ 
              backgroundColor: "#fff", 
              borderTopLeftRadius: 28, 
              borderTopRightRadius: 28, 
              padding: 28, 
              shadowColor: "#000", 
              shadowOpacity: 0.15, 
              shadowRadius: 20, 
              elevation: 20, 
            }} 
          > 
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}> 
              <Ionicons name="chatbubble-ellipses-outline" size={22} color="#7C3AED" /> 
              <Text style={{ fontSize: 17, fontWeight: "900", color: "#111827", marginLeft: 10, flex: 1 }}> 
                Send Retrieval Link via SMS 
              </Text> 
              <TouchableOpacity onPress={() => setSmsModalVisible(false)}> 
                <Ionicons name="close" size={22} color="#6B7280" /> 
              </TouchableOpacity> 
            </View> 
 
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#6B7280", letterSpacing: 3, marginBottom: 8 }}> 
              GUEST MOBILE NUMBER 
            </Text> 
            <View 
              style={{ 
                backgroundColor: "#F9FAFB", 
                borderRadius: 14, 
                borderWidth: 1, 
                borderColor: "#E5E7EB", 
                flexDirection: "row", 
                alignItems: "center", 
                paddingHorizontal: 14, 
                marginBottom: 20, 
              }} 
            > 
               <Ionicons name="phone-portrait-outline" size={18} color="#7C3AED" /> 
              {loadingPhone ? ( 
                <ActivityIndicator color="#7C3AED" style={{ paddingVertical: 14, paddingLeft: 10 }} /> 
              ) : ( 
                <TextInput 
                  value={phone} 
                  onChangeText={setPhone} 
                  placeholder="10-digit mobile number" 
                  placeholderTextColor="#9CA3AF" 
                  keyboardType="phone-pad" 
                  maxLength={10} 
                  style={{ flex: 1, fontSize: 16, paddingVertical: 14, paddingLeft: 10, color: "#111827" }} 
                /> 
              )} 
            </View> 
 
            <Text style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 20, lineHeight: 18 }}> 
              The guest will receive a link to request retrieval of their {plate} when ready. 
            </Text> 
 
            <TouchableOpacity 
              onPress={handleSendSms} 
              disabled={sending} 
              style={{ 
                backgroundColor: "#7C3AED", 
                borderRadius: 14, 
                paddingVertical: 15, 
                alignItems: "center", 
              }} 
            > 
              {sending ? ( 
                <ActivityIndicator color="#fff" /> 
              ) : ( 
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 14, letterSpacing: 2 }}> 
                  SEND SMS 
                </Text> 
              )} 
            </TouchableOpacity> 
          </View> 
        </KeyboardAvoidingView> 
      </Modal> 
    </View> 
  ); 
} 
