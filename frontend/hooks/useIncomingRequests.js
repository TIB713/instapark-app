import { useState, useRef, useCallback, useEffect } from 'react';
import { Vibration } from 'react-native';
import { Audio } from 'expo-av';

export function useIncomingRequests() {
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [requestQueue, setRequestQueue] = useState([]);
  const seenRequestIdsRef = useRef(new Set());
  const requestSoundRef = useRef(null);
  const hasSeededSeenRef = useRef(false);

  useEffect(() => {
    let timeout;
    if (incomingRequest) {
      Vibration.vibrate([500, 500], true);
      (async () => {
        try {
          const { sound } = await Audio.Sound.createAsync(
            require("../assets/sounds/trip-request.mp3"),
            { isLooping: true }
          );
          requestSoundRef.current = sound;
          await sound.playAsync();
        } catch (e) {
          // Android denies audio focus while a phone call is active — expected,
          // not a bug. The modal + vibration still alert the driver either way.
          const isFocusDenied = String(e?.message || e).includes("AudioFocusNotAcquiredException");
          if (!isFocusDenied) {
            console.warn("Failed to play trip-request audio", e);
          }
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


  const isAlreadyTracked = useCallback((carId) => {
    if (seenRequestIdsRef.current.has(carId)) return true;
    if (incomingRequest && String(incomingRequest.id) === carId) return true;
    return false;
  }, [incomingRequest]);

  const maybeQueueNewRequest = useCallback((car) => {
    if (!car) return;

    const carData = car.car || car;
    const carId = carData.id ? String(carData.id) : null;

    if (!carId) return;
    if (carData.status !== "RETRIEVAL_REQUESTED" || carData.retrieval_driver_id) return;

    if (isAlreadyTracked(carId)) return;

    seenRequestIdsRef.current.add(carId);

    setRequestQueue((prev) => {
      if (prev.some((item) => String(item.id) === carId)) return prev;
      return [...prev, carData];
    });
  }, [isAlreadyTracked]);


  const clearStaleRequest = useCallback((carId) => {
    const idStr = String(carId);
    seenRequestIdsRef.current.delete(idStr);
    setRequestQueue((prev) => prev.filter((item) => String(item.id) !== idStr));
    setIncomingRequest((prev) => (prev && String(prev.id) === idStr ? null : prev));
  }, []);

  const reconcileWithServer = useCallback((freshCars) => {
    const stillRequested = new Set(
      (freshCars || [])
        .filter((c) => c.status === "RETRIEVAL_REQUESTED" && !c.retrieval_driver_id)
        .map((c) => String(c.id))
    );

    setRequestQueue((prev) => prev.filter((item) => stillRequested.has(String(item.id))));

    setIncomingRequest((prev) => {
      if (prev && !stillRequested.has(String(prev.id))) {
        return null;
      }
      return prev;
    });
  }, []);

  const dismissIncomingRequest = useCallback(() => {
    setIncomingRequest(null);
  }, []);

  return {
    incomingRequest,
    requestQueue,
    maybeQueueNewRequest,
    dismissIncomingRequest,
    clearStaleRequest,
    reconcileWithServer,
    seenRequestIdsRef,
    hasSeededSeenRef,
    setRequestQueue,
    requestSoundRef
  };
}
