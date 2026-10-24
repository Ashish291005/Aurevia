import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, apiError } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      // Returns { user: null } for guests and silently renews an expired login.
      const { data } = await api.get("/auth/session");
      setUser(data.user || false);
    } catch {
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setUser(data);
      return { success: true, user: data };
    } catch (e) {
      return { success: false, error: apiError(e, e.message) };
    }
  };

  const register = async (name, email, password) => {
    try {
      const { data } = await api.post("/auth/register", { name, email, password });
      setUser(data);
      return { success: true, user: data };
    } catch (e) {
      return { success: false, error: apiError(e, e.message) };
    }
  };

  // `credential` is the ID token from Google's "Sign in with Google" button; the backend verifies it.
  const loginWithGoogle = async (credential) => {
    try {
      const { data } = await api.post("/auth/google", { credential });
      setUser(data);
      return { success: true, user: data };
    } catch (e) {
      return { success: false, error: apiError(e, "Google sign-in failed. Please try again.") };
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch { /* ignore */ }
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, register, logout, updateUser: setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
