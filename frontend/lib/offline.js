import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "offline_handover_queue";

export const enqueueHandover = async (carId, localPath) => {
  try {
    const existing = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = existing ? JSON.parse(existing) : [];
    queue.push({ carId, localPath, timestamp: Date.now() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
};

export const getQueueCount = async () => {
  try {
    const existing = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = existing ? JSON.parse(existing) : [];
    return queue.length;
  } catch {
    return 0;
  }
};

export const processPendingQueue = async () => {
  try {
    const existing = await AsyncStorage.getItem(QUEUE_KEY);
    if (!existing) return;
    const queue = JSON.parse(existing);
    if (!queue.length) return;
    const remaining = [];
    for (const item of queue) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(item.localPath);
        if (!fileInfo.exists) continue;
        const formData = new FormData();
        formData.append("file", {
          uri: item.localPath,
          type: "image/jpeg",
          name: "handover.jpg",
        });
        formData.append("folder", `handover/${item.carId}`);
        const { default: api } = await import("./api");
        const up = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        await api.patch(`/cars/${item.carId}/deliver`, {
          delivery_photo_url: up.data.url,
        });
        try { await FileSystem.deleteAsync(item.localPath); } catch {}
      } catch {
        remaining.push(item);
      }
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  } catch {}
};
