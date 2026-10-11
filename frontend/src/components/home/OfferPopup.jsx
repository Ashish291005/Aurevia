import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { X, Sparkles } from "lucide-react";
import { useStorefront } from "../../context/StorefrontContext";
import { imageUrl } from "../../lib/api";
import { CouponCode } from "./OfferBanner";

const SEEN_KEY = "aurevia_offer_popup_seen";
const HIDDEN_ON = ["/checkout", "/order-confirmation", "/login", "/register"];

// Shows the store's featured offer shortly after the site loads — once per browser session.
export default function OfferPopup() {
  const { popupOffer } = useStorefront();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!popupOffer || HIDDEN_ON.some(p => pathname.startsWith(p))) return;
    let seen = null;
    try { seen = sessionStorage.getItem(SEEN_KEY); } catch { /* storage unavailable */ }
    if (seen === popupOffer.id) return;
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
    // Only on first load / when the featured offer changes, not on every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popupOffer]);

  const close = () => {
    setOpen(false);
    try { sessionStorage.setItem(SEEN_KEY, popupOffer.id); } catch { /* storage unavailable */ }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !popupOffer) return null;
  const o = popupOffer;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="offer-popup-title" data-testid="offer-popup">
      <div className="absolute inset-0 bg-black/60 animate-[fadeIn_.3s_ease-out]" onClick={close} />
      <div className="relative w-full max-w-2xl bg-cream shadow-2xl grid grid-cols-1 sm:grid-cols-2 overflow-hidden rounded-xl animate-[popIn_.35s_ease-out]">
        <button onClick={close} aria-label="Close offer" data-testid="offer-popup-close" className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 text-stone-600 hover:text-burgundy shadow">
          <X className="w-4 h-4" />
        </button>
        <div className="relative h-44 sm:h-auto bg-burgundy">
          {o.image ? <img src={imageUrl(o.image)} alt="" className="absolute inset-0 w-full h-full object-cover" />
            : <div className="absolute inset-0 flex items-center justify-center"><Sparkles className="w-16 h-16 text-gold" /></div>}
        </div>
        <div className="p-7 sm:p-9 text-center sm:text-left flex flex-col justify-center">
          <p className="text-[11px] tracking-[0.25em] uppercase font-semibold text-gold font-body mb-2">Exclusive offer</p>
          <h2 id="offer-popup-title" className="font-heading text-3xl sm:text-4xl text-stone-900 leading-tight mb-3">{o.title}</h2>
          {o.description && <p className="font-body text-sm text-stone-600 mb-5">{o.description}</p>}
          {o.code && <div className="mb-5"><CouponCode code={o.code} /></div>}
          <button onClick={() => { close(); if (o.cta_link) navigate(o.cta_link); }} data-testid="offer-popup-cta"
            className="bg-burgundy text-white px-8 py-3.5 text-xs tracking-[0.2em] uppercase font-body font-semibold hover:bg-burgundy-dark transition-colors">
            {o.cta_text || "Shop now"}
          </button>
          <button onClick={close} className="mt-3 text-xs font-body text-stone-400 hover:text-stone-600">No thanks</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
