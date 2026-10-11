import { Link } from "react-router-dom";
import { imageUrl } from "../../lib/api";
import { recipientImages } from "../../data/products";

const TILES = [
  { value: "her", label: "For Her", note: "Wife, mom, sister, best friend" },
  { value: "him", label: "For Him", note: "Bracelets & gift boxes" },
  { value: "couples", label: "For Couples", note: "Matching rings & duo boxes" },
];

export default function ShopForTiles({ products }) {
  // Curated lifestyle photos, falling back to a product from that group.
  const imageFor = (value) => recipientImages[value] || products.find(p => p.recipients?.includes(value))?.images[0];
  return (
    <section data-testid="shop-for" className="py-14 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="text-center mb-8 sm:mb-10">
          <p className="text-[11px] tracking-[0.2em] uppercase font-semibold text-gold font-body">Gifting made easy</p>
          <h2 className="font-heading text-3xl sm:text-4xl text-stone-900">Who are you shopping for?</h2>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:gap-6 max-w-4xl mx-auto">
          {TILES.map(t => (
            <Link key={t.value} to={`/shop?for=${t.value}`} data-testid={`shop-for-${t.value}`} className="group relative aspect-[4/5] sm:aspect-square rounded-2xl overflow-hidden bg-stone-200">
              <img src={imageUrl(imageFor(t.value))} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-0 inset-x-0 p-3 sm:p-5 text-white">
                <p className="font-heading text-xl sm:text-3xl">{t.label}</p>
                <p className="hidden sm:block text-xs font-body text-white/80 mt-1">{t.note}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
