import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useProducts } from "./ProductsContext";
import { useStorefront } from "./StorefrontContext";
import { couponDiscount } from "../lib/format";

const CartContext = createContext(null);
const STORAGE_KEY = "aurevia_cart";
const COUPON_KEY = "aurevia_coupon";

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    // Older carts stored a full product snapshot; keep only the reference + options.
    return saved
      .map(i => ({ key: i.key, productId: i.productId || i.product?.id, size: i.size, material: i.material, quantity: i.quantity }))
      .filter(i => i.productId && i.quantity > 0);
  } catch {
    return [];
  }
}

const maxFor = (product) => (typeof product?.stock === "number" ? product.stock : 99);

export function CartProvider({ children }) {
  const [items, setItemsState] = useState(loadCart);
  const itemsRef = useRef(items);
  const { products, loading } = useProducts();
  const { findCoupon } = useStorefront();
  const [couponCode, setCouponCode] = useState(() => { try { return localStorage.getItem(COUPON_KEY) || ""; } catch { return ""; } });

  useEffect(() => {
    try { couponCode ? localStorage.setItem(COUPON_KEY, couponCode) : localStorage.removeItem(COUPON_KEY); } catch { /* storage unavailable */ }
  }, [couponCode]);

  // Keep a synchronous copy so actions can compute (and report) results immediately.
  const setItems = useCallback((updater) => {
    const next = typeof updater === "function" ? updater(itemsRef.current) : updater;
    itemsRef.current = next;
    setItemsState(next);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* storage unavailable */ }
  }, [items]);

  // Resolve cart lines against the live catalog so prices and stock are always current.
  const lines = useMemo(() => items.map(item => {
    const product = products.find(p => p.id === item.productId);
    const available = Boolean(product) && maxFor(product) > 0;
    return { ...item, product, available, max: maxFor(product) };
  }), [items, products]);

  const purchasable = lines.filter(l => l.available);
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = purchasable.reduce((sum, l) => sum + l.product.price * Math.min(l.quantity, l.max), 0);

  // The applied coupon is re-evaluated whenever the cart changes (minimum order, % of subtotal).
  const couponOffer = couponCode ? findCoupon(couponCode) : null;
  const { discount, error: couponError } = couponDiscount(couponOffer, totalPrice);
  const coupon = couponCode ? { code: couponCode, offer: couponOffer, discount, error: couponOffer ? couponError : "" } : null;

  const addItem = useCallback((product, size, material, quantity = 1) => {
    const key = `${product.id}-${size}-${material}`;
    const max = maxFor(product);
    const prev = itemsRef.current;
    const inCart = prev.filter(i => i.productId === product.id).reduce((s, i) => s + i.quantity, 0);
    const allowed = Math.max(0, Math.min(quantity, max - inCart));
    if (allowed === 0) {
      return { ok: false, message: max === 0 ? `${product.name} is sold out` : `You already have all ${max} available in your cart` };
    }
    const existing = prev.find(i => i.key === key);
    setItems(existing
      ? prev.map(i => (i.key === key ? { ...i, quantity: i.quantity + allowed } : i))
      : [...prev, { key, productId: product.id, size, material, quantity: allowed }]);
    return allowed < quantity ? { ok: true, message: `Only ${allowed} more could be added (limited stock)` } : { ok: true };
  }, [setItems]);

  const removeItem = useCallback((key) => setItems(prev => prev.filter(i => i.key !== key)), [setItems]);

  const updateQuantity = useCallback((key, quantity) => {
    setItems(prev => (quantity <= 0 ? prev.filter(i => i.key !== key) : prev.map(i => (i.key === key ? { ...i, quantity } : i))));
  }, [setItems]);

  const clearCart = useCallback(() => { setItems([]); setCouponCode(""); }, [setItems]);

  return (
    <CartContext.Provider value={{ items, lines, purchasable, loading, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, coupon, discount: coupon && !coupon.error ? discount : 0, setCouponCode }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
