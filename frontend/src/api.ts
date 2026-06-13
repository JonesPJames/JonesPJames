import axios, { AxiosInstance } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Natvrdo zapsaná URL, aby mobil nikdy nevzal prázdný řetězec
const BASE = "https://jonespjames-production.up.railway.app";

export const TOKEN_KEY = "rp_token";

export const api: AxiosInstance = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 60000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function setToken(token: string | null) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export function getApiErrorMessage(err: any): string {
  const d = err?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e: any) => e?.msg || JSON.stringify(e)).join(" ");
  if (d && typeof d.msg === "string") return d.msg;
  return err?.message || "Něco se nepovedlo";
}

export function pdfUrl(path: string): string {
  return `${BASE}${path}`;
}