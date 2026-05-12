import { Platform } from "react-native";
import api from "./api";

// expo-sqlite is not supported on web (wa-sqlite.wasm missing). Provide stubs on web.
const isWeb = Platform.OS === "web";

let SQLite, FileSystem;
if (!isWeb) {
  // Lazy native imports to avoid web bundling failure
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SQLite = require("expo-sqlite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  FileSystem = require("expo-file-system");
}

let dbPromise = null;
const getDb = async () => {
  if (isWeb) return null;
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync("instapark_offline.db");
  const db = await dbPromise;
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS handover_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, car_id TEXT NOT NULL, local_path TEXT NOT NULL, created_at INTEGER NOT NULL);`
  );
  return db;
};

export const enqueueHandover = async (carId, localPath) => {
  if (isWeb) return;
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO handover_queue (car_id, local_path, created_at) VALUES (?, ?, ?)",
    [carId, localPath, Date.now()]
  );
};

export const getQueueCount = async () => {
  if (isWeb) return 0;
  try {
    const db = await getDb();
    const row = await db.getFirstAsync(
      "SELECT COUNT(*) as count FROM handover_queue"
    );
    return row?.count || 0;
  } catch {
    return 0;
  }
};

export const processPendingQueue = async () => {
  if (isWeb) return;
  try {
    const db = await getDb();
    const items = await db.getAllAsync(
      "SELECT * FROM handover_queue ORDER BY created_at ASC"
    );
    for (const it of items) {
      try {
        const formData = new FormData();
        formData.append("file", {
          uri: it.local_path,
          type: "image/jpeg",
          name: "handover.jpg",
        });
        formData.append("folder", `handover/${it.car_id}`);
        const up = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        await api.patch(`/cars/${it.car_id}/deliver`, {
          delivery_photo_url: up.data.url,
        });
        await db.runAsync("DELETE FROM handover_queue WHERE id = ?", [it.id]);
        try {
          await FileSystem.deleteAsync(it.local_path, { idempotent: true });
        } catch {}
      } catch {
        // Skip and try next time
      }
    }
  } catch {}
};
