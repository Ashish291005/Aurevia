import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Minus, Plus, Trash2, ShoppingBag, AlertCircle, Truck } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useSettings } from "../context/SettingsContext";
import { Separator } from "../components/ui/separator";
import { imageUrl } from "../lib/api";
import { formatPrice } from "../lib/format";
import { usePageTitle } from "../lib/hooks";
import CouponBox from "../components/CouponBox";

export function FreeShippingProgress({ subtotal }) {
  const { free_shipping_threshold: threshold, shipping_fee } = useSettings();
  if (shipping_fee <= 0 || threshold <= 0) return null;
  const remaining = threshold - subtotal;
  const pct = Math.min(100, (subtotal / threshold) * 100);
  return (
    <div className="mb-6" data-testid="free-shipping-progress">
      <p className="text-xs font-body text-stone-600 mb-2 flex items-center gap-2">
        <Truck className="w-4 h-4 text-gold" />
        {remaining > 0 ? <>Add <strong className="text-burgundy">{formatPrice(remaining)}</strong> more for complimentary shipping</> : "You've unlocked complimentary shipping"}
      </p>
      <div className="h-1 bg-stone-200 overflow-hidden"><div className="h-full bg-gold transition-all" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function Cart() {
  const { lines, removeItem, updateQuantity, totalPrice, totalItems, purchasable, loading, discount } = useCart();
  const { shippingFor } = useSettings();
  const navigate = useNavigate();
  usePageTitle("Cart");

  if (loading && lines.length > 0) {
    return <div className="pt-40 pb-24 text-center font-body text-stone-500">Loading your cart...</div>;
  }

  if (lines.length === 0) {
    return (
      <div data-testid="cart-page-empty" className="pt-20 sm:pt-24 min-h-[60vh] flex items-center justify-center">
        <div className="text-center px-6">
          <ShoppingBag className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h1 className="font-heading text-3xl text-stone-900 mb-2">Your cart is empty</h1>
          <p className="text-sm text-stone-500 font-body mb-8">Discover our collection and find something you love.</p>
          <Link to="/shop" data-testid="empty-cart-shop-link"
            className="inline-flex items-center gap-3 bg-burgundy text-white px-10 py-4 text-xs tracking-[0.2em] uppercase font-body font-semibold hover:bg-burgundy-dark transition-colors">
            Shop Now
          </Link>
        </div>
      </div>
    );
  }

  const shipping = shippingFor(totalPrice);
  const hasProblems = lines.some(l => !l.available || l.quantity > l.max);

  return (
    <div data-testid="cart-page" className="pt-20 sm:pt-24">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-10 sm:py-14">
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="font-heading text-3xl sm:text-4xl text-stone-900 tracking-tight mb-10">
          Shopping Cart <span className="text-lg text-stone-400">({totalItems} {totalItems === 1 ? "item" : "items"})</span>
        </motion.h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12">
          <div className="lg:col-span-2">
            {lines.map(line => {
              const { product } = line;
              if (!line.available) {
                return (
                  <div key={line.key} data-testid={`cart-item-${line.key}`} className="flex items-center gap-4 py-6 border-b border-stone-200">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <p className="flex-1 text-sm font-body text-stone-600">
                      {product ? <><strong>{product.name}</strong> is sold out.</> : "An item in your cart is no longer available."}
                    </p>
                    <button onClick={() => removeItem(line.key)} className="text-xs tracking-wider uppercase font-body font-semibold text-burgundy hover:text-gold">Remove</button>
                  </div>
                );
              }
              const qty = Math.min(line.quantity, line.max);
              return (
                <div key={line.key} data-testid={`cart-item-${line.key}`} className="flex gap-4 sm:gap-6 py-6 border-b border-stone-200">
                  <Link to={`/product/${product.id}`} className="w-24 h-28 sm:w-28 sm:h-32 shrink-0 overflow-hidden bg-stone-100">
                    <img src={imageUrl(product.images[0])} alt={product.name} className="w-full h-full object-cover" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-4">
                      <Link to={`/product/${product.id}`} className="font-heading text-lg text-stone-900 hover:text-burgundy transition-colors truncate">{product.name}</Link>
                      <p className="text-sm font-body text-stone-900 font-semibold whitespace-nowrap">{formatPrice(product.price * qty)}</p>
                    </div>
                    <p className="text-xs text-stone-500 font-body mt-1">
                      {[line.size !== "One Size" && line.size, line.material !== "Standard" && line.material].filter(Boolean).join(" · ") || " "}
                    </p>
                    <p className="text-xs text-stone-500 font-body mt-1">{formatPrice(product.price)} each</p>
                    {line.quantity > line.max && (
                      <p className="text-xs text-amber-700 font-body mt-1">Only {line.max} left — quantity adjusted.</p>
                    )}
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center border border-stone-300">
                        <button data-testid={`qty-minus-${line.key}`} onClick={() => updateQuantity(line.key, qty - 1)}
                          className="w-9 h-9 flex items-center justify-center text-stone-600 hover:text-burgundy" aria-label="Decrease quantity">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span data-testid={`qty-value-${line.key}`} className="w-10 text-center text-sm font-body">{qty}</span>
                        <button data-testid={`qty-plus-${line.key}`} onClick={() => updateQuantity(line.key, qty + 1)} disabled={qty >= line.max}
                          className="w-9 h-9 flex items-center justify-center text-stone-600 hover:text-burgundy disabled:opacity-30" aria-label="Increase quantity">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button data-testid={`remove-item-${line.key}`} onClick={() => removeItem(line.key)}
                        className="flex items-center gap-1 text-xs font-body text-stone-400 hover:text-red-600" aria-label="Remove item">
                        <Trash2 className="w-4 h-4" /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="lg:sticky lg:top-28 lg:self-start bg-white p-6 sm:p-8 border border-stone-200">
            <h2 className="font-heading text-xl text-stone-900 mb-6">Order Summary</h2>
            <FreeShippingProgress subtotal={totalPrice} />
            <CouponBox />
            <div className="space-y-3 mb-6 text-sm font-body">
              <div className="flex justify-between">
                <span className="text-stone-500">Subtotal</span>
                <span data-testid="cart-subtotal" className="text-stone-900">{formatPrice(totalPrice)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Coupon discount</span>
                  <span data-testid="cart-discount">−{formatPrice(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-stone-500">Shipping</span>
                <span data-testid="cart-shipping" className={shipping === 0 ? "text-gold" : "text-stone-900"}>{shipping === 0 ? "Complimentary" : formatPrice(shipping)}</span>
              </div>
            </div>
            <Separator className="mb-6" />
            <div className="flex justify-between mb-8">
              <span className="font-body font-semibold text-stone-900">Total</span>
              <span data-testid="cart-total" className="font-heading text-2xl text-burgundy">{formatPrice(totalPrice - discount + shipping)}</span>
            </div>
            {hasProblems && <p className="text-xs text-amber-700 font-body mb-4">Some items changed since you added them. Unavailable items won't be ordered.</p>}
            <button onClick={() => navigate("/checkout")} disabled={purchasable.length === 0} data-testid="proceed-checkout-btn"
              className="w-full text-center bg-burgundy text-white py-4 text-xs tracking-[0.2em] uppercase font-body font-semibold hover:bg-burgundy-dark transition-colors disabled:bg-stone-400">
              Proceed to Checkout
            </button>
            <Link to="/shop" className="block text-center text-xs text-stone-500 hover:text-gold transition-colors font-body mt-4 tracking-wider uppercase">
              Continue Shopping
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
