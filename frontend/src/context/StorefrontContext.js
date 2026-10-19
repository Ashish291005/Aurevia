import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { fallbackStorefront } from "../data/products";

// Homepage content managed from the admin panel: hero slides, categories and offers.
const StorefrontContext = createContext({ slides: [], categories: [], offers: [], loading: true });

export function StorefrontProvider({ children }) {
  const [data, setData] = useState({ slides: [], categories: [], offers: [] });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data: d } = await api.get("/storefront");
      if (!Array.isArray(d?.slides)) throw new Error("Unexpected response");
      setData(d);
    } catch {
      // Backend unreachable (e.g. a frontend-only preview deploy): show the built-in demo content.
      setData(fallbackStorefront);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({
    ...data,
    loading,
    refresh,
    popupOffer: data.offers.find(o => o.show_popup) || null,
    bannerOffers: data.offers.filter(o => o.show_banner),
    findCoupon: (code) => data.offers.find(o => o.code && o.code === code?.trim().toUpperCase()) || null,
  }), [data, loading, refresh]);

  return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>;
}

export const useStorefront = () => useContext(StorefrontContext);
