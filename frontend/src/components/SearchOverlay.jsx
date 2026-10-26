import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { Search, X, ArrowRight } from "lucide-react";
import { useProducts } from "../context/ProductsContext";
import { imageUrl } from "../lib/api";
import { formatPrice } from "../lib/format";

export function matchesQuery(product, q) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [product.name, product.category, product.description, ...(product.materials || [])]
    .some(v => v && v.toLowerCase().includes(needle));
}

export default function SearchOverlay({ open, onClose }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { products } = useProducts();

  const results = useMemo(() => (query.trim() ? products.filter(p => matchesQuery(p, query)).slice(0, 6) : []), [products, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { clearTimeout(t); document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    onClose();
    navigate(`/shop?q=${encodeURIComponent(query.trim())}`);
  };

  return createPortal(
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label="Search products">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-cream shadow-2xl">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <form onSubmit={submit} className="flex items-center gap-3 border-b-2 border-stone-300 focus-within:border-gold transition-colors">
            <Search className="w-5 h-5 text-stone-400 shrink-0" />
            <input
              ref={inputRef}
              data-testid="search-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search rings, necklaces, bangles..."
              className="flex-1 bg-transparent py-4 text-lg font-body outline-none placeholder:text-stone-400"
            />
            <button type="button" onClick={onClose} aria-label="Close search" className="p-2 text-stone-500 hover:text-burgundy">
              <X className="w-5 h-5" />
            </button>
          </form>

          {query.trim() && (
            <div className="py-4">
              {results.length === 0 ? (
                <p className="py-6 text-sm text-stone-500 font-body">No pieces match "{query}".</p>
              ) : (
                <>
                  <ul className="divide-y divide-stone-200">
                    {results.map(p => (
                      <li key={p.id}>
                        <Link to={`/product/${p.id}`} onClick={onClose} data-testid={`search-result-${p.id}`}
                          className="flex items-center gap-4 py-3 group">
                          <img src={imageUrl(p.images[0])} alt="" className="w-12 h-14 object-cover bg-stone-100" />
                          <div className="flex-1 min-w-0">
                            <p className="font-heading text-lg text-stone-900 group-hover:text-burgundy truncate">{p.name}</p>
                            <p className="text-xs text-stone-500 font-body">{p.category}</p>
                          </div>
                          <span className="text-sm text-gold font-body font-semibold">{formatPrice(p.price)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <button onClick={submit} className="mt-4 inline-flex items-center gap-2 text-xs tracking-[0.2em] uppercase font-body font-semibold text-burgundy hover:text-gold">
                    See all results <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
