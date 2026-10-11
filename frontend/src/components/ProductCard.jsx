import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShoppingBag, Heart } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { imageUrl } from "../lib/api";
import { formatPrice } from "../lib/format";

export function PriceTag({ product, className = "" }) {
  const onSale = product.compare_at_price && product.compare_at_price > product.price;
  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`}>
      <span className={onSale ? "text-burgundy" : ""}>{formatPrice(product.price)}</span>
      {onSale && <span className="text-stone-400 line-through text-[0.85em] font-normal">{formatPrice(product.compare_at_price)}</span>}
    </span>
  );
}

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const wishlist = useWishlist();
  const soldOut = product.stock === 0;
  const onSale = product.compare_at_price && product.compare_at_price > product.price;
  const saved = wishlist.has(product.id);

  const handleQuickAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (soldOut) return;
    const result = addItem(product, product.sizes[0], product.materials[0]);
    if (result.ok) toast.success(result.message || `${product.name} added to cart`);
    else toast.error(result.message);
  };

  const handleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const added = wishlist.toggle(product.id);
    toast.success(added ? `${product.name} saved to wishlist` : `${product.name} removed from wishlist`);
  };

  return (
    <motion.div
      data-testid={`product-card-${product.id}`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="group"
    >
      <Link to={`/product/${product.id}`} className="block">
        <div className="relative overflow-hidden bg-stone-100 aspect-[4/5]">
          <img
            src={imageUrl(product.images[0])}
            alt={product.name}
            loading="lazy"
            className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${soldOut ? "opacity-70" : ""}`}
          />
          <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
            {product.bestseller && (
              <span data-testid={`bestseller-badge-${product.id}`} className="bg-gold text-white text-[10px] tracking-wider uppercase px-2.5 py-1 font-body font-semibold">Bestseller</span>
            )}
            {onSale && !soldOut && (
              <span data-testid={`sale-badge-${product.id}`} className="bg-burgundy text-white text-[10px] tracking-wider uppercase px-2.5 py-1 font-body font-semibold">Sale</span>
            )}
            {soldOut && (
              <span data-testid={`soldout-badge-${product.id}`} className="bg-stone-800/90 text-white text-[10px] tracking-wider uppercase px-2.5 py-1 font-body font-semibold">Sold Out</span>
            )}
          </div>
          <button
            data-testid={`wishlist-btn-${product.id}`}
            onClick={handleWishlist}
            aria-pressed={saved}
            aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
            className={`absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 shadow-sm transition-colors ${saved ? "text-burgundy" : "text-stone-600 hover:text-burgundy"}`}
          >
            <Heart className={`w-4 h-4 ${saved ? "fill-burgundy" : ""}`} />
          </button>
          <div className="absolute inset-0 bg-burgundy/0 group-hover:bg-burgundy/10 transition-colors duration-300 pointer-events-none" />
          {!soldOut && (
            <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 focus-within:translate-y-0 transition-transform duration-300">
              <button
                data-testid={`quick-add-${product.id}`}
                onClick={handleQuickAdd}
                className="w-full flex items-center justify-center gap-2 bg-burgundy text-white py-3 text-xs tracking-widest uppercase font-body hover:bg-burgundy-dark transition-colors"
                aria-label={`Add ${product.name} to cart`}
              >
                <ShoppingBag className="w-3.5 h-3.5" /> Quick Add
              </button>
            </div>
          )}
        </div>
        <div className="mt-4 space-y-1">
          <p className="text-[11px] tracking-[0.15em] uppercase text-stone-400 font-body">{product.category}</p>
          <h3 className="font-heading text-lg text-stone-900 group-hover:text-burgundy transition-colors">{product.name}</h3>
          <PriceTag product={product} className="font-body text-sm text-gold font-semibold" />
        </div>
      </Link>
    </motion.div>
  );
}
