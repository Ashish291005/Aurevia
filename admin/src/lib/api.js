import axios from "axios";

// The Vite dev server proxies /api and /uploads to the backend (see vite.config.js).
// VITE_API_SUBDOMAIN=api (the Hostinger build) = backend at api.<this site's domain>, same as the storefront.
const sub = import.meta.env.VITE_API_SUBDOMAIN;
export const API_ORIGIN = sub ? `https://${sub}.${window.location.hostname.replace(/^www\./, "")}` : "";
export const api = axios.create({ baseURL: `${API_ORIGIN}/api`, withCredentials: true });

// Public storefront, used for "View in store" links.
// Locally the storefront runs on :3000; in production it shares the admin's domain (admin lives at /admin).
export const STORE_URL = (import.meta.env.VITE_STORE_URL || (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin)).replace(/\/$/, "");

// Access tokens live 15 minutes: on a 401, try the refresh token once and replay the request.
let refreshing = null;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const url = original?.url || "";
    // Signed in, but no longer as an admin (role changed, or another account signed in on this browser).
    if (error.response?.status === 403 && url.startsWith("/admin/")) {
      window.dispatchEvent(new Event("admin:session-expired"));
      throw error;
    }
    if (error.response?.status !== 401 || original._retried || url.startsWith("/auth/")) {
      throw error;
    }
    original._retried = true;
    refreshing = refreshing || api.post("/auth/refresh").finally(() => { refreshing = null; });
    try {
      await refreshing;
    } catch {
      window.dispatchEvent(new Event("admin:session-expired"));
      throw error;
    }
    return api(original);
  }
);

export function apiError(err, fallback = "Something went wrong. Please try again.") {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.response ? fallback : "Cannot reach the server. Is the backend running?";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(d => d?.msg).filter(Boolean).join(" ") || fallback;
  return fallback;
}
