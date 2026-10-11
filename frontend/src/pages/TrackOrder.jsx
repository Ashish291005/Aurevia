import { useEffect, useState, useCallback } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { Input } from "../components/ui/input";
import OrderDetails, { StatusBadge } from "../components/OrderDetails";
import { api, apiError } from "../lib/api";
import { formatDate } from "../lib/format";
import { usePageTitle } from "../lib/hooks";

export default function TrackOrder() {
  const [params] = useSearchParams();
  const { state } = useLocation();
  const [number, setNumber] = useState(params.get("number") || "");
  const [email, setEmail] = useState(state?.email || "");
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  usePageTitle("Track order");

  const lookup = useCallback(async (n, e) => {
    setLoading(true);
    setError("");
    setOrder(null);
    try {
      const { data } = await api.post("/orders/track", { number: n.trim(), email: e.trim() });
      setOrder(data);
    } catch (err) {
      setError(apiError(err, "We couldn't find that order."));
    } finally {
      setLoading(false);
    }
  }, []);

  // Coming from the order confirmation page: look the order up straight away.
  useEffect(() => {
    const n = params.get("number");
    if (n && state?.email) lookup(n, state.email);
  }, [params, state, lookup]);

  return (
    <div data-testid="track-order-page" className="pt-20 sm:pt-24">
      <div className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
        <div className="text-center mb-10">
          <p className="text-xs tracking-[0.2em] uppercase font-semibold text-gold mb-3 font-body">Order status</p>
          <h1 className="font-heading text-3xl sm:text-4xl text-stone-900">Track your order</h1>
          <p className="text-sm text-stone-500 font-body mt-2">Enter your order number and the email used at checkout.</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); lookup(number, email); }} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 mb-10">
          <Input data-testid="track-number" value={number} onChange={e => setNumber(e.target.value)} placeholder="Order number (AUR-...)" aria-label="Order number" required />
          <Input data-testid="track-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" aria-label="Email address" required />
          <button type="submit" disabled={loading} data-testid="track-submit"
            className="flex items-center justify-center gap-2 bg-burgundy text-white px-6 h-11 text-xs tracking-[0.2em] uppercase font-body font-semibold hover:bg-burgundy-dark disabled:opacity-60">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Track
          </button>
        </form>

        {error && <p data-testid="track-error" className="text-center text-sm font-body text-red-700 bg-red-50 border border-red-200 px-4 py-3">{error}</p>}

        {order && (
          <div className="bg-white border border-stone-200 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <p className="font-heading text-2xl text-stone-900">{order.number}</p>
                <p className="text-xs text-stone-500 font-body">Placed {formatDate(order.created_at, true)}</p>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <OrderDetails order={order} />
          </div>
        )}
      </div>
    </div>
  );
}
