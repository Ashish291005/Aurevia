import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useProducts } from "./ProductsContext";

const WishlistContext = createContext(null);
const STORAGE_KEY = "aurevia_wishlist";

function loadWishlist() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter(id => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }) {
  const [ids, setIds] = useState(loadWishlist);
  const idsRef = useRef(ids);
  const { products } = useProducts();

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch { /* storage unavailable */ }
  }, [ids]);

  const update = useCallback((next) => {
    idsRef.current = next;
    setIds(next);
  }, []);

  // Returns true when the product was added, false when it was removed.
  const toggle = useCallback((id) => {
    const added = !idsRef.current.includes(id);
    update(added ? [id, ...idsRef.current] : idsRef.current.filter(x => x !== id));
    return added;
  }, [update]);

  const value = useMemo(() => ({
    ids,
    has: (id) => ids.includes(id),
    toggle,
    remove: (id) => update(idsRef.current.filter(x => x !== id)),
    // Only show products that still exist in the store.
    items: ids.map(id => products.find(p => p.id === id)).filter(Boolean),
    count: ids.filter(id => products.length === 0 || products.some(p => p.id === id)).length,
  }), [ids, toggle, update, products]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export const useWishlist = () => useContext(WishlistContext);
