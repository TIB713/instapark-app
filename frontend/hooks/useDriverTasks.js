import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState, Vibration, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';

import api from '../lib/api';
import { useAppStore } from '../lib/store';
import { connectWS, disconnectWS } from '../lib/websocket';
import { confirmDialog } from '../lib/confirmDialog';
import {
  enqueueHandover,
  getQueueSummary,
  getFailedQueue,
  processPendingQueue,
} from '../lib/offline';
import {
  updateJourney,
  checkEventStatusAndStop,
  isJourneyAccepted,
  startLocationTracking,
  LOCATION_TASK_NAME
} from '../lib/locationTracking';

export function useDriverTasks(
  seenRequestIdsRef,
  dismissIncomingRequest,
  maybeQueueNewRequest,
  hasSeededSeenRef,
  clearStaleRequest,
  reconcileWithServer,
  fetchSlots,
  requestSoundRef
) {
  const router = useRouter();
  const { driver, currentEventId } = useAppStore();
  const resolvedDriverId = driver?.id;

  const [tab, setTab] = useState("all");
  const [cars, setCars] = useState([]);
  const [acceptedCarIds, setAcceptedCarIds] = useState(new Set());
  const [acceptingCarId, setAcceptingCarId] = useState(null);
  const [retrievals, setRetrievals] = useState([]);

  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [handoverUploading, setHandoverUploading] = useState(false);
  const [queueSummary, setQueueSummary] = useState({ checkin: 0, park: 0, handover: 0, total: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [otpInput, setOtpInput] = useState({});
  const [verifyingOtp, setVerifyingOtp] = useState({});
  const [arrivingAtGate, setArrivingAtGate] = useState(null);
  const [pickingUp, setPickingUp] = useState({});
  const [nowTick, setNowTick] = useState(Date.now());

  const retrievalsRef = useRef([]);
  const lastExpiryRefetchRef = useRef(0);
  const lastBackgroundedAtRef = useRef(null);

  useEffect(() => {
    retrievalsRef.current = retrievals;
  }, [retrievals]);

  useEffect(() => {
    const syncEvents = async () => {
      await useAppStore.getState().fetchEvents();
      const latestEvents = useAppStore.getState().events;
      const activeId = useAppStore.getState().currentEventId;
      if (activeId && !latestEvents.some((e) => e.id === activeId)) {
        useAppStore.getState().setCurrentEventId(null);
      }
    };
    syncEvents();
    const eventsSyncInterval = setInterval(syncEvents, 20000);
    return () => clearInterval(eventsSyncInterval);
  }, [resolvedDriverId]);

  const fetchMyCars = useCallback(async () => {
    try {
      const { data } = await api.get(`/cars/event/${currentEventId}`, {
        params: {
          driver_id: resolvedDriverId,
          status: "CHECKED_IN,PARKED",
        },
      });
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
      reconcileWithServerRef.current(fetchedCars);
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
  }, [currentEventId, maybeQueueNewRequest, seenRequestIdsRef, hasSeededSeenRef]);

  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setNowTick(now);

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

  const refreshPending = async () => {
    const summary = await getQueueSummary();
    setQueueSummary(summary);
    setPendingCount(summary.total);
    const failed = await getFailedQueue();
    setFailedCount(failed.length);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchMyCars(), fetchRetrievals()]);
    setRefreshing(false);
  }, [fetchMyCars, fetchRetrievals]);

  const fetchMyCarsRef = useRef(fetchMyCars);
  const fetchRetrievalsRef = useRef(fetchRetrievals);
  const maybeQueueNewRequestRef = useRef(maybeQueueNewRequest);
  const reconcileWithServerRef = useRef(reconcileWithServer);

  useEffect(() => { fetchMyCarsRef.current = fetchMyCars; }, [fetchMyCars]);
  useEffect(() => { fetchRetrievalsRef.current = fetchRetrievals; }, [fetchRetrievals]);
  useEffect(() => { maybeQueueNewRequestRef.current = maybeQueueNewRequest; }, [maybeQueueNewRequest]);
  useEffect(() => { reconcileWithServerRef.current = reconcileWithServer; }, [reconcileWithServer]);

  useEffect(() => {
    if (!currentEventId) return;
    api.post(`/slots/event/${currentEventId}/initialize`).catch(() => { });
    Promise.all([fetchMyCarsRef.current(), fetchRetrievalsRef.current()]);
    refreshPending();

    connectWS(`/event/${currentEventId}`, (msg) => {
      if (msg.type === "car_update") fetchMyCarsRef.current();
      if (msg.type === "slot_update" && fetchSlots) fetchSlots(msg.data);
    });
    connectWS(`/retrievals/${currentEventId}`, (msg) => {
      if (msg.type === "retrieval_update") {
        console.log(`[DUP_DEBUG] retrieval_update received on channel /retrievals/${currentEventId}, carId=${(msg.data.car || msg.data).id}, status=${(msg.data.car || msg.data).status}`);
        if (msg.data) {
          const carId = String((msg.data.car || msg.data).id);
          const status = (msg.data.car || msg.data).status;
          if (status !== "RETRIEVAL_REQUESTED") {
            clearStaleRequest(carId);
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
    }, () => {
      fetchRetrievalsRef.current();
    });

    const appStateSub = AppState.addEventListener("change", (nextAppState) => {
      console.log(`[DUP_DEBUG] AppState changed to: ${nextAppState}`);
      if (nextAppState !== "active") {
        lastBackgroundedAtRef.current = Date.now();
        return;
      }
      const awayMs = lastBackgroundedAtRef.current ? Date.now() - lastBackgroundedAtRef.current : Infinity;
      console.log(`[DUP_DEBUG] AppState active after ${awayMs}ms away, reconnect ${awayMs < 3000 ? "SKIPPED" : "proceeding"}`);
      if (awayMs < 3000) {
        useAppStore.getState().fetchEvents();
        fetchRetrievalsRef.current();
        return;
      }
      disconnectWS(`/event/${currentEventId}`);
      disconnectWS(`/retrievals/${currentEventId}`);
      connectWS(`/event/${currentEventId}`, (msg) => {
        if (msg.type === "car_update") fetchMyCarsRef.current();
        if (msg.type === "slot_update" && fetchSlots) fetchSlots(msg.data);
      });
      connectWS(`/retrievals/${currentEventId}`, (msg) => {
        if (msg.type === "retrieval_update") {
          console.log(`[DUP_DEBUG] retrieval_update received on channel /retrievals/${currentEventId}, carId=${(msg.data.car || msg.data).id}, status=${(msg.data.car || msg.data).status}`);
          if (msg.data) {
            const carId = String((msg.data.car || msg.data).id);
            const status = (msg.data.car || msg.data).status;
            if (status !== "RETRIEVAL_REQUESTED") {
              clearStaleRequest(carId);
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
      }, () => {
        fetchRetrievalsRef.current();
      });
      useAppStore.getState().fetchEvents();
      Promise.all([fetchMyCarsRef.current(), fetchRetrievalsRef.current()]);
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
      setTab('requested');
      fetchRetrievalsRef.current();
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
    if (requestSoundRef?.current) {
      requestSoundRef.current.unloadAsync().catch(() => { });
    }
  };
}, [currentEventId]);

const acceptRetrieval = async (car, options = {}) => {
  const { fromIncomingRequest = false } = options;
  const doIt = async () => {
    if (fromIncomingRequest) seenRequestIdsRef.current.add(String(car.id));
    setPickingUp((prev) => ({ ...prev, [car.id]: true }));
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
      await api.patch(`/cars/${car.id}/pickup`, { retrieval_driver_id: resolvedDriverId });
      if (fromIncomingRequest) {
        setTab("at_gate");
        dismissIncomingRequest();
        updateJourney(car.id, "retrieval").catch(() => { });
      } else {
        await updateJourney(car.id, "retrieval");
      }
      fetchRetrievals();
    } catch (e) {
      if (fromIncomingRequest && e.response?.status === 409) {
        confirmDialog.info("Too late", "Already picked up by another driver.");
        dismissIncomingRequest();
      } else {
        confirmDialog.info("Error", e.response?.data?.detail || "Failed");
      }
    } finally {
      setPickingUp((prev) => ({ ...prev, [car.id]: false }));
    }
  };
  if (fromIncomingRequest) {
    await doIt();
  } else {
    confirmDialog.confirm("Accept Retrieval?", `Confirm you're accepting the retrieval for ${car.plate}.`, doIt);
  }
};

const confirmPickup = async (car) => {
  const doIt = async () => {
    setPickingUp((prev) => ({ ...prev, [car.id]: true }));
    try {
      await api.patch(`/cars/${car.id}/confirm-pickup`);
      fetchRetrievals();
    } catch (e) {
      confirmDialog.info("Error", e.response?.data?.detail || "Failed");
    } finally {
      setPickingUp((prev) => ({ ...prev, [car.id]: false }));
    }
  };
  confirmDialog.confirm("Confirm Pickup?", `Confirm you've picked up the keys for ${car.plate}.`, doIt);
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

const handleHandover = async (car) => {
  if (handoverUploading) return;
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
    setHandoverUploading(false);
    return;
  }
  const rawUri = result.assets[0].uri;
  let finalUri = rawUri;
  try {
    const resized = await ImageManipulator.manipulateAsync(rawUri, [{ resize: { width: 1280 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
    finalUri = resized.uri;
  } catch {
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
    let uploadUri = finalUri;
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        finalUri,
        [{ resize: { width: 1280 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );
      uploadUri = compressed.uri;
    } catch { uploadUri = finalUri; }

    await api.patch(`/cars/${car.id}/deliver`, { delivery_photo_url: "" });

    setHandoverUploading(false);
    fetchRetrievals();

    (async () => {
      try {
        const formData = new FormData();
        formData.append("file", { uri: uploadUri, type: "image/jpeg", name: "handover.jpg" });
        formData.append("folder", `handover/${car.id}`);
        const up = await api.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
        const photoUrl = up.data.url;
        await api.patch(`/cars/${car.id}/update-photo`, { delivery_photo_url: photoUrl }).catch(() => { });
      } catch { }
    })();

  } catch (e) {
    confirmDialog.info("Handover failed", e.response?.data?.detail || "Could not complete handover. Try again.");
    setHandoverUploading(false);
  } finally {
    await updateJourney(null, "idle");
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

return {
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
};
}
