import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { couponTerms } from "../lib/format";

// "T&C apply" toggle that expands the coupon's conditions in place (works on touch screens, no hover needed).
export default function CouponTerms({ coupon, light = false, className = "" }) {
  const [open, setOpen] = useState(false);
  const terms = couponTerms(coupon);
  if (!terms.length) return null;
  return (
    <div className={className}>
      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }} aria-expanded={open}
        data-testid={`coupon-terms-${coupon.code}`}
        className={`inline-flex items-center gap-1 text-[11px] font-body underline underline-offset-2 ${light ? "text-white/70 hover:text-white" : "text-stone-500 hover:text-stone-800"}`}>
        T&amp;C apply <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className={`mt-2 space-y-1 text-[11px] leading-relaxed font-body list-disc pl-4 text-left ${light ? "text-white/75" : "text-stone-600"}`}>
          {terms.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      )}
    </div>
  );
}
