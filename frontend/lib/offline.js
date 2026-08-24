import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";

const HANDOVER_QUEUE_KEY = "offline_handover_queue";
const PARK_QUEUE_KEY = "offline_park_queue";
const CHECKIN_QUEUE_KEY = "offline_checkin_queue";
const PHOTO_ATTACH_QUEUE_KEY = "offline_photo_attach_queue";
const FAILED_QUEUE_KEY = "failed_queue";

export const enqueueHandover = async (carId, localPath) => {
  try {
    const existing = await AsyncStorage.getItem(HANDOVER_QUEUE_KEY);
    const queue = existing ? JSON.parse(existing) : [];
    queue.push({
      carId,
      localPath,
      type: "handover",
      retryCount: 0,
      maxRetries: 3,
      lastError: null,
      enqueuedAt: Date.now(),
    });
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
      retryCount: 0,
      maxRetries: 3,
      lastError: null,
      enqueuedAt: Date.now(),
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
      retryCount: 0,
      maxRetries: 3,
      lastError: null,
      enqueuedAt: Date.now(),
    });
    await AsyncStorage.setItem(CHECKIN_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
};

export const enqueuePhotoAttach = async (carId, { photoLocalPaths, labels }) => {
  try {
    const existing = await AsyncStorage.getItem(PHOTO_ATTACH_QUEUE_KEY);
    const queue = existing ? JSON.parse(existing) : [];
    queue.push({
      carId,
      photoLocalPaths,
      labels,
      type: "photo_attach",
      retryCount: 0,
      maxRetries: 3,
      lastError: null,
      enqueuedAt: Date.now(),
    });
    await AsyncStorage.setItem(PHOTO_ATTACH_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
};

export const getQueueCount = async () => {
  try {
    const [h, p, c, pa] = await Promise.all([
      AsyncStorage.getItem(HANDOVER_QUEUE_KEY),
      AsyncStorage.getItem(PARK_QUEUE_KEY),
      AsyncStorage.getItem(CHECKIN_QUEUE_KEY),
      AsyncStorage.getItem(PHOTO_ATTACH_QUEUE_KEY)
    ]);
    const count = (h ? JSON.parse(h).length : 0) +
                  (p ? JSON.parse(p).length : 0) +
                  (c ? JSON.parse(c).length : 0) +
                  (pa ? JSON.parse(pa).length : 0);
    return count;
  } catch {
    return 0;
  }
};

export const getQueueSummary = async () => {
  try {
    const [h, p, c, pa] = await Promise.all([
      AsyncStorage.getItem(HANDOVER_QUEUE_KEY),
      AsyncStorage.getItem(PARK_QUEUE_KEY),
      AsyncStorage.getItem(CHECKIN_QUEUE_KEY),
      AsyncStorage.getItem(PHOTO_ATTACH_QUEUE_KEY)
    ]);
    const handover = h ? JSON.parse(h).length : 0;
    const park = p ? JSON.parse(p).length : 0;
    const checkin = c ? JSON.parse(c).length : 0;
    const photo_attach = pa ? JSON.parse(pa).length : 0;
    return {
      handover,
      park,
      checkin,
      photo_attach,
      total: handover + park + checkin + photo_attach
    };
  } catch {
    return { handover: 0, park: 0, checkin: 0, photo_attach: 0, total: 0 };
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
              notes: item.notes,
              make: item.make,
              color: item.color,
              plate: item.plate,
              car_type: item.carType,
              alt_guest_phone: item.altGuestPhone,
              has_damage: item.hasDamage,
              damage_notes: item.damageNotes,
              damage_types: item.damageTypes,
              guest_name: item.guestName
            });
            carId = res.data.id;
          } else {
            try {
              const res = await api.post("/cars", {
                plate: item.plate,
                color: item.color,
                make: item.make,
                notes: item.notes,
                gate: item.gate,
                event_id: item.eventId,
                check_in_driver_id: item.checkInDriverId,
                guest_phone: item.guestPhone,
                car_type: item.carType,
                alt_guest_phone: item.altGuestPhone,
                has_damage: item.hasDamage,
                damage_notes: item.damageNotes,
                damage_types: item.damageTypes,
                guest_name: item.guestName,
                instant_park: item.instantPark
              });
              carId = res.data.id;
            } catch (err) {
              const detail = err.response?.data?.detail;
              if (err.response?.status === 400 && typeof detail === "string" && detail.includes("already active")) {
                const existingRes = await api.get(`/cars/by-plate/${encodeURIComponent(item.plate)}?event_id=${item.eventId}`);
                carId = existingRes.data.id;
              } else {
                throw err;
              }
            }
          }

          // Upload photos
          const urls = [];
          const labels = [];
          for (const [label, path] of Object.entries(item.photoLocalPaths)) {
            if (!path) continue;
            const fileInfo = await FileSystem.getInfoAsync(path);
            if (!fileInfo.exists) continue;
            const formData = new FormData();
            formData.append("file", { uri: path, type: "image/jpeg", name: "checkin.jpg" });
            formData.append("folder", `checkin/${carId}`);
            const up = await api.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
            urls.push(up.data.url);
            labels.push(label);
          }

          if (urls.length > 0) {
            await api.post(`/cars/${carId}/photos`, { urls, type: "checkin", labels });
          }

          // Initialize slots (ignore errors as per instructions)
          try { await api.post(`/slots/event/${item.eventId}/initialize`); } catch {}

          // Success - delete local files
          for (const path of Object.values(item.photoLocalPaths)) {
            if (!path) continue;
            try { await FileSystem.deleteAsync(path); } catch {}
          }
        } catch (error) {
          const updatedItem = {
            ...item,
            retryCount: (item.retryCount || 0) + 1,
            lastError: error.message || "Unknown error",
            lastAttempt: Date.now(),
          };
          if (updatedItem.retryCount >= (item.maxRetries || 3)) {
            const existing = await AsyncStorage.getItem(FAILED_QUEUE_KEY);
            const failed = existing ? JSON.parse(existing) : [];
            failed.push(updatedItem);
            await AsyncStorage.setItem(FAILED_QUEUE_KEY, JSON.stringify(failed));
            console.warn(`[Offline Queue] Item permanently failed after ${updatedItem.retryCount} attempts:`, item.type);
          } else {
            remaining.push(updatedItem);
          }
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
        } catch (error) {
          const updatedItem = {
            ...item,
            retryCount: (item.retryCount || 0) + 1,
            lastError: error.message || "Unknown error",
            lastAttempt: Date.now(),
          };
          if (updatedItem.retryCount >= (item.maxRetries || 3)) {
            const existing = await AsyncStorage.getItem(FAILED_QUEUE_KEY);
            const failed = existing ? JSON.parse(existing) : [];
            failed.push(updatedItem);
            await AsyncStorage.setItem(FAILED_QUEUE_KEY, JSON.stringify(failed));
            console.warn(`[Offline Queue] Item permanently failed after ${updatedItem.retryCount} attempts:`, item.type);
          } else {
            remaining.push(updatedItem);
          }
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
        } catch (error) {
          const updatedItem = {
            ...item,
            retryCount: (item.retryCount || 0) + 1,
            lastError: error.message || "Unknown error",
            lastAttempt: Date.now(),
          };
          if (updatedItem.retryCount >= (item.maxRetries || 3)) {
            const existing = await AsyncStorage.getItem(FAILED_QUEUE_KEY);
            const failed = existing ? JSON.parse(existing) : [];
            failed.push(updatedItem);
            await AsyncStorage.setItem(FAILED_QUEUE_KEY, JSON.stringify(failed));
            console.warn(`[Offline Queue] Item permanently failed after ${updatedItem.retryCount} attempts:`, item.type);
          } else {
            remaining.push(updatedItem);
          }
        }
      }
      await AsyncStorage.setItem(HANDOVER_QUEUE_KEY, JSON.stringify(remaining));
    }
  } catch {}

  // 4. Process Photo Attach Queue
  try {
    const existing = await AsyncStorage.getItem(PHOTO_ATTACH_QUEUE_KEY);
    if (existing) {
      const queue = JSON.parse(existing);
      const remaining = [];
      for (const item of queue) {
        try {
          const urls = [];
          const successLabels = [];
          for (let i = 0; i < item.labels.length; i++) {
            const label = item.labels[i];
            const path = item.photoLocalPaths[label];
            if (!path) continue;
            const fileInfo = await FileSystem.getInfoAsync(path);
            if (!fileInfo.exists) continue;
            const formData = new FormData();
            formData.append("file", { uri: path, type: "image/jpeg", name: "checkin.jpg" });
            formData.append("folder", `checkin/${item.carId}`);
            const up = await api.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
            urls.push(up.data.url);
            successLabels.push(label);
          }
          if (urls.length > 0) {
            await api.post(`/cars/${item.carId}/photos`, { urls, type: "checkin", labels: successLabels });
          }
          // Delete local files
          for (const path of Object.values(item.photoLocalPaths)) {
            if (!path) continue;
            try { await FileSystem.deleteAsync(path); } catch {}
          }
        } catch (error) {
          const updatedItem = {
            ...item,
            retryCount: (item.retryCount || 0) + 1,
            lastError: error.message || "Unknown error",
            lastAttempt: Date.now(),
          };
          if (updatedItem.retryCount >= (item.maxRetries || 3)) {
            const existing = await AsyncStorage.getItem(FAILED_QUEUE_KEY);
            const failed = existing ? JSON.parse(existing) : [];
            failed.push(updatedItem);
            await AsyncStorage.setItem(FAILED_QUEUE_KEY, JSON.stringify(failed));
          } else {
            remaining.push(updatedItem);
          }
        }
      }
      await AsyncStorage.setItem(PHOTO_ATTACH_QUEUE_KEY, JSON.stringify(remaining));
    }
  } catch {}

  await cleanupOldOfflinePhotos();
};

export const cleanupOldOfflinePhotos = async () => {
  try {
    const docDir = FileSystem.documentDirectory;
    const files = await FileSystem.readDirectoryAsync(docDir);
    const now = Date.now();
    const MAX_AGE_MS = 48 * 60 * 60 * 1000;

    for (const file of files) {
      if (file.startsWith("checkin_") || file.startsWith("park_") || file.startsWith("handover_")) {
        const info = await FileSystem.getInfoAsync(`${docDir}${file}`);
        if (info.exists && info.modificationTime && (now - info.modificationTime * 1000) > MAX_AGE_MS) {
          await FileSystem.deleteAsync(`${docDir}${file}`, { idempotent: true });
        }
      }
    }
  } catch (e) {
    console.warn("Photo cleanup error:", e);
  }
};

export const getFailedQueue = async () => {
  try {
    const existing = await AsyncStorage.getItem(FAILED_QUEUE_KEY);
    return existing ? JSON.parse(existing) : [];
  } catch {
    return [];
  }
};

export const clearFailedItem = async (index) => {
  try {
    const existing = await AsyncStorage.getItem(FAILED_QUEUE_KEY);
    const failed = existing ? JSON.parse(existing) : [];
    failed.splice(index, 1);
    await AsyncStorage.setItem(FAILED_QUEUE_KEY, JSON.stringify(failed));
  } catch {}
};
