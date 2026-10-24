import { useEffect, useState } from "react";
import { Truck, RefreshCw, FileDown, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "../lib/api";
import { navigate } from "../lib/router";
import { Card, Button, ConfirmDialog } from "./ui";
import { Input } from "./Input";

// Book a courier for this order through NimbusPost, then follow and manage the shipment.
// Fetched each time an order opens, so changes saved in Settings → Shipping apply straight away.
const loadShipping = () => api.get("/admin/shipping").then(r => r.data).catch(() => null);

export default function NimbusCard({ order, onUpdated }) {
  const n = order.nimbus || {};
  const [cfg, setCfg] = useState(null);
  const [pkg, setPkg] = useState({ package_weight: "", package_length: "", package_breadth: "", package_height: "" });
  const [busy, setBusy] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    loadShipping().then(s => {
      if (!s) return;
      setCfg(s);
      setPkg({ package_weight: s.package_weight, package_length: s.package_length, package_breadth: s.package_breadth, package_height: s.package_height });
    });
  }, []);

  const call = async (key, path, body, message) => {
    setBusy(key);
    try {
      const { data } = await api.post(`/admin/orders/${order.id}/${path}`, body);
      onUpdated(data);
      toast.success(message(data));
    } catch (err) {
      toast.error(apiError(err, "Nimbus request failed"));
    } finally {
      setBusy(null);
      setConfirmCancel(false);
    }
  };

  const unpaidOnline = order.payment_method === "razorpay" && order.payment_status !== "paid";
  const pickupMissing = cfg && !(cfg.warehouse_name && cfg.pickup_address && cfg.pickup_pincode && cfg.pickup_phone);

  return (
    <Card className="p-4" data-testid="nimbus-card">
      <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Truck className="w-3.5 h-3.5" /> Shipping · Nimbus</h3>

      {n.awb ? (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="block text-xs text-stone-500">Courier</span><strong className="text-stone-900">{n.courier_name || "—"}</strong></div>
            <div><span className="block text-xs text-stone-500">AWB</span><strong className="text-stone-900 tabular-nums">{n.awb}</strong></div>
            <div className="col-span-2"><span className="block text-xs text-stone-500">Status</span>
              <span className="text-stone-900">{n.status_text || "Booked"}</span>
              {n.synced_at && <span className="text-xs text-stone-400"> · checked {new Date(n.synced_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>}
            </div>
          </div>
          {n.history?.length > 0 && (
            <ul className="text-xs text-stone-500 space-y-1 border-l-2 border-stone-200 pl-3 max-h-32 overflow-y-auto">
              {n.history.slice(0, 6).map((h, i) => <li key={i}><span className="text-stone-700">{h.message}</span> · {h.location} · {h.event_time}</li>)}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            {n.label && <a href={n.label} target="_blank" rel="noreferrer"><Button type="button" variant="secondary"><FileDown className="w-4 h-4" /> Shipping label</Button></a>}
            {order.tracking_url && <a href={order.tracking_url} target="_blank" rel="noreferrer"><Button type="button" variant="secondary"><ExternalLink className="w-4 h-4" /> Tracking page</Button></a>}
            <Button type="button" variant="secondary" loading={busy === "sync"} data-testid="nimbus-sync"
              onClick={() => call("sync", "nimbus/sync", undefined, d => `Status: ${d.nimbus?.status_text || "updated"}`)}><RefreshCw className="w-4 h-4" /> Refresh tracking</Button>
            {["PP", undefined, ""].includes(n.status_code) && (
              <Button type="button" variant="ghost" className="text-red-700" onClick={() => setConfirmCancel(true)}><X className="w-4 h-4" /> Cancel shipment</Button>
            )}
          </div>
        </div>
      ) : order.status === "cancelled" || order.status === "delivered" ? (
        <p className="text-sm text-stone-500">{n.cancelled_awb ? `Shipment ${n.cancelled_awb} was cancelled.` : "No Nimbus shipment for this order."}</p>
      ) : cfg && !cfg.nimbus_connected ? (
        <p className="text-sm text-stone-500">Nimbus isn't connected yet: add <code className="bg-stone-100 px-1 rounded">NIMBUS_EMAIL</code> and <code className="bg-stone-100 px-1 rounded">NIMBUS_PASSWORD</code> on the server (Vercel environment variables).</p>
      ) : (
        <div className="space-y-3">
          {n.cancelled_awb && <p className="text-xs text-stone-500">Previous shipment {n.cancelled_awb} was cancelled.</p>}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[["package_weight", "Weight (g)"], ["package_length", "Length (cm)"], ["package_breadth", "Breadth (cm)"], ["package_height", "Height (cm)"]].map(([k, label]) => (
              <label key={k} className="text-xs text-stone-500">{label}
                <Input type="number" min="1" value={pkg[k]} onChange={e => setPkg(p => ({ ...p, [k]: e.target.value }))} className="rounded-md mt-1" />
              </label>
            ))}
          </div>
          {pickupMissing && (
            <p className="text-xs text-amber-800 bg-amber-50 rounded px-3 py-2">Add your pickup address first: <button type="button" className="underline" onClick={() => navigate("settings")}>Settings → Shipping</button>.</p>
          )}
          {unpaidOnline && <p className="text-xs text-stone-500">Waiting for the online payment before this can ship.</p>}
          <Button type="button" disabled={unpaidOnline || pickupMissing || !cfg} loading={busy === "ship"} data-testid="nimbus-ship"
            onClick={() => call("ship", "nimbus", Object.fromEntries(Object.entries(pkg).map(([k, v]) => [k, Number(v) || null])),
              d => `Booked with ${d.nimbus?.courier_name || "Nimbus"} · AWB ${d.tracking_number}`)}>
            <Truck className="w-4 h-4" /> Ship with Nimbus
          </Button>
          <p className="text-xs text-stone-400">{order.payment_method === "cod" && order.payment_status !== "paid" ? `Cash on delivery: the courier collects ${"₹" + Number(order.total).toLocaleString("en-IN")}.` : "Prepaid: nothing to collect on delivery."} Nimbus picks the courier per your account rules{cfg?.auto_pickup ? " and schedules a pickup" : ""}.</p>
        </div>
      )}

      <ConfirmDialog open={confirmCancel} title="Cancel this shipment?" message={<>The courier booking for AWB <strong>{n.awb}</strong> will be cancelled with Nimbus. The order itself stays open so you can book again.</>}
        confirmLabel="Cancel shipment" busy={busy === "cancel"} onCancel={() => setConfirmCancel(false)}
        onConfirm={() => call("cancel", "nimbus/cancel", undefined, () => "Shipment cancelled")} />
    </Card>
  );
}
