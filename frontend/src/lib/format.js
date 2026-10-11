// Indian rupees with Indian digit grouping (₹1,24,999).
export const formatPrice = (n) => {
  // Whole rupees stay clean (₹449); amounts with paise always show two decimals (₹89.80).
  const v = Number(n || 0);
  const digits = Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2;
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: 2 })}`;
};

// Mirrors the backend's coupon rule so the cart shows the same discount the order will get.
export function couponDiscount(offer, subtotal) {
  if (!offer) return { discount: 0, error: "" };
  if (subtotal < (offer.min_order || 0)) {
    return { discount: 0, error: `Add ${formatPrice(offer.min_order - subtotal)} more to use ${offer.code}` };
  }
  const discount = offer.discount_type === "percent"
    ? Math.round(subtotal * offer.discount_value) / 100
    : Math.min(offer.discount_value, subtotal);
  return { discount, error: "" };
}

export const RECIPIENTS = [
  { value: "her", label: "For Her" },
  { value: "him", label: "For Him" },
  { value: "couples", label: "For Couples" },
];

export const formatDate = (iso, withTime = false) => {
  if (!iso) return "";
  const d = new Date(iso);
  return withTime
    ? d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : d.toLocaleDateString("en-IN", { dateStyle: "medium" });
};

export const ORDER_STATUS = {
  pending: { label: "Order placed", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  processing: { label: "Processing", badge: "bg-sky-50 text-sky-800 border-sky-200" },
  shipped: { label: "Shipped", badge: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  delivered: { label: "Delivered", badge: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  cancelled: { label: "Cancelled", badge: "bg-stone-100 text-stone-600 border-stone-200" },
};

export const ORDER_STEPS = ["pending", "processing", "shipped", "delivered"];
