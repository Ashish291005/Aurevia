import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

// Re-runs `refresh` while the page stays open: when the customer comes back to the tab and every
// `intervalMs` while it's visible, so changes made in admin (e.g. order shipped) appear without a reload.
export function useLiveRefresh(refresh, { enabled = true, intervalMs = 30000 } = {}) {
  const latest = useRef(refresh);
  useEffect(() => { latest.current = refresh; }, [refresh]);
  useEffect(() => {
    if (!enabled) return undefined;
    let last = Date.now();
    const run = () => {
      // focus and visibilitychange often fire together; one refresh is enough.
      if (document.visibilityState !== "visible" || Date.now() - last < 2000) return;
      last = Date.now();
      latest.current();
    };
    const timer = setInterval(run, intervalMs);
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", run);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, [enabled, intervalMs]);
}

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | Aurevia` : "Aurevia | Fashion Jewellery & Gifts";
  }, [title]);
}

// Scroll to the top on page navigation (not on query-string changes like shop filters).
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
