import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { confirmDialog } from "../../lib/confirmDialog";
import { useState } from "react";
import { rs, rp } from '../../utils/responsive'; 
import { 
  View, 
  Text, 
  Share, 
  TextInput, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform, 
} from "react-native"; 
import { useRouter, useLocalSearchParams } from "expo-router"; 
import { Ionicons } from "@expo/vector-icons"; 
import QRCode from "react-native-qrcode-svg"; 
import api from "../../lib/api"; 
import { Screen, TopBar, Btn, Sheet } from '../../components/valet/ui';
import { theme } from '../../utils/theme';
 
export default function AdminQRDisplay() {
  const insets = useSafeAreaInsets();
 
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
      confirmDialog.info("Cannot send SMS", "Car ID not available. Please try again."); 
      return; 
    } 
    setSending(true); 
    try { 
      await api.post(`/cars/${carId}/send-sms`, { phone: phone.trim() });
      setSmsModalVisible(false); 
      confirmDialog.info("SMS sent", `Retrieval link sent to ${phone.trim()}`); 
    } catch (err) { 
      const msg = err.response?.data?.detail || "Failed to send SMS"; 
      confirmDialog.info("Couldn't send SMS", "Something went wrong sending the SMS. Check your connection and try again."); 
    } finally { 
      setSending(false); 
    } 
  }; 
 
  return ( 
    <View style={{ flex: 1, backgroundColor: theme.colors.primary }} testID="qr-screen"> 
      <TopBar 
        title="Guest QR Code" 
        onBack={() => router.back()} 
      />

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: rp(24) }}>
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: theme.radius?.xl || rp(32),
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
            GUEST QR CODE
          </Text>
          <Text style={{ fontSize: rs(28), fontWeight: "900", color: theme.colors.textPrimary, marginTop: rp(6) }}>{plate}</Text>
          <Text style={{ color: theme.colors.textSecondary, marginTop: rp(4), marginBottom: rp(24), fontSize: rs(13) }}>
            Show this to the guest
          </Text>
          <View style={{ padding: rp(14), backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(20) }}>
            <QRCode value={guestUrl} size={220} color={theme.colors.primary} />
          </View>
          <Text style={{ color: theme.colors.textSecondary, fontSize: rs(11), marginTop: rp(18), textAlign: "center" }}>
            Guest scans this to request their car
          </Text>
        </View>

        <View style={{ width: "100%", marginTop: rp(20), gap: rp(10) }}>
          <Btn 
            variant="dark" 
            onPress={() => Share.share({ message: `Valet QR for ${plate}. Scan to request: ${guestUrl}` })}
          >
            <Ionicons name="share-outline" size={20} color="#fff" /> SHARE
          </Btn>
          <Btn 
            variant="outline" 
            onPress={handleOpenSmsModal}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" /> SEND SMS TO GUEST
          </Btn>
        </View>
      </View>

      <Sheet open={smsModalVisible} onClose={() => setSmsModalVisible(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : undefined} 
        >
          <View style={{ paddingBottom: rp(10) }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: rp(20) }}> 
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.colors.primary} /> 
              <Text style={{ fontSize: rs(17), fontWeight: "900", color: theme.colors.textPrimary, marginLeft: rp(10), flex: 1 }}> 
                Send Retrieval Link
              </Text> 
            </View> 
  
            <Text style={{ fontSize: rs(11), fontWeight: "800", color: theme.colors.textSecondary, letterSpacing: rs(3), marginBottom: rp(8) }}> 
              GUEST MOBILE NUMBER 
            </Text> 
            <View 
              style={{ 
                backgroundColor: theme.colors.surfaceAlt, 
                borderRadius: rp(14), 
                borderWidth: rp(1), 
                borderColor: phoneError ? theme.colors.danger : theme.colors.border, 
                flexDirection: "row", 
                alignItems: "center", 
                paddingHorizontal: rp(14), 
                marginBottom: rp(20), 
              }} 
            > 
               <Ionicons name="phone-portrait-outline" size={18} color={theme.colors.primary} /> 
              {loadingPhone ? ( 
                <ActivityIndicator color={theme.colors.primary} style={{ paddingVertical: rp(14), paddingLeft: rp(10) }} /> 
              ) : ( 
                <TextInput 
                  value={phone} 
                  onChangeText={(txt) => { setPhone(txt); if (phoneError) setPhoneError(null); }} 
                  placeholder="10-digit mobile number" 
                  placeholderTextColor={theme.colors.textMuted} 
                  keyboardType="phone-pad" 
                  maxLength={10} 
                  style={{ flex: 1, fontSize: rs(16), paddingVertical: rp(14), paddingLeft: rp(10), color: theme.colors.textPrimary }} 
                /> 
              )} 
            </View> 
            {phoneError && <Text style={{ color: theme.colors.danger, fontSize: rs(12), marginTop: rp(-12), marginBottom: rp(12) }}>* {phoneError}</Text>}
  
            <Text style={{ fontSize: rs(12), color: theme.colors.textMuted, marginBottom: rp(20), lineHeight: 18 }}> 
              The guest will receive a link to request retrieval of their {plate} when ready. 
            </Text> 
  
            <Btn onPress={handleSendSms} disabled={sending}>
              {sending ? ( 
                <ActivityIndicator color="#fff" /> 
              ) : ( 
                "SEND SMS"
              )} 
            </Btn>
          </View>
        </KeyboardAvoidingView>
      </Sheet>
    </View>
  );
}
