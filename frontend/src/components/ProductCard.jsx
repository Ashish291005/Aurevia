import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShoppingBag, Heart, Check } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { imageUrl } from "../lib/api";
import { formatPrice } from "../lib/format";
import { Stars } from "./Stars";

export const discountPct = (p) => (p.compare_at_price && p.compare_at_price > p.price ? Math.round((1 - p.price / p.compare_at_price) * 100) : 0);

export function PriceTag({ product, className = "" }) {
  const pct = discountPct(product);
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <span className="text-stone-900 font-semibold">{formatPrice(product.price)}</span>
      {pct > 0 && (
        <>
          <span className="text-stone-400 line-through text-[0.85em] font-normal">{formatPrice(product.compare_at_price)}</span>
          <span className="text-emerald-700 text-[0.8em] font-semibold">{pct}% off</span>
        </>
      )}
    </span>
  );
}

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const wishlist = useWishlist();
  const [justAdded, setJustAdded] = useState(false);
  const [pop, setPop] = useState(0);
  const soldOut = product.stock === 0;
  const lowStock = product.stock > 0 && product.stock <= 5;
  const pct = discountPct(product);
  const saved = wishlist.has(product.id);
  const hoverImage = product.images[1];

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (soldOut) return;
    const result = addItem(product, product.sizes[0], product.materials[0]);
    if (!result.ok) { toast.error(result.message); return; }
    toast.success(result.message || `${product.name} added to cart`);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  const handleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const added = wishlist.toggle(product.id);
    setPop(n => n + 1);
    toast.success(added ? "Saved to wishlist" : "Removed from wishlist");
  };

  return (
    <motion.div
      data-testid={`product-card-${product.id}`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45 }}
      className="group h-full"
    >
      <Link to={`/product/${product.id}`} className="flex flex-col h-full rounded-2xl bg-white ring-1 ring-stone-200/70 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-rose/10 hover:ring-rose/30">
        <div className="relative overflow-hidden bg-petal aspect-square">
          <img src={imageUrl(product.images[0])} alt={product.name} loading="lazy"
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${hoverImage ? "group-hover:opacity-0" : ""} ${soldOut ? "opacity-60" : ""}`} />
          {hoverImage && (
            <img src={imageUrl(hoverImage)} alt="" loading="lazy" aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover opacity-0 scale-105 transition-all duration-700 group-hover:opacity-100 group-hover:scale-100" />
          )}
          <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5">
            {pct > 0 && !soldOut && <span data-testid={`sale-badge-${product.id}`} className="bg-rose text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">{pct}% OFF</span>}
            {product.bestseller && <span data-testid={`bestseller-badge-${product.id}`} className="bg-white/95 text-burgundy text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">★ Bestseller</span>}
            {soldOut && <span data-testid={`soldout-badge-${product.id}`} className="bg-stone-800 text-white text-[10px] font-bold px-2 py-1 rounded-full">Sold out</span>}
          </div>
          <button
            data-testid={`wishlist-btn-${product.id}`}
            onClick={handleWishlist}
            aria-pressed={saved}
            aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
            className="absolute top-2.5 right-2.5 w-9 h-9 flex items-center justify-center rounded-full bg-white/95 shadow-sm hover:scale-110 transition-transform"
          >
            <Heart key={pop} className={`w-4 h-4 ${pop ? "animate-heart" : ""} ${saved ? "fill-rose text-rose" : "text-stone-600"}`} />
          </button>
          {lowStock && <span className="absolute bottom-2.5 left-2.5 bg-amber-50/95 text-amber-800 text-[10px] font-semibold px-2 py-1 rounded-full">Only {product.stock} left</span>}
        </div>

        <div className="flex flex-col flex-1 p-3 sm:p-4">
          {product.rating_count > 0 ? (
            <span className="flex items-center gap-1.5 mb-1" data-testid={`rating-${product.id}`}>
              <Stars value={product.rating_avg} size="w-3 h-3" />
              <span className="text-[11px] text-stone-500 font-body">{product.rating_avg} ({product.rating_count})</span>
            </span>
          ) : (
            <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 font-body mb-1">{product.category}</p>
          )}
          <h3 className="font-body text-sm text-stone-800 leading-snug line-clamp-2 group-hover:text-burgundy transition-colors">{product.name}</h3>
          <PriceTag product={product} className="font-body text-sm mt-1.5" />
          <div className="mt-auto pt-3">
            <button
              data-testid={`quick-add-${product.id}`}
              onClick={handleAdd}
              disabled={soldOut}
              aria-label={`Add ${product.name} to cart`}
              className={`w-full flex items-center justify-center gap-2 rounded-full py-2.5 text-[11px] tracking-[0.12em] uppercase font-body font-semibold transition-colors ${
                justAdded ? "bg-emerald-600 text-white" : soldOut ? "bg-stone-100 text-stone-400 cursor-not-allowed" : "bg-burgundy text-white hover:bg-rose"
              }`}
            >
              {justAdded ? <><Check className="w-3.5 h-3.5" /> Added</> : soldOut ? "Sold out" : <><ShoppingBag className="w-3.5 h-3.5" /> Add to cart</>}
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
