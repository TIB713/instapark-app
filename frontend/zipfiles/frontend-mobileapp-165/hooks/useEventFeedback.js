import { useState, useCallback, useEffect } from "react";
import api from "../lib/api";

export function useEventFeedback(eventId, tab) {
  const [feedback, setFeedback] = useState([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  const fetchFeedback = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoadingFeedback(true);
      const res = await api.get(`/events/${eventId}/feedback`);
      setFeedback(res.data);
    } catch (e) {
      console.warn("Error fetching feedback:", e);
    } finally {
      setLoadingFeedback(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (tab === "feedback") {
      fetchFeedback();
    }
  }, [tab, fetchFeedback]);

  return { feedback, loadingFeedback, fetchFeedback };
}
