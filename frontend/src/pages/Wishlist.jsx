import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { useWishlist } from "../context/WishlistContext";
import { useProducts } from "../context/ProductsContext";
import ProductCard from "../components/ProductCard";
import { usePageTitle } from "../lib/hooks";

export default function Wishlist() {
  const { items } = useWishlist();
  const { loading } = useProducts();
  usePageTitle("Wishlist");

  return (
    <div data-testid="wishlist-page" className="pt-20 sm:pt-24">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-10 sm:py-14">
        <div className="mb-10">
          <p className="text-xs tracking-[0.2em] uppercase font-semibold text-gold mb-2 font-body">Saved for later</p>
          <h1 className="font-heading text-3xl sm:text-4xl text-stone-900">Your Wishlist {items.length > 0 && <span className="text-lg text-stone-400">({items.length})</span>}</h1>
        </div>

        {loading ? (
          <p className="text-center py-20 text-sm text-stone-500 font-body">Loading...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-stone-300 bg-white">
            <Heart className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <p className="font-heading text-2xl text-stone-800 mb-1">Nothing saved yet</p>
            <p className="text-sm text-stone-500 font-body mb-6">Tap the heart on any piece to save it here.</p>
            <Link to="/shop" className="inline-block bg-burgundy text-white px-10 py-4 text-xs tracking-[0.2em] uppercase font-body font-semibold hover:bg-burgundy-dark">Explore the collection</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-10">
            {items.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
