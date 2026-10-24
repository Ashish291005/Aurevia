import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { fallbackStorefront } from "../data/products";

// Homepage content managed from the admin panel: hero slides, categories and offers.
const StorefrontContext = createContext({ slides: [], categories: [], offers: [], loading: true });
const CACHE_KEY = "aurevia_storefront";

// Render straight away from the last visit's copy (or the built-in one on a first visit) instead of an
// empty hero while the API answers; the fresh copy replaces it a moment later.
function initialData() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (Array.isArray(cached?.slides)) return cached;
  } catch { /* storage unavailable */ }
  return fallbackStorefront;
}

export function StorefrontProvider({ children }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data: d } = await api.get("/storefront");
      if (!Array.isArray(d?.slides)) throw new Error("Unexpected response");
      setData(d);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch { /* storage unavailable */ }
    } catch {
      // Backend unreachable (e.g. a frontend-only preview deploy): keep showing the copy we started with.
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({
    ...data,
    loading,
    refresh,
    // Wait for the fresh copy: never pop up an offer that may have ended since the cached visit.
    popupOffer: loading ? null : data.offers.find(o => o.show_popup) || null,
    bannerOffers: data.offers.filter(o => o.show_banner),
  }), [data, loading, refresh]);

  return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>;
}

export const useStorefront = () => useContext(StorefrontContext);
