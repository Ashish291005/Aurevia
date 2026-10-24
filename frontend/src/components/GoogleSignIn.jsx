import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

// Google's official "Sign in with Google" button (Google Identity Services). Renders nothing until the
// backend reports a Google client ID, so the store works the same before Google sign-in is set up.
let providersPromise = null;
let scriptPromise = null;

const getClientId = () => {
  providersPromise = providersPromise || api.get("/auth/providers").then(r => r.data?.google_client_id || null).catch(() => null);
  return providersPromise;
};

const loadScript = () => {
  scriptPromise = scriptPromise || new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = resolve;
    s.onerror = () => { scriptPromise = null; reject(new Error("Google script failed to load")); };
    document.head.appendChild(s);
  });
  return scriptPromise;
};

export default function GoogleSignIn({ text = "continue_with", onSuccess, onError, divider = "or" }) {
  const { loginWithGoogle } = useAuth();
  const box = useRef(null);
  const [ready, setReady] = useState(false);
  // Kept in a ref so re-renders don't re-create Google's button.
  const handlers = useRef({ onSuccess, onError, loginWithGoogle });
  handlers.current = { onSuccess, onError, loginWithGoogle };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const clientId = await getClientId();
      if (!clientId || cancelled) return;
      try { await loadScript(); } catch { return; }
      if (cancelled || !box.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        ux_mode: "popup",
        callback: async ({ credential }) => {
          const result = await handlers.current.loginWithGoogle(credential);
          if (result.success) handlers.current.onSuccess?.(result.user);
          else handlers.current.onError?.(result.error);
        },
      });
      window.google.accounts.id.renderButton(box.current, {
        type: "standard", theme: "outline", size: "large", shape: "rectangular", text, logo_alignment: "center",
        width: Math.min(box.current.offsetWidth || 400, 400),
      });
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [text]);

  return (
    <div className={ready ? "" : "hidden"} data-testid="google-sign-in">
      <div ref={box} className="w-full flex justify-center min-h-[44px]" />
      {divider && (
        <div className="flex items-center gap-3 my-6 text-[11px] uppercase tracking-[0.2em] text-stone-400 font-body">
          <span className="flex-1 h-px bg-stone-200" />{divider}<span className="flex-1 h-px bg-stone-200" />
        </div>
      )}
    </div>
  );
}
