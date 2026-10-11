import { Link } from "react-router-dom";
import { imageUrl } from "../../lib/api";

// Small square tiles in a left-to-right row; scrolls sideways on narrow screens.
export default function CategoryTiles({ categories }) {
  if (!categories.length) return null;
  return (
    <section data-testid="category-tiles" className="py-10 sm:py-14 bg-gradient-to-b from-petal to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-[11px] tracking-[0.2em] uppercase font-semibold text-gold font-body">Shop by category</p>
            <h2 className="font-heading text-2xl sm:text-3xl text-stone-900">What are you looking for?</h2>
          </div>
          <Link to="/shop" className="hidden sm:inline text-xs tracking-[0.15em] uppercase font-body text-stone-500 hover:text-burgundy">View all</Link>
        </div>
        <div className="flex gap-4 sm:gap-6 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none lg:justify-center">
          {categories.map(c => (
            <Link key={c.id || c.name} to={`/shop?category=${encodeURIComponent(c.name)}`} data-testid={`category-tile-${c.name.toLowerCase().replace(/\s+/g, "-")}`}
              className="group snap-start shrink-0 w-24 sm:w-32 text-center">
              <div className="story-ring rounded-full p-[3px] transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
                <div className="rounded-full bg-white p-[3px]">
                  <div className="aspect-square rounded-full overflow-hidden bg-petal">
                    <img src={imageUrl(c.image)} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                </div>
              </div>
              <p className="mt-3 font-body text-sm font-semibold text-stone-800 group-hover:text-burgundy">{c.name}</p>
              {typeof c.product_count === "number" && <p className="text-[11px] text-stone-400 font-body">{c.product_count} {c.product_count === 1 ? "design" : "designs"}</p>}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
