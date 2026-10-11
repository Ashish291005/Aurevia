import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Banknote, Loader2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../context/ProductsContext";
import { useSettings } from "../context/SettingsContext";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import { api, apiError, imageUrl } from "../lib/api";
import { formatPrice } from "../lib/format";
import { usePageTitle } from "../lib/hooks";
import CouponBox from "../components/CouponBox";

const SAVED_KEY = "aurevia_checkout_address";
const EMPTY = { first_name: "", last_name: "", email: "", phone: "", address: "", city: "", state: "", zip: "", country: "India" };

const STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"];

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "null"); } catch { return null; }
}

function Field({ label, id, optional, className = "", children }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-xs tracking-[0.15em] uppercase font-body font-semibold text-stone-700 mb-2 block">
        {label} {optional && <span className="normal-case tracking-normal font-normal text-stone-400">(optional)</span>}
      </label>
      {children}
    </div>
  );
}

export default function Checkout() {
  const { purchasable, totalPrice, clearCart, loading, coupon, discount } = useCart();
  const { user } = useAuth();
  const { refresh } = useProducts();
  const { shippingFor } = useSettings();
  const navigate = useNavigate();
  const placed = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [remember, setRemember] = useState(true);
  const [notes, setNotes] = useState("");
  const [form, setForm] = useState(() => {
    const saved = loadSaved();
    const [first = "", ...rest] = (user?.name || "").split(" ");
    // Saved details fill the address; a signed-in customer always uses their account email.
    return { ...EMPTY, first_name: first, last_name: rest.join(" "), ...(saved || {}), ...(user ? { email: user.email } : {}) };
  });
  usePageTitle("Checkout");

  // Auth may resolve after the first render; fill in the account details if the fields are still empty.
  useEffect(() => {
    if (!user) return;
    const [first = "", ...rest] = (user.name || "").split(" ");
    setForm(f => ({
      ...f,
      email: user.email,
      first_name: f.first_name || first,
      last_name: f.last_name || rest.join(" "),
    }));
  }, [user]);

  if (placed.current) return null;
  if (loading) return <div className="pt-40 pb-24 text-center font-body text-stone-500">Loading...</div>;
  if (purchasable.length === 0) return <Navigate to="/cart" replace />;

  const shipping = shippingFor(totalPrice);
  const update = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data: order } = await api.post("/orders", {
        customer: { ...form, country: "India" },
        notes,
        coupon_code: coupon && coupon.offer && !coupon.error ? coupon.code : "",
        payment_method: "cod",
        items: purchasable.map(l => ({ product_id: l.productId, size: l.size, material: l.material, quantity: Math.min(l.quantity, l.max) })),
      });
      try {
        if (remember) localStorage.setItem(SAVED_KEY, JSON.stringify(form));
        else localStorage.removeItem(SAVED_KEY);
      } catch { /* storage unavailable */ }
      placed.current = true;
      clearCart();
      refresh();
      navigate(`/order-confirmation/${order.number}`, { replace: true, state: { order } });
    } catch (err) {
      toast.error(apiError(err, "We couldn't place your order. Please try again."));
      // Stock or availability may have changed; reload so the summary is accurate.
      if (err.response?.status === 409) refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="checkout-page" className="pt-20 sm:pt-24">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-10 sm:py-14">
        <Link to="/cart" className="inline-flex items-center gap-1 text-xs font-body text-stone-500 hover:text-gold mb-6"><ChevronLeft className="w-4 h-4" /> Back to cart</Link>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="font-heading text-3xl sm:text-4xl text-stone-900 tracking-tight mb-10">Checkout</motion.h1>

        {!user && (
          <p className="text-sm font-body text-stone-600 bg-white border border-stone-200 px-4 py-3 mb-8">
            Have an account? <Link to="/login" state={{ from: "/checkout" }} className="text-gold font-semibold hover:text-gold-hover">Sign in</Link> to track this order in your account — or continue as a guest.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12">
            <div className="lg:col-span-2 space-y-10">
              <section>
                <h2 className="font-heading text-xl text-stone-900 mb-6">Contact</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field label="Email" id="co-email">
                    <Input id="co-email" data-testid="checkout-email" type="email" autoComplete="email" value={form.email} onChange={update("email")} required />
                  </Field>
                  <Field label="Mobile number" id="co-phone">
                    <Input id="co-phone" data-testid="checkout-phone" type="tel" autoComplete="tel" value={form.phone} onChange={update("phone")} maxLength={16}
                      required pattern="^(\+91[\s\-]?)?[6-9][0-9]{4}[\s\-]?[0-9]{5}$" title="Enter a 10-digit Indian mobile number" placeholder="98765 43210" />
                  </Field>
                </div>
              </section>

              <section>
                <h2 className="font-heading text-xl text-stone-900 mb-6">Shipping address</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field label="First name" id="co-first">
                    <Input id="co-first" data-testid="checkout-firstname" autoComplete="given-name" value={form.first_name} onChange={update("first_name")} required maxLength={60} />
                  </Field>
                  <Field label="Last name" id="co-last">
                    <Input id="co-last" data-testid="checkout-lastname" autoComplete="family-name" value={form.last_name} onChange={update("last_name")} required maxLength={60} />
                  </Field>
                  <Field label="Address (house no., street, area)" id="co-address" className="sm:col-span-2">
                    <Input id="co-address" data-testid="checkout-address" autoComplete="street-address" value={form.address} onChange={update("address")} required maxLength={200} />
                  </Field>
                  <Field label="City" id="co-city">
                    <Input id="co-city" data-testid="checkout-city" autoComplete="address-level2" value={form.city} onChange={update("city")} required maxLength={80} />
                  </Field>
                  <Field label="State" id="co-state">
                    <select id="co-state" data-testid="checkout-state" autoComplete="address-level1" value={form.state} onChange={update("state")} required
                      className="flex h-11 w-full border border-stone-300 bg-white px-3 text-sm font-body outline-none focus:border-gold">
                      <option value="">Select state</option>
                      {STATES.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </Field>
                  <Field label="PIN code" id="co-zip">
                    <Input id="co-zip" data-testid="checkout-zip" autoComplete="postal-code" inputMode="numeric" value={form.zip} onChange={update("zip")} required pattern="^[1-9][0-9]{5}$" title="Enter a 6-digit PIN code" maxLength={6} />
                  </Field>
                  <Field label="Country" id="co-country">
                    <Input id="co-country" value="India" disabled />
                  </Field>
                  <Field label="Order notes" id="co-notes" optional className="sm:col-span-2">
                    <textarea id="co-notes" data-testid="checkout-notes" rows={3} maxLength={500} value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="Gift message, delivery instructions..."
                      className="w-full border border-stone-300 bg-white px-3 py-2 text-sm font-body outline-none focus:border-gold resize-y" />
                  </Field>
                </div>
                <label className="mt-5 flex items-center gap-3 text-sm font-body text-stone-600 cursor-pointer">
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="w-4 h-4 accent-burgundy" />
                  Save these details for next time (on this device)
                </label>
              </section>

              <section>
                <h2 className="font-heading text-xl text-stone-900 mb-6">Payment</h2>
                <label className="flex items-start gap-4 border-2 border-burgundy bg-white p-4 cursor-pointer">
                  <input type="radio" name="payment" checked readOnly className="mt-1 accent-burgundy" />
                  <span>
                    <span className="flex items-center gap-2 font-body font-semibold text-stone-900"><Banknote className="w-4 h-4 text-gold" /> Cash on delivery</span>
                    <span className="block text-sm text-stone-500 font-body mt-1">Pay when your order arrives. We'll confirm by email before shipping.</span>
                  </span>
                </label>
              </section>
            </div>

            <div className="bg-white p-6 sm:p-8 border border-stone-200 self-start lg:sticky lg:top-28">
              <h2 className="font-heading text-xl text-stone-900 mb-6">Order Summary</h2>
              <ul className="space-y-4 mb-6">
                {purchasable.map(line => {
                  const qty = Math.min(line.quantity, line.max);
                  return (
                    <li key={line.key} className="flex gap-3">
                      <div className="relative w-14 h-16 shrink-0 bg-stone-100">
                        <img src={imageUrl(line.product.images[0])} alt="" className="w-full h-full object-cover" />
                        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-stone-700 text-white text-[10px] flex items-center justify-center font-body">{qty}</span>
                      </div>
                      <div className="flex-1 min-w-0 text-sm font-body">
                        <p className="text-stone-800 truncate">{line.product.name}</p>
                        <p className="text-xs text-stone-500">{[line.size !== "One Size" && line.size, line.material !== "Standard" && line.material].filter(Boolean).join(" · ")}</p>
                      </div>
                      <span className="text-sm font-body text-stone-900 whitespace-nowrap">{formatPrice(line.product.price * qty)}</span>
                    </li>
                  );
                })}
              </ul>
              <CouponBox />
              <Separator className="mb-4" />
              <div className="space-y-2 text-sm font-body">
                <div className="flex justify-between"><span className="text-stone-500">Subtotal</span><span>{formatPrice(totalPrice)}</span></div>
                {discount > 0 && <div className="flex justify-between text-emerald-700"><span>Coupon ({coupon.code})</span><span data-testid="checkout-discount">−{formatPrice(discount)}</span></div>}
                <div className="flex justify-between"><span className="text-stone-500">Shipping</span><span className={shipping === 0 ? "text-gold" : ""}>{shipping === 0 ? "Complimentary" : formatPrice(shipping)}</span></div>
              </div>
              <Separator className="my-4" />
              <div className="flex justify-between mb-8">
                <span className="font-body font-semibold text-stone-900">Total</span>
                <span data-testid="checkout-total" className="font-heading text-2xl text-burgundy">{formatPrice(totalPrice - discount + shipping)}</span>
              </div>
              <button data-testid="place-order-btn" type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-burgundy text-white py-4 text-xs tracking-[0.2em] uppercase font-body font-semibold hover:bg-burgundy-dark transition-colors disabled:opacity-60">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {submitting ? "Placing order..." : `Place Order · ${formatPrice(totalPrice - discount + shipping)}`}
              </button>
              <p className="text-[11px] text-stone-400 font-body text-center mt-3">By placing your order you agree to our terms and 7-day return policy.</p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
