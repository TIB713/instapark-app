// version 3
import { configureBackgroundAudio } from "../../../lib/audio";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../../utils/theme';
import { Audio } from "expo-av";
import { confirmDialog } from "../../../lib/confirmDialog";
import { Vibration } from "react-native";
import * as Location from "expo-location";
import { Linking } from "react-native";
import { useEffect, useState, useCallback, useRef } from "react";
import { rs, rp } from '../../../utils/responsive';
import { fmtDuration } from '../../../utils/time';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Platform,
  BackHandler,
  KeyboardAvoidingView,
  AppState,
  Animated,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import NetInfo from "@react-native-community/netinfo";
import api from "../../../lib/api";
import { useAppStore } from "../../../lib/store";
import { connectWS, disconnectWS } from "../../../lib/websocket";
import { enqueueHandover, getQueueCount, processPendingQueue, enqueueParkAction, getQueueSummary, getFailedQueue } from "../../../lib/offline";
import { stopLocationTracking, updateJourney, checkEventStatusAndStop, isJourneyAccepted, markJourneyAccepted, startLocationTracking, LOCATION_TASK_NAME } from "../../../lib/locationTracking";

import { useDriverTasksContext } from "../../../context/DriverTasksContext";

import { Screen, TopBar, Card, Btn, StatusPill, Plate, EmptyState, SectionTitle, Chip, Modal, Sheet } from '../../../components/valet/ui';
import Heading from '../../../components/Heading';

export default function Tasks() {
  const router = useRouter();
  const { driver, currentEventId } = useAppStore();
  const resolvedDriverId = driver?.id;

  const ctx = useDriverTasksContext();
  const incomingRequests = ctx;
  const { incomingRequest, requestQueue, maybeQueueNewRequest, dismissIncomingRequest, seenRequestIdsRef, hasSeededSeenRef, setRequestQueue, requestSoundRef } = incomingRequests;

  const sosHook = ctx;
  const { sosState, openSOS, closeSOS, setSosAlertType, setSosNote, takeSosPhoto, sendSOS } = sosHook;
  const { showSOSModal, sosAlertType, sosNote, sosCarId, sosCarNumber, sendingSOS, sosPhoto } = sosState;

  const driverTasks = ctx;
  const {
    tab,
    setTab,
    cars,
    retrievals,
    acceptedCarIds,
    acceptingCarId,
    setAcceptingCarId,
    setAcceptedCarIds,
    refreshing,
    nowTick,
    otpInput,
    setOtpInput,
    verifyingOtp,
    arrivingAtGate,
    handoverUploading,
    pendingCount,
    failedCount,
    queueSummary,
    pickingUp,
    onRefresh,
    acceptRetrieval,
    confirmPickup,
    arriveAtGate,
    verifyDeliveryOtp,
    handleHandover,
    navigateToCar,
    refreshPending,
    fetchMyCarsRef,
    fetchRetrievalsRef
  } = driverTasks;

  const parkFlowHook = ctx;
  const {
    parkState,
    setShowParkModal,
    setSelectedCar,
    setEventZones,
    setSlots,
    setSelectedZone,
    setSelectedSlot,
    setKeyTag,
    setParkPhotos,
    setLoadingPhotoIdx,
    setParkingPhotoStep,
    setTakingParkPhoto,
    setShowParkSuccessModal,
    setParkedCarInfo,
    setCapturedGPS,
    setCapturingGPS,
    setOpeningParkModal,
    setConfirmingPark,
    setDismissingParkSuccess,
    openParkModal,
    captureGPSPin,
    takeParkPhoto,
    confirmPark,
    doConfirmPark,
    uploadParkPhotosInBackground
  } = parkFlowHook;

  const {
    showParkModal,
    selectedCar,
    eventZones,
    slots,
    selectedZone,
    selectedSlot,
    keyTag,
    parkPhotos,
    loadingPhotoIdx,
    parkingPhotoStep,
    takingParkPhoto,
    showParkSuccessModal,
    parkedCarInfo,
    capturedGPS,
    capturingGPS,
    openingParkModal,
    confirmingPark,
    dismissingParkSuccess,
  } = parkState;

  const retrievalRequested = retrievals.filter(car => car.status === "RETRIEVAL_REQUESTED").length;

  const [stats, setStats] = useState({ parked_count: 0, delivered_count: 0, avg_retrieval_minutes: 0 });

  const fetchStats = async () => {
    if (!currentEventId || !resolvedDriverId) return;
    try {
      const res = await api.get(`/drivers/${resolvedDriverId}/events/${currentEventId}/stats`);
      setStats(res.data);
    } catch (err) {
      console.warn("Failed to fetch driver stats", err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [currentEventId, resolvedDriverId])
  );

  const handleRefresh = async () => {
    onRefresh();
    await fetchStats();
  };

  // Add back the back handler effect which is required for modal close!
  useEffect(() => {
    const backAction = () => {
      if (incomingRequest) { dismissIncomingRequest(); return true; }
      if (showSOSModal) { closeSOS(); return true; }
      if (showParkModal) { setShowParkModal(false); return true; }
      router.back(); return true;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [showSOSModal, showParkModal, incomingRequest]);


  const unifiedList = Object.values([...cars, ...retrievals].reduce((acc, car) => {
    if (!acc[car.id] || car.retrieval_driver_id) {
      acc[car.id] = car;
    }
    return acc;
  }, {})).filter((car) => {
    // Only show retrievals that are requested OR belong to this driver
    if (["RETRIEVAL_REQUESTED", "ACCEPTED", "BEING_FETCHED", "ARRIVED_AT_GATE", "AWAITING_REPARK"].includes(car.status) &&
      car.status !== "RETRIEVAL_REQUESTED" &&
      car.retrieval_driver_id !== resolvedDriverId) {
      return false;
    }

    if (tab === "all") return true;
    if (tab === "requested") return car.status === "RETRIEVAL_REQUESTED";
    if (tab === "at_gate") return car.status === "ACCEPTED" || car.status === "BEING_FETCHED" || car.status === "ARRIVED_AT_GATE";
    if (tab === "parked") return car.status === "PARKED" || car.status === "CHECKED_IN";
    if (tab === "repark") return car.status === "AWAITING_REPARK";
    return true;
  });

  const renderUnifiedCard = (car) => {
    const isRetrievalMine = car.retrieval_driver_id === resolvedDriverId;
    let label = "";
    let tone = "default";

    if (car.status === "RETRIEVAL_REQUESTED") { tone = "accent"; label = "REQUESTED"; }
    else if (car.status === "ACCEPTED") { tone = "warning"; label = "ACCEPTED"; }
    else if (car.status === "BEING_FETCHED" && isRetrievalMine) { tone = "primary"; label = "YOURS"; }
    else if (car.status === "ARRIVED_AT_GATE" && isRetrievalMine) { tone = "success"; label = "AT GATE"; }
    else if (car.status === "AWAITING_REPARK" && isRetrievalMine) { tone = "danger"; label = "RE-PARK NEEDED"; }
    else if (isRetrievalMine) { tone = "primary"; label = "YOURS"; }
    else if (car.status === "PARKED") { tone = "success"; label = "PARKED"; }
    else if (car.status === "CHECKED_IN") { tone = "primary"; label = "CHECKED IN"; }
    else { tone = "default"; label = car.status; }

    const supervisorRequested = car.retrieval_requested_via === "supervisor_scan";

    return (
      <Card key={car.id} style={{ marginBottom: rp(12) }}>
        {supervisorRequested && ["RETRIEVAL_REQUESTED", "ACCEPTED", "BEING_FETCHED", "ARRIVED_AT_GATE"].includes(car.status) && (
          <View style={{ backgroundColor: theme.colors.infoLight, paddingHorizontal: rp(8), paddingVertical: rp(4), borderRadius: rp(8), marginBottom: rp(10), alignSelf: "flex-start" }}>
            <Text style={{ color: theme.colors.info, fontSize: rs(11), fontWeight: "700" }}>Requested by supervisor · No OTP needed</Text>
          </View>
        )}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: rp(12) }}>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: rp(8) }}>
              <Plate value={car.plate} />
            </View>
            <Text style={{ color: theme.colors.textSecondary, fontSize: rs(12), marginTop: rp(4) }}>{car.color} {car.make}</Text>
          </View>
          <StatusPill label={label} tone={tone} />
        </View>

        {(car.zone || car.slot) && (
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surfaceAlt, padding: rp(8), borderRadius: rp(8), marginBottom: rp(12) }}>
            <Ionicons name="location" size={14} color={theme.colors.textPrimary} />
            <Text style={{ color: theme.colors.textPrimary, fontWeight: "700", fontSize: rs(12), marginLeft: rp(6) }}>
              Zone {car.zone} • Slot {car.slot}{(car.key_tag_number || car.key_tag) ? ` • Key Tag #${car.key_tag_number || car.key_tag}` : ""}
            </Text>
          </View>
        )}
        {!car.zone && !car.slot && (car.key_tag_number || car.key_tag) && (
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surfaceAlt, padding: rp(8), borderRadius: rp(8), marginBottom: rp(12) }}>
            <Ionicons name="pricetag-outline" size={14} color={theme.colors.textPrimary} />
            <Text style={{ color: theme.colors.textPrimary, fontWeight: "700", fontSize: rs(12), marginLeft: rp(6) }}>
              Key Tag #{car.key_tag_number || car.key_tag}
            </Text>
          </View>
        )}

        {(() => {
          let durText = null;
          if (car.park_minutes != null) durText = `Parked in ${fmtDuration(car.park_minutes)}`;
          else if (car.retrieval_to_gate_minutes != null) durText = `Retrieved in ${fmtDuration(car.retrieval_to_gate_minutes)}`;
          else if (car.dispatch_wait_minutes != null) durText = `Picked up after ${fmtDuration(car.dispatch_wait_minutes)}`;
          
          if (!durText) return null;
          return (
            <Text style={{ color: theme.colors.textSecondary, fontSize: rs(12), marginBottom: rp(12), marginTop: rp(-4) }}>
              {durText}
            </Text>
          );
        })()}

        {car.notes && (
          <View style={{ backgroundColor: theme.colors.warningLight, padding: rp(8), borderRadius: rp(8), marginBottom: rp(12) }}>
            <Text style={{ color: theme.colors.warning, fontSize: rs(12) }}>{car.notes}</Text>
          </View>
        )}

        {car.status === "PARKED" ? (
          <View style={{ flexDirection: "row", gap: rp(8) }}>
            <Btn style={{ flex: 1 }} variant="outline" onPress={() => navigateToCar(car.id)}>
              Navigate
            </Btn>
            <Btn style={{ flex: 1 }} variant="outline" onPress={() => router.push({ pathname: "/(driver)/(tabs)/qr", params: { token: car.qr_token || car.retrieval_token, plate: car.plate, code: car.checkin_code, mode: "park", keyTagNumber: car.key_tag_number || car.key_tag } })}>
              Show QR Code
            </Btn>
          </View>
        ) : car.status === "CHECKED_IN" ? (
          !acceptedCarIds.has(car.id) ? (
            <Btn
              variant="primary"
              disabled={acceptingCarId === car.id}
              onPress={async () => {
                setAcceptingCarId(car.id);
                try {
                  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
                  if (!running) {
                    const started = await startLocationTracking();
                    if (!started) {
                      confirmDialog.info(
                        "Location permission needed",
                        "InstaPark couldn't start sharing your location. Your supervisor won't be able to see you on the map. Please enable location permission for this app in your device settings."
                      );
                    }
                  }
                  await updateJourney(car.id, "checkin");
                  await markJourneyAccepted(car.id);
                  setAcceptedCarIds(prev => new Set(prev).add(car.id));
                } finally {
                  setAcceptingCarId(null);
                }
              }}
            >
              {acceptingCarId === car.id ? "Accepting..." : "Accept"}
            </Btn>
          ) : (
            <View style={{ flexDirection: "row", gap: rp(8) }}>
              <Btn style={{ flex: 1 }} variant="outline" onPress={() => router.push({ pathname: "/(driver)/(tabs)/qr", params: { token: car.qr_token || car.retrieval_token, plate: car.plate, code: car.checkin_code, mode: "park", keyTagNumber: car.key_tag_number || car.key_tag } })}>
                QR Code
              </Btn>
              <Btn style={{ flex: 1 }} variant="primary" disabled={openingParkModal === car.id} onPress={() => { openParkModal(car); router.push('/(driver)/(tabs)/park'); }}>
                {openingParkModal === car.id ? "Loading..." : "Park"}
              </Btn>
            </View>
          )
        ) : car.status === "RETRIEVAL_REQUESTED" ? (
          <View style={{ gap: rp(8) }}>
            <Btn variant="primary" disabled={pickingUp[car.id]} onPress={() => acceptRetrieval(car)}>
              {pickingUp[car.id] ? "Accepting..." : "Accept Retrieval"}
            </Btn>
          </View>
        ) : car.status === "ACCEPTED" && isRetrievalMine ? (
          <View style={{ gap: rp(8) }}>
            <Btn variant="primary" disabled={pickingUp[car.id]} onPress={() => confirmPickup(car)}>
              {pickingUp[car.id] ? "Confirming..." : "Picked Up"}
            </Btn>
          </View>
        ) : car.status === "BEING_FETCHED" && isRetrievalMine ? (
          <View style={{ gap: rp(8) }}>
            <Btn variant="outline" onPress={() => navigateToCar(car.id)}>
              Navigate to Car
            </Btn>
            <Btn variant="primary" disabled={arrivingAtGate === car.id} onPress={() => arriveAtGate(car)}>
              {arrivingAtGate === car.id ? "Marking arrived..." : "Mark Arrived at Gate"}
            </Btn>
          </View>
        ) : car.status === "ARRIVED_AT_GATE" && isRetrievalMine ? (
          car.otp_verified || car.retrieval_requested_via === "supervisor_scan" ? (
            <View style={{ gap: rp(8) }}>
              <Btn
                variant="primary"
                disabled={handoverUploading}
                onPress={() => handleHandover(car)}
              >
                {handoverUploading ? "Processing..." : "Take Delivery Photo & Handover"}
              </Btn>
            </View>
          ) : (
            <View style={{ gap: rp(12) }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: rp(12) }}>
                <TextInput
                  style={{
                    flex: 1,
                    backgroundColor: theme.colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: rp(8),
                    padding: rp(12),
                    fontSize: rs(16),
                    color: theme.colors.textPrimary,
                    textAlign: "center",
                    letterSpacing: rs(2),
                    fontWeight: "bold",
                  }}
                  placeholder="Enter OTP"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otpInput[car.id] || ""}
                  onChangeText={(text) => setOtpInput(prev => ({ ...prev, [car.id]: text }))}
                />
                {car.gate_timer_expires_at && (
                  <View style={{ alignItems: "center", paddingHorizontal: rp(8) }}>
                    <Text style={{ fontSize: rs(10), color: theme.colors.textSecondary, fontWeight: "600", textTransform: "uppercase" }}>Time Left</Text>
                    <Text style={{ fontSize: rs(16), color: new Date(car.gate_timer_expires_at).getTime() - nowTick <= 60000 ? theme.colors.danger : theme.colors.textPrimary, fontWeight: "700" }}>
                      {(() => {
                        const diff = Math.max(0, new Date(car.gate_timer_expires_at).getTime() - nowTick);
                        const m = Math.floor(diff / 60000);
                        const s = Math.floor((diff % 60000) / 1000);
                        return `${m}:${s < 10 ? '0' : ''}${s}`;
                      })()}
                    </Text>
                  </View>
                )}
              </View>
              <Btn
                variant="primary"
                disabled={verifyingOtp[car.id]}
                onPress={() => verifyDeliveryOtp(car)}
              >
                {verifyingOtp[car.id] ? "Verifying..." : "Verify OTP"}
              </Btn>
            </View>
          )
        ) : car.status === "AWAITING_REPARK" && isRetrievalMine ? (
          <View style={{ gap: rp(8) }}>
            <Btn style={{ flex: 1 }} variant="primary" disabled={openingParkModal === car.id} onPress={() => { openParkModal(car); router.push('/(driver)/(tabs)/park'); }}>
              {openingParkModal === car.id ? "Loading..." : "Re-park"}
            </Btn>
          </View>
        ) : null}
      </Card>
    );
  };

  return (
    <Screen scroll={false}>
      {!currentEventId ? (
        <EmptyState
          icon={<Ionicons name="calendar-outline" size={64} color="#9CA3AF" />}
          title="No active event"
          body="Ask your supervisor to assign you to an event."
          cta={<Btn onPress={() => router.push("/(driver)/(tabs)/profile")}>Go to Profile</Btn>}
        />
      ) : (
        <>
          <TopBar
            align="left"
            eyebrow="TASKS"
            title={useAppStore.getState().events?.find(e => e.id === currentEventId)?.name || "Active Event"}
            rightNode={
              <TouchableOpacity
                onPress={() => openSOS()}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.danger, alignItems: 'center', justifyContent: 'center' }}
              >
                <MaterialCommunityIcons name="alarm-light-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            }
          />

          <View style={{
            backgroundColor: "#FFFFFF",
            marginHorizontal: rp(16),
            marginTop: rp(12),
            borderRadius: rp(12),
            paddingVertical: rp(16),
            flexDirection: "row",
            justifyContent: "space-around",
            alignItems: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 4,
            zIndex: 10
          }}>
            <View style={{ alignItems: "center", flex: 1 }}>
              <Heading level="display" style={{ fontSize: rs(20), color: "#111827" }}>{stats.parked_count}</Heading>
              <Text style={{ fontSize: rs(11), color: "#6B7280", marginTop: rp(4), textTransform: "uppercase", fontWeight: "600" }}>Parked</Text>
            </View>
            <View style={{ width: 1, backgroundColor: "#E5E7EB", height: "100%" }} />
            <View style={{ alignItems: "center", flex: 1 }}>
              <Heading level="display" style={{ fontSize: rs(20), color: "#111827" }}>{stats.delivered_count}</Heading>
              <Text style={{ fontSize: rs(11), color: "#6B7280", marginTop: rp(4), textTransform: "uppercase", fontWeight: "600" }}>Delivered</Text>
            </View>
            <View style={{ width: 1, backgroundColor: "#E5E7EB", height: "100%" }} />
            <View style={{ alignItems: "center", flex: 1 }}>
              <Heading level="display" style={{ fontSize: rs(20), color: "#111827" }}>{stats.avg_retrieval_minutes}</Heading>
              <Text style={{ fontSize: rs(11), color: "#6B7280", marginTop: rp(4), textTransform: "uppercase", fontWeight: "600" }}>Avg Min</Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", paddingHorizontal: rp(16), marginTop: rp(16), marginBottom: rp(12), gap: rp(6) }}>
            <Chip style={{ flex: 1, marginRight: 0, alignItems: "center", paddingHorizontal: rp(4) }} textStyle={{ fontSize: rs(10) }} label="All" active={tab === "all"} onPress={() => setTab("all")} />
            <Chip style={{ flex: 1, marginRight: 0, alignItems: "center", paddingHorizontal: rp(4) }} textStyle={{ fontSize: rs(10) }} label="Requested" active={tab === "requested"} onPress={() => setTab("requested")} />
            <Chip style={{ flex: 1, marginRight: 0, alignItems: "center", paddingHorizontal: rp(4) }} textStyle={{ fontSize: rs(10) }} label="At gate" active={tab === "at_gate"} onPress={() => setTab("at_gate")} />
            <Chip style={{ flex: 1, marginRight: 0, alignItems: "center", paddingHorizontal: rp(4) }} textStyle={{ fontSize: rs(10) }} label="Parked" active={tab === "parked"} onPress={() => setTab("parked")} />
            <Chip style={{ flex: 1, marginRight: 0, alignItems: "center", paddingHorizontal: rp(4) }} textStyle={{ fontSize: rs(10) }} label="Re-park" active={tab === "repark"} onPress={() => setTab("repark")} />
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: rp(16), marginBottom: rp(12) }}>
            <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#7C3AED", letterSpacing: rs(3) }}>LIVE QUEUE</Text>
            <Text style={{ fontSize: rs(12), color: "#6B7280", fontWeight: "600" }}>{unifiedList.length} active</Text>
          </View>

          {failedCount > 0 && (
            <TouchableOpacity onPress={() => router.push("/(driver)/failed-syncs")}>
              <View style={{ backgroundColor: "#FEE2E2", padding: rp(12), marginHorizontal: rp(16), marginBottom: rp(12), borderRadius: rp(14), borderWidth: rp(1), borderColor: "#FCA5A5", flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="warning" size={16} color="#B91C1C" />
                <Text style={{ color: "#B91C1C", fontSize: rs(12), fontWeight: "700", marginLeft: rp(8), flex: 1 }}>
                  {failedCount} sync failure(s) • these check-ins could not be uploaded.
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {pendingCount > 0 && (
            <View style={{ backgroundColor: "#FEF3C7", padding: rp(12), marginHorizontal: rp(16), marginBottom: rp(12), borderRadius: rp(14), borderWidth: rp(1), borderColor: "#F59E0B", flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="cloud-offline" size={16} color="#92400E" />
              <Text style={{ color: "#92400E", fontSize: rs(12), fontWeight: "700", marginLeft: rp(8) }}>
                {pendingCount} action(s) pending • will sync when online.
              </Text>
            </View>
          )}

          <ScrollView
            style={{ flex: 1, paddingHorizontal: rp(16) }}
            contentContainerStyle={{ paddingBottom: rp(100) }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#059669" />}
          >
            {unifiedList.length === 0 ? (
              <EmptyState title="No cars in queue" body="No vehicles match the selected filter." />
            ) : (
              unifiedList.map(renderUnifiedCard)
            )}
          </ScrollView>
        </>
      )}

      {/* Park Flow Sheet */}


      {/* SOS Modal */}
      <Modal open={showSOSModal} onClose={closeSOS} title="Send SOS Alert">
        <Text style={{ fontSize: rs(13), color: "#6B7280", marginBottom: rp(20) }}>Your supervisor will be notified immediately.</Text>

        <SectionTitle>What do you need help with?</SectionTitle>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: rp(8), marginBottom: rp(16) }}>
          {[
            { key: "NEED_HELP", label: "Need Help" },
            { key: "BLOCKED_CAR", label: "Blocked Car" },
            { key: "DAMAGE_CLAIM", label: "Damage Claim" },
            { key: "MEDICAL", label: "Medical" },
            { key: "OTHER", label: "Other" },
          ].map((item) => (
            <Chip
              key={item.key}
              label={item.label}
              active={sosAlertType === item.key}
              onPress={() => setSosAlertType(item.key)}
            />
          ))}
        </View>

        <TextInput
          placeholder="Add details (optional)..."
          value={sosNote}
          onChangeText={setSosNote}
          multiline
          numberOfLines={3}
          style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: rp(10), padding: rp(12), fontSize: rs(14), color: "#111827", textAlignVertical: "top", marginBottom: rp(20), minHeight: rp(80) }}
        />

        <Btn variant="outline" onPress={takeSosPhoto} style={{ marginBottom: rp(24) }}>
          {sosPhoto ? "Retake Photo (Optional)" : "Add Photo (Optional)"}
        </Btn>

        <View style={{ flexDirection: "row", gap: rp(12) }}>
          <Btn style={{ flex: 1 }} variant="outline" onPress={closeSOS}>Cancel</Btn>
          <Btn style={{ flex: 1 }} variant="danger" disabled={sendingSOS} onPress={sendSOS}>
            {sendingSOS ? "Sending..." : "Send SOS"}
          </Btn>
        </View>
      </Modal>

      {/* Park Success Modal - keeping React Native Modal because it requires completely custom UI for QR Code display */}
      <Modal open={showParkSuccessModal} onClose={() => { }} title="Vehicle Parked!">
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "baseline", gap: rp(8), marginBottom: rp(12) }}>
          <Text style={{ fontSize: rs(16), fontWeight: "700", color: "#6B7280", textAlign: "center" }}>
            {parkedCarInfo?.plate}
          </Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: rp(8), marginBottom: rp(16), flexWrap: "wrap" }}>
          <View style={{ backgroundColor: "#F3F4F6", borderRadius: rp(12), paddingVertical: rp(6), paddingHorizontal: rp(12) }}>
            <Text style={{ fontSize: rs(12), fontWeight: "700", color: "#374151" }}>Zone {parkedCarInfo?.zone}</Text>
          </View>
          <View style={{ backgroundColor: "#F3F4F6", borderRadius: rp(12), paddingVertical: rp(6), paddingHorizontal: rp(12) }}>
            <Text style={{ fontSize: rs(12), fontWeight: "700", color: "#374151" }}>Slot {parkedCarInfo?.slot}</Text>
          </View>
          {(parkedCarInfo?.key_tag_number || parkedCarInfo?.key_tag) && (
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", paddingHorizontal: rp(12), paddingVertical: rp(8), borderRadius: rp(8) }}>
              <Ionicons name="pricetag" size={16} color="#4B5563" style={{ marginRight: rp(8) }} />
              <Text style={{ fontSize: rs(12), fontWeight: "700", color: "#374151" }}>Key Tag #{parkedCarInfo?.key_tag_number || parkedCarInfo?.key_tag}</Text>
            </View>
          )}
        </View>
        <Btn variant="outline" style={{ marginBottom: rp(12) }} onPress={() => {
          setShowParkSuccessModal(false);
          setDismissingParkSuccess(false);
          router.push({ pathname: "/(driver)/(tabs)/qr", params: { token: parkedCarInfo?.qr_token, plate: parkedCarInfo?.plate, code: parkedCarInfo?.checkin_code, mode: "park", keyTagNumber: parkedCarInfo?.key_tag_number || parkedCarInfo?.key_tag } });
        }}>Show QR Code</Btn>
        <Btn variant="primary" disabled={dismissingParkSuccess} onPress={async () => {
          setDismissingParkSuccess(true);
          await new Promise(r => setTimeout(r, 600));
          setShowParkSuccessModal(false);
          setDismissingParkSuccess(false);
          setParkedCarInfo(null);
        }}>Done</Btn>
      </Modal>

      {/* Incoming Request Full Screen */}
      <Modal open={!!incomingRequest} onClose={dismissIncomingRequest} title="">
        <View style={{ alignItems: "center", marginBottom: rp(24) }}>
          <Text style={{ fontSize: rs(20), fontWeight: "900", color: "#111827", textAlign: "center", marginBottom: rp(24) }}>New Retrieval Request</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: rp(24), marginBottom: rp(16), marginTop: rp(12) }}>
            <Plate value={incomingRequest?.plate} style={{ transform: [{ scale: 1.5 }] }} />
          </View>
          {(incomingRequest?.key_tag_number || incomingRequest?.key_tag) && (
            <View style={{ backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: rp(16), paddingVertical: rp(8), borderRadius: rp(12), marginBottom: rp(16) }}>
              <Text style={{ fontSize: rs(18), fontWeight: "900", color: theme.colors.primary }}>
                Key Tag #{incomingRequest?.key_tag_number || incomingRequest?.key_tag}
              </Text>
            </View>
          )}
          <Text style={{ fontSize: rs(16), color: "#6B7280", textAlign: "center", marginBottom: rp(16) }}>{incomingRequest?.color} {incomingRequest?.make}</Text>
        </View>

        {(incomingRequest?.zone || incomingRequest?.slot) && (
          <Card style={{ marginBottom: rp(24), backgroundColor: "#F3F4F6", alignItems: "center" }}>
            <Text style={{ fontSize: rs(14), fontWeight: "700", color: "#374151" }}>Zone {incomingRequest?.zone} · Slot {incomingRequest?.slot}</Text>
          </Card>
        )}

        {incomingRequest?.notes && (
          <View style={{ backgroundColor: "#FEF3C7", borderRadius: rp(12), padding: rp(12), marginBottom: rp(24) }}>
            <Text style={{ color: "#92400E", fontSize: rs(13), fontWeight: "600", textAlign: "center" }}>{incomingRequest.notes}</Text>
          </View>
        )}

        <View style={{ gap: rp(12) }}>
          <Btn variant="accent" disabled={!!pickingUp[incomingRequest?.id]} onPress={() => { if (incomingRequest) acceptRetrieval(incomingRequest, { fromIncomingRequest: true }); }}>
            {pickingUp[incomingRequest?.id] ? "Accepting..." : "ACCEPT"}
          </Btn>
          <Btn variant="outline" disabled={!!pickingUp[incomingRequest?.id]} onPress={() => {
            if (!incomingRequest) return;
            incomingRequests.seenRequestIdsRef.current.add(String(incomingRequest.id));
            dismissIncomingRequest();
          }}>
            SKIP
          </Btn>
        </View>
      </Modal>
    </Screen>
  );
}
