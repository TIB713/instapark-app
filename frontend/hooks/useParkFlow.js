import { useState, useRef, useEffect, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';
import api from '../lib/api';
import { confirmDialog } from '../lib/confirmDialog';
import { enqueueParkAction } from '../lib/offline';
import { updateJourney } from '../lib/locationTracking';
import { useAppStore } from '../lib/store';

export function useParkFlow(retrievals, fetchMyCars, fetchRetrievals, refreshPending) {
  const { driver, currentEventId } = useAppStore();
  const resolvedDriverId = driver?.id;

  const [showParkModal, setShowParkModal] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);
  const [eventZones, setEventZones] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [keyTag, setKeyTag] = useState("");
  const [parkPhotos, setParkPhotos] = useState([]);
  const [loadingPhotoIdx, setLoadingPhotoIdx] = useState(null);
  const [parkingPhotoStep, setParkingPhotoStep] = useState(false);
  const [takingParkPhoto, setTakingParkPhoto] = useState(false);
  const [showParkSuccessModal, setShowParkSuccessModal] = useState(false);
  const [parkedCarInfo, setParkedCarInfo] = useState(null);
  const [capturedGPS, setCapturedGPS] = useState(null);
  const [capturingGPS, setCapturingGPS] = useState(false);
  const [openingParkModal, setOpeningParkModal] = useState(null);
  const [confirmingPark, setConfirmingPark] = useState(false);
  const [dismissingParkSuccess, setDismissingParkSuccess] = useState(false);

  const resizedParkPhotosRef = useRef({});
  const holdTimerRef = useRef(null);

  const fetchEvent = useCallback(async () => {
    if (!currentEventId) return;
    try {
      const evRes = await api.get(`/events/${currentEventId}`);
      setEventZones(evRes.data.zones || []);
      if (evRes.data.zones?.[0]) setSelectedZone(evRes.data.zones[0].name);
    } catch { }
  }, [currentEventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const fetchSlots = async (updatedSlot) => {
    if (updatedSlot && updatedSlot.zone_name) {
      setSlots(prev => prev.map(s => s.zone_name === updatedSlot.zone_name && s.slot_number === updatedSlot.slot_number ? { ...s, ...updatedSlot } : s));
      return;
    }
    try {
      const { data } = await api.get(`/slots/event/${currentEventId}`);
      setSlots(data || []);
    } catch { }
  };

  const holdSlot = async (zone, slotNumber) => {
    try {
      await api.post(`/slots/event/${currentEventId}/hold`, { zone, slot: slotNumber });
      return true;
    } catch (e) {
      confirmDialog.info("Slot unavailable", e.response?.data?.detail || "Please choose another slot");
      return false;
    }
  };

  const releaseSlot = async (zone, slotNumber) => {
    if (!zone || slotNumber == null) return;
    try { await api.post(`/slots/event/${currentEventId}/release-hold`, { zone, slot: slotNumber }); } catch {}
  };

  const selectSlot = async (slotNumber) => {
    if (selectedSlot != null && (selectedSlot !== slotNumber)) {
      releaseSlot(selectedZone, selectedSlot); // fire-and-forget release of the old pick
    }
    const ok = await holdSlot(selectedZone, slotNumber);
    if (ok) {
      setSelectedSlot(slotNumber);
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = setInterval(() => holdSlot(selectedZone, slotNumber), 45000); // refresh before 90s TTL
    } else {
      fetchSlots(); // refresh grid so the just-taken/held slot shows correctly
    }
  };

  const openParkModal = (car) => {
    setOpeningParkModal(car.id);
    setSelectedCar(car);
    setSelectedSlot(null);
    setSlots([]);
    setShowParkModal(true);
    Promise.all([fetchEvent(), fetchSlots()]).then(() => setOpeningParkModal(null));
  };

  const captureGPSOnce = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const loc = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("gps_timeout")), 5000)),
    ]);
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  } catch {
    // Single try only — if it fails, times out, or permission is denied,
    // park without a pin. No retry.
    return null;
  }
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

  const confirmPark = async () => {
    if (!selectedSlot) return;

    confirmDialog.confirm(
      "Confirm parking",
      `Confirm parking ${selectedCar?.plate} in Zone ${selectedZone}, Slot ${selectedSlot}?`,
      () => doConfirmPark()
    );
  };

  const doConfirmPark = async () => {
    setConfirmingPark(true);
    try {
      const gpsPin = await captureGPSOnce();
      setCapturedGPS(gpsPin);
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
        await enqueueParkAction(selectedCar.id, { zone: selectedZone, slot: selectedSlot, parkedDriverId: resolvedDriverId, photoLocalPaths, gpsLat: gpsPin?.lat ?? null, gpsLng: gpsPin?.lng ?? null });
        setParkedCarInfo({ plate: selectedCar.plate, zone: selectedZone, slot: selectedSlot, checkin_code: selectedCar.checkin_code, qr_token: selectedCar.qr_token });
        setShowParkSuccessModal(true);
        setShowParkModal(false);
        setParkPhotos([]);
        setParkingPhotoStep(false);
        if (refreshPending) refreshPending();
        confirmDialog.info("Saved offline", "Parking recorded. Will sync when connected.");
        return;
      }

      // ONLINE: go straight to API — no photo copying needed before this
      const snapshotUris = [...parkPhotos]; // snapshot current URIs before state is cleared
      clearInterval(holdTimerRef.current);
      await api.patch(`/cars/${selectedCar.id}/park`, {
        zone: selectedZone,
        slot: selectedSlot,
        parked_driver_id: resolvedDriverId,
        gps_lat: gpsPin?.lat ?? null,
        gps_lng: gpsPin?.lng ?? null,
      });
      await updateJourney(selectedCar.id, "parked");

      const carId = selectedCar.id;
      setParkedCarInfo({ plate: selectedCar.plate, zone: selectedZone, slot: selectedSlot, checkin_code: selectedCar.checkin_code, qr_token: selectedCar.qr_token });
      setShowParkSuccessModal(true);
      setShowParkModal(false);
      setParkPhotos([]);
      setParkingPhotoStep(false);
      if (fetchMyCars && fetchRetrievals) {
        Promise.all([fetchMyCars(), fetchRetrievals()]);
      }
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
        } catch { }
      })();
    } catch (e) {
      confirmDialog.info("Error", e.response?.data?.detail || "Failed to park");
    } finally {
      setConfirmingPark(false);
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

  useEffect(() => {
    if (!showParkModal) {
      clearInterval(holdTimerRef.current);
      if (selectedZone && selectedSlot != null) releaseSlot(selectedZone, selectedSlot);
    }
  }, [showParkModal, selectedZone, selectedSlot]);

  return {
    fetchSlots,
    state: {
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
      driver,
    },
    openParkModal,
    closeParkModal: () => setShowParkModal(false),
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
    selectSlot,
    takeParkPhoto,
    confirmPark,
    doConfirmPark,
    uploadParkPhotosInBackground,
    captureGPSOnce
  };
}