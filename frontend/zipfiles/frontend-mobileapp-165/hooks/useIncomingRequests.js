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
      console.log(`[DUP_DEBUG] pulling from queue: showing car ${next.id}, queue had ${requestQueue.length} items`);
      setIncomingRequest(next);
      setRequestQueue(rest);
    }
  }, [requestQueue, incomingRequest]);

  const maybeQueueNewRequest = useCallback((car) => {
    if (!car) return;

    const carData = car.car || car;
    const carId = carData.id ? String(carData.id) : null;

    if (!carId) return;
    console.log(`[DUP_DEBUG] maybeQueueNewRequest called for car ${carId}, status=${carData.status}, alreadySeen=${seenRequestIdsRef.current.has(carId)}, currentIncoming=${incomingRequest?.id}`);
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

  const dismissIncomingRequest = useCallback(() => {
    setIncomingRequest(null);
  }, []);

  return {
    incomingRequest,
    requestQueue,
    maybeQueueNewRequest,
    dismissIncomingRequest,
    seenRequestIdsRef,
    hasSeededSeenRef,
    setRequestQueue,
    requestSoundRef
  };
}
