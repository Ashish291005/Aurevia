import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./lib/api";

// Dashboard stats are shared: the sidebar shows open-order / unread-message badges,
// and every page calls reloadStats() after a change so those counts stay current.
const AdminDataContext = createContext(null);

export function AdminDataProvider({ children }) {
  const [stats, setStats] = useState(null);

  const reloadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/stats");
      setStats(data);
    } catch { /* surfaced by the page that needs it */ }
  }, []);

  useEffect(() => {
    reloadStats();
    const id = setInterval(reloadStats, 60_000);
    const onFocus = () => reloadStats();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, [reloadStats]);

  return <AdminDataContext.Provider value={{ stats, reloadStats }}>{children}</AdminDataContext.Provider>;
}

export const useAdminData = () => useContext(AdminDataContext);
