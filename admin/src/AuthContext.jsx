import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, apiError } from "./lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = signed out
  const [notice, setNotice] = useState("");

  const checkAuth = useCallback(async () => {
    try {
      // { user: null } for signed-out visitors; also renews an expired login.
      const { data } = await api.get("/auth/session");
      setUser(data.user?.role === "admin" ? data.user : false);
    } catch {
      setUser(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    const onExpired = () => { setUser(false); setNotice("Your admin session ended. Please sign in again."); };
    window.addEventListener("admin:session-expired", onExpired);
    return () => window.removeEventListener("admin:session-expired", onExpired);
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      if (data.role !== "admin") {
        await api.post("/auth/logout").catch(() => {});
        return { success: false, error: "This account doesn't have admin access." };
      }
      setNotice("");
      setUser(data);
      return { success: true };
    } catch (e) {
      return { success: false, error: apiError(e, "Sign in failed") };
    }
  };

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, notice }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
