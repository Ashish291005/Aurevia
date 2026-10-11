import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ChevronDown, Loader2, Package, User, Lock, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../context/ProductsContext";
import { Input } from "../components/ui/input";
import OrderDetails, { StatusBadge } from "../components/OrderDetails";
import { api, apiError } from "../lib/api";
import { formatDate, formatPrice } from "../lib/format";
import { usePageTitle } from "../lib/hooks";

const TABS = [
  { key: "orders", label: "Orders", Icon: Package },
  { key: "profile", label: "Profile", Icon: User },
  { key: "security", label: "Password", Icon: Lock },
];

function Label({ htmlFor, children }) {
  return <label htmlFor={htmlFor} className="text-xs tracking-[0.15em] uppercase font-body font-semibold text-stone-700 mb-2 block">{children}</label>;
}

function OrderCard({ order, onCancelled }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const { refresh } = useProducts();
  const count = order.items.reduce((s, i) => s + i.quantity, 0);

  const cancel = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/orders/${order.id}/cancel`);
      toast.success(`Order ${order.number} cancelled`);
      onCancelled(data);
      refresh();
    } catch (err) {
      toast.error(apiError(err, "Could not cancel this order"));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div data-testid={`account-order-${order.number}`} className="bg-white border border-stone-200">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 text-left hover:bg-stone-50">
        <div className="flex-1 min-w-[10rem]">
          <p className="font-body font-semibold text-stone-900">{order.number}</p>
          <p className="text-xs text-stone-500 font-body">{formatDate(order.created_at)} · {count} {count === 1 ? "item" : "items"}</p>
        </div>
        <StatusBadge status={order.status} />
        <span className="font-body text-stone-900 w-24 text-right">{formatPrice(order.total)}</span>
        <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-6 pt-2 border-t border-stone-100">
          <OrderDetails order={order} />
          {order.status === "pending" && (
            <div className="mt-6 flex items-center justify-end gap-3">
              {confirming ? (
                <>
                  <span className="text-sm font-body text-stone-600">Cancel this order?</span>
                  <button onClick={() => setConfirming(false)} disabled={busy} className="px-4 py-2 text-xs uppercase tracking-wider font-body font-semibold text-stone-600">Keep it</button>
                  <button onClick={cancel} disabled={busy} data-testid="confirm-cancel-order"
                    className="flex items-center gap-2 bg-red-700 text-white px-4 py-2 text-xs uppercase tracking-wider font-body font-semibold disabled:opacity-60">
                    {busy && <Loader2 className="w-3 h-3 animate-spin" />} Yes, cancel
                  </button>
                </>
              ) : (
                <button onClick={() => setConfirming(true)} data-testid="cancel-order-btn" className="text-xs uppercase tracking-wider font-body font-semibold text-red-700 hover:text-red-800">
                  Cancel order
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState(null);
  const load = useCallback(() => {
    api.get("/orders/mine").then(r => setOrders(r.data)).catch(err => { toast.error(apiError(err, "Could not load orders")); setOrders([]); });
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!orders) return <p className="py-12 text-center text-sm text-stone-500 font-body">Loading your orders...</p>;
  if (!orders.length) {
    return (
      <div className="text-center py-16 border border-dashed border-stone-300 bg-white">
        <Package className="w-10 h-10 text-stone-300 mx-auto mb-3" />
        <p className="font-heading text-2xl text-stone-800 mb-1">No orders yet</p>
        <p className="text-sm text-stone-500 font-body mb-6">When you place an order, it will appear here.</p>
        <Link to="/shop" className="text-xs tracking-[0.2em] uppercase font-body font-semibold text-burgundy hover:text-gold">Start shopping</Link>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {orders.map(o => (
        <OrderCard key={o.id} order={o} onCancelled={(updated) => setOrders(list => list.map(x => (x.id === updated.id ? updated : x)))} />
      ))}
    </div>
  );
}

function ProfileTab() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.patch("/auth/me", { name });
      updateUser(data);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(apiError(err, "Could not update profile"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={save} className="bg-white border border-stone-200 p-6 sm:p-8 max-w-lg space-y-5">
      <div>
        <Label htmlFor="acc-name">Full name</Label>
        <Input id="acc-name" data-testid="account-name" value={name} onChange={e => setName(e.target.value)} required maxLength={80} />
      </div>
      <div>
        <Label htmlFor="acc-email">Email</Label>
        <Input id="acc-email" value={user.email} disabled />
      </div>
      {user.created_at && <p className="text-xs text-stone-500 font-body">Member since {formatDate(user.created_at)}</p>}
      <button type="submit" disabled={saving || name.trim() === user.name} data-testid="account-save"
        className="flex items-center gap-2 bg-burgundy text-white px-8 py-3 text-xs tracking-[0.2em] uppercase font-body font-semibold hover:bg-burgundy-dark disabled:opacity-50">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save changes
      </button>
    </form>
  );
}

function SecurityTab() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    if (form.next.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    if (form.next !== form.confirm) { toast.error("New passwords don't match"); return; }
    setSaving(true);
    try {
      await api.post("/auth/change-password", { current_password: form.current, new_password: form.next });
      toast.success("Password updated");
      setForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      toast.error(apiError(err, "Could not update password"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={save} className="bg-white border border-stone-200 p-6 sm:p-8 max-w-lg space-y-5">
      <div>
        <Label htmlFor="pw-current">Current password</Label>
        <Input id="pw-current" type="password" autoComplete="current-password" value={form.current} onChange={set("current")} required />
      </div>
      <div>
        <Label htmlFor="pw-new">New password</Label>
        <Input id="pw-new" type="password" autoComplete="new-password" value={form.next} onChange={set("next")} required minLength={6} placeholder="At least 6 characters" />
      </div>
      <div>
        <Label htmlFor="pw-confirm">Confirm new password</Label>
        <Input id="pw-confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} required />
      </div>
      <button type="submit" disabled={saving}
        className="flex items-center gap-2 bg-burgundy text-white px-8 py-3 text-xs tracking-[0.2em] uppercase font-body font-semibold hover:bg-burgundy-dark disabled:opacity-50">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />} Update password
      </button>
    </form>
  );
}

export default function Account() {
  const { user, loading, logout } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(t => t.key === params.get("tab")) ? params.get("tab") : "orders";
  usePageTitle("My account");

  if (loading) return <div className="pt-40 pb-24 text-center font-body text-stone-500">Loading...</div>;
  if (!user) return <Navigate to="/login" state={{ from: "/account" }} replace />;

  return (
    <div data-testid="account-page" className="pt-20 sm:pt-24">
      <div className="max-w-5xl mx-auto px-6 sm:px-8 py-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs tracking-[0.2em] uppercase font-semibold text-gold mb-2 font-body">My account</p>
            <h1 className="font-heading text-3xl sm:text-4xl text-stone-900">Hello, {user.name.split(" ")[0]}</h1>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-xs tracking-wider uppercase font-body font-semibold text-stone-500 hover:text-red-700">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>

        <div className="flex gap-6 border-b border-stone-200 mb-8 overflow-x-auto">
          {TABS.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setParams({ tab: key }, { replace: true })} data-testid={`account-tab-${key}`}
              className={`flex items-center gap-2 pb-3 -mb-px border-b-2 text-xs tracking-[0.15em] uppercase font-body font-semibold whitespace-nowrap transition-colors ${tab === key ? "border-gold text-burgundy" : "border-transparent text-stone-500 hover:text-burgundy"}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {tab === "orders" && <OrdersTab />}
        {tab === "profile" && <ProfileTab />}
        {tab === "security" && <SecurityTab />}
      </div>
    </div>
  );
}
