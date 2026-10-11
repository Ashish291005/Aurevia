import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

// Homepage content managed from the admin panel: hero slides, categories and offers.
const StorefrontContext = createContext({ slides: [], categories: [], offers: [], loading: true });

export function StorefrontProvider({ children }) {
  const [data, setData] = useState({ slides: [], categories: [], offers: [] });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data: d } = await api.get("/storefront");
      setData(d);
    } catch { /* storefront falls back to built-in content */ }
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
