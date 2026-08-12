// version 3
import { configureBackgroundAudio } from "../../lib/audio";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from "expo-av";
import { confirmDialog } from "../../lib/confirmDialog";
import { Vibration } from "react-native";
import * as Location from "expo-location";
import { Linking } from "react-native";
import { useEffect, useState, useCallback, useRef } from "react";
import { rs, rp } from '../../utils/responsive';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Platform,
  BackHandler,
  KeyboardAvoidingView,
  AppState,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import NetInfo from "@react-native-community/netinfo";
import api from "../../lib/api";
import { useAppStore } from "../../lib/store";
import { connectWS, disconnectWS } from "../../lib/websocket";
import { enqueueHandover, getQueueCount, processPendingQueue, enqueueParkAction, getQueueSummary, getFailedQueue } from "../../lib/offline";
import { stopLocationTracking, updateJourney, checkEventStatusAndStop, isJourneyAccepted, markJourneyAccepted } from "../../lib/locationTracking";

const cardShadow = {
  shadowColor: "#059669",
  shadowOpacity: 0.08,
  shadowRadius: rp(16),
  shadowOffset: { width: 0, height: rp(4) },
  elevation: 4,
};



export default function Tasks() {
  const insets = useSafeAreaInsets();

  const router = useRouter();
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const backAction = () => {
      if (incomingRequest) { setIncomingRequest(null); return true; }
      if (showSOSModal) { setShowSOSModal(false); return true; }
      if (showParkModal) { setShowParkModal(false); return true; }
      router.back(); return true;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [showSOSModal, showParkModal, incomingRequest]);
  const { driver, currentEventId } = useAppStore();
  const resolvedDriverId = driver?.id;
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [requestQueue, setRequestQueue] = useState([]);
  const seenRequestIdsRef = useRef(new Set());
  const requestSoundRef = useRef(null);
  const hasSeededSeenRef = useRef(false);

  const [tab, setTab] = useState("mycars");
  const [cars, setCars] = useState([]);
  const [acceptedCarIds, setAcceptedCarIds] = useState(new Set());
  const [acceptingCarId, setAcceptingCarId] = useState(null);
  const [retrievals, setRetrievals] = useState([]);
  const [showParkModal, setShowParkModal] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);
  const [eventZones, setEventZones] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [handoverUploading, setHandoverUploading] = useState(false);
  const [queueSummary, setQueueSummary] = useState({ checkin: 0, park: 0, handover: 0, total: 0 });
  const [openingParkModal, setOpeningParkModal] = useState(null); // stores car.id while loading
  const [confirmingPark, setConfirmingPark] = useState(false);
  const [dismissingParkSuccess, setDismissingParkSuccess] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [keyTag, setKeyTag] = useState("");
  const [parkPhotos, setParkPhotos] = useState([]);
  const [loadingPhotoIdx, setLoadingPhotoIdx] = useState(null);
  const [parkingPhotoStep, setParkingPhotoStep] = useState(false);
  const [takingParkPhoto, setTakingParkPhoto] = useState(false);
  const [showParkSuccessModal, setShowParkSuccessModal] = useState(false);
  const [parkedCarInfo, setParkedCarInfo] = useState(null); // { plate, zone, slot, key_tag_number, qr_token }

  const [showSOSModal, setShowSOSModal] = useState(false);
  const [sosAlertType, setSOSAlertType] = useState("NEED_HELP");
  const [sosNote, setSosNote] = useState("");
  const [sosCarId, setSosCarId] = useState(null);
  const [sosCarNumber, setSosCarNumber] = useState("");
  const [sendingSOS, setSendingSOS] = useState(false);
  const [sosPhoto, setSosPhoto] = useState(null);

  const [capturedGPS, setCapturedGPS] = useState(null);
  const [capturingGPS, setCapturingGPS] = useState(false);
  const [otpInput, setOtpInput] = useState({});
  const [verifyingOtp, setVerifyingOtp] = useState({});
  const [arrivingAtGate, setArrivingAtGate] = useState(null);
  const [pickingUp, setPickingUp] = useState({});
  const [skipping, setSkipping] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const retrievalsRef = useRef([]);
  const lastExpiryRefetchRef = useRef(0);
  const resizedParkPhotosRef = useRef({});

  useEffect(() => {
    retrievalsRef.current = retrievals;
  }, [retrievals]);

  const retrievalRequested = retrievals.filter((c) => c.status === "RETRIEVAL_REQUESTED").length;

  useEffect(() => {
    if (retrievalRequested > 0) {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(blinkAnim, { toValue: 0.2, duration: 400, useNativeDriver: true }),
            Animated.timing(blinkAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(scaleAnim, { toValue: 1.2, duration: 400, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          ]),
        ])
      ).start();
    } else {
      blinkAnim.stopAnimation();
      blinkAnim.setValue(1);
      scaleAnim.stopAnimation();
      scaleAnim.setValue(1);
    }
  }, [retrievalRequested]);

  useEffect(() => {
    configureBackgroundAudio();
  }, []);

  useEffect(() => {
    let timeout;
    if (incomingRequest) {
      Vibration.vibrate([500, 500], true);
      (async () => {
        try {
          const { sound } = await Audio.Sound.createAsync(
            require("../../assets/sounds/trip-request.mp3"),
            { isLooping: true }
          );
          requestSoundRef.current = sound;
          await sound.playAsync();
        } catch (e) {
          console.warn("Failed to play trip-request audio", e);
        }
      })();
      timeout = setTimeout(() => {
        setIncomingRequest(null);
      }, 18000);
    } else {
      Vibration.cancel();
      if (requestSoundRef.current) {
        requestSoundRef.current.stopAsync().then(() => requestSoundRef.current.unloadAsync()).catch(() => {});
        requestSoundRef.current = null;
      }
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [incomingRequest]);

  useEffect(() => {
    if (incomingRequest === null && requestQueue.length > 0) {
      const [next, ...rest] = requestQueue;
      setIncomingRequest(next);
      setRequestQueue(rest);
    }
  }, [requestQueue, incomingRequest]);

  const maybeQueueNewRequest = useCallback((car) => {
    if (!car) return;

    const carData = car.car || car;
    const carId = carData.id ? String(carData.id) : null;

    if (!carId) return;
    if (carData.status !== "RETRIEVAL_REQUESTED" || carData.retrieval_driver_id) return;

    // Block if already in seen set
    if (seenRequestIdsRef.current.has(carId)) return;

    // Block if currently active on screen
    if (incomingRequest && String(incomingRequest.id) === carId) return;

    seenRequestIdsRef.current.add(carId);

    // Deduplicate state queue
    setRequestQueue((prev) => {
      if (prev.some((item) => String(item.id) === carId)) return prev;
      return [...prev, carData];
    });
  }, [incomingRequest]);

  const fetchMyCars = useCallback(async () => {
    try {
      const { data } = await api.get(`/cars/event/${currentEventId}`, {
        params: {
          driver_id: resolvedDriverId,
          status: "CHECKED_IN,PARKED",
        },
      });
      // TODO: remove client-side filter once backend supports driver_id + status query params
      const myCars = (data || []).filter(
        (c) => c.check_in_driver_id === resolvedDriverId && ["CHECKED_IN", "PARKED"].includes(c.status)
      );
      setCars(myCars);
      const checkedInIds = myCars.filter(c => c.status === "CHECKED_IN").map(c => c.id);
      const accepted = await Promise.all(checkedInIds.map(id => isJourneyAccepted(id)));
      setAcceptedCarIds(prev => {
        const next = new Set(prev);
        checkedInIds.forEach((id, i) => { if (accepted[i]) next.add(id); });
        return next;
      });
    } catch { }
  }, [currentEventId, resolvedDriverId]);

  const fetchRetrievals = useCallback(async () => {
    try {
      const { data } = await api.get(`/retrievals/event/${currentEventId}`);
      const fetchedCars = data || [];
      setRetrievals(fetchedCars);
      if (!hasSeededSeenRef.current) {
        fetchedCars.forEach((car) => {
          if (car.status === "RETRIEVAL_REQUESTED" && car.id) {
            seenRequestIdsRef.current.add(String(car.id));
          }
        });
        hasSeededSeenRef.current = true;
      } else {
        fetchedCars.forEach((car) => maybeQueueNewRequest(car));
      }
    } catch { }
  }, [currentEventId, maybeQueueNewRequest]);

  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setNowTick(now);

      // If any car's gate timer has expired locally, the backend should be
      // flipping it to AWAITING_REPARK shortly — actively refetch instead of
      // waiting on a WebSocket push, so the re-park button shows up on its own.
      const hasExpiredGateTimer = retrievalsRef.current.some(
        (car) =>
          car.status === "ARRIVED_AT_GATE" &&
          car.gate_timer_expires_at &&
          new Date(car.gate_timer_expires_at).getTime() <= now
      );
      if (hasExpiredGateTimer && now - lastExpiryRefetchRef.current > 4000) {
        lastExpiryRefetchRef.current = now;
        fetchRetrievals();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [fetchRetrievals]);

  // If the guest recalls the car while we're mid-re-park (park modal open),
  // the backend flips this car's status away from AWAITING_REPARK. Catch
  // that and bounce out of the park flow automatically — the driver just
  // needs to bring the car back to the gate, not finish parking it.
  useEffect(() => {
    if (!showParkModal || !selectedCar) return;
    const liveCar = retrievals.find((c) => c.id === selectedCar.id);
    if (liveCar && liveCar.status !== "AWAITING_REPARK") {
      setShowParkModal(false);
      setParkPhotos([]);
      setParkingPhotoStep(false);
      setSelectedSlot(null);
      confirmDialog.info(
        "Guest is back at the gate!",
        `${selectedCar.plate} — bring the car back to the gate instead. No need to re-park it.`
      );
    }
  }, [retrievals, showParkModal, selectedCar]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchMyCars(), fetchRetrievals()]);
    setRefreshing(false);
  }, [fetchMyCars, fetchRetrievals]);

  const refreshPending = async () => {
    const summary = await getQueueSummary();
    setQueueSummary(summary);
    setPendingCount(summary.total);
    const failed = await getFailedQueue();
    setFailedCount(failed.length);
  };

  const fetchMyCarsRef = useRef(fetchMyCars);
  const fetchRetrievalsRef = useRef(fetchRetrievals);
  const fetchEventRef = useRef(fetchEvent);
  const maybeQueueNewRequestRef = useRef(maybeQueueNewRequest);
  
  useEffect(() => { fetchMyCarsRef.current = fetchMyCars; }, [fetchMyCars]);
  useEffect(() => { fetchRetrievalsRef.current = fetchRetrievals; }, [fetchRetrievals]);
  useEffect(() => { fetchEventRef.current = fetchEvent; }, [fetchEvent]);
  useEffect(() => { maybeQueueNewRequestRef.current = maybeQueueNewRequest; }, [maybeQueueNewRequest]);

  useEffect(() => {
    if (!currentEventId) return;
    api.post(`/slots/event/${currentEventId}/initialize`).catch(() => { });
    fetchEventRef.current();
    Promise.all([fetchMyCarsRef.current(), fetchRetrievalsRef.current()]);
    refreshPending();
    connectWS(`/event/${currentEventId}`, (msg) => {
      if (msg.type === "car_update") fetchMyCarsRef.current();
      if (msg.type === "slot_update") fetchSlots();
    });
    connectWS(`/retrievals/${currentEventId}`, (msg) => {
      if (msg.type === "retrieval_update") {
        if (msg.data) {
          const carId = String((msg.data.car || msg.data).id);
          const status = (msg.data.car || msg.data).status;
          if (status !== "RETRIEVAL_REQUESTED") {
            seenRequestIdsRef.current.delete(carId);
            setRequestQueue((prev) => prev.filter((item) => String(item.id) !== carId));
          }
          if (!["RETRIEVAL_REQUESTED", "BEING_FETCHED", "ARRIVED_AT_GATE", "AWAITING_REPARK"].includes(status)) {
            setRetrievals(prev => prev.filter(c => String(c.id) !== carId));
          } else {
            setRetrievals(prev => prev.map(c => String(c.id) === carId ? { ...c, ...(msg.data.car || msg.data) } : c));
          }
          maybeQueueNewRequestRef.current(msg.data);
        }
        fetchRetrievalsRef.current();
      }
    });

    const appStateSub = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        disconnectWS(`/event/${currentEventId}`);
        disconnectWS(`/retrievals/${currentEventId}`);
        connectWS(`/event/${currentEventId}`, (msg) => {
          if (msg.type === "car_update") fetchMyCarsRef.current();
          if (msg.type === "slot_update") fetchSlots();
        });
        connectWS(`/retrievals/${currentEventId}`, (msg) => {
          if (msg.type === "retrieval_update") {
            if (msg.data) {
              const carId = String((msg.data.car || msg.data).id);
              const status = (msg.data.car || msg.data).status;
              if (status !== "RETRIEVAL_REQUESTED") {
                seenRequestIdsRef.current.delete(carId);
                setRequestQueue((prev) => prev.filter((item) => String(item.id) !== carId));
              }
              if (!["RETRIEVAL_REQUESTED", "BEING_FETCHED", "ARRIVED_AT_GATE", "AWAITING_REPARK"].includes(status)) {
                setRetrievals(prev => prev.filter(c => String(c.id) !== carId));
              } else {
                setRetrievals(prev => prev.map(c => String(c.id) === carId ? { ...c, ...(msg.data.car || msg.data) } : c));
              }
              maybeQueueNewRequestRef.current(msg.data);
            }
            fetchRetrievalsRef.current();
          }
        });
        Promise.all([fetchMyCarsRef.current(), fetchRetrievalsRef.current()]);
      }
    });

    const pollRetrievalsInterval = setInterval(() => fetchRetrievalsRef.current(), 15000);

    const unsub = NetInfo.addEventListener(async (state) => {
      if (state.isConnected) {
        await processPendingQueue();
        refreshPending();
      }
    });

    const notifSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.screen === 'retrievals') {
        setTab('retrievals');
        fetchRetrievals();
      }
    });

    const eventStatusInterval = setInterval(async () => {
      const stillActive = await checkEventStatusAndStop();
      if (!stillActive) {
        clearInterval(eventStatusInterval);
        confirmDialog.info(
          "Event closed",
          "This event has been closed. Location tracking has stopped.",
          () => router.back()
        );
      }
    }, 60000);

    return () => {
      clearInterval(eventStatusInterval);
      clearInterval(pollRetrievalsInterval);
      appStateSub.remove();
      disconnectWS(`/event/${currentEventId}`);
      disconnectWS(`/retrievals/${currentEventId}`);
      unsub();
      notifSub.remove();
      Vibration.cancel();
      if (requestSoundRef.current) {
        requestSoundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, [currentEventId]);

  const fetchEvent = useCallback(async () => {
    try {
      const evRes = await api.get(`/events/${currentEventId}`);
      setEventZones(evRes.data.zones || []);
      if (evRes.data.zones?.[0]) setSelectedZone(evRes.data.zones[0].name);

    } catch { }
  }, [currentEventId]);

  const fetchSlots = async () => {
    try {
      const { data } = await api.get(`/slots/event/${currentEventId}`);
      setSlots(data || []);
    } catch { }
  };

  const sendSOS = async () => {
    if (!currentEventId) return;
    setSendingSOS(true);
    try {
      let uploadUrl = null;
      if (sosPhoto) {
        try {
          const fd = new FormData();
          fd.append("file", { uri: sosPhoto, type: "image/jpeg", name: "sos.jpg" });
          fd.append("folder", `sos/${currentEventId}`);
          const { data: uploadData } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
          uploadUrl = uploadData?.url || null;
        } catch (uploadErr) {
          console.warn("SOS photo upload failed", uploadErr);
        }
      }

      await api.post(`/sos/event/${currentEventId}`, {
        alert_type: sosAlertType,
        note: sosNote,
        car_id: sosCarId,
        car_number: sosCarNumber,
        photo_url: uploadUrl,
      });

      setShowSOSModal(false);
      setSosNote("");
      setSosPhoto(null);
      setSosCarId(null);
      setSosCarNumber("");
      
      if (sosPhoto && !uploadUrl) {
        confirmDialog.info("Photo upload failed", "Your SOS was sent, but the photo did not attach. Please inform your supervisor.");
      } else {
        confirmDialog.info("SOS sent", "Your supervisor has been notified.");
      }
    } catch {
      confirmDialog.info("Error", "Failed to send SOS. Please try again.");
    } finally {
      setSendingSOS(false);
    }
  };

  const takeSosPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5,
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled) setSosPhoto(result.assets[0].uri);
  };

  const captureGPSPin = async () => {
    setCapturingGPS(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        confirmDialog.info("Permission denied", "Location permission is needed to save GPS pin.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCapturedGPS({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      confirmDialog.info("Error", "Could not get GPS location. You can still park without it.");
    } finally {
      setCapturingGPS(false);
    }
  };

  const navigateToCar = async (carId) => {
    try {
      const { data } = await api.get(`/cars/${carId}/gps-pin`);
      if (!data.gps_lat || !data.gps_lng) {
        confirmDialog.info("No GPS pin", "This car does not have a GPS pin saved.");
        return;
      }
      const url = `https://www.google.com/maps?q=${data.gps_lat},${data.gps_lng}`;
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        confirmDialog.info("Error", "Could not open Google Maps.");
      }
    } catch {
      confirmDialog.info("Error", "Failed to get car location.");
    }
  };



  const openParkModal = async (car) => {
    setOpeningParkModal(car.id);
    setSelectedCar(car);
    setSelectedSlot(null);
    setSlots([]);
    setShowParkModal(true);
    await fetchEvent();
    await fetchSlots();
    setOpeningParkModal(null);
  };

  const confirmPark = async () => {
    if (!selectedSlot) return;

    if (parkPhotos.length === 0) {
      confirmDialog.info("Photo required", "Please take at least one parking photo before confirming.");
      return;
    }

    confirmDialog.confirm(
      "Confirm parking",
      `Confirm parking ${selectedCar?.plate} in Zone ${selectedZone}, Slot ${selectedSlot}?`,
      () => doConfirmPark()
    );
  };

  const doConfirmPark = async () => {
    setConfirmingPark(true);
    try {
      const net = await NetInfo.fetch();

      if (!net.isConnected) {
        // OFFLINE: copy photos first (needed for queue)
        const photoLocalPaths = [];
        for (let i = 0; i < parkPhotos.length; i++) {
          const sourceUri = resizedParkPhotosRef.current[parkPhotos[i]] || parkPhotos[i];
          const localPath = `${FileSystem.documentDirectory}park_${selectedCar.id}_${i}_${Date.now()}.jpg`;
          await FileSystem.copyAsync({ from: sourceUri, to: localPath });
          photoLocalPaths.push(localPath);
        }
        await enqueueParkAction(selectedCar.id, { zone: selectedZone, slot: selectedSlot, parkedDriverId: resolvedDriverId, photoLocalPaths });
        setParkedCarInfo({ plate: selectedCar.plate, zone: selectedZone, slot: selectedSlot, key_tag_number: selectedCar.key_tag_number, qr_token: selectedCar.qr_token });
        setShowParkSuccessModal(true);
        setShowParkModal(false);
        setParkPhotos([]);
        setParkingPhotoStep(false);
        refreshPending();
        confirmDialog.info("Saved offline", "Parking recorded. Will sync when connected.");
        return;
      }

      // ONLINE: go straight to API — no photo copying needed before this
      const snapshotUris = [...parkPhotos]; // snapshot current URIs before state is cleared
      await api.patch(`/cars/${selectedCar.id}/park`, {
        zone: selectedZone,
        slot: selectedSlot,
        parked_driver_id: resolvedDriverId,
        gps_lat: capturedGPS?.lat || null,
        gps_lng: capturedGPS?.lng || null,
      });
      await updateJourney(selectedCar.id, "parked");

      const carId = selectedCar.id;
      setParkedCarInfo({ plate: selectedCar.plate, zone: selectedZone, slot: selectedSlot, key_tag_number: selectedCar.key_tag_number, qr_token: selectedCar.qr_token });
      setShowParkSuccessModal(true);
      setShowParkModal(false);
      setParkPhotos([]);
      setParkingPhotoStep(false);
      Promise.all([fetchMyCars(), fetchRetrievals()]);
      setCapturedGPS(null);

      // Fire-and-forget: copy + upload photos after driver has moved on
      (async () => {
        try {
          const photoLocalPaths = [];
          for (let i = 0; i < snapshotUris.length; i++) {
            const sourceUri = resizedParkPhotosRef.current[snapshotUris[i]] || snapshotUris[i];
            const localPath = `${FileSystem.documentDirectory}park_${carId}_${i}_${Date.now()}.jpg`;
            await FileSystem.copyAsync({ from: sourceUri, to: localPath });
            photoLocalPaths.push(localPath);
          }
          await uploadParkPhotosInBackground(carId, photoLocalPaths);
        } catch {}
      })();
    } catch (e) {
      confirmDialog.info("Error", e.response?.data?.detail || "Failed to park");
    } finally {
      setConfirmingPark(false);
    }
  };

  const pickup = async (car) => {
    confirmDialog.confirm(
      "Pick up this car?",
      `Confirm you're picking up ${car.plate}.`,
      () => doPickup(car)
    );
  };

  const doPickup = async (car) => {
    setPickingUp((prev) => ({ ...prev, [car.id]: true }));
    try {
      await api.patch(`/cars/${car.id}/pickup`, { retrieval_driver_id: resolvedDriverId });
      await updateJourney(car.id, "retrieval");
      fetchRetrievals();
    } catch (e) {
      confirmDialog.info("Error", e.response?.data?.detail || "Failed");
    } finally {
      setPickingUp((prev) => ({ ...prev, [car.id]: false }));
    }
  };

  const arriveAtGate = async (car) => {
    confirmDialog.confirm(
      "Arrive at gate",
      `Mark arrived at gate for ${car.plate}?`,
      () => doArriveAtGate(car)
    );
  };

  const doArriveAtGate = async (car) => {
    setArrivingAtGate(car.id);
    try {
      await api.patch(`/cars/${car.id}/arrive-at-gate`);
      fetchRetrievals();
    } catch (e) {
      confirmDialog.info("Error", e.response?.data?.detail || "Could not mark arrived at gate");
    } finally {
      setArrivingAtGate(null);
    }
  };

  const verifyDeliveryOtp = async (car) => {
    const code = (otpInput[car.id] || "").trim();
    if (!code) { confirmDialog.info("Enter the code", "Ask the guest for their code and enter it."); return; }
    confirmDialog.confirm(
      "Confirm handover",
      `Confirm handover code for ${car.plate}?`,
      () => doVerifyDeliveryOtp(car, code)
    );
  };

  const doVerifyDeliveryOtp = async (car, code) => {
    setVerifyingOtp((prev) => ({ ...prev, [car.id]: true }));
    try {
      await api.post(`/cars/${car.id}/verify-delivery-otp`, { otp: code });
      fetchRetrievals();
    } catch (e) {
      confirmDialog.info("Incorrect code", e.response?.data?.detail || "Could not verify code");
    } finally {
      setVerifyingOtp((prev) => ({ ...prev, [car.id]: false }));
    }
  };

  const uploadHandoverInBackground = async (carId, uri) => {
    try {
      const formData = new FormData();
      formData.append("file", { uri, type: "image/jpeg", name: "handover.jpg" });
      formData.append("folder", `handover/${carId}`);
      const up = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await api.patch(`/cars/${carId}/update-photo`, {
        delivery_photo_url: up.data.url,
      });
    } catch { }
  };

  const takeParkPhoto = async () => {
    if (parkPhotos.length >= 5) {
      confirmDialog.info("Max 5 photos", "Maximum 5 parking photos allowed");
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      confirmDialog.info("Permission needed", "Camera access required");
      return;
    }
    setTakingParkPhoto(true);
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5,
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    setTakingParkPhoto(false);
    if (!result.canceled) {
      const rawUri = result.assets[0].uri;
      setParkPhotos((prev) => {
        const next = [...prev, rawUri];
        setLoadingPhotoIdx(next.length - 1);
        return next;
      });
      ImageManipulator.manipulateAsync(rawUri, [{ resize: { width: 1280 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG })
        .then((resized) => { resizedParkPhotosRef.current[rawUri] = resized.uri; })
        .catch(() => { resizedParkPhotosRef.current[rawUri] = rawUri; });
    }
  };

  const uploadParkPhotosInBackground = async (carId, photoUris) => {
    try {
      const urls = [];
      for (const uri of photoUris) {
        const fd = new FormData();
        fd.append("file", { uri, type: "image/jpeg", name: "parked.jpg" });
        fd.append("folder", `parked/${carId}`);
        const up = await api.post("/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        urls.push(up.data.url);
      }
      if (urls.length > 0) {
        await api.post(`/cars/${carId}/photos`, {
          urls,
          type: "parked",
        });
        // Store first photo as parked_photo_url on the car record
        await api.patch(`/cars/${carId}/park-photo`, {
          parked_photo_url: urls[0],
        });
      }
    } catch { }
  };

  const handleHandover = async (car) => {
    if (handoverUploading) return; // guard against a second tap while the first is still in flight
    setHandoverUploading(true);

    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setHandoverUploading(false);
      confirmDialog.info("Camera permission needed");
      return;
    }


    let result;
    try {
      result = await ImagePicker.launchCameraAsync({ 
        mediaTypes: ImagePicker.MediaTypeOptions.Images, 
        quality: 0.5, 
        allowsEditing: false 
      });
    } catch (e) {
      setHandoverUploading(false);
      confirmDialog.info("Camera error", "Could not open camera. Please try again.");
      return;
    }

    if (result.canceled) {
      setHandoverUploading(false);  // driver cancelled — reset loader
      return;
    }
    const rawUri = result.assets[0].uri;
    let finalUri = rawUri;
    try {
      const resized = await ImageManipulator.manipulateAsync(rawUri, [{ resize: { width: 1280 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
      finalUri = resized.uri;
    } catch {
      // fall back to the original full-size photo if resize fails
    }
    doHandleHandover(car, finalUri);
  };

  const doHandleHandover = async (car, finalUri) => {
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      const localPath = `${FileSystem.documentDirectory}handover_${car.id}_${Date.now()}.jpg`;
      try {
        await FileSystem.copyAsync({ from: finalUri, to: localPath });
        await enqueueHandover(car.id, localPath);
        await refreshPending();
        confirmDialog.info("Saved offline", "Photo saved. Will upload when connected.");
      } catch (e) { confirmDialog.info("Error", "Failed to save offline"); }
      setHandoverUploading(false);
      return;
    }
    try {
      // Step 1: Compress image first (faster upload)
      let uploadUri = finalUri;
      try {
        const compressed = await ImageManipulator.manipulateAsync(
          finalUri,
          [{ resize: { width: 1280 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
        );
        uploadUri = compressed.uri;
      } catch { uploadUri = finalUri; }

      // Step 2: Mark car as DELIVERED immediately without waiting for photo upload
      await api.patch(`/cars/${car.id}/deliver`, { delivery_photo_url: "" });

      // Step 3: Driver is done — clear loader and refresh list immediately
      setHandoverUploading(false);
      fetchRetrievals();

      // Step 4: Upload photo in background — patch delivery_photo_url once done
      // This runs after driver has already moved on
      (async () => {
        try {
          const formData = new FormData();
          formData.append("file", { uri: uploadUri, type: "image/jpeg", name: "handover.jpg" });
          formData.append("folder", `handover/${car.id}`);
          const up = await api.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
          const photoUrl = up.data.url;
          await api.patch(`/cars/${car.id}/update-delivery-photo`, { delivery_photo_url: photoUrl }).catch(() => { });
        } catch { }
      })();

    } catch (e) {
      confirmDialog.info("Handover failed", e.response?.data?.detail || "Could not complete handover. Try again.");
      setHandoverUploading(false);
    } finally {
      await updateJourney(null, "idle"); // always clear journey context, even if delivery fails
    }
  };


  return (
    <View style={{ flex: 1, backgroundColor: "#ECFDF5" }} testID="tasks-screen">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#059669" }}>
        <View
          style={{
            backgroundColor: "#059669",
            borderBottomLeftRadius: rp(44),
            borderBottomRightRadius: rp(44),
            paddingHorizontal: rp(20),
            paddingTop: rp(8),
            paddingBottom: rp(18),
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(8,145,178,0.5)",
              borderBottomLeftRadius: rp(44),
              borderBottomRightRadius: rp(44),
            }}
          />
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(8) }}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: rs(20), fontWeight: "900", flex: 1, textAlign: "center", marginRight: rp(40) }}>
              My Tasks
            </Text>
          </View>

        </View>
      </SafeAreaView>

      {/* Tab pill */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#fff",
          marginHorizontal: rp(16),
          marginTop: rp(10),
          borderRadius: rp(20),
          padding: rp(4),
          ...cardShadow,
        }}
      >
        <TouchableOpacity
          onPress={() => setTab("mycars")}
          activeOpacity={0.7}
          style={{
            flex: 1,
            paddingVertical: rp(10),
            borderRadius: rp(16),
            backgroundColor: tab === "mycars" ? "#059669" : "transparent",
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "800", fontSize: rs(13), color: tab === "mycars" ? "#fff" : "#6B7280", letterSpacing: rs(1) }}>My Cars</Text>
        </TouchableOpacity>
        <Animated.View style={{
          flex: 1,
          transform: [{ scale: retrievalRequested > 0 ? scaleAnim : 1 }],
          ...(retrievalRequested > 0 ? {
            shadowColor: "#F43F5E",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.7,
            shadowRadius: 8,
            elevation: 10,
          } : {})
        }}>
          <TouchableOpacity
            onPress={() => setTab("retrievals")}
            activeOpacity={0.7}
            style={{
              flex: 1,
              paddingVertical: rp(10),
              borderRadius: rp(16),
              backgroundColor: tab === "retrievals" ? "#059669" : "transparent",
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ fontWeight: "800", fontSize: rs(13), color: tab === "retrievals" ? "#fff" : "#6B7280", letterSpacing: rs(1) }}>Retrievals</Text>
            {retrievalRequested > 0 && (
              <Animated.View style={{
                backgroundColor: "#F43F5E",
                borderRadius: rp(99),
                paddingHorizontal: rp(7),
                marginLeft: rp(6),
                opacity: blinkAnim,
                transform: [{ scale: scaleAnim }]
              }}>
                <Text style={{ color: "#fff", fontSize: rs(11), fontWeight: "900" }}>{retrievalRequested}</Text>
              </Animated.View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "center", marginHorizontal: rp(16), marginTop: rp(12) }}>
        <TouchableOpacity
          onPress={() => router.push("/(driver)/scan-qr-card")}
          testID="add-checkin-btn"
          activeOpacity={0.85}
          style={{ flex: 1, justifyContent: "center", backgroundColor: "#fff", borderRadius: rp(16), paddingHorizontal: rp(12), paddingVertical: rp(14), alignItems: "center", flexDirection: "row", ...cardShadow }}
        >
          <Ionicons name="add" size={20} color="#059669" />
          <Text style={{ color: "#059669", fontWeight: "800", fontSize: rs(13), marginLeft: rp(4) }}>Check In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowSOSModal(true)}
          activeOpacity={0.85}
          style={{ flex: 1, justifyContent: "center", backgroundColor: "#DC2626", borderRadius: rp(16), paddingHorizontal: rp(12), paddingVertical: rp(14), alignItems: "center", flexDirection: "row", marginLeft: rp(10), ...cardShadow }}
        >
          <Ionicons name="warning" size={18} color="white" />
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: rs(13), marginLeft: rp(4) }}>SOS</Text>
        </TouchableOpacity>
      </View>

      {failedCount > 0 && (
        <TouchableOpacity onPress={() => router.push("/(driver)/failed-syncs")}>
          <View
            style={{
              backgroundColor: "#FEE2E2",
              padding: rp(12),
              marginHorizontal: rp(16),
              marginTop: rp(8),
              borderRadius: rp(14),
              borderWidth: rp(1),
              borderColor: "#FCA5A5",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons name="warning" size={16} color="#B91C1C" />
            <Text style={{ color: "#B91C1C", fontSize: rs(12), fontWeight: "700", marginLeft: rp(8), flex: 1 }}>
              {failedCount} sync failure(s) — these check-ins could not be uploaded. Tell your supervisor.
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {pendingCount > 0 && (
        <View
          style={{
            backgroundColor: "#FEF3C7",
            paddingHorizontal: rp(14),
            paddingVertical: rp(10),
            marginHorizontal: rp(16),
            marginTop: rp(12),
            borderRadius: rp(14),
            borderWidth: rp(1),
            borderColor: "#F59E0B",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Ionicons name="cloud-offline" size={16} color="#92400E" />
          <Text style={{ color: "#92400E", fontSize: rs(12), fontWeight: "700", marginLeft: rp(8) }}>
            {[
              queueSummary.checkin ? `${queueSummary.checkin} check-in(s)` : null,
              queueSummary.park ? `${queueSummary.park} parking` : null,
              queueSummary.handover ? `${queueSummary.handover} handover(s)` : null,
            ].filter(Boolean).join(" · ")} pending — will sync when online
          </Text>
        </View>
      )}

      <ScrollView
        style={{ flex: 1, paddingHorizontal: rp(16), paddingTop: rp(14) }}
        contentContainerStyle={{ paddingBottom: rp(100) }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" colors={["#059669"]} />
        }
      >
        {tab === "mycars" && cars.length === 0 && (
          <View style={{ alignItems: "center", marginTop: rp(60) }}>
            <Text style={{ fontSize: rs(64) }}>🚗</Text>
            <Text style={{ color: "#111827", fontWeight: "900", fontSize: rs(16), marginTop: rp(12) }}>No cars yet</Text>
            <Text style={{ color: "#6B7280", fontSize: rs(13), marginTop: rp(4) }}>Tap + to check in a vehicle</Text>
          </View>
        )}
        {tab === "mycars" && cars.map((car) => (
          <View
            key={car.id}
            style={{
              backgroundColor: "#fff",
              borderRadius: rp(24),
              padding: rp(18),
              marginBottom: rp(12),
              borderLeftWidth: rp(4),
              borderLeftColor: car.status === "PARKED" ? "#059669" : "#0EA5E9",
              ...cardShadow,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(18) }}>{car.plate}</Text>
                <Text style={{ color: "#6B7280", fontSize: rs(12), marginTop: rp(2) }}>{car.color} {car.make}</Text>
              </View>
              <View
                style={{
                  paddingHorizontal: rp(10),
                  paddingVertical: rp(3),
                  borderRadius: rp(99),
                  backgroundColor: car.status === "PARKED" ? "#D1FAE5" : "#E0F2FE",
                }}
              >
                <Text
                  style={{
                    fontSize: rs(10),
                    fontWeight: "800",
                    letterSpacing: rs(1),
                    color: car.status === "PARKED" ? "#059669" : "#0284C7",
                  }}
                >
                  {car.status === "PARKED" ? "PARKED" : "CHECKED IN"}
                </Text>
              </View>
            </View>

            {car.status === "PARKED" ? (
              <View>
                <View
                  style={{
                    alignSelf: "flex-start",
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#ECFDF5",
                    paddingHorizontal: rp(10),
                    paddingVertical: rp(6),
                    borderRadius: rp(99),
                    marginTop: rp(10),
                  }}
                >
                  <Ionicons name="location" size={13} color="#059669" />
                  <Text style={{ color: "#059669", fontWeight: "800", fontSize: rs(12), marginLeft: rp(4) }}>
                    Zone {car.zone} · Slot {car.slot} · Key Tag #{car.key_tag_number}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: "/(driver)/qr-display", params: { token: car.qr_token, plate: car.plate } })}
                  style={{
                    borderWidth: rp(1.5),
                    borderColor: "#059669",
                    borderRadius: rp(14),
                    paddingVertical: rp(12),
                    alignItems: "center",
                    marginTop: rp(12),
                    flexDirection: "row",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="qr-code-outline" size={16} color="#059669" />
                  <Text style={{ color: "#059669", fontWeight: "900", fontSize: rs(12), marginLeft: rp(6), letterSpacing: rs(1.5) }}>
                    SHOW QR CODE
                  </Text>
                </TouchableOpacity>


                {car.notes ? (
                  <View style={{
                    backgroundColor: "#FEF3C7",
                    borderRadius: rp(10),
                    paddingHorizontal: rp(8),
                    paddingVertical: rp(5),
                    marginTop: rp(6),
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: rp(5),
                  }}>
                    <Ionicons name="information-circle-outline"
                      size={13} color="#D97706"
                      style={{ marginTop: rp(1) }} />
                    <Text style={{
                      color: "#92400E", fontSize: rs(11),
                      flex: 1, lineHeight: 16
                    }}>
                      {car.notes}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : !acceptedCarIds.has(car.id) ? (
              <TouchableOpacity
                onPress={async () => {
                  setAcceptingCarId(car.id);
                  try {
                    await updateJourney(car.id, "checkin");
                    await markJourneyAccepted(car.id);
                    setAcceptedCarIds(prev => new Set(prev).add(car.id));
                  } finally {
                    setAcceptingCarId(null);
                  }
                }}
                disabled={acceptingCarId === car.id}
                style={{
                  backgroundColor: "#0F2044",
                  borderRadius: rp(14),
                  paddingVertical: rp(14),
                  alignItems: "center",
                  marginTop: rp(12),
                  flexDirection: "row",
                  justifyContent: "center",
                }}
              >
                {acceptingCarId === car.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(12), marginLeft: rp(6), letterSpacing: rs(1.5) }}>ACCEPT</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: "row", gap: rp(8), marginTop: rp(12) }}>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: "/(driver)/qr-display", params: { token: car.qr_token, plate: car.plate } })}
                  style={{
                    flex: 1,
                    borderWidth: rp(1.5),
                    borderColor: "#059669",
                    borderRadius: rp(14),
                    paddingVertical: rp(12),
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="qr-code-outline" size={14} color="#059669" />
                  <Text style={{ color: "#059669", fontWeight: "900", fontSize: rs(11), marginLeft: rp(4), letterSpacing: rs(1) }}>QR CODE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => openParkModal(car)}
                  disabled={openingParkModal === car.id}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    backgroundColor: openingParkModal === car.id ? "#047857" : "#059669",
                    borderRadius: rp(14),
                    paddingVertical: rp(12),
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    opacity: openingParkModal === car.id ? 0.8 : 1,
                  }}
                >
                  {openingParkModal === car.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="location" size={14} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(11), marginLeft: rp(4), letterSpacing: rs(1) }}>MARK PARKED</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {(() => {
          // Once a car is claimed (self-service or supervisor-assigned), it's no longer
          // anyone else's business — only show it to the driver actually handling it.
          const visibleRetrievals = retrievals.filter(
            (car) => car.status === "RETRIEVAL_REQUESTED" || car.retrieval_driver_id === resolvedDriverId
          );
          return (
            <>
              {tab === "retrievals" && visibleRetrievals.length === 0 && (
                <View style={{ alignItems: "center", marginTop: rp(60) }}>
                  <Text style={{ fontSize: rs(64) }}>🔔</Text>
                  <Text style={{ color: "#111827", fontWeight: "900", fontSize: rs(16), marginTop: rp(12) }}>No retrieval requests</Text>
                  <Text style={{ color: "#6B7280", fontSize: rs(13), marginTop: rp(4) }}>You're all caught up!</Text>
                </View>
              )}
              {tab === "retrievals" && visibleRetrievals.map((car) => {
                const isMine = car.retrieval_driver_id === resolvedDriverId;
                let borderColor = "#9CA3AF";
                if (car.status === "RETRIEVAL_REQUESTED") borderColor = "#F59E0B";
                else if (car.status === "BEING_FETCHED" && isMine) borderColor = "#F97316";
                else if (car.status === "ARRIVED_AT_GATE" && isMine) borderColor = "#7C3AED";
                else if (car.status === "AWAITING_REPARK" && isMine) borderColor = "#DC2626";
                return (
                  <View
                    key={car.id}
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: rp(24),
                      padding: rp(18),
                      marginBottom: rp(12),
                      borderLeftWidth: rp(4),
                      borderLeftColor: borderColor,
                      ...cardShadow,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "900", color: "#111827", fontSize: rs(18) }}>{car.plate}</Text>
                        <Text style={{ color: "#6B7280", fontSize: rs(12), marginTop: rp(2) }}>{car.color} {car.make}</Text>
                        <View
                          style={{
                            alignSelf: "flex-start",
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: "#F3F4F6",
                            paddingHorizontal: rp(8),
                            paddingVertical: rp(3),
                            borderRadius: rp(99),
                            marginTop: rp(6),
                          }}
                        >
                          <Ionicons name="location-outline" size={11} color="#6B7280" />
                          <Text style={{ color: "#6B7280", fontSize: rs(11), fontWeight: "700", marginLeft: rp(4) }}>
                            Zone {car.zone} · Slot {car.slot} · Key Tag #{car.key_tag_number}
                          </Text>
                        </View>
                        {car.notes ? (
                          <View style={{
                            backgroundColor: "#FEF3C7",
                            borderRadius: rp(10),
                            paddingHorizontal: rp(8),
                            paddingVertical: rp(5),
                            marginTop: rp(6),
                            flexDirection: "row",
                            alignItems: "flex-start",
                            gap: rp(5),
                          }}>
                            <Ionicons name="information-circle-outline"
                              size={13} color="#D97706"
                              style={{ marginTop: rp(1) }} />
                            <Text style={{
                              color: "#92400E", fontSize: rs(11),
                              flex: 1, lineHeight: rp(16)
                            }}>
                              {car.notes}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View
                        style={{
                          paddingHorizontal: rp(10),
                          paddingVertical: rp(3),
                          borderRadius: rp(99),
                          backgroundColor: borderColor,
                        }}
                      >
                        <Text style={{ color: "#fff", fontSize: rs(10), fontWeight: "800", letterSpacing: rs(1) }}>
                          {car.status === "RETRIEVAL_REQUESTED" ? "REQUESTED" : car.status === "ARRIVED_AT_GATE" && isMine ? "AT GATE" : car.status === "AWAITING_REPARK" && isMine ? "RE-PARK NEEDED" : isMine ? "YOURS" : "OTHER"}
                        </Text>
                      </View>
                    </View>
                    {car.status === "RETRIEVAL_REQUESTED" && (
                      <>
                        <TouchableOpacity
                          onPress={() => pickup(car)}
                          disabled={pickingUp[car.id]}
                          style={{ backgroundColor: "#F59E0B", borderRadius: rp(14), paddingVertical: rp(12), alignItems: "center", marginTop: rp(12), flexDirection: "row", justifyContent: "center", opacity: pickingUp[car.id] ? 0.7 : 1 }}
                        >
                          {pickingUp[car.id] ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="hand-right" size={14} color="#fff" />
                              <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(12), marginLeft: rp(6), letterSpacing: rs(1.5) }}>PICK UP</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => navigateToCar(car.id)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            backgroundColor: "#EFF6FF",
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            marginTop: 6,
                          }}
                        >
                          <Ionicons name="navigate" size={16} color="#1D4ED8" />
                          <Text style={{ color: "#1D4ED8", fontWeight: "600", fontSize: rs(13) }}>Navigate to Car</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {car.status === "BEING_FETCHED" && isMine && (
                      <>
                        <TouchableOpacity
                          onPress={() => arriveAtGate(car)}
                          disabled={arrivingAtGate === car.id}
                          style={{ backgroundColor: "#F97316", borderRadius: rp(14), paddingVertical: rp(12), alignItems: "center", marginTop: rp(12), flexDirection: "row", justifyContent: "center", opacity: arrivingAtGate === car.id ? 0.7 : 1 }}
                        >
                          {arrivingAtGate === car.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="flag" size={14} color="#fff" />
                              <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(12), marginLeft: rp(6), letterSpacing: rs(1.5) }}>ARRIVED AT GATE</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => navigateToCar(car.id)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            backgroundColor: "#EFF6FF",
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            marginTop: 6,
                          }}
                        >
                          <Ionicons name="navigate" size={16} color="#1D4ED8" />
                          <Text style={{ color: "#1D4ED8", fontWeight: "600", fontSize: rs(13) }}>Navigate to Car</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {car.status === "ARRIVED_AT_GATE" && isMine && (
                      <View style={{ marginTop: rp(12) }}>
                        {car.gate_timer_expires_at && (() => {
                          const secondsLeft = Math.max(0, Math.floor((new Date(car.gate_timer_expires_at) - nowTick) / 1000));
                          return (
                            <View style={{ backgroundColor: secondsLeft <= 60 ? "#FEE2E2" : "#FEF3C7", borderRadius: rp(12), padding: rp(10), marginBottom: rp(10), alignItems: "center" }}>
                              <Text style={{ color: secondsLeft <= 60 ? "#DC2626" : "#B45309", fontSize: rs(11), fontWeight: "800", letterSpacing: rs(0.5) }}>
                                TIME LEFT FOR GUEST
                              </Text>
                              <Text style={{ color: secondsLeft <= 60 ? "#DC2626" : "#92400E", fontSize: rs(22), fontWeight: "900", marginTop: rp(2) }}>
                                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
                              </Text>
                            </View>
                          );
                        })()}
                        <TouchableOpacity
                          onPress={() => confirmDialog.info("Coming soon", "In-app masked calling will be available in a future update.")}
                          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#EFF6FF", borderRadius: rp(14), paddingVertical: rp(10), marginBottom: rp(10), borderWidth: rp(1), borderColor: "#BFDBFE" }}
                        >
                          <Ionicons name="call" size={16} color="#1D4ED8" />
                          <Text style={{ color: "#1D4ED8", fontWeight: "800", fontSize: rs(12), marginLeft: rp(6), letterSpacing: rs(0.5) }}>CALL GUEST</Text>
                        </TouchableOpacity>
                        {!car.otp_verified ? (
                          <>
                            <Text style={{ color: "#6B7280", fontSize: rs(12), fontWeight: "700", marginBottom: rp(6) }}>
                              Ask the guest for their code:
                            </Text>
                            <TextInput
                              value={otpInput[car.id] || ""}
                              onChangeText={(v) => setOtpInput((prev) => ({ ...prev, [car.id]: v }))}
                              placeholder="Enter 6-digit code"
                              keyboardType="number-pad"
                              maxLength={6}
                              style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: rp(12), paddingHorizontal: rp(14), paddingVertical: rp(10), fontSize: rs(16), fontWeight: "700", textAlign: "center", letterSpacing: rs(4), marginBottom: rp(8) }}
                            />
                            <TouchableOpacity
                              onPress={() => verifyDeliveryOtp(car)}
                              disabled={verifyingOtp[car.id]}
                              style={{ backgroundColor: "#7C3AED", borderRadius: rp(14), paddingVertical: rp(12), alignItems: "center", flexDirection: "row", justifyContent: "center", opacity: verifyingOtp[car.id] ? 0.7 : 1 }}
                            >
                              {verifyingOtp[car.id] ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(12), letterSpacing: rs(1.5) }}>VERIFY CODE</Text>
                              )}
                            </TouchableOpacity>
                          </>
                        ) : (
                          <TouchableOpacity
                            onPress={() => handleHandover(car)}
                            disabled={handoverUploading}
                            activeOpacity={0.7}
                            style={{ backgroundColor: "#059669", borderRadius: rp(14), paddingVertical: rp(12), alignItems: "center", flexDirection: "row", justifyContent: "center", opacity: handoverUploading ? 0.7 : 1 }}
                          >
                            {handoverUploading ? (
                              <View style={{ flexDirection: "row", alignItems: "center" }}>
                                <ActivityIndicator size="small" color="#fff" />
                                <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(12), marginLeft: rp(8), letterSpacing: rs(1) }}>
                                  UPLOADING PHOTO...
                                </Text>
                              </View>
                            ) : (
                              <>
                                <Ionicons name="camera" size={14} color="#fff" />
                                <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(12), marginLeft: rp(6), letterSpacing: rs(1.5) }}>TAKE PHOTO & DELIVER</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                    {car.status === "AWAITING_REPARK" && isMine && (
                      <View style={{ marginTop: rp(12) }}>
                        <View style={{ backgroundColor: "#FEF2F2", borderRadius: rp(12), padding: rp(10), marginBottom: rp(10) }}>
                          <Text style={{ color: "#B91C1C", fontSize: rs(12), fontWeight: "700" }}>
                            Guest didn't arrive in time. Please park this car in any available slot.
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => openParkModal(car)}
                          disabled={openingParkModal === car.id}
                          style={{ backgroundColor: openingParkModal === car.id ? "#047857" : "#059669", borderRadius: rp(14), paddingVertical: rp(12), alignItems: "center", flexDirection: "row", justifyContent: "center", opacity: openingParkModal === car.id ? 0.8 : 1 }}
                        >
                          {openingParkModal === car.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="location" size={14} color="#fff" />
                              <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(12), marginLeft: rp(6), letterSpacing: rs(1.5) }}>RE-PARK CAR</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          );
        })()}
        <View style={{ height: rp(40) }} />
      </ScrollView>

      <Modal visible={showParkModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: rp(36), borderTopRightRadius: rp(36), maxHeight: "92%", paddingTop: rp(20), paddingBottom: (insets?.bottom || 0) }}>
              {/* Fixed Header */}
              <View style={{ paddingHorizontal: rp(20) }}>
                <View style={{ alignItems: "center", marginBottom: rp(12) }}>
                  <View style={{ backgroundColor: "#D1D5DB", width: rp(48), height: rp(4), borderRadius: rp(99) }} />
                </View>
                <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#7C3AED", letterSpacing: rs(3) }}>PARK VEHICLE</Text>
                <Text style={{ fontSize: rs(24), fontWeight: "900", color: "#111827", marginTop: rp(2) }}>{selectedCar?.plate}</Text>
              </View>

              {eventZones.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: rp(40) }}>
                  <Ionicons name="map-outline" size={64} color="#9CA3AF" />
                  <Text style={{ color: "#111827", fontWeight: "800", marginTop: rp(12) }}>No Parking Zones Configured</Text>
                  <Text style={{ color: "#6B7280", fontSize: rs(12), marginTop: rp(4) }}>Please ask your admin to set up zones</Text>
                </View>
              ) : !slots.length ? (
                <View style={{ alignItems: "center", padding: rp(32) }}>
                  <ActivityIndicator size="large" color="#059669" />
                  <Text style={{ color: "#6B7280", marginTop: rp(8) }}>Loading parking slots...</Text>
                </View>
              ) : (
                <>
                  {/* Zone Selector - Fixed */}
                  <View style={{ paddingHorizontal: rp(20) }}>
                    <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(2), marginTop: rp(18), marginBottom: rp(8) }}>SELECT ZONE</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: rp(8), paddingBottom: rp(4) }}>
                      {eventZones.map((z) => {
                        const zoneSlots = slots.filter((s) => s.zone_name === z.name);
                        const free = zoneSlots.filter((s) => !s.is_occupied).length;
                        const isFull = zoneSlots.length > 0 && free === 0;
                        return (
                          <TouchableOpacity
                            key={z.name}
                            onPress={() => { setSelectedZone(z.name); setSelectedSlot(null); }}
                            style={{
                              paddingHorizontal: rp(14),
                              paddingVertical: rp(10),
                              borderRadius: rp(99),
                              backgroundColor: isFull ? "#F43F5E" : selectedZone === z.name ? "#7C3AED" : "#fff",
                              borderWidth: rp(1),
                              borderColor: isFull ? "#F43F5E" : selectedZone === z.name ? "#7C3AED" : "#E5E7EB",
                            }}
                          >
                            <Text style={{ fontSize: rs(12), fontWeight: "800", color: isFull || selectedZone === z.name ? "#fff" : "#374151", letterSpacing: rs(0.5) }}>
                              {z.name} — {isFull ? "FULL" : `${free} free`}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Slot Grid - Fixed height with its own scroll */}
                  <View style={{ paddingHorizontal: rp(20) }}>
                    <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(2), marginTop: rp(14), marginBottom: rp(8) }}>SELECT SLOT</Text>
                    <ScrollView
                      style={{ maxHeight: rp(200) }}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled={true}
                    >
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: rp(6), marginBottom: rp(6) }}>
                        {slots.filter((s) => s.zone_name === selectedZone).length === 0 ? (
                          <Text style={{ color: "#9CA3AF", textAlign: "center", paddingVertical: rp(24), width: "100%" }}>No slots in this zone</Text>
                        ) : (
                          slots.filter((s) => s.zone_name === selectedZone).map((item, idx) => {
                            const isSel = selectedSlot === item.slot_number;
                            let bg = "#D1FAE5";
                            if (item.is_occupied) bg = "#FECACA";
                            else if (isSel) bg = "#7C3AED";
                            return (
                              <TouchableOpacity
                                key={`${item.zone_name}-${item.slot_number}-${idx}`}
                                disabled={item.is_occupied}
                                onPress={() => setSelectedSlot(item.slot_number)}
                                style={{
                                  width: rp(56),
                                  height: rp(56),
                                  borderRadius: rp(14),
                                  backgroundColor: bg,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {item.is_occupied ? (
                                  <Ionicons name="close" size={18} color="#991B1B" />
                                ) : (
                                  <Text style={{ fontWeight: "900", color: isSel ? "#fff" : "#065F46" }}>
                                    {item.slot_number}
                                  </Text>
                                )}
                              </TouchableOpacity>
                            );
                          })
                        )}
                      </View>
                    </ScrollView>
                  </View>

                  {/* Bottom section - Photos, GPS, Confirm - scrollable */}
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingHorizontal: rp(20), paddingBottom: rp(32) }}
                  >
                    <Text style={{ fontSize: rs(11), fontWeight: "800", color: "#6B7280", letterSpacing: rs(2), marginTop: rp(14), marginBottom: rp(8) }}>
                      PARKING PHOTOS * (MIN 1, MAX 5)
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: rp(10), marginBottom: rp(14) }}>
                      {parkPhotos.map((uri, i) => (
                        <View key={i} style={{ position: "relative" }}>
                          <Image
                            source={{ uri }}
                            style={{ width: rp(80), height: rp(80), borderRadius: rp(14), borderWidth: rp(1.5), borderColor: "#E5E7EB" }}
                            onLoadEnd={() => setLoadingPhotoIdx((cur) => (cur === i ? null : cur))}
                          />
                          {loadingPhotoIdx === i && (
                            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(255,255,255,0.75)", borderRadius: rp(14), alignItems: "center", justifyContent: "center" }}>
                              <ActivityIndicator size="small" color="#7C3AED" />
                            </View>
                          )}
                          <TouchableOpacity
                            onPress={() => {
                              const removedUri = parkPhotos[i];
                              delete resizedParkPhotosRef.current[removedUri];
                              setParkPhotos(parkPhotos.filter((_, k) => k !== i));
                            }}
                            style={{ position: "absolute", top: -6, right: -6, backgroundColor: "#EF4444", borderRadius: rp(99), width: rp(22), height: rp(22), alignItems: "center", justifyContent: "center" }}
                          >
                            <Ionicons name="close" size={13} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {parkPhotos.length < 5 && (
                        <TouchableOpacity
                          onPress={takeParkPhoto}
                          disabled={takingParkPhoto}
                          style={{ width: rp(80), height: rp(80), borderRadius: rp(14), borderWidth: rp(1.5), borderStyle: "dashed", borderColor: "#7C3AED", backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" }}
                        >
                          {takingParkPhoto ? (
                            <ActivityIndicator size="small" color="#7C3AED" />
                          ) : (
                            <>
                              <Ionicons name="camera-outline" size={26} color="#7C3AED" />
                              <Text style={{ color: "#7C3AED", fontSize: rs(10), fontWeight: "800", marginTop: rp(4) }}>{parkPhotos.length === 0 ? "ADD" : "MORE"}</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </ScrollView>
                    <TouchableOpacity
                      onPress={captureGPSPin}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        backgroundColor: capturedGPS ? "#DCFCE7" : "#F3F4F6",
                        borderRadius: 8,
                        padding: 10,
                        marginBottom: 12,
                      }}
                    >
                      {capturingGPS
                        ? <ActivityIndicator size="small" color="#059669" />
                        : <Ionicons name={capturedGPS ? "location" : "location-outline"} size={18} color={capturedGPS ? "#059669" : "#6B7280"} />
                      }
                      <Text style={{ color: capturedGPS ? "#059669" : "#6B7280", fontSize: rs(14) }}>
                        {capturedGPS
                          ? `GPS Saved ✓ (${capturedGPS.lat.toFixed(5)}, ${capturedGPS.lng.toFixed(5)})`
                          : "Save GPS Pin (Open Ground Only)"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={confirmPark}
                      disabled={!selectedSlot || confirmingPark}
                      activeOpacity={0.7}
                      style={{
                        borderRadius: rp(16),
                        paddingVertical: rp(16),
                        alignItems: "center",
                        marginTop: rp(14),
                        backgroundColor: selectedSlot && !confirmingPark ? "#7C3AED" : "#D1D5DB",
                      }}
                    >
                      {confirmingPark ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2) }}>CONFIRM PARKING</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setShowParkModal(false); setParkPhotos([]); setParkingPhotoStep(false); setKeyTag(""); }}
                      style={{ paddingVertical: rp(12), alignItems: "center", marginTop: rp(4) }}
                    >
                      <Text style={{ color: "#6B7280", fontWeight: "700" }}>Close</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </>
              )}
            </View>

          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showSOSModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 24 + (insets?.bottom || 0) }}>
            <Text style={{ fontSize: rs(20), fontWeight: "700", color: "#DC2626", marginBottom: 4 }}>
              🚨 Send SOS Alert
            </Text>
            <Text style={{ fontSize: rs(13), color: "#6B7280", marginBottom: 20 }}>
              Your supervisor will be notified immediately
            </Text>

            {/* Alert Type Chips */}
            <Text style={{ fontSize: rs(13), fontWeight: "600", color: "#374151", marginBottom: 10 }}>
              What do you need help with?
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {[
                { key: "NEED_HELP", label: "Need Help" },
                { key: "BLOCKED_CAR", label: "Blocked Car" },
                { key: "DAMAGE_CLAIM", label: "Damage Claim" },
                { key: "MEDICAL", label: "Medical" },
                { key: "OTHER", label: "Other" },
              ].map((item) => (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => setSOSAlertType(item.key)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1.5,
                    borderColor: sosAlertType === item.key ? "#DC2626" : "#D1D5DB",
                    backgroundColor: sosAlertType === item.key ? "#FEE2E2" : "white",
                  }}
                >
                  <Text style={{ color: sosAlertType === item.key ? "#DC2626" : "#6B7280", fontWeight: "600", fontSize: rs(13) }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Optional Note */}
            <TextInput
              placeholder="Add details (optional)..."
              value={sosNote}
              onChangeText={setSosNote}
              multiline
              numberOfLines={3}
              style={{
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 10,
                padding: 12,
                fontSize: rs(14),
                color: "#111827",
                textAlignVertical: "top",
                marginBottom: 20,
                minHeight: 80,
              }}
            />

            <TouchableOpacity
              onPress={takeSosPhoto}
              style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", borderRadius: 10, padding: 12, marginBottom: 16 }}
            >
              <Ionicons name="camera-outline" size={20} color="#374151" />
              <Text style={{ color: "#374151", fontWeight: "600", marginLeft: 8, flex: 1 }}>
                {sosPhoto ? "Retake Photo (Optional)" : "Add Photo (Optional)"}
              </Text>
              {sosPhoto && <Ionicons name="checkmark-circle" size={20} color="#059669" />}
            </TouchableOpacity>

            {/* Buttons */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => { setShowSOSModal(false); setSosNote(""); setSosPhoto(null); }}
                style={{ flex: 1, backgroundColor: "#F3F4F6", borderRadius: 10, padding: 14, alignItems: "center" }}
              >
                <Text style={{ color: "#374151", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={sendSOS}
                disabled={sendingSOS}
                activeOpacity={0.7}
                style={{ flex: 1, backgroundColor: "#DC2626", borderRadius: 10, padding: 14, alignItems: "center" }}
              >
                {sendingSOS
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text style={{ color: "white", fontWeight: "700" }}>Send SOS</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showParkSuccessModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: rp(36), borderTopRightRadius: rp(36), padding: rp(24), paddingBottom: rp(24) + (insets?.bottom || 0) }}>
            <View style={{ alignItems: "center" }}>
              <Ionicons name="checkmark-circle" size={rs(64)} color="#059669" />
              <Text style={{ fontSize: rs(22), fontWeight: "900", color: "#111827", textAlign: "center", marginTop: rp(12) }}>
                Vehicle Parked!
              </Text>
              <Text style={{ fontSize: rs(16), fontWeight: "700", color: "#6B7280", textAlign: "center", marginTop: rp(4) }}>
                {parkedCarInfo?.plate}
              </Text>

              <View style={{ flexDirection: "row", gap: rp(8), marginTop: rp(12) }}>
                <View style={{ backgroundColor: "#F3F4F6", borderRadius: rp(12), paddingVertical: rp(6), paddingHorizontal: rp(12) }}>
                  <Text style={{ fontSize: rs(12), fontWeight: "700", color: "#374151" }}>
                    Zone {parkedCarInfo?.zone}
                  </Text>
                </View>
                <View style={{ backgroundColor: "#F3F4F6", borderRadius: rp(12), paddingVertical: rp(6), paddingHorizontal: rp(12) }}>
                  <Text style={{ fontSize: rs(12), fontWeight: "700", color: "#374151" }}>
                    Slot {parkedCarInfo?.slot}
                  </Text>
                </View>
              </View>

              <View style={{ backgroundColor: "#ECFDF5", borderRadius: rp(20), padding: rp(20), marginTop: rp(16), alignItems: "center", width: "100%" }}>
                <Text style={{ color: "#9CA3AF", fontWeight: "800", fontSize: rs(11), letterSpacing: rs(1) }}>KEY TAG</Text>
                <Text style={{ fontSize: rs(36), fontWeight: "900", color: "#059669", textAlign: "center", marginTop: rp(4) }}>
                  {parkedCarInfo?.key_tag_number}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setShowParkSuccessModal(false);
        setDismissingParkSuccess(false);
                  router.push({ pathname: "/(driver)/qr-display", params: { token: parkedCarInfo?.qr_token, plate: parkedCarInfo?.plate } });
                }}
                style={{ backgroundColor: "#fff", borderWidth: rp(1.5), borderColor: "#059669", borderRadius: rp(16), paddingVertical: rp(14), alignItems: "center", flexDirection: "row", justifyContent: "center", marginTop: rp(16), width: "100%" }}
              >
                <Ionicons name="qr-code-outline" size={rs(20)} color="#059669" />
                <Text style={{ color: "#059669", fontWeight: "800", fontSize: rs(14), marginLeft: rp(8) }}>Show QR Code</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  setDismissingParkSuccess(true);
                  // Small visual delay so driver sees the loader — gives fetchMyCars time to settle
                  await new Promise(r => setTimeout(r, 600));
                  setShowParkSuccessModal(false);
        setDismissingParkSuccess(false);
                  setParkedCarInfo(null);
                  setDismissingParkSuccess(false);
                }}
                disabled={dismissingParkSuccess}
                activeOpacity={0.7}
                style={{ backgroundColor: "#059669", borderRadius: rp(16), paddingVertical: rp(16), alignItems: "center", marginTop: rp(10), width: "100%" }}
              >
                {dismissingParkSuccess ? (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: rs(14), marginLeft: rp(8) }}>Please wait...</Text>
                  </View>
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: rs(14) }}>Done</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={!!incomingRequest} transparent={false} animationType="slide" onRequestClose={() => {
        setIncomingRequest(null);
      }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0F2044", padding: rp(24), justifyContent: "center" }}>
          <View style={{ alignItems: "center", marginBottom: rp(32) }}>
            <Text style={{ fontSize: rs(48), marginBottom: rp(16) }}>🔔</Text>
            <Text style={{ fontSize: rs(24), fontWeight: "900", color: "#fff", textAlign: "center", letterSpacing: rs(1) }}>New Retrieval Request</Text>
          </View>
          
          <View style={{ backgroundColor: "#fff", borderRadius: rp(24), padding: rp(24), ...cardShadow, marginBottom: rp(32) }}>
            <Text style={{ fontSize: rs(36), fontWeight: "900", color: "#111827", textAlign: "center" }}>{incomingRequest?.plate}</Text>
            <Text style={{ fontSize: rs(16), color: "#6B7280", textAlign: "center", marginTop: rp(4), marginBottom: rp(16) }}>{incomingRequest?.color} {incomingRequest?.make}</Text>
            
            <View style={{ backgroundColor: "#F3F4F6", borderRadius: rp(16), padding: rp(16), alignItems: "center" }}>
              <Text style={{ fontSize: rs(14), fontWeight: "700", color: "#374151" }}>
                Zone {incomingRequest?.zone} · Slot {incomingRequest?.slot}
              </Text>
              <Text style={{ fontSize: rs(16), fontWeight: "900", color: "#059669", marginTop: rp(4) }}>
                Key Tag #{incomingRequest?.key_tag_number}
              </Text>
            </View>

            {incomingRequest?.notes ? (
              <View style={{ backgroundColor: "#FEF3C7", borderRadius: rp(12), padding: rp(12), marginTop: rp(16) }}>
                <Text style={{ color: "#92400E", fontSize: rs(13), fontWeight: "600", textAlign: "center" }}>{incomingRequest.notes}</Text>
              </View>
            ) : null}
          </View>

          <View style={{ gap: rp(12) }}>
            <TouchableOpacity 
              disabled={!!pickingUp[incomingRequest?.id]}
              onPress={async () => {
                const car = incomingRequest;
                if (!car) return;
                const carIdStr = String(car.id);

                seenRequestIdsRef.current.add(carIdStr);
                setPickingUp((prev) => ({ ...prev, [car.id]: true }));

                try {
                  await api.patch(`/cars/${car.id}/pickup`, { retrieval_driver_id: resolvedDriverId });
                  setTab("retrievals");
                  setIncomingRequest(null);
                  setPickingUp((prev) => ({ ...prev, [car.id]: false }));
                  
                  updateJourney(car.id, "retrieval").catch(() => {});
                  fetchRetrievals().catch(() => {});
                } catch (e) {
                  setPickingUp((prev) => ({ ...prev, [car.id]: false }));
                  if (e.response?.status === 409) {
                    confirmDialog.info("Too late", "Already picked up by another driver.");
                  } else {
                    confirmDialog.info("Error", e.response?.data?.detail || "Failed to pick up.");
                  }
                  setIncomingRequest(null);
                }
              }}
              style={{ backgroundColor: "#10B981", borderRadius: rp(16), paddingVertical: rp(18), alignItems: "center" }}
            >
              {pickingUp[incomingRequest?.id] ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: rs(16), letterSpacing: rs(2) }}>ACCEPT</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              disabled={!!pickingUp[incomingRequest?.id] || skipping}
              onPress={() => {
                if (skipping || !incomingRequest) return;
                setSkipping(true);
                seenRequestIdsRef.current.add(String(incomingRequest.id));
                setIncomingRequest(null);
                setSkipping(false);
              }}
              style={{ backgroundColor: "transparent", borderWidth: rp(2), borderColor: "rgba(255,255,255,0.2)", borderRadius: rp(16), paddingVertical: rp(16), alignItems: "center" }}
            >
              {skipping ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: rs(14), letterSpacing: rs(1) }}>SKIP</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

