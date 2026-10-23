import axios from "axios";

// Empty REACT_APP_BACKEND_URL = same origin (the CRA dev server proxies /api and /uploads to the backend),
// which keeps the auth cookies first-party.
// REACT_APP_API_SUBDOMAIN=api (the Hostinger build) = backend at api.<this site's domain>, e.g. the shop at
// aurevia.in talks to api.aurevia.in; same domain, so cookies still count as first-party.
const siteDomain = () => window.location.hostname.replace(/^www\./, "");
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL
  || (process.env.REACT_APP_API_SUBDOMAIN ? `https://${process.env.REACT_APP_API_SUBDOMAIN}.${siteDomain()}` : "");
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, withCredentials: true });

// Access tokens live 15 minutes: on a 401, try the refresh token once and replay the request.
let refreshing = null;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const url = original?.url || "";
    if (error.response?.status !== 401 || original._retried || url.startsWith("/auth/")) {
      throw error;
    }
    original._retried = true;
    refreshing = refreshing || api.post("/auth/refresh").finally(() => { refreshing = null; });
    await refreshing;
    return api(original);
  }
);

export function apiError(err, fallback = "Something went wrong. Please try again.") {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(d => d?.msg).filter(Boolean).join(" ") || fallback;
  return fallback;
}

// Uploaded images are stored as "/uploads/..." paths on the backend.
export const imageUrl = (src) => (src && src.startsWith("/uploads/") ? `${BACKEND_URL}${src}` : src);
