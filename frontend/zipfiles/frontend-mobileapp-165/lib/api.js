import axios from "axios";
import { router } from "expo-router";
import { getItem, deleteItem } from "./secure";

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || "https://instapark.docusafe.ai/api/v1",
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  try {
    const token = await getItem("auth_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {}
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const url = err.config?.url || "";
    const isAuthEndpoint = url.includes("/auth/");

    if ((err.response?.status === 401 || err.response?.status === 403) && !isAuthEndpoint) {
      try {
        await deleteItem("auth_token");
        const { useAppStore } = require("./store");
        useAppStore.getState().signOut?.();
      } catch {}
      router.replace("/(auth)/login");
    }
    return Promise.reject(err);
  }
);

export default api;


// import axios from "axios";
// import { getItem, deleteItem } from "./secure";

// const api = axios.create({
//   baseURL: process.env.EXPO_PUBLIC_API_URL,
//   timeout: 30000,
// });

// api.interceptors.request.use(async (config) => {
//   const token = await getItem("auth_token");
//   if (token) config.headers.Authorization = `Bearer ${token}`;
//   return config;
// });

// api.interceptors.response.use(
//   (res) => res,
//   async (err) => {
//     if (err.response?.status === 401) {
//       await deleteItem("auth_token");
//     }
//     return Promise.reject(err);
//   }
// );

// export default api;
