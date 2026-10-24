import { Link } from "react-router-dom";
import { Check, X } from "lucide-react";
import { imageUrl } from "../lib/api";
import { formatDate, formatPrice, ORDER_STATUS, ORDER_STEPS } from "../lib/format";

export function StatusBadge({ status }) {
  const s = ORDER_STATUS[status] || ORDER_STATUS.pending;
  return <span data-testid="order-status" className={`inline-block border px-2.5 py-0.5 text-xs font-body font-semibold ${s.badge}`}>{s.label}</span>;
}

export function OrderTimeline({ order }) {
  if (order.status === "cancelled") {
    return (
      <div className="flex items-center gap-3 bg-stone-100 px-4 py-3 text-sm font-body text-stone-600">
        <X className="w-4 h-4" /> This order was cancelled{order.history?.length ? ` on ${formatDate(order.history[order.history.length - 1].at)}` : ""}.
      </div>
    );
  }
  const current = ORDER_STEPS.indexOf(order.status);
  const reachedAt = (step) => order.history?.find(h => h.status === step)?.at;
  return (
    <ol className="grid grid-cols-4" data-testid="order-timeline">
      {ORDER_STEPS.map((step, i) => {
        const done = i <= current;
        return (
          <li key={step} className="relative flex flex-col items-center text-center">
            {i > 0 && <span className={`absolute top-3.5 right-1/2 w-full h-0.5 -z-0 ${i <= current ? "bg-gold" : "bg-stone-200"}`} />}
            <span className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center border-2 ${done ? "bg-gold border-gold text-white" : "bg-white border-stone-300 text-stone-300"}`}>
              {done ? <Check className="w-3.5 h-3.5" /> : <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />}
            </span>
            <span className={`mt-2 text-[11px] sm:text-xs font-body ${done ? "text-stone-800 font-semibold" : "text-stone-400"}`}>{ORDER_STATUS[step].label}</span>
            {reachedAt(step) && <span className="text-[10px] text-stone-400 font-body hidden sm:block">{formatDate(reachedAt(step))}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export default function OrderDetails({ order }) {
  const c = order.customer;
  return (
    <div className="space-y-6">
      <OrderTimeline order={order} />
      {order.tracking_number && (
        <p className="text-sm font-body text-stone-600 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{order.courier ? `${order.courier} · ` : ""}Tracking number: <strong className="text-stone-900">{order.tracking_number}</strong></span>
          {order.tracking_url && (
            <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" data-testid="track-shipment-link"
              className="text-xs tracking-[0.15em] uppercase font-semibold text-burgundy hover:text-gold underline underline-offset-4">Track shipment →</a>
          )}
        </p>
      )}
      <ul className="divide-y divide-stone-100 border-y border-stone-200">
        {order.items.map((it, i) => (
          <li key={i} className="flex gap-4 py-3">
            <Link to={`/product/${it.product_id}`} className="w-14 h-16 shrink-0 bg-stone-100 overflow-hidden">
              <img src={imageUrl(it.image)} alt="" className="w-full h-full object-cover" />
            </Link>
            <div className="flex-1 min-w-0 text-sm font-body">
              <p className="text-stone-900 truncate">{it.name}</p>
              <p className="text-xs text-stone-500">
                {[it.size !== "One Size" && it.size, it.material !== "Standard" && it.material].filter(Boolean).join(" · ")}
                {" "}× {it.quantity}
              </p>
            </div>
            <span className="text-sm font-body text-stone-900 whitespace-nowrap">{formatPrice(it.line_total)}</span>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm font-body">
        <div>
          <p className="text-xs tracking-[0.15em] uppercase font-semibold text-stone-500 mb-2">Ship to</p>
          <p className="text-stone-800">{c.first_name} {c.last_name}</p>
          <p className="text-stone-600">{c.address}</p>
          <p className="text-stone-600">{c.city}{c.state ? `, ${c.state}` : ""} {c.zip}</p>
          <p className="text-stone-600">{c.country}</p>
          {c.phone && <p className="text-stone-600 mt-1">{c.phone}</p>}
        </div>
        <div className="sm:text-right space-y-1">
          <p className="text-xs tracking-[0.15em] uppercase font-semibold text-stone-500 mb-2">Summary</p>
          <p className="flex sm:justify-end gap-6 text-stone-600"><span>Subtotal</span><span className="text-stone-900">{formatPrice(order.subtotal)}</span></p>
          {order.discount > 0 && <p className="flex sm:justify-end gap-6 text-emerald-700"><span>Coupon {order.coupon?.code}</span><span>−{formatPrice(order.discount)}</span></p>}
          <p className="flex sm:justify-end gap-6 text-stone-600"><span>Shipping</span><span className="text-stone-900">{order.shipping ? formatPrice(order.shipping) : "Free"}</span></p>
          <p className="flex sm:justify-end gap-6 font-semibold text-stone-900"><span>Total</span><span className="text-burgundy">{formatPrice(order.total)}</span></p>
          <p className="text-xs text-stone-500 pt-1">
            {order.payment_method === "razorpay" ? "Paid online" : "Cash on delivery"} · {order.payment_status === "paid" ? "Paid" : order.payment_status === "refunded" ? "Refunded" : order.payment_method === "razorpay" ? "Payment not completed" : "Payment due on delivery"}
          </p>
        </div>
      </div>
      {order.notes && <p className="text-sm font-body text-stone-600 bg-stone-50 px-4 py-3"><span className="font-semibold text-stone-800">Note:</span> {order.notes}</p>}
    </div>
  );
}
