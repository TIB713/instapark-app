import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";

const HANDOVER_QUEUE_KEY = "offline_handover_queue";
const PARK_QUEUE_KEY = "offline_park_queue";
const CHECKIN_QUEUE_KEY = "offline_checkin_queue";

export const enqueueHandover = async (carId, localPath) => {
  try {
    const existing = await AsyncStorage.getItem(HANDOVER_QUEUE_KEY);
    const queue = existing ? JSON.parse(existing) : [];
    queue.push({ carId, localPath, timestamp: Date.now() });
    await AsyncStorage.setItem(HANDOVER_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
};

export const enqueueParkAction = async (carId, { zone, slot, parkedDriverId, keyTag, photoLocalPaths }) => {
  try {
    const existing = await AsyncStorage.getItem(PARK_QUEUE_KEY);
    const queue = existing ? JSON.parse(existing) : [];
    queue.push({
      type: "park",
      carId,
      zone,
      slot,
      parkedDriverId,
      keyTag,
      photoLocalPaths,
      timestamp: Date.now()
    });
    await AsyncStorage.setItem(PARK_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
};

export const enqueueCheckinAction = async (payload) => {
  try {
    const existing = await AsyncStorage.getItem(CHECKIN_QUEUE_KEY);
    const queue = existing ? JSON.parse(existing) : [];
    queue.push({
      ...payload,
      type: "checkin",
      timestamp: Date.now()
    });
    await AsyncStorage.setItem(CHECKIN_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
};

export const getQueueCount = async () => {
  try {
    const [h, p, c] = await Promise.all([
      AsyncStorage.getItem(HANDOVER_QUEUE_KEY),
      AsyncStorage.getItem(PARK_QUEUE_KEY),
      AsyncStorage.getItem(CHECKIN_QUEUE_KEY)
    ]);
    const count = (h ? JSON.parse(h).length : 0) +
                  (p ? JSON.parse(p).length : 0) +
                  (c ? JSON.parse(c).length : 0);
    return count;
  } catch {
    return 0;
  }
};

export const getQueueSummary = async () => {
  try {
    const [h, p, c] = await Promise.all([
      AsyncStorage.getItem(HANDOVER_QUEUE_KEY),
      AsyncStorage.getItem(PARK_QUEUE_KEY),
      AsyncStorage.getItem(CHECKIN_QUEUE_KEY)
    ]);
    const handover = h ? JSON.parse(h).length : 0;
    const park = p ? JSON.parse(p).length : 0;
    const checkin = c ? JSON.parse(c).length : 0;
    return {
      handover,
      park,
      checkin,
      total: handover + park + checkin
    };
  } catch {
    return { handover: 0, park: 0, checkin: 0, total: 0 };
  }
};

export const processPendingQueue = async () => {
  const { default: api } = await import("./api");

  // 1. Process Check-in Queue
  try {
    const existing = await AsyncStorage.getItem(CHECKIN_QUEUE_KEY);
    if (existing) {
      const queue = JSON.parse(existing);
      const remaining = [];
      for (const item of queue) {
        try {
          let carId = item.prefilledCarId;
          if (item.isPreRegistered) {
            const res = await api.patch(`/cars/${item.prefilledCarId}/complete-checkin`, {
              check_in_driver_id: item.checkInDriverId,
              gate: item.gate,
              notes: item.notes
            });
            carId = res.data.id;
          } else {
            const res = await api.post("/cars", {
              plate: item.plate,
              color: item.color,
              make: item.make,
              notes: item.notes,
              gate: item.gate,
              event_id: item.eventId,
              check_in_driver_id: item.checkInDriverId,
              guest_phone: item.guestPhone
            });
            carId = res.data.id;
          }

          // Upload photos
          const urls = [];
          for (const path of item.photoLocalPaths) {
            const fileInfo = await FileSystem.getInfoAsync(path);
            if (!fileInfo.exists) continue;
            const formData = new FormData();
            formData.append("file", { uri: path, type: "image/jpeg", name: "checkin.jpg" });
            formData.append("folder", `checkin/${carId}`);
            const up = await api.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
            urls.push(up.data.url);
          }

          if (urls.length > 0) {
            await api.post(`/cars/${carId}/photos`, { urls, type: "checkin" });
          }

          // Initialize slots (ignore errors as per instructions)
          try { await api.post(`/slots/event/${item.eventId}/initialize`); } catch {}

          // Success - delete local files
          for (const path of item.photoLocalPaths) {
            try { await FileSystem.deleteAsync(path); } catch {}
          }
        } catch (e) {
          remaining.push(item);
        }
      }
      await AsyncStorage.setItem(CHECKIN_QUEUE_KEY, JSON.stringify(remaining));
    }
  } catch {}

  // 2. Process Park Queue
  try {
    const existing = await AsyncStorage.getItem(PARK_QUEUE_KEY);
    if (existing) {
      const queue = JSON.parse(existing);
      const remaining = [];
      for (const item of queue) {
        try {
          await api.patch(`/cars/${item.carId}/park`, {
            zone: item.zone,
            slot: item.slot,
            parked_driver_id: item.parkedDriverId,
            key_tag: item.keyTag
          });

          // Upload photos
          const urls = [];
          for (const path of item.photoLocalPaths) {
            const fileInfo = await FileSystem.getInfoAsync(path);
            if (!fileInfo.exists) continue;
            const formData = new FormData();
            formData.append("file", { uri: path, type: "image/jpeg", name: "parked.jpg" });
            formData.append("folder", `parked/${item.carId}`);
            const up = await api.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
            urls.push(up.data.url);
          }

          if (urls.length > 0) {
            await api.post(`/cars/${item.carId}/photos`, { urls, type: "parked" });
            await api.patch(`/cars/${item.carId}/park-photo`, { parked_photo_url: urls[0] });
          }

          // Success - delete local files
          for (const path of item.photoLocalPaths) {
            try { await FileSystem.deleteAsync(path); } catch {}
          }
        } catch (e) {
          remaining.push(item);
        }
      }
      await AsyncStorage.setItem(PARK_QUEUE_KEY, JSON.stringify(remaining));
    }
  } catch {}

  // 3. Process Handover Queue
  try {
    const existing = await AsyncStorage.getItem(HANDOVER_QUEUE_KEY);
    if (existing) {
      const queue = JSON.parse(existing);
      const remaining = [];
      for (const item of queue) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(item.localPath);
          if (!fileInfo.exists) continue;
          const formData = new FormData();
          formData.append("file", { uri: item.localPath, type: "image/jpeg", name: "handover.jpg" });
          formData.append("folder", `handover/${item.carId}`);
          const up = await api.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
          await api.patch(`/cars/${item.carId}/deliver`, { delivery_photo_url: up.data.url });
          try { await FileSystem.deleteAsync(item.localPath); } catch {}
        } catch {
          remaining.push(item);
        }
      }
      await AsyncStorage.setItem(HANDOVER_QUEUE_KEY, JSON.stringify(remaining));
    }
  } catch {}
};
