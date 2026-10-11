import { useEffect, useState } from "react";

// Tiny hash router: "#/orders/abc123" -> { page: "orders", param: "abc123" }.
// Hash routing keeps the admin a static site (no server rewrites needed) and survives refreshes.
let navState = null;
let pendingState = null;

// Registered at import time, so it runs before components re-render on the same event:
// state only survives navigations made through navigate(), not plain links or the back button.
window.addEventListener("hashchange", () => {
  navState = pendingState;
  pendingState = null;
});

function parse() {
  const [page = "dashboard", param = null] = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return { page, param: param ? decodeURIComponent(param) : null };
}

export function navigate(path, state = null) {
  pendingState = state;
  const target = `#/${path.replace(/^\//, "")}`;
  if (window.location.hash === target) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else window.location.hash = target;
}

// State passed with the latest navigate() call (e.g. a search prefill); replaced on the next navigation.
// Not cleared on read, because React StrictMode runs state initializers twice in development.
export function takeNavState() {
  return navState;
}

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
