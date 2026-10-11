import { useEffect } from "react";
import { useLocation } from "react-router-dom";

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
