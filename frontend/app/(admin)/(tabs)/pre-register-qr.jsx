import { confirmDialog } from "../../../lib/confirmDialog";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { rs, rp } from "../../../utils/responsive";
import { theme } from "../../../utils/theme";
import { Hero } from "../../../components/admin/Hero";
import { Screen } from "../../../components/valet/ui";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  FlatList,
  Modal,
  Share,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import api from "../../../lib/api";
import { useAppStore } from "../../../lib/store";

const cardShadow = {
  shadowColor: theme.colors.primary,
  shadowOpacity: 0.08,
  shadowRadius: rp(16),
  shadowOffset: { width: 0, height: rp(4) },
  elevation: 4,
};

export default function PreRegisterQR() {
  const insets = useSafeAreaInsets();

  const router = useRouter();
  const { user } = useAppStore();
  const [resolvedProviderType, setResolvedProviderType] = useState(null);

  const qrColor = theme.colors.primary;

  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [modalCard, setModalCard] = useState(null);

  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState("lost");
  const [reportNote, setReportNote] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState(null);
  const [qrPage, setQrPage] = useState(1);
  const QR_TAGS_PER_PAGE = 20;
  const [exportQueue, setExportQueue] = useState([]); // cards pending offscreen PNG generation
  const [exportMode, setExportMode] = useState(null); // "download" | null
  const [exportSavedCount, setExportSavedCount] = useState(0);
  const [exportBusy, setExportBusy] = useState(false);
  const qrRefs = useRef({});

  const fetchCards = useCallback(() => {
    if (!resolvedProviderType) return;
    setLoading(true);
    api.get("/qr-cards/me", { params: { search: debouncedSearch || undefined } })
      .then(({ data }) => setCards(data.cards || []))
      .catch(() => confirmDialog.info("Couldn't load QR cards", "Something went wrong loading the cards. Check your connection and try again."))
      .finally(() => setLoading(false));
  }, [resolvedProviderType, debouncedSearch]);

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

  useFocusEffect(
    useCallback(() => {
      fetchCards();
    }, [fetchCards])
  );

  const getDateKey = (iso) => {
    if (!iso) return "unknown";
    const utcStr = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
    return new Date(utcStr).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  };

  const formatDateLabel = (iso) => {
    const utcStr = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
    return new Date(utcStr).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
  };

  const dateGroups = useMemo(() => {
    const map = new Map();
    for (const c of cards) {
      const key = getDateKey(c.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
      .map(([dateKey, groupCards]) => ({
        dateKey,
        label: dateKey === "unknown" ? "Unknown Date" : formatDateLabel(groupCards[0].created_at),
        cards: groupCards,
      }));
  }, [cards]);

  const allGroup = useMemo(() => ({
    dateKey: "all",
    label: "All",
    cards: [...cards].sort((a, b) => {
      const na = Number(a.key_tag_number), nb = Number(b.key_tag_number);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return String(a.key_tag_number).localeCompare(String(b.key_tag_number));
    }),
  }), [cards]);

  useEffect(() => {
    if (dateGroups.length === 0) {
      setSelectedDateKey(null);
      return;
    }
    const stillExists = selectedDateKey === "all" || dateGroups.some(g => g.dateKey === selectedDateKey);
    if (!stillExists) {
      setSelectedDateKey(dateGroups[0].dateKey);
      setQrPage(1);
    }
  }, [dateGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setQrPage(1);
  }, [selectedDateKey]);

  const selectedGroup = selectedDateKey === "all" ? allGroup : (dateGroups.find(g => g.dateKey === selectedDateKey) || null);
  const qrTotalPages = selectedGroup ? Math.max(1, Math.ceil(selectedGroup.cards.length / QR_TAGS_PER_PAGE)) : 1;
  const qrVisibleCards = selectedGroup
    ? selectedGroup.cards.slice((qrPage - 1) * QR_TAGS_PER_PAGE, (qrPage - 1) * QR_TAGS_PER_PAGE + QR_TAGS_PER_PAGE)
    : [];

  const qrUrlFor = (card) =>
    `${process.env.EXPO_PUBLIC_API_URL || "https://instapark.docusafe.ai/api/v1"}/qr-redirect/${card.qr_token}`;

  const captureCardToDataUrl = (card) =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("QR capture timed out")), 5000);
      qrRefs.current[card.id] = {
        onCapture: (dataUrl) => {
          clearTimeout(timeout);
          resolve(dataUrl);
        },
      };
    });

  const handleDownloadDateGroup = async (group) => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      confirmDialog.info("Permission needed", "Please allow photo library access to save QR codes.");
      return;
    }
    setExportBusy(true);
    setExportSavedCount(0);
    setExportMode("download");
    setExportQueue(group.cards);

    let saved = 0;
    let album = null;
    for (const card of group.cards) {
      try {
        const dataUrl = await captureCardToDataUrl(card);
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
        const fileUri = `${FileSystem.cacheDirectory}qr-tag-${card.key_tag_number}.png`;
        await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        const asset = await MediaLibrary.createAssetAsync(fileUri);
        if (!album) {
          album = await MediaLibrary.getAlbumAsync("InstaPark QR Codes");
          if (!album) {
            album = await MediaLibrary.createAlbumAsync("InstaPark QR Codes", asset, false);
          } else {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          }
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
        saved++;
        setExportSavedCount(saved);
      } catch {
        // skip this card, continue with the rest
      }
    }

    setExportBusy(false);
    setExportMode(null);
    setExportQueue([]);
    if (saved === group.cards.length) {
      confirmDialog.info("Saved", `Saved all ${saved} QR code(s) from ${group.label} to your gallery (album "InstaPark QR Codes").`);
    } else {
      confirmDialog.info("Partially saved", `Saved ${saved} of ${group.cards.length} QR code(s) from ${group.label}. Some failed.`);
    }
  };

  const handleShareDateGroup = async (group) => {
    const links = group.cards.map(c => `Tag #${c.key_tag_number}: ${qrUrlFor(c)}`).join("\n");
    try {
      await Share.share({ message: `QR Codes added on ${group.label} (${group.cards.length} tag(s)):\n\n${links}` });
    } catch {
      confirmDialog.info("Couldn't share QR codes", "Something went wrong sharing the codes. Please try again.");
    }
  };

  const submitReport = () => {
    if (!modalCard) return;
    setSubmittingReport(true);
    api.post(`/qr-cards/${modalCard.id}/report-incident`, { reason: reportReason, note: reportNote })
      .then(() => {
        confirmDialog.info("Success", "Incident reported successfully");
        setModalCard(null);
        setIsReporting(false);
        setReportNote("");
        fetchCards();
      })
      .catch((err) => {
        confirmDialog.info("Couldn't report incident", err.response?.data?.detail || "Something went wrong submitting the report. Check your connection and try again.");
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
        backgroundColor: theme.colors.surface,
        borderRadius: rp(16),
        padding: rp(16),
        alignItems: "center",
        width: "47%",
        marginBottom: rp(16),
        ...cardShadow
      }}
    >
      {item.status === "pending_incident" && (
        <View style={{ position: "absolute", top: rp(8), right: rp(8), backgroundColor: theme.colors.warningLight, borderRadius: rp(99), padding: rp(4), zIndex: 10 }}>
          <Ionicons name="warning" size={16} color={theme.colors.warning} />
        </View>
      )}
      <View style={{ backgroundColor: theme.colors.surfaceAlt, padding: rp(10), borderRadius: rp(12), marginBottom: rp(12), position: 'relative', overflow: 'hidden' }}>
        <QRCode value={`${process.env.EXPO_PUBLIC_API_URL || "https://instapark.docusafe.ai/api/v1"}/qr-redirect/${item.qr_token}`} size={80} color={qrColor} />
        {item.is_assigned && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(17, 24, 39, 0.75)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: theme.colors.successLight, paddingHorizontal: rp(6), paddingVertical: rp(2), borderRadius: rp(4) }}>
              <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(8), fontWeight: "bold", color: theme.colors.success, textTransform: "uppercase", letterSpacing: 0.5 }}>Assigned</Text>
            </View>
            <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(10), fontWeight: "bold", color: theme.colors.surface, marginTop: rp(4) }}>{item.assigned_car_plate}</Text>
          </View>
        )}
      </View>
      <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(14), fontWeight: "bold", color: theme.colors.textPrimary }}>Tag #{item.key_tag_number}</Text>
    </TouchableOpacity>
  );

  return (
    <Screen scroll={false}>
      <Hero eyebrow="Inventory" title="QR Codes" onBack={() => router.back()} />
      <View style={{ flex: 1, backgroundColor: theme.colors.surfaceAlt, borderTopLeftRadius: rp(24), borderTopRightRadius: rp(24), overflow: "hidden" }}>

        <View style={{ padding: rp(20), backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surfaceAlt, borderRadius: rp(12), paddingHorizontal: rp(14), paddingVertical: rp(10), borderWidth: 1, borderColor: theme.colors.border, marginBottom: rp(12) }}>
            <Ionicons name="search" size={20} color={theme.colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search Key Tag Number..."
              style={{ fontFamily: theme.fontFamily.regular, flex: 1, marginLeft: rp(10), fontSize: rs(15), color: theme.colors.textPrimary }}
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          {dateGroups.length > 0 && (
            <>
              <TouchableOpacity
                onPress={() => setDateModalVisible(true)}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: rp(12), paddingHorizontal: rp(14), paddingVertical: rp(12), marginBottom: rp(12) }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
                  <Text style={{ fontFamily: theme.fontFamily.bold, marginLeft: rp(8), fontWeight: "800", fontSize: rs(14), color: theme.colors.textPrimary }}>
                    {selectedGroup ? `${selectedGroup.label} (${selectedGroup.cards.length})` : "Select date"}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>

              {selectedGroup && (
                <View style={{ flexDirection: "row", gap: rp(10) }}>
                  <TouchableOpacity
                    onPress={() => handleDownloadDateGroup(selectedGroup)}
                    disabled={exportBusy}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.border, borderRadius: rp(12), paddingVertical: rp(11), opacity: exportBusy ? 0.6 : 1 }}
                  >
                    {exportBusy && exportMode === "download" ? (
                      <>
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                        <Text style={{ fontFamily: theme.fontFamily.bold, marginLeft: rp(8), fontWeight: "800", fontSize: rs(13), color: theme.colors.textSecondary }}>
                          {exportSavedCount}/{exportQueue.length}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="download-outline" size={18} color={theme.colors.textSecondary} />
                        <Text style={{ fontFamily: theme.fontFamily.bold, marginLeft: rp(8), fontWeight: "800", fontSize: rs(13), color: theme.colors.textSecondary }}>Download All</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleShareDateGroup(selectedGroup)}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.border, borderRadius: rp(12), paddingVertical: rp(11) }}
                  >
                    <Ionicons name="share-social-outline" size={18} color={theme.colors.textSecondary} />
                    <Text style={{ fontFamily: theme.fontFamily.bold, marginLeft: rp(8), fontWeight: "800", fontSize: rs(13), color: theme.colors.textSecondary }}>Share</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : cards.length > 0 && selectedGroup ? (
          <>
            <FlatList
              data={qrVisibleCards}
              keyExtractor={c => c.id.toString()}
              numColumns={2}
              columnWrapperStyle={{ justifyContent: "space-between", paddingHorizontal: rp(20) }}
              contentContainerStyle={{ paddingVertical: rp(20) }}
              renderItem={renderItem}
            />
            {qrTotalPages > 1 && (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: rp(20), paddingVertical: rp(14), borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface }}>
                <TouchableOpacity
                  onPress={() => setQrPage(p => Math.max(1, p - 1))}
                  disabled={qrPage === 1}
                  style={{ paddingHorizontal: rp(16), paddingVertical: rp(9), borderRadius: rp(10), borderWidth: 1, borderColor: theme.colors.border, opacity: qrPage === 1 ? 0.4 : 1 }}
                >
                  <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: "800", fontSize: rs(13), color: theme.colors.textSecondary }}>Previous</Text>
                </TouchableOpacity>
                <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: "700", fontSize: rs(13), color: theme.colors.textMuted }}>Page {qrPage} of {qrTotalPages}</Text>
                <TouchableOpacity
                  onPress={() => setQrPage(p => Math.min(qrTotalPages, p + 1))}
                  disabled={qrPage === qrTotalPages}
                  style={{ paddingHorizontal: rp(16), paddingVertical: rp(9), borderRadius: rp(10), borderWidth: 1, borderColor: theme.colors.border, opacity: qrPage === qrTotalPages ? 0.4 : 1 }}
                >
                  <Text style={{ fontFamily: theme.fontFamily.bold, fontWeight: "800", fontSize: rs(13), color: theme.colors.textSecondary }}>Next</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: rp(40) }}>
            <Ionicons name="qr-code-outline" size={48} color={theme.colors.border} />
            <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(16), fontWeight: "bold", color: theme.colors.textSecondary, marginTop: rp(16) }}>No QR Codes Found</Text>
            <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(14), color: theme.colors.textMuted, textAlign: "center", marginTop: rp(8) }}>Try adjusting your search criteria</Text>
          </View>
        )}

      </View>

      <Modal visible={!!modalCard} transparent={true} animationType="fade" onRequestClose={() => setModalCard(null)}>
        <View style={{ flex: 1, backgroundColor: theme.colors.overlay, justifyContent: "center", alignItems: "center", padding: rp(24) }}>
          <View style={{ backgroundColor: theme.colors.surface, borderRadius: rp(24), width: "100%", overflow: "hidden" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: rp(20), borderBottomWidth: 1, borderBottomColor: theme.colors.surfaceAlt }}>
              <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(18), fontWeight: "bold", color: theme.colors.textPrimary }}>Tag #{modalCard?.key_tag_number}</Text>
              <TouchableOpacity onPress={() => setModalCard(null)} style={{ padding: rp(4) }}>
                <Ionicons name="close" size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: rp(40), alignItems: "center", backgroundColor: theme.colors.surfaceAlt }}>
              <View style={{ backgroundColor: theme.colors.surface, padding: rp(20), borderRadius: rp(16), shadowColor: theme.colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5, position: 'relative', overflow: 'hidden' }}>
                {modalCard && <QRCode value={`${process.env.EXPO_PUBLIC_API_URL || "https://instapark.docusafe.ai/api/v1"}/qr-redirect/${modalCard.qr_token}`} size={200} color={qrColor} />}
                {modalCard?.is_assigned && (
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(17, 24, 39, 0.75)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ backgroundColor: theme.colors.successLight, paddingHorizontal: rp(12), paddingVertical: rp(4), borderRadius: rp(99) }}>
                      <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(12), fontWeight: "bold", color: theme.colors.success, textTransform: "uppercase", letterSpacing: 0.5 }}>Assigned</Text>
                    </View>
                    <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(18), fontWeight: "bold", color: theme.colors.surface, marginTop: rp(8), letterSpacing: rs(1) }}>{modalCard?.assigned_car_plate}</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontFamily: theme.fontFamily.headline, fontSize: rs(24), fontWeight: "bold", color: theme.colors.textSecondary, marginTop: rp(24), letterSpacing: rs(2) }}>#{modalCard?.key_tag_number}</Text>
            </View>

            <View style={{ padding: rp(20), backgroundColor: theme.colors.surface }}>
              {modalCard?.status === "pending_incident" ? (
                <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.warningLight, padding: rp(12), borderRadius: rp(12), borderWidth: 1, borderColor: theme.colors.warningLight }}>
                  <Ionicons name="warning" size={20} color={theme.colors.warning} />
                  <Text style={{ fontFamily: theme.fontFamily.regular, marginLeft: rp(8), color: theme.colors.warning, fontSize: rs(13), fontWeight: "bold", flex: 1 }}>
                    Reported as lost/damaged — awaiting superadmin review
                  </Text>
                </View>
              ) : !isReporting ? (
                <TouchableOpacity
                  onPress={() => setIsReporting(true)}
                  style={{ backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.dangerLight, padding: rp(14), borderRadius: rp(12), alignItems: "center" }}
                >
                  <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.danger, fontWeight: "bold", fontSize: rs(15) }}>Report Lost / Damaged</Text>
                </TouchableOpacity>
              ) : (
                <View>
                  <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(12), fontWeight: "bold", color: theme.colors.textMuted, textTransform: "uppercase", marginBottom: rp(8) }}>Reason</Text>
                  <View style={{ flexDirection: "row", gap: rp(8), marginBottom: rp(16) }}>
                    <TouchableOpacity
                      onPress={() => setReportReason("lost")}
                      style={{ flex: 1, padding: rp(12), borderRadius: rp(10), borderWidth: 1, alignItems: "center", ...(reportReason === "lost" ? { backgroundColor: theme.colors.dangerLight, borderColor: theme.colors.dangerLight } : { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }) }}
                    >
                      <Text style={{ fontFamily: theme.fontFamily.regular, fontWeight: "bold", fontSize: rs(14), ...(reportReason === "lost" ? { color: theme.colors.danger } : { color: theme.colors.textSecondary }) }}>Lost</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setReportReason("damaged")}
                      style={{ flex: 1, padding: rp(12), borderRadius: rp(10), borderWidth: 1, alignItems: "center", ...(reportReason === "damaged" ? { backgroundColor: theme.colors.dangerLight, borderColor: theme.colors.dangerLight } : { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }) }}
                    >
                      <Text style={{ fontFamily: theme.fontFamily.regular, fontWeight: "bold", fontSize: rs(14), ...(reportReason === "damaged" ? { color: theme.colors.danger } : { color: theme.colors.textSecondary }) }}>Damaged</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(12), fontWeight: "bold", color: theme.colors.textMuted, textTransform: "uppercase", marginBottom: rp(8) }}>Note (Optional)</Text>
                  <TextInput
                    value={reportNote}
                    onChangeText={setReportNote}
                    placeholder="Any details..."
                    multiline
                    numberOfLines={3}
                    style={{ fontFamily: theme.fontFamily.regular, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: rp(10), padding: rp(12), fontSize: rs(14), color: theme.colors.textPrimary, minHeight: rp(80), textAlignVertical: "top", marginBottom: rp(20) }}
                  />

                  <View style={{ flexDirection: "row", gap: rp(12) }}>
                    <TouchableOpacity
                      onPress={() => setIsReporting(false)}
                      style={{ flex: 1, padding: rp(14), borderRadius: rp(12), borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", backgroundColor: theme.colors.surface }}
                    >
                      <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.textSecondary, fontWeight: "bold", fontSize: rs(15) }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={submitReport}
                      disabled={submittingReport}
                      style={{ flex: 1, padding: rp(14), borderRadius: rp(12), alignItems: "center", backgroundColor: theme.colors.danger, opacity: submittingReport ? 0.7 : 1 }}
                    >
                      {submittingReport ? (
                        <ActivityIndicator size="small" color={theme.colors.surface} />
                      ) : (
                        <Text style={{ fontFamily: theme.fontFamily.regular, color: theme.colors.surface, fontWeight: "bold", fontSize: rs(15) }}>Submit Report</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

          </View>
        </View>
      </Modal>

      <Modal visible={dateModalVisible} transparent animationType="slide" onRequestClose={() => setDateModalVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: theme.colors.overlay, justifyContent: "flex-end" }} activeOpacity={1} onPress={() => setDateModalVisible(false)}>
          <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "70%", paddingBottom: (insets?.bottom || 0) }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: rp(20), borderBottomWidth: 1, borderBottomColor: theme.colors.surfaceAlt }}>
              <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(17), fontWeight: "900", color: theme.colors.textPrimary }}>Select Date</Text>
              <TouchableOpacity onPress={() => setDateModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[allGroup, ...dateGroups]}
              keyExtractor={g => g.dateKey}
              contentContainerStyle={{ padding: rp(12) }}
              renderItem={({ item: g }) => (
                <TouchableOpacity
                  onPress={() => { setSelectedDateKey(g.dateKey); setDateModalVisible(false); }}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: rp(16), borderRadius: rp(12), backgroundColor: g.dateKey === selectedDateKey ? theme.colors.primaryLight : theme.colors.surface }}
                >
                  <Text style={{ fontFamily: theme.fontFamily.bold, fontSize: rs(15), fontWeight: "700", color: g.dateKey === selectedDateKey ? themeColor : theme.colors.textPrimary }}>{g.label}</Text>
                  <Text style={{ fontFamily: theme.fontFamily.regular, fontSize: rs(13), color: theme.colors.textMuted }}>{g.cards.length} tag{g.cards.length !== 1 ? "s" : ""}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>


      {/* Hidden QR renderer used only for generating PNGs for download/share, independent of what's currently visible/paginated on screen */}
      <View style={{ position: "absolute", top: -9999, left: -9999, opacity: 0 }} pointerEvents="none">
        {exportQueue.map(card => (
          <QRCode
            key={card.id}
            value={qrUrlFor(card)}
            size={300}
            getRef={(c) => {
              if (c && qrRefs.current[card.id] && !qrRefs.current[card.id]._captured) {
                qrRefs.current[card.id]._captured = true;
                c.toDataURL((data) => {
                  const dataUrl = data.startsWith("data:") ? data : `data:image/png;base64,${data}`;
                  qrRefs.current[card.id].onCapture(dataUrl);
                });
              }
            }}
          />
        ))}
      </View>
    </Screen>
  );
}
