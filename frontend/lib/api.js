import axios from "axios";
import { getItem, deleteItem } from "./secure";

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || "https://instapark.docusafe.ai/api/v1",
  timeout: 30000,
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
    if (err.response?.status === 401) {
      try { await deleteItem("auth_token"); } catch {}
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
