import { useState } from "react";
import { rs, rp } from '../../utils/responsive'; 
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
  const [phoneError, setPhoneError] = useState(null);

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
      setPhoneError("Please enter a valid 10-digit mobile number.");
      return; 
    } 
    setPhoneError(null);
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
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: rp(20), paddingTop: rp(8) }}> 
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={{ backgroundColor: "rgba(255,255,255,0.18)", borderRadius: rp(99), padding: rp(10) }} 
          > 
            <Ionicons name="chevron-back" size={22} color="#fff" /> 
          </TouchableOpacity> 
          <Text style={{ color: "#fff", fontSize: rs(20), fontWeight: "900", marginLeft: rp(14), flex: 1, letterSpacing: rs(0.5) }}> 
            Guest QR Code 
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
            <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#7C3AED", letterSpacing: rs(3) }}> 
              GUEST QR CODE 
            </Text> 
            <Text style={{ fontSize: rs(28), fontWeight: "900", color: "#111827", marginTop: rp(6) }}>{plate}</Text> 
            <Text style={{ color: "#9CA3AF", marginTop: rp(4), marginBottom: rp(24), fontSize: rs(13) }}>Show this to the guest</Text> 
            <View style={{ padding: rp(14), backgroundColor: "#F5F3FF", borderRadius: rp(20) }}> 
              <QRCode value={guestUrl} size={220} color="#4F46E5" /> 
            </View> 
            <Text style={{ color: "#9CA3AF", fontSize: rs(11), marginTop: rp(18), textAlign: "center" }}> 
              Guest scans this to request their car 
            </Text> 
          </View> 
 
          {/* Share button */} 
          <TouchableOpacity 
            onPress={() => Share.share({ message: `Valet QR for ${plate}. Scan to request: ${guestUrl}` })} 
            style={{ 
              backgroundColor: "rgba(255,255,255,0.15)", 
              borderWidth: rp(1.5), 
              borderColor: "#fff", 
              borderRadius: rp(16), 
              paddingVertical: rp(14), 
              marginTop: rp(24), 
              width: "100%", 
              flexDirection: "row", 
              alignItems: "center", 
              justifyContent: "center", 
            }} 
          > 
            <Ionicons name="share-outline" size={20} color="#fff" /> 
            <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2), marginLeft: rp(8) }}>SHARE</Text> 
          </TouchableOpacity> 
 
          {/* Send SMS button */} 
          <TouchableOpacity 
            onPress={handleOpenSmsModal} 
            style={{ 
              backgroundColor: "#fff", 
              borderRadius: rp(16), 
              paddingVertical: rp(14), 
              marginTop: rp(12), 
              width: "100%", 
              flexDirection: "row", 
              alignItems: "center", 
              justifyContent: "center", 
            }} 
          > 
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#7C3AED" /> 
            <Text style={{ color: "#7C3AED", fontWeight: "900", letterSpacing: rs(2), marginLeft: rp(8) }}>SEND SMS TO GUEST</Text> 
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
              padding: rp(28), 
              shadowColor: "#000", 
              shadowOpacity: 0.15, 
              shadowRadius: rp(20), 
              elevation: 20, 
            }} 
          > 
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rp(20) }}> 
              <Ionicons name="chatbubble-ellipses-outline" size={22} color="#7C3AED" /> 
              <Text style={{ fontSize: rs(17), fontWeight: "900", color: "#111827", marginLeft: rp(10), flex: 1 }}> 
                Send Retrieval Link via SMS 
              </Text> 
              <TouchableOpacity onPress={() => setSmsModalVisible(false)}> 
                <Ionicons name="close" size={22} color="#6B7280" /> 
              </TouchableOpacity> 
            </View> 
 
            <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(3), marginBottom: rp(8) }}> 
              GUEST MOBILE NUMBER 
            </Text> 
            <View 
              style={{ 
                backgroundColor: "#F9FAFB", 
                borderRadius: rp(14), 
                borderWidth: rp(1), 
                borderColor: phoneError ? "#EF4444" : "#E5E7EB", 
                flexDirection: "row", 
                alignItems: "center", 
                paddingHorizontal: rp(14), 
                marginBottom: rp(20), 
              }} 
            > 
               <Ionicons name="phone-portrait-outline" size={18} color="#7C3AED" /> 
              {loadingPhone ? ( 
                <ActivityIndicator color="#7C3AED" style={{ paddingVertical: rp(14), paddingLeft: rp(10) }} /> 
              ) : ( 
                <TextInput 
                  value={phone} 
                  onChangeText={(txt) => { setPhone(txt); if (phoneError) setPhoneError(null); }} 
                  placeholder="10-digit mobile number" 
                  placeholderTextColor="#9CA3AF" 
                  keyboardType="phone-pad" 
                  maxLength={10} 
                  style={{ flex: 1, fontSize: rs(16), paddingVertical: rp(14), paddingLeft: rp(10), color: "#111827" }} 
                /> 
              )} 
            </View> 
            {phoneError && <Text style={{ color: "#EF4444", fontSize: rs(12), marginTop: rp(4), marginBottom: rp(8) }}>* {phoneError}</Text>}
 
            <Text style={{ fontSize: rs(12), color: "#9CA3AF", marginBottom: rp(20), lineHeight: 18 }}> 
              The guest will receive a link to request retrieval of their {plate} when ready. 
            </Text> 
 
            <TouchableOpacity 
              onPress={handleSendSms} 
              disabled={sending} 
              style={{ 
                backgroundColor: "#7C3AED", 
                borderRadius: rp(14), 
                paddingVertical: rp(15), 
                alignItems: "center", 
              }} 
            > 
              {sending ? ( 
                <ActivityIndicator color="#fff" /> 
              ) : ( 
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(14), letterSpacing: rs(2) }}> 
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
