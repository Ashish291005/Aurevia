import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const DEFAULTS = {
  announcement_enabled: false,
  announcement_text: "",
  shipping_fee: 79,
  free_shipping_threshold: 999,
  store_email: "hello@aurevia.in",
  store_phone: "+91 98765 43210",
  store_address: "Shop 12, Linking Road, Bandra West, Mumbai 400050",
  instagram_url: "",
  facebook_url: "",
  twitter_url: "",
  whatsapp_number: "",
  ticker_messages: [],
};

const SettingsContext = createContext(DEFAULTS);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    api.get("/settings").then(r => setSettings({ ...DEFAULTS, ...r.data })).catch(() => {});
  }, []);

  const value = useMemo(() => ({
    ...settings,
    showAnnouncement: settings.announcement_enabled && settings.announcement_text.trim().length > 0,
    // Mirrors the backend's shipping rule so the cart total matches the order total.
    shippingFor: (subtotal) => {
      const threshold = settings.free_shipping_threshold;
      if (settings.shipping_fee <= 0 || (threshold > 0 && subtotal >= threshold)) return 0;
      return settings.shipping_fee;
    },
  }), [settings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
