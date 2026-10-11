import { useCallback, useEffect, useMemo, useState } from "react";
import { ShoppingCart, Download, Mail, Phone, Truck, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api, apiError, STORE_URL } from "../lib/api";
import { navigate, takeNavState } from "../lib/router";
import { useAdminData } from "../AdminData";
import { money, formatDate, timeAgo, ORDER_STATUSES, STATUS_META, NEXT_STATUS, downloadCsv } from "../lib/format";
import { Card, PageHeader, StatusBadge, PaymentBadge, EmptyState, SearchInput, Button, ConfirmDialog, Drawer, Select } from "../components/ui";
import { Input } from "../components/Input";

function OrderDrawer({ order, onClose, onUpdated }) {
  const [tracking, setTracking] = useState(order.tracking_number || "");
  const [busy, setBusy] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const c = order.customer;
  const next = NEXT_STATUS[order.status];
  const final = order.status === "cancelled";

  useEffect(() => { setTracking(order.tracking_number || ""); }, [order]);

  const update = async (changes, key, message) => {
    setBusy(key);
    try {
      const { data } = await api.patch(`/admin/orders/${order.id}`, changes);
      onUpdated(data);
      toast.success(message);
    } catch (err) {
      toast.error(apiError(err, "Update failed"));
    } finally {
      setBusy(null);
      setConfirmCancel(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={order.number}
      subtitle={<span className="flex items-center gap-2">Placed {formatDate(order.created_at, true)} <StatusBadge status={order.status} /> <PaymentBadge status={order.payment_status} /></span>}
      footer={!final && order.status !== "delivered" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" className="text-red-700 hover:text-red-800" onClick={() => setConfirmCancel(true)} data-testid="order-cancel-btn">Cancel order</Button>
          {next && (
            <Button onClick={() => update({ status: next, ...(next === "shipped" ? { tracking_number: tracking } : {}) }, "next", `Order marked as ${STATUS_META[next].label.toLowerCase()}`)}
              loading={busy === "next"} data-testid="order-next-btn">
              {next === "processing" ? <Check className="w-4 h-4" /> : next === "shipped" ? <Truck className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              {next === "processing" ? "Confirm order" : next === "shipped" ? "Mark as shipped" : "Mark as delivered"}
            </Button>
          )}
        </div>
      )}
    >
      <div className="space-y-5">
        <Card className="p-4">
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Fulfilment</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="block text-xs text-stone-500 mb-1">Order status</span>
              <Select value={order.status} disabled={final || busy}
                onChange={(v) => (v === "cancelled" ? setConfirmCancel(true) : update({ status: v }, "status", `Status set to ${STATUS_META[v].label}`))}
                options={ORDER_STATUSES.map(s => ({ value: s, label: STATUS_META[s].label }))} className="w-full" data-testid="order-status-select" />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-stone-500 mb-1">Payment ({order.payment_method === "razorpay" ? `online${order.razorpay_payment_id ? ` · ${order.razorpay_payment_id}` : ""}` : "cash on delivery"})</span>
              <Select value={order.payment_status} disabled={busy}
                onChange={(v) => update({ payment_status: v }, "payment", `Payment marked ${v}`)}
                options={[{ value: "unpaid", label: "Unpaid" }, { value: "paid", label: "Paid" }, { value: "refunded", label: "Refunded" }]} className="w-full" data-testid="order-payment-select" />
            </label>
            <div className="sm:col-span-2">
              <span className="block text-xs text-stone-500 mb-1">Tracking number</span>
              <div className="flex gap-2">
                <Input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="e.g. 1Z999AA10123456784" maxLength={80} disabled={final} data-testid="order-tracking-input" className="rounded-md" />
                <Button variant="secondary" disabled={final || tracking === (order.tracking_number || "")} loading={busy === "tracking"}
                  onClick={() => update({ tracking_number: tracking }, "tracking", "Tracking number saved")}>Save</Button>
              </div>
            </div>
          </div>
          {final && <p className="text-xs text-stone-500 mt-3">Cancelled orders are final; stock was returned to inventory.</p>}
          {order.status === "delivered" && <p className="text-xs text-stone-500 mt-3">Delivered. For a return, set the status to Cancelled (items go back to stock) and mark the payment Refunded.</p>}
        </Card>

        <Card className="p-4">
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Items</h3>
          <ul className="divide-y divide-stone-100">
            {order.items.map((it, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <img src={it.image} alt="" className="w-11 h-12 object-cover rounded bg-stone-100" />
                <div className="flex-1 min-w-0 text-sm">
                  <a href={`${STORE_URL}/product/${it.product_id}`} target="_blank" rel="noreferrer" className="text-stone-900 hover:text-burgundy truncate block">{it.name}</a>
                  <p className="text-xs text-stone-500">{[it.size !== "One Size" && it.size, it.material !== "Standard" && it.material].filter(Boolean).join(" · ")} · {money(it.price)} × {it.quantity}</p>
                </div>
                <span className="text-sm tabular-nums text-stone-900">{money(it.line_total)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-stone-200 mt-2 pt-3 space-y-1 text-sm">
            <p className="flex justify-between text-stone-600"><span>Subtotal</span><span className="tabular-nums">{money(order.subtotal)}</span></p>
            {order.discount > 0 && <p className="flex justify-between text-emerald-700"><span>Coupon {order.coupon?.code}</span><span className="tabular-nums">−{money(order.discount)}</span></p>}
            <p className="flex justify-between text-stone-600"><span>Shipping</span><span className="tabular-nums">{order.shipping ? money(order.shipping) : "Free"}</span></p>
            <p className="flex justify-between font-semibold text-stone-900"><span>Total</span><span className="tabular-nums">{money(order.total)}</span></p>
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Card className="p-4 text-sm">
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Customer</h3>
            <p className="text-stone-900 font-medium">{c.first_name} {c.last_name}</p>
            <a href={`mailto:${c.email}?subject=${encodeURIComponent(`Your Aurevia order ${order.number}`)}`} className="flex items-center gap-2 text-gold hover:text-gold-hover mt-1"><Mail className="w-3.5 h-3.5" /> {c.email}</a>
            {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-stone-600 hover:text-burgundy mt-1"><Phone className="w-3.5 h-3.5" /> {c.phone}</a>}
            <p className="text-xs text-stone-400 mt-2">{order.user_id ? "Registered customer" : "Guest checkout"}</p>
          </Card>
          <Card className="p-4 text-sm">
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Shipping address</h3>
            <p className="text-stone-800">{c.first_name} {c.last_name}</p>
            <p className="text-stone-600">{c.address}</p>
            <p className="text-stone-600">{c.city}{c.state ? `, ${c.state}` : ""} {c.zip}</p>
            <p className="text-stone-600">{c.country}</p>
          </Card>
        </div>

        {order.notes && (
          <Card className="p-4 text-sm">
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Customer note</h3>
            <p className="text-stone-700 whitespace-pre-wrap">{order.notes}</p>
          </Card>
        )}

        <Card className="p-4">
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">History</h3>
          <ol className="space-y-2">
            {[...(order.history || [])].reverse().map((h, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="w-2 h-2 rounded-full bg-gold shrink-0" />
                <span className="text-stone-800">{STATUS_META[h.status]?.label || h.status}</span>
                <span className="text-xs text-stone-400">{formatDate(h.at, true)}{h.by ? ` · ${h.by === "customer" ? "by customer" : h.by}` : ""}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title={`Cancel ${order.number}?`}
        message={<>The order will be cancelled and its items returned to stock. This can't be undone. {order.payment_status === "paid" && <strong className="block mt-2">This order is marked paid — remember to refund the customer.</strong>}</>}
        confirmLabel="Cancel order"
        busy={busy === "cancel"}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => update({ status: "cancelled" }, "cancel", "Order cancelled and stock restored")}
      />
    </Drawer>
  );
}

export default function Orders({ param }) {
  const [orders, setOrders] = useState(null);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState(() => takeNavState()?.query || "");
  const { reloadStats } = useAdminData();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/orders");
      setOrders(data);
    } catch (err) {
      toast.error(apiError(err, "Could not load orders"));
      setOrders([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c = { all: orders?.length || 0 };
    ORDER_STATUSES.forEach(s => { c[s] = orders?.filter(o => o.status === s).length || 0; });
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (orders || []).filter(o =>
      (status === "all" || o.status === status) &&
      (!q || o.number.toLowerCase().includes(q) || o.customer.email.includes(q) || `${o.customer.first_name} ${o.customer.last_name}`.toLowerCase().includes(q))
    );
  }, [orders, status, query]);

  const selected = param && orders ? orders.find(o => o.id === param) : null;

  const onUpdated = (updated) => {
    setOrders(list => list.map(o => (o.id === updated.id ? updated : o)));
    reloadStats();
  };

  const exportCsv = () => {
    downloadCsv(`aurevia-orders-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Order", "Date", "Status", "Payment", "Customer", "Email", "Phone", "Items", "Subtotal", "Coupon", "Discount", "Shipping", "Total", "City", "State", "PIN"],
      ...filtered.map(o => [o.number, o.created_at, o.status, o.payment_status, `${o.customer.first_name} ${o.customer.last_name}`, o.customer.email, o.customer.phone,
        o.items.reduce((s, i) => s + i.quantity, 0), o.subtotal, o.coupon?.code || "", o.discount || 0, o.shipping, o.total, o.customer.city, o.customer.state || "", o.customer.zip]),
    ]);
  };

  return (
    <div data-testid="orders-page">
      <PageHeader
        title="Orders"
        subtitle="Confirm, ship and track customer orders. Cancelling returns items to stock."
        actions={<>
          <Button variant="secondary" onClick={load} title="Refresh"><RefreshCw className="w-4 h-4" /></Button>
          <Button variant="secondary" onClick={exportCsv} disabled={!filtered.length}><Download className="w-4 h-4" /> Export CSV</Button>
        </>}
      />

      <div className="flex gap-1 overflow-x-auto border-b border-stone-200 mb-4">
        {["all", ...ORDER_STATUSES].map(s => (
          <button key={s} onClick={() => setStatus(s)} data-testid={`orders-tab-${s}`}
            className={`px-3 pb-2.5 -mb-px border-b-2 text-sm whitespace-nowrap transition-colors ${status === s ? "border-burgundy text-burgundy font-semibold" : "border-transparent text-stone-500 hover:text-stone-800"}`}>
            {s === "all" ? "All" : STATUS_META[s].label} <span className="text-xs text-stone-400 tabular-nums">{counts[s]}</span>
          </button>
        ))}
      </div>

      <div className="mb-4">
        <SearchInput value={query} onChange={setQuery} placeholder="Search order #, customer or email" testId="orders-search" />
      </div>

      <Card className="overflow-x-auto">
        {orders === null ? (
          <p className="py-16 text-center text-sm text-stone-500">Loading orders...</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={ShoppingCart} title={orders.length ? "No matching orders" : "No orders yet"}
            text={orders.length ? "Try another status or search." : "When customers check out on the storefront, their orders appear here."} />
        ) : (
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium text-right">Items</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id} onClick={() => navigate(`orders/${o.id}`)} data-testid={`order-row-${o.number}`}
                  className="border-b border-stone-100 last:border-0 hover:bg-stone-50 cursor-pointer">
                  <td className="px-4 py-3">
                    <p className="font-medium text-stone-900">{o.number}</p>
                    <p className="text-xs text-stone-400" title={formatDate(o.created_at, true)}>{timeAgo(o.created_at)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-stone-800">{o.customer.first_name} {o.customer.last_name}</p>
                    <p className="text-xs text-stone-400">{o.customer.email}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-600">{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-900">{money(o.total)}</td>
                  <td className="px-4 py-3"><PaymentBadge status={o.payment_status} /></td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {selected && <OrderDrawer order={selected} onClose={() => navigate("orders")} onUpdated={onUpdated} />}
    </div>
  );
}
