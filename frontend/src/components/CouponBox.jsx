import { useEffect, useState } from "react";
import { Tag, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "../context/CartContext";
import { api, apiError } from "../lib/api";
import { formatPrice } from "../lib/format";
import CouponTerms from "./CouponTerms";

export default function CouponBox() {
  const { coupon, setCouponCode, applyCoupon, totalPrice } = useCart();
  const [available, setAvailable] = useState([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/coupons/available").then(r => setAvailable(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const apply = async (value) => {
    const c = value.trim().toUpperCase();
    if (!c) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/coupons/validate", { code: c, subtotal: totalPrice });
      if (data.error) { setError(data.error); return; }
      applyCoupon(data);
      setCode("");
      toast.success(`${data.code} applied — you save ${formatPrice(data.discount)}`);
    } catch (err) {
      setError(apiError(err, "That code didn't work"));
    } finally {
      setBusy(false);
    }
  };

  if (coupon) {
    return (
      <div className="mb-6" data-testid="coupon-applied">
        <div className={`flex items-center justify-between gap-3 border border-dashed px-3 py-2.5 ${coupon.error || !coupon.offer ? "border-amber-400 bg-amber-50" : "border-emerald-400 bg-emerald-50"}`}>
          <div className="flex items-center gap-2 min-w-0">
            <Tag className="w-4 h-4 text-emerald-700 shrink-0" />
            <div className="min-w-0 font-body">
              <p className="text-sm font-semibold text-stone-900">{coupon.code}</p>
              <p className="text-xs text-stone-600 truncate">
                {!coupon.offer ? "This code is no longer available" : coupon.error ? coupon.error : `You save ${formatPrice(coupon.discount)}`}
              </p>
            </div>
          </div>
          <button onClick={() => setCouponCode("")} aria-label="Remove coupon" data-testid="coupon-remove" className="p-1 text-stone-500 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
        {coupon.offer && <CouponTerms coupon={coupon.offer} className="mt-1.5" />}
      </div>
    );
  }

  const suggestions = available;
  return (
    <div className="mb-6">
      {/* Not a <form>: on checkout this sits inside the order form, and submitting it would place the order. */}
      <div className="flex gap-2">
        <input value={code} onChange={e => { setCode(e.target.value); setError(""); }} placeholder="Coupon code" aria-label="Coupon code" data-testid="coupon-input"
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (code.trim() && !busy) apply(code); } }}
          className="flex-1 min-w-0 h-11 border border-stone-300 bg-white px-3 text-sm font-body uppercase placeholder:normal-case outline-none focus:border-gold" />
        <button type="button" onClick={() => apply(code)} disabled={busy || !code.trim()} data-testid="coupon-apply"
          className="h-11 px-5 bg-stone-900 text-white text-xs tracking-[0.15em] uppercase font-body font-semibold disabled:opacity-40">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
        </button>
      </div>
      {error && <p data-testid="coupon-error" className="text-xs text-red-700 font-body mt-2">{error}</p>}
      {suggestions.length > 0 && (
        <div className="mt-3 space-y-2">
          {suggestions.map(o => (
            <div key={o.code} className="border border-stone-200 bg-blush/60 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-xs font-body font-bold tracking-wider text-burgundy">{o.code}</span>
                  <span className="block text-[11px] font-body text-stone-600 truncate">{o.description || (o.discount_type === "percent" ? `${o.discount_value}% off` : `${formatPrice(o.discount_value)} off`)}{o.min_order ? ` · min ${formatPrice(o.min_order)}` : ""}</span>
                </span>
                <button type="button" onClick={() => apply(o.code)} disabled={busy}
                  className="text-[11px] uppercase tracking-wider font-body font-semibold text-stone-700 hover:text-burgundy disabled:opacity-50">Apply</button>
              </div>
              <CouponTerms coupon={o} className="mt-1" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
