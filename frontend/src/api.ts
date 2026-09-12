import axios from "axios";

export const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api", withCredentials:true });

let accessToken = "";
export const auth = {
  get token(){ return accessToken; },
  set token(v:string){ accessToken = v; }
};

API.interceptors.request.use(config => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing: Promise<string> | null = null;
API.interceptors.response.use(r=>r, async error => {
  const original = error.config;
  if (error.response?.status === 401 && !original._retry && !original.url?.includes("/auth/")) {
    original._retry = true;
    refreshing ||= API.post("/auth/refresh").then(r => { accessToken=r.data.accessToken; return accessToken; }).finally(()=>refreshing=null);
    await refreshing;
    original.headers.Authorization = `Bearer ${accessToken}`;
    return API(original);
  }
  return Promise.reject(error);
});
