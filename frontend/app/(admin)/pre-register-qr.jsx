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
  
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState("lost");
  const [reportNote, setReportNote] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  const fetchCards = () => {
    if (!resolvedProviderType) return;
    setLoading(true);
    api.get("/qr-cards/me", { params: { search: debouncedSearch || undefined } })
      .then(({ data }) => setCards(data.cards || []))
      .catch(() => Alert.alert("Error", "Failed to load QR cards"))
      .finally(() => setLoading(false));
  };

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
    fetchCards();
  }, [resolvedProviderType, debouncedSearch]); 

  const submitReport = () => {
    if (!modalCard) return;
    setSubmittingReport(true);
    api.post(`/qr-cards/${modalCard.id}/report-incident`, { reason: reportReason, note: reportNote })
      .then(() => {
        Alert.alert("Success", "Incident reported successfully");
        setModalCard(null);
        setIsReporting(false);
        setReportNote("");
        fetchCards();
      })
      .catch((err) => {
        Alert.alert("Error", err.response?.data?.detail || "Failed to report incident");
      })
      .finally(() => setSubmittingReport(false));
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      onPress={() => {
        setModalCard(item);
        setIsReporting(false);
        setReportNote("");
        setReportReason("lost");
      }}
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
      {item.status === "pending_incident" && (
        <View style={{ position: "absolute", top: rp(8), right: rp(8), backgroundColor: "#FEF3C7", borderRadius: rp(99), padding: rp(4), zIndex: 10 }}>
          <Ionicons name="warning" size={16} color="#D97706" />
        </View>
      )}
      <View style={{ backgroundColor: "#F9FAFB", padding: rp(10), borderRadius: rp(12), marginBottom: rp(12) }}>
        <QRCode value={`${process.env.EXPO_PUBLIC_GUEST_URL}/v/${item.qr_token}`} size={80} color={qrColor} />
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
                  {modalCard && <QRCode value={`${process.env.EXPO_PUBLIC_GUEST_URL}/v/${modalCard.qr_token}`} size={200} color={qrColor} />}
                </View>
                <Text style={{ fontSize: rs(24), fontWeight: "bold", color: "#4B5563", marginTop: rp(24), letterSpacing: rs(2) }}>#{modalCard?.key_tag_number}</Text>
              </View>

              <View style={{ padding: rp(20), backgroundColor: "#fff" }}>
                {modalCard?.status === "pending_incident" ? (
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#FEF3C7", padding: rp(12), borderRadius: rp(12), borderWidth: 1, borderColor: "#FDE68A" }}>
                    <Ionicons name="warning" size={20} color="#D97706" />
                    <Text style={{ marginLeft: rp(8), color: "#92400E", fontSize: rs(13), fontWeight: "bold", flex: 1 }}>
                      Reported as lost/damaged — awaiting superadmin review
                    </Text>
                  </View>
                ) : !isReporting ? (
                  <TouchableOpacity 
                    onPress={() => setIsReporting(true)}
                    style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#FECACA", padding: rp(14), borderRadius: rp(12), alignItems: "center" }}
                  >
                    <Text style={{ color: "#DC2626", fontWeight: "bold", fontSize: rs(15) }}>Report Lost / Damaged</Text>
                  </TouchableOpacity>
                ) : (
                  <View>
                    <Text style={{ fontSize: rs(12), fontWeight: "bold", color: "#6B7280", textTransform: "uppercase", marginBottom: rp(8) }}>Reason</Text>
                    <View style={{ flexDirection: "row", gap: rp(8), marginBottom: rp(16) }}>
                      <TouchableOpacity 
                        onPress={() => setReportReason("lost")}
                        style={{ flex: 1, padding: rp(12), borderRadius: rp(10), borderWidth: 1, alignItems: "center", ...(reportReason === "lost" ? { backgroundColor: "#FEF2F2", borderColor: "#FECACA" } : { backgroundColor: "#fff", borderColor: "#E5E7EB" }) }}
                      >
                        <Text style={{ fontWeight: "bold", fontSize: rs(14), ...(reportReason === "lost" ? { color: "#B91C1C" } : { color: "#4B5563" }) }}>Lost</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => setReportReason("damaged")}
                        style={{ flex: 1, padding: rp(12), borderRadius: rp(10), borderWidth: 1, alignItems: "center", ...(reportReason === "damaged" ? { backgroundColor: "#FEF2F2", borderColor: "#FECACA" } : { backgroundColor: "#fff", borderColor: "#E5E7EB" }) }}
                      >
                        <Text style={{ fontWeight: "bold", fontSize: rs(14), ...(reportReason === "damaged" ? { color: "#B91C1C" } : { color: "#4B5563" }) }}>Damaged</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={{ fontSize: rs(12), fontWeight: "bold", color: "#6B7280", textTransform: "uppercase", marginBottom: rp(8) }}>Note (Optional)</Text>
                    <TextInput 
                      value={reportNote}
                      onChangeText={setReportNote}
                      placeholder="Any details..."
                      multiline
                      numberOfLines={3}
                      style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: rp(10), padding: rp(12), fontSize: rs(14), color: "#111827", minHeight: rp(80), textAlignVertical: "top", marginBottom: rp(20) }}
                    />

                    <View style={{ flexDirection: "row", gap: rp(12) }}>
                      <TouchableOpacity 
                        onPress={() => setIsReporting(false)}
                        style={{ flex: 1, padding: rp(14), borderRadius: rp(12), borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center", backgroundColor: "#fff" }}
                      >
                        <Text style={{ color: "#4B5563", fontWeight: "bold", fontSize: rs(15) }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={submitReport}
                        disabled={submittingReport}
                        style={{ flex: 1, padding: rp(14), borderRadius: rp(12), alignItems: "center", backgroundColor: "#DC2626", opacity: submittingReport ? 0.7 : 1 }}
                      >
                        {submittingReport ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={{ color: "#fff", fontWeight: "bold", fontSize: rs(15) }}>Submit Report</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

            </View>
          </View>
        </Modal>

      </SafeAreaView> 
    </View> 
  ); 
}
