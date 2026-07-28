import { useState, useEffect } from "react";
import { rs, rp } from '../../utils/responsive'; 
import { 
  View, Text, TouchableOpacity, Share, ActivityIndicator, Alert, ScrollView
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
  const [resolvedProviderType, setResolvedProviderType] = useState(null);

  const isHotelOwner = resolvedProviderType === "hotel_owner";
  const themeColor = isHotelOwner ? "#1D4ED8" : "#7C3AED";
  const overlayColor = isHotelOwner ? "rgba(29,78,216,0.5)" : "rgba(79,70,229,0.5)";
  const qrColor = isHotelOwner ? "#1D4ED8" : "#4F46E5";

  const [loading, setLoading] = useState(true); 
  const [qrToken, setQrToken] = useState(null); 
  const [name, setName] = useState(""); 
  const [events, setEvents] = useState([]);
 
  useEffect(() => {
    api.get("/auth/me")
      .then(({ data }) => {
        const freshType = data.provider_type || "valet_provider";
        if (freshType !== user?.provider_type) {
          useAppStore.getState().setUser({ ...user, provider_type: freshType });
        }
        setResolvedProviderType(freshType);
      })
      .catch(() => setResolvedProviderType(user?.provider_type || "valet_provider"));
  }, []);

  useEffect(() => { 
    if (!resolvedProviderType) return;
    
    if (resolvedProviderType === "hotel_owner") {
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
      api.get("/events")
        .then(async ({ data }) => {
          const regularEvents = (data || []).filter(
            e => e.event_type === "regular" && (e.status === "active" || e.status === "upcoming")
          );
          
          const eventsWithTokens = await Promise.all(regularEvents.map(async (ev) => {
            try {
              const res = await api.get(`/events/${ev.id}/qr-token`);
              return { ...ev, event_qr_token: res.data.event_qr_token };
            } catch (err) {
              return ev; // leave as is if fails
            }
          }));
          
          setEvents(eventsWithTokens);
        })
        .catch(() => Alert.alert("Error", "Failed to load events"))
        .finally(() => setLoading(false));
    }
  }, [resolvedProviderType]); 
 
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
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: rp(20), paddingTop: rp(8) }}> 
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={{ backgroundColor: "rgba(255,255,255,0.18)", borderRadius: rp(99), padding: rp(10) }} 
          > 
            <Ionicons name="chevron-back" size={22} color="#fff" /> 
          </TouchableOpacity> 
          <Text style={{ color: "#fff", fontSize: rs(20), fontWeight: "900", marginLeft: rp(14), flex: 1, letterSpacing: rs(0.5) }}> 
            {isHotelOwner ? "Hotel Registration QR" : "Pre-Registration QR"}
          </Text> 
        </View> 
 
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: rp(24), paddingVertical: rp(24) }}> 
          {loading ? ( 
            <ActivityIndicator size="large" color="#fff" /> 
          ) : ( 
            <> 
              {isHotelOwner && (
                <>
                  <View style={{ backgroundColor: "#fff", borderRadius: rp(32), padding: rp(32), alignItems: "center", width: "100%", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: rp(24), shadowOffset: { width: 0, height: rp(12) }, elevation: 12 }}> 
                    <Text style={{ fontSize: rs(11), fontWeight: "800", color: themeColor, letterSpacing: rs(3) }}> 
                      {isHotelOwner ? "HOTEL GUEST REGISTRATION" : "EVENT GUEST PRE-REGISTRATION"}
                    </Text> 
                    <Text style={{ fontSize: rs(20), fontWeight: "900", color: "#111827", marginTop: rp(6), textAlign: "center" }}> 
                      {name} 
                    </Text> 
                    <Text style={{ color: "#9CA3AF", marginTop: rp(4), marginBottom: rp(24), fontSize: rs(13), textAlign: "center" }}> 
                      {isHotelOwner ? "Guests scan this to register their vehicle" : "For event guests only — use Hotel QR for hotel valet"}
                    </Text> 
                    <View style={{ padding: rp(14), backgroundColor: isHotelOwner ? "#EFF6FF" : "#F5F3FF", borderRadius: rp(20) }}> 
                      {qrToken ? ( 
                        <QRCode value={preRegisterUrl} size={220} color={qrColor} /> 
                      ) : ( 
                        <View style={{ width: rp(220), height: rp(220), justifyContent: "center", alignItems: "center" }}> 
                          <Text style={{ color: "#9CA3AF" }}>QR unavailable</Text> 
                        </View> 
                      )} 
                    </View> 
                    <Text style={{ color: "#9CA3AF", fontSize: rs(11), marginTop: rp(18), textAlign: "center" }}> 
                      Guest scans this to pre-register their vehicle 
                    </Text> 
                  </View> 
     
                  <TouchableOpacity 
                    onPress={handleShare} 
                    style={{ backgroundColor: "rgba(255,255,255,0.15)", borderWidth: rp(1.5), borderColor: "#fff", borderRadius: rp(16), paddingVertical: rp(14), marginTop: rp(24), width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center" }} 
                  > 
                    <Ionicons name="share-outline" size={20} color="#fff" /> 
                    <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2), marginLeft: rp(8) }}>SHARE LINK</Text> 
                  </TouchableOpacity>
                </>
              )}

              {!isHotelOwner && (
                events.length === 0 ? (
                  <Text style={{ color: "#fff", textAlign: "center" }}>No active or upcoming events</Text>
                ) : (
                  <View style={{ width: "100%" }}>
                    {events.map(ev => {
                      const url = `${process.env.EXPO_PUBLIC_GUEST_URL}/pre-register/event/${ev.event_qr_token}`;
                      return (
                        <View key={ev.id} style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(20), alignItems: "center", width: "100%", marginBottom: rp(16) }}>
                          <Text style={{ fontSize: rs(16), fontWeight: "900", color: "#111827", textAlign: "center" }}>{ev.name}</Text>
                          <Text style={{ color: "#9CA3AF", fontSize: rs(12), marginTop: rp(2), marginBottom: rp(16) }}>{ev.date}</Text>
                          {ev.event_qr_token ? (
                            <QRCode value={url} size={160} color={qrColor} />
                          ) : (
                            <View style={{ width: rp(160), height: rp(160), justifyContent: "center", alignItems: "center" }}>
                              <Text style={{ color: "#9CA3AF" }}>QR unavailable</Text>
                            </View>
                          )}
                          <TouchableOpacity
                            onPress={() => Share.share({ message: `Pre-register your vehicle for ${ev.name}. Visit: ${url}` })}
                            style={{ backgroundColor: themeColor, borderRadius: rp(14), paddingVertical: rp(10), paddingHorizontal: rp(20), marginTop: rp(16), flexDirection: "row", alignItems: "center" }}
                          >
                            <Ionicons name="share-outline" size={16} color="#fff" />
                            <Text style={{ color: "#fff", fontWeight: "800", marginLeft: rp(6) }}>SHARE</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )
              )}
            </> 
          )} 
        </ScrollView> 
      </SafeAreaView> 
    </View> 
  ); 
} 
