import { useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, ChevronDown, X } from "lucide-react";

// "Where does this appear?": screenshots of the live storefront for the section this page edits.
// Images live in admin/public/guides (captured from the shop; refresh them if the design changes).
export default function PlacementGuide({ items, defaultOpen = true }) {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(`guide:${items[0]?.img}`) !== "closed" && defaultOpen; } catch { return defaultOpen; }
  });
  const [zoom, setZoom] = useState(null);
  const toggle = () => setOpen(o => {
    try { localStorage.setItem(`guide:${items[0]?.img}`, o ? "closed" : "open"); } catch { /* storage unavailable */ }
    return !o;
  });
  const src = (img) => `${import.meta.env.BASE_URL}guides/${img}`;

  return (
    <div className="mb-4 rounded-lg border border-gold/30 bg-[#fffaf0]" data-testid="placement-guide">
      <button type="button" onClick={toggle} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-medium text-stone-800"><MapPin className="w-4 h-4 text-gold" /> Where this appears on your store</span>
        <ChevronDown className={`w-4 h-4 text-stone-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 pb-4">
          {items.map(it => (
            <figure key={it.img} className="min-w-0">
              <button type="button" onClick={() => setZoom(it)} className="block w-full overflow-hidden rounded-md border border-stone-200 bg-white hover:border-gold" title="Click to enlarge">
                <img src={src(it.img)} alt={it.title} loading="lazy" className="w-full h-40 object-cover object-top" />
              </button>
              <figcaption className="mt-2 text-xs text-stone-600"><strong className="text-stone-800">{it.title}.</strong> {it.text}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {zoom && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={() => setZoom(null)} role="dialog" aria-label={zoom.title}>
          <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setZoom(null)} aria-label="Close" className="absolute -top-3 -right-3 p-1.5 rounded-full bg-white shadow"><X className="w-4 h-4" /></button>
            <img src={src(zoom.img)} alt={zoom.title} className="w-full max-h-[80vh] object-contain rounded-md bg-white" />
            <p className="mt-2 text-sm text-white/90"><strong>{zoom.title}.</strong> {zoom.text}</p>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
