import { useState, useEffect } from "react";
import { rs, rp } from '../../utils/responsive'; 
import { 
  View, Text, TouchableOpacity, ActivityIndicator, Alert, TextInput, FlatList, Modal
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
  const [cards, setCards] = useState([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [modalCard, setModalCard] = useState(null);

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
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { 
    if (!resolvedProviderType) return;
    setLoading(true);
    api.get("/qr-cards/me", { params: { search: debouncedSearch || undefined } })
      .then(({ data }) => setCards(data.cards || []))
      .catch(() => Alert.alert("Error", "Failed to load QR cards"))
      .finally(() => setLoading(false));
  }, [resolvedProviderType, debouncedSearch]); 

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      onPress={() => setModalCard(item)}
      style={{ 
        backgroundColor: "#fff", 
        borderRadius: rp(16), 
        padding: rp(16), 
        alignItems: "center", 
        width: "47%", 
        marginBottom: rp(16),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2
      }}
    >
      <View style={{ backgroundColor: "#F9FAFB", padding: rp(10), borderRadius: rp(12), marginBottom: rp(12) }}>
        <QRCode value={item.qr_token} size={80} color={qrColor} />
      </View>
      <Text style={{ fontSize: rs(14), fontWeight: "bold", color: "#111827" }}>Tag #{item.key_tag_number}</Text>
    </TouchableOpacity>
  );

  return ( 
    <View style={{ flex: 1, backgroundColor: themeColor }}> 
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: overlayColor }} /> 
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}> 
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: rp(20), paddingTop: rp(8), paddingBottom: rp(16) }}> 
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={{ backgroundColor: "rgba(255,255,255,0.18)", borderRadius: rp(99), padding: rp(10) }} 
          > 
            <Ionicons name="chevron-back" size={22} color="#fff" /> 
          </TouchableOpacity> 
          <Text style={{ color: "#fff", fontSize: rs(20), fontWeight: "900", marginLeft: rp(14), flex: 1, letterSpacing: rs(0.5) }}> 
            QR Codes
          </Text> 
        </View> 

        <View style={{ flex: 1, backgroundColor: "#F3F4F6", borderTopLeftRadius: rp(24), borderTopRightRadius: rp(24), overflow: "hidden" }}>
          
          <View style={{ padding: rp(20), backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", borderRadius: rp(12), paddingHorizontal: rp(14), paddingVertical: rp(10), borderWidth: 1, borderColor: "#E5E7EB" }}>
              <Ionicons name="search" size={20} color="#9CA3AF" />
              <TextInput 
                value={search}
                onChangeText={setSearch}
                placeholder="Search Key Tag Number..."
                style={{ flex: 1, marginLeft: rp(10), fontSize: rs(15), color: "#111827" }}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          {loading ? ( 
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={themeColor} /> 
            </View>
          ) : cards.length > 0 ? (
            <FlatList 
              data={cards}
              keyExtractor={c => c.id.toString()}
              numColumns={2}
              columnWrapperStyle={{ justifyContent: "space-between", paddingHorizontal: rp(20) }}
              contentContainerStyle={{ paddingVertical: rp(20) }}
              renderItem={renderItem}
            />
          ) : (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: rp(40) }}>
              <Ionicons name="qr-code-outline" size={48} color="#D1D5DB" />
              <Text style={{ fontSize: rs(16), fontWeight: "bold", color: "#4B5563", marginTop: rp(16) }}>No QR Codes Found</Text>
              <Text style={{ fontSize: rs(14), color: "#9CA3AF", textAlign: "center", marginTop: rp(8) }}>Try adjusting your search criteria</Text>
            </View>
          )}

        </View>

        <Modal visible={!!modalCard} transparent={true} animationType="fade" onRequestClose={() => setModalCard(null)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: rp(24) }}>
            <View style={{ backgroundColor: "#fff", borderRadius: rp(24), width: "100%", overflow: "hidden" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: rp(20), borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}>
                <Text style={{ fontSize: rs(18), fontWeight: "bold", color: "#111827" }}>Tag #{modalCard?.key_tag_number}</Text>
                <TouchableOpacity onPress={() => setModalCard(null)} style={{ padding: rp(4) }}>
                  <Ionicons name="close" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              <View style={{ padding: rp(40), alignItems: "center", backgroundColor: "#F9FAFB" }}>
                <View style={{ backgroundColor: "#fff", padding: rp(20), borderRadius: rp(16), shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 }}>
                  {modalCard && <QRCode value={modalCard.qr_token} size={200} color={qrColor} />}
                </View>
                <Text style={{ fontSize: rs(24), fontWeight: "bold", color: "#4B5563", marginTop: rp(24), letterSpacing: rs(2) }}>#{modalCard?.key_tag_number}</Text>
              </View>
            </View>
          </View>
        </Modal>

      </SafeAreaView> 
    </View> 
  ); 
}
