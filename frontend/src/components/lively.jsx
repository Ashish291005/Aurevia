import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSettings } from "../context/SettingsContext";
import ProductCard from "./ProductCard";
export { Stars } from "./Stars";

function remaining(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function Countdown({ endsAt, light = false, compact = false }) {
  const [left, setLeft] = useState(() => remaining(endsAt));
  useEffect(() => {
    const id = setInterval(() => setLeft(remaining(endsAt)), 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  if (!left) return null;
  const units = [["d", left.d], ["h", left.h], ["m", left.m], ["s", left.s]].filter(([u, v], i) => u !== "d" || v > 0);
  return (
    <span className="inline-flex items-center gap-1.5" data-testid="countdown" role="timer" aria-label="Offer ends in">
      {!compact && <span className={`text-[10px] tracking-[0.2em] uppercase font-body font-semibold mr-1 ${light ? "text-white/70" : "text-stone-500"}`}>Ends in</span>}
      {units.map(([u, v]) => (
        <span key={u} className={`min-w-[2.6rem] text-center rounded-md px-1.5 py-1 font-body tabular-nums ${light ? "bg-white/15 text-white" : "bg-burgundy text-white"}`}>
          <span className="block text-sm font-bold leading-none">{String(v).padStart(2, "0")}</span>
          <span className="block text-[9px] uppercase tracking-wider opacity-70 mt-0.5">{u}</span>
        </span>
      ))}
    </span>
  );
}

export function WhatsAppButton() {
  const { whatsapp_number } = useSettings();
  if (!whatsapp_number) return null;
  const number = whatsapp_number.length === 10 ? `91${whatsapp_number}` : whatsapp_number;
  const text = encodeURIComponent("Hi Aurevia! I have a question about a product.");
  return (
    <a href={`https://wa.me/${number}?text=${text}`} target="_blank" rel="noopener noreferrer" aria-label="Chat with us on WhatsApp" data-testid="whatsapp-btn"
      className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 flex items-center justify-center hover:scale-110 transition-transform animate-[floatIn_.5s_ease-out]">
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor" aria-hidden="true">
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.94.95-3.48-.22-.36a9.43 9.43 0 1 1 7.99 4.41zm8.02-17.45A11.27 11.27 0 0 0 12.04.73C5.8.73.73 5.8.72 12.03c0 1.99.52 3.94 1.51 5.65L.63 23.5l5.96-1.56a11.3 11.3 0 0 0 5.44 1.39h.01c6.24 0 11.31-5.07 11.31-11.3 0-3.02-1.17-5.86-3.31-8z" />
      </svg>
    </a>
  );
}

// Left-to-right product row with arrow buttons (desktop) and swipe (mobile).
export function ProductRow({ products, testId }) {
  const ref = useRef(null);
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <div className="relative group/row" data-testid={testId}>
      <div ref={ref} className="flex gap-4 sm:gap-6 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
        {products.map(p => (
          <div key={p.id} className="snap-start shrink-0 w-[46%] sm:w-[31%] lg:w-[23.5%]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
      {products.length > 4 && (
        <>
          <button onClick={() => scroll(-1)} aria-label="Scroll left" className="hidden lg:flex absolute -left-5 top-[38%] w-10 h-10 items-center justify-center rounded-full bg-white shadow-md text-stone-700 hover:text-burgundy opacity-0 group-hover/row:opacity-100 transition-opacity">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => scroll(1)} aria-label="Scroll right" className="hidden lg:flex absolute -right-5 top-[38%] w-10 h-10 items-center justify-center rounded-full bg-white shadow-md text-stone-700 hover:text-burgundy opacity-0 group-hover/row:opacity-100 transition-opacity">
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  );
}
