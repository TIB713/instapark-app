import { useState, useCallback, useRef, useEffect } from "react";
import { Vibration } from "react-native";
import { Audio } from "expo-av";
import api from "../lib/api";
import { confirmDialog } from "../lib/confirmDialog";
import { configureBackgroundAudio } from "../lib/audio"; // Ensure this matches actual

export function useEventSOS(currentEventId, fetchEvent) {
  const seenSOSIdsRef = useRef(new Set());
  const hasSeededSOSRef = useRef(false);
  const sosSoundRef = useRef(null);

const [sosAlerts, setSOSAlerts] = useState([]);

const [sosCount, setSOSCount] = useState(0);

const [showSOSPanel, setShowSOSPanel] = useState(false);

const [resolvingSOSId, setResolvingSOSId] = useState(null);

const [activeSOSQueue, setActiveSOSQueue] = useState([]);

const [forcedSOSAlert, setForcedSOSAlert] = useState(null);

const [resolvingForcedSOS, setResolvingForcedSOS] = useState(false);

const fetchSOSAlerts = useCallback(async () => {
    if (!currentEventId) return;
    try {
      const { data } = await api.get(`/sos/event/${currentEventId}`);
      const alerts = data || [];
      setSOSAlerts(alerts);
      setSOSCount(alerts.filter(a => a.status === "ACTIVE").length);

      if (!hasSeededSOSRef.current) {
        alerts.forEach(alert => seenSOSIdsRef.current.add(alert.id));
        hasSeededSOSRef.current = true;
      } else {
        const newQueue = [];
        alerts.forEach(alert => {
          if (alert.status === "ACTIVE" && !seenSOSIdsRef.current.has(alert.id)) {
            seenSOSIdsRef.current.add(alert.id);
            newQueue.push(alert);
          }
        });
        if (newQueue.length > 0) {
          setActiveSOSQueue(prev => [...prev, ...newQueue]);
        }
      }
    } catch {}
  }, [currentEventId]);


  const doResolveSOSAlert = async (alertId) => {
    setResolvingSOSId(alertId);
    try {
      await api.patch(`/sos/${alertId}/resolve`);
      fetchSOSAlerts();
    } catch {
      confirmDialog.info("Error", "Failed to resolve alert.");
    } finally {
      setResolvingSOSId(null);
    }
  };

const resolveSOSAlert = async (alertId) => {
    confirmDialog.confirm(
      "Resolve SOS alert",
      "Mark this SOS alert as resolved?",
      () => doResolveSOSAlert(alertId)
    );
  }

  useEffect(() => {
    configureBackgroundAudio();
  }, []);

  useEffect(() => {
    if (forcedSOSAlert === null && activeSOSQueue.length > 0) {
      const [next, ...rest] = activeSOSQueue;
      setForcedSOSAlert(next);
      setActiveSOSQueue(rest);
    }
  }, [activeSOSQueue, forcedSOSAlert]);

  useEffect(() => {
    if (forcedSOSAlert) {
      Vibration.vibrate([600, 400], true);
      (async () => {
        try {
          const { sound } = await Audio.Sound.createAsync(
            require("../assets/sounds/sos-alarm.mp3"),
            { isLooping: true }
          );
          sosSoundRef.current = sound;
          await sound.playAsync();
        } catch (e) {
          console.warn("Failed to play sos-alarm audio", e);
        }
      })();
    } else {
      Vibration.cancel();
      if (sosSoundRef.current) {
        sosSoundRef.current.stopAsync().then(() => sosSoundRef.current.unloadAsync()).catch(() => {});
        sosSoundRef.current = null;
      }
    }
  }, [forcedSOSAlert]);


  return {
    sosAlerts, setSOSAlerts,
    sosCount, setSOSCount,
    showSOSPanel, setShowSOSPanel,
    resolvingSOSId, setResolvingSOSId,
    activeSOSQueue, setActiveSOSQueue,
    forcedSOSAlert, setForcedSOSAlert,
    resolvingForcedSOS, setResolvingForcedSOS,
    fetchSOSAlerts, resolveSOSAlert
  };
}
