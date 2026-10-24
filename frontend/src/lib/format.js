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
  if (offer.discount_type === "free_shipping") return { discount: 0, error: "" };  // delivery is waived instead
  let discount = offer.discount_type === "percent"
    ? Math.round(subtotal * offer.discount_value) / 100
    : Math.min(offer.discount_value, subtotal);
  if (offer.discount_type === "percent" && offer.max_discount) discount = Math.min(discount, offer.max_discount);
  return { discount, error: "" };
}

// The conditions customers see under "T&C": the coupon's rules, then the admin's own terms.
export function couponTerms(c) {
  if (!c) return [];
  const per = c.per_customer_limit;
  return [
    c.discount_type === "free_shipping" ? "Free delivery on this order (the delivery charge is waived)." : "",
    c.min_order ? `Minimum order value ${formatPrice(c.min_order)}.` : "",
    c.discount_type === "percent" && c.max_discount ? `Maximum discount ${formatPrice(c.max_discount)}.` : "",
    c.first_order_only ? "Valid on your first order only." : "",
    per === 1 ? "Can be used once per customer." : per > 1 ? `Can be used up to ${per} times per customer.` : "",
    c.ends_at ? `Valid till ${new Date(c.ends_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}.` : "",
    "Cannot be combined with other coupons.",
    ...(c.terms || "").split("\n").map(t => t.trim()),
  ].filter(Boolean);
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

export const INDIAN_STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"];
