import { useState, useCallback, useEffect } from "react";
import { useAppStore } from "../lib/store";
import api from "../lib/api";
import { connectWS, disconnectWS } from "../lib/websocket";

export function useSupervisorEvents() {
  const { user } = useAppStore();
  const [events, setEvents] = useState([]);
  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wsStatus, setWsStatus] = useState("connecting");

  const fetchAll = useCallback(async () => {
    const supervisorId = user?.id || user?.user_id;
    if (!supervisorId) return;

    try {
      setLoading(true);
      const [eventsRes, hotelRes] = await Promise.all([
        api.get(`/supervisors/${supervisorId}/events`),
        user?.hotel_id ? api.get(`/hotels/${user.hotel_id}`) : Promise.resolve({ data: null })
      ]);

      const sorted = (eventsRes.data || []).sort((a, b) => new Date(b.date) - new Date(a.date));
      setEvents(sorted);
      if (hotelRes.data) setHotel(hotelRes.data);
    } catch (e) {
      console.log("Error fetching supervisor dashboard data:", e?.response?.status, e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    const activeEvent = events.find((e) => e.status === "active");
    if (!activeEvent) {
      setWsStatus("disconnected");
      return;
    }
    setWsStatus("connecting");
    let connected = false;
    const disconnectTimer = setTimeout(() => {
      if (!connected) setWsStatus("disconnected");
    }, 8000);

    connectWS(`/event/${activeEvent.id}`, () => {
      connected = true;
      setWsStatus("connected");
    });

    return () => {
      clearTimeout(disconnectTimer);
      disconnectWS(`/event/${activeEvent.id}`);
    };
  }, [events]);

  return { events, hotel, loading, refreshing, wsStatus, fetchAll, setRefreshing };
}
