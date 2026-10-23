// Indian rupees with Indian digit grouping (₹1,24,999).
export const money = (n) => {
  // Whole rupees stay clean (₹449); amounts with paise always show two decimals (₹89.80).
  const v = Number(n || 0);
  const digits = Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2;
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: 2 })}`;
};

// Compact Indian notation: ₹12.5K, ₹3.2L (lakh), ₹1.1Cr (crore).
export const moneyCompact = (n) => {
  const v = Number(n || 0);
  const fmt = (x, unit) => `₹${x.toFixed(1).replace(/\.0$/, "")}${unit}`;
  if (Math.abs(v) >= 1e7) return fmt(v / 1e7, "Cr");
  if (Math.abs(v) >= 1e5) return fmt(v / 1e5, "L");
  if (Math.abs(v) >= 1e4) return fmt(v / 1e3, "K");
  return money(v);
};

const shortDate = (iso) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

// One-line rule summary for lists; with asTerms, the same rules as the bullet points customers see
// (kept in step with couponTerms in the storefront's lib/format.js).
export function couponSummary(c, { asTerms = false } = {}) {
  if (!c) return asTerms ? [] : "";
  const amount = c.discount_type === "percent" ? `${c.discount_value}% off` : `${money(c.discount_value)} off`;
  const per = c.per_customer_limit;
  if (asTerms) {
    return [
      c.min_order ? `Minimum order value ${money(c.min_order)}.` : "",
      c.discount_type === "percent" && c.max_discount ? `Maximum discount ${money(c.max_discount)}.` : "",
      c.first_order_only ? "Valid on your first order only." : "",
      per === 1 ? "Can be used once per customer." : per > 1 ? `Can be used up to ${per} times per customer.` : "",
      c.ends_at ? `Valid till ${shortDate(c.ends_at)}.` : "",
      "Cannot be combined with other coupons.",
      ...(c.terms || "").split("\n").map(t => t.trim()),
    ].filter(Boolean);
  }
  return [
    amount + (c.discount_type === "percent" && c.max_discount ? ` (max ${money(c.max_discount)})` : ""),
    c.min_order ? `min order ${money(c.min_order)}` : "",
    c.first_order_only ? "first order only" : "",
    per ? `${per}× per customer` : "",
    c.usage_limit ? `${c.usage_limit} uses total` : "",
    c.starts_at && new Date(c.starts_at) > new Date() ? `starts ${shortDate(c.starts_at)}` : "",
    c.ends_at ? `ends ${shortDate(c.ends_at)}` : "",
  ].filter(Boolean).join(" · ");
}

export function couponStatus(c) {
  const now = new Date();
  if (!c.active) return "Off";
  if (c.ends_at && new Date(c.ends_at) <= now) return "Expired";
  if (c.starts_at && new Date(c.starts_at) > now) return "Scheduled";
  if (c.usage_limit && c.used_count >= c.usage_limit) return "Used up";
  return "Active";
}

export const RECIPIENTS = [
  { value: "her", label: "For Her" },
  { value: "him", label: "For Him" },
  { value: "couples", label: "For Couples" },
];

export const formatDate = (iso, withTime = false) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return withTime
    ? d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export const timeAgo = (iso) => {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(iso);
};

export const ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];

export const STATUS_META = {
  pending: { label: "Pending", badge: "bg-amber-50 text-amber-800 ring-amber-200" },
  processing: { label: "Processing", badge: "bg-sky-50 text-sky-800 ring-sky-200" },
  shipped: { label: "Shipped", badge: "bg-indigo-50 text-indigo-800 ring-indigo-200" },
  delivered: { label: "Delivered", badge: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  cancelled: { label: "Cancelled", badge: "bg-stone-100 text-stone-600 ring-stone-200" },
};

export const PAYMENT_META = {
  unpaid: { label: "Unpaid", badge: "bg-amber-50 text-amber-800 ring-amber-200" },
  paid: { label: "Paid", badge: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  refunded: { label: "Refunded", badge: "bg-stone-100 text-stone-600 ring-stone-200" },
};

// The next step in the normal fulfilment flow, used for one-click actions.
export const NEXT_STATUS = { pending: "processing", processing: "shipped", shipped: "delivered" };

export function downloadCsv(filename, rows) {
  const escape = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map(r => r.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
