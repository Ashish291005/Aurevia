import { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check, Gift, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { imageUrl } from "../../lib/api";
import { Countdown } from "../lively";
import CouponTerms from "../CouponTerms";

const THEMES = [
  "bg-gradient-to-r from-burgundy via-[#6b1d33] to-burgundy-dark text-white",
  "bg-gradient-to-r from-[#f8d7df] via-petal to-[#fbe3e8] text-stone-900",
  "bg-gradient-to-r from-[#3b2a1a] via-[#5a4127] to-[#3b2a1a] text-white",
];

export function CouponCode({ code, light }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`Code ${code} copied — apply it in your cart`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.message(`Your code: ${code}`);
    }
  };
  return (
    <button type="button" onClick={copy} data-testid={`coupon-${code}`}
      className={`inline-flex items-center gap-2 border-2 border-dashed px-4 py-2 font-body text-sm font-bold tracking-[0.15em] transition-colors ${light ? "border-white/60 hover:bg-white/10" : "border-burgundy/50 text-burgundy hover:bg-burgundy/5"}`}>
      {code} {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      <span className="sr-only">Copy code</span>
    </button>
  );
}

// Full-width promotional strip; `variant` picks a colour theme so banners down the page look distinct.
export default function OfferBanner({ offer, variant = 0 }) {
  if (!offer) return null;
  const theme = THEMES[variant % THEMES.length];
  const light = variant % THEMES.length !== 1;
  const cta = offer.cta_link && (
    /^https?:\/\//.test(offer.cta_link)
      ? <a href={offer.cta_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">{offer.cta_text || "Shop now"} <ArrowRight className="w-4 h-4" /></a>
      : <Link to={offer.cta_link} className="inline-flex items-center gap-2">{offer.cta_text || "Shop now"} <ArrowRight className="w-4 h-4" /></Link>
  );
  return (
    <section data-testid="offer-banner" className={`relative overflow-hidden ${theme}`}>
      {offer.image && <img src={imageUrl(offer.image)} alt="" className="absolute inset-y-0 right-0 w-1/3 h-full object-cover opacity-30 hidden md:block [mask-image:linear-gradient(to_left,black,transparent)]" />}
      <div className="relative max-w-7xl mx-auto px-6 sm:px-10 py-8 sm:py-10 flex flex-col md:flex-row md:items-center gap-5 md:gap-10">
        <Gift className={`w-10 h-10 shrink-0 ${light ? "text-gold" : "text-burgundy"}`} />
        <div className="flex-1">
          <p className="font-heading text-2xl sm:text-3xl leading-tight">{offer.title}</p>
          {offer.description && <p className={`font-body text-sm mt-1 ${light ? "text-white/75" : "text-stone-600"}`}>{offer.description}</p>}
          {offer.ends_at && <div className="mt-3"><Countdown endsAt={offer.ends_at} light={light} /></div>}
          {offer.code && offer.coupon && <CouponTerms coupon={offer.coupon} light={light} className="mt-2" />}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {offer.code && <CouponCode code={offer.code} light={light} />}
          {cta && (
            <span className={`text-xs tracking-[0.2em] uppercase font-body font-semibold ${light ? "text-white hover:text-gold" : "text-burgundy hover:text-gold"}`}>{cta}</span>
          )}
        </div>
      </div>
    </section>
  );
}
