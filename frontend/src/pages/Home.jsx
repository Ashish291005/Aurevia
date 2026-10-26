import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Send, ShieldCheck, Lock, Truck, RotateCcw, Banknote } from "lucide-react";
import { toast } from "sonner";
import HeroCarousel from "../components/home/HeroCarousel";
import CategoryTiles from "../components/home/CategoryTiles";
import OfferBanner from "../components/home/OfferBanner";
import ShopForTiles from "../components/home/ShopForTiles";
import { useProducts } from "../context/ProductsContext";
import { useStorefront } from "../context/StorefrontContext";
import { useSettings } from "../context/SettingsContext";
import { api, apiError } from "../lib/api";
import { formatPrice } from "../lib/format";
import { usePageTitle } from "../lib/hooks";
import { ProductRow, Stars } from "../components/lively";
import { BadgeCheck } from "lucide-react";

const CRAFT_IMG = "/images/brand/jewelry-box-bg.webp";
const fadeUp = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.5 } };

function SectionHeading({ eyebrow, title, link, linkLabel = "View all" }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-8">
      <div>
        <p className="text-[11px] tracking-[0.2em] uppercase font-semibold text-gold font-body">{eyebrow}</p>
        <h2 className="font-heading text-3xl sm:text-4xl text-stone-900">{title}</h2>
      </div>
      {link && <Link to={link} className="shrink-0 gold-underline text-xs tracking-[0.15em] uppercase font-body text-stone-600 hover:text-burgundy">{linkLabel}</Link>}
    </div>
  );
}

function TrustStrip() {
  const { free_shipping_threshold, shipping_fee } = useSettings();
  const items = [
    { Icon: ShieldCheck, title: "Anti-tarnish & skin-safe", text: "Nickel & lead free" },
    { Icon: Lock, title: "Secure payments", text: "UPI, cards & netbanking" },
    { Icon: Truck, title: shipping_fee <= 0 ? "Free shipping" : `Free shipping over ${formatPrice(free_shipping_threshold)}`, text: "Across India" },
    { Icon: Banknote, title: "Cash on delivery", text: "Pay when it arrives" },
    { Icon: RotateCcw, title: "Easy 7-day returns", text: "No questions asked" },
  ];
  return (
    <div className="border-b border-stone-200 bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex gap-6 lg:justify-between overflow-x-auto scrollbar-none">
        {items.map(({ Icon, title, text }) => (
          <div key={title} className="flex items-center gap-3 shrink-0">
            <Icon className="w-5 h-5 text-gold" />
            <div className="font-body leading-tight">
              <p className="text-xs font-semibold text-stone-800">{title}</p>
              <p className="text-[11px] text-stone-500">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BrandStory() {
  return (
    <section className="py-16 sm:py-24 bg-blush">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center">
        <motion.div {...fadeUp} className="overflow-hidden rounded-2xl">
          <img src={CRAFT_IMG} alt="Model wearing Aurevia jewellery" loading="lazy" className="w-full h-[360px] sm:h-[480px] object-cover" />
        </motion.div>
        <motion.div {...fadeUp}>
          <p className="text-[11px] tracking-[0.2em] uppercase font-semibold text-gold font-body mb-3">Why Aurevia</p>
          <h2 className="font-heading text-3xl sm:text-4xl text-stone-900 mb-5 leading-snug">The look of fine jewellery, at a price you'll love to gift</h2>
          <p className="font-body text-stone-600 leading-relaxed mb-4">
            Aurevia is a fashion jewellery label. Our pieces are crafted in brass and stainless steel, finished in
            polished yellow, rose and silver tones, and set with American Diamond (AD) and crystal stones —
            so you get the shine of fine jewellery without the fine-jewellery price.
          </p>
          <p className="font-body text-stone-600 leading-relaxed mb-8">
            Every design is anti-tarnish coated, nickel-free and is packed with care, making it
            easy to celebrate birthdays, anniversaries, Raksha Bandhan, Diwali — or just a Tuesday.
          </p>
          <Link to="/about" className="inline-flex items-center gap-3 border border-burgundy text-burgundy hover:bg-burgundy hover:text-white px-8 py-4 text-xs tracking-[0.2em] uppercase font-body font-semibold transition-colors">
            Our Story <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function CustomerReviews() {
  const [reviews, setReviews] = useState([]);
  useEffect(() => {
    api.get("/reviews/latest").then(r => setReviews(r.data)).catch(() => {});
  }, []);
  // Only genuine reviews from customers are shown; the section stays hidden until there are some.
  if (!reviews.length) return null;
  return (
    <section data-testid="customer-reviews" className="py-16 sm:py-20 bg-petal">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="text-center mb-10">
          <p className="text-[11px] tracking-[0.2em] uppercase font-semibold text-gold font-body">Real reviews</p>
          <h2 className="font-heading text-3xl sm:text-4xl text-stone-900">What our customers say</h2>
        </div>
        <div className="flex gap-4 sm:gap-6 overflow-x-auto snap-x pb-2 scrollbar-none">
          {reviews.map((r) => (
            <Link key={r.id} to={`/product/${r.product_id}`} className="snap-start shrink-0 w-[80%] sm:w-[45%] lg:w-[31%] rounded-2xl bg-white p-6 ring-1 ring-stone-200/70 hover:shadow-lg transition-shadow">
              <Stars value={r.rating} />
              {r.title && <p className="font-body font-semibold text-stone-900 mt-3">{r.title}</p>}
              <p className="font-body text-sm text-stone-600 mt-2 line-clamp-4">{r.body}</p>
              <div className="flex items-center justify-between gap-2 mt-4 text-xs font-body">
                <span className="text-stone-800 font-semibold flex items-center gap-1">{r.name}{r.verified && <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" aria-label="Verified buyer" />}</span>
                <span className="text-stone-400 truncate">on {r.product_name}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Newsletter() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await api.post("/newsletter", { email });
      toast.success(data.message);
      setEmail("");
    } catch (err) {
      toast.error(apiError(err, "Failed to subscribe"));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <section data-testid="newsletter-section" className="py-16 sm:py-20 bg-burgundy">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <p className="text-[11px] tracking-[0.2em] uppercase font-semibold text-gold mb-3 font-body">Join the club</p>
        <h2 className="font-heading text-3xl sm:text-4xl text-white mb-3">Get first dibs on new drops & offers</h2>
        <p className="text-sm text-white/60 font-body mb-8">Festive edits, members-only codes and gifting ideas — straight to your inbox.</p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input data-testid="newsletter-email-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" aria-label="Email address" required
            className="flex-1 bg-transparent border-b border-white/30 focus:border-gold text-white placeholder:text-white/40 py-3 text-sm font-body outline-none transition-colors" />
          <button data-testid="newsletter-submit-btn" type="submit" disabled={submitting}
            className="flex items-center justify-center gap-2 bg-gold hover:bg-gold-hover text-burgundy px-8 py-3 text-xs tracking-[0.2em] uppercase font-body font-semibold transition-colors disabled:opacity-50">
            <Send className="w-3.5 h-3.5" /> {submitting ? "..." : "Subscribe"}
          </button>
        </form>
      </div>
    </section>
  );
}

export default function Home() {
  const { products, getBestsellers } = useProducts();
  const { slides, categories, bannerOffers } = useStorefront();
  usePageTitle(null);

  const bestsellers = getBestsellers().slice(0, 8);
  const newArrivals = [...products].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).slice(0, 10);
  const onSale = products.filter(p => p.compare_at_price > p.price && p.stock !== 0).slice(0, 10);
  const giftBoxes = products.filter(p => p.category === "Gift Boxes");
  const underBudget = products.filter(p => p.price < 1000 && p.stock !== 0).slice(0, 8);
  // Spread the admin's banner offers through the page, cycling if there are fewer banners than slots.
  const banner = (slot) => (bannerOffers.length ? bannerOffers[slot % bannerOffers.length] : null);
  const bannerSlots = Math.min(bannerOffers.length, 3);

  return (
    <div data-testid="home-page" className="pt-16 sm:pt-20">
      <HeroCarousel slides={slides} />
      <TrustStrip />
      <CategoryTiles categories={categories} />
      {bannerSlots > 0 && <OfferBanner offer={banner(0)} variant={0} />}

      {bestsellers.length > 0 && (
        <section data-testid="bestsellers-section" className="py-14 sm:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-8">
            <SectionHeading eyebrow="Most loved" title="Trending now" link="/shop" />
            <ProductRow products={bestsellers} testId="trending-row" />
          </div>
        </section>
      )}

      {newArrivals.length > 0 && (
        <section data-testid="new-arrivals-section" className="py-14 sm:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-8">
            <SectionHeading eyebrow="Just dropped" title="New arrivals" link="/shop?sort=newest" />
            <ProductRow products={newArrivals} testId="new-row" />
          </div>
        </section>
      )}

      <ShopForTiles products={products} />
      {bannerSlots > 1 && <OfferBanner offer={banner(1)} variant={1} />}

      {giftBoxes.length > 0 && (
        <section data-testid="gift-boxes-section" className="py-14 sm:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-8">
            <SectionHeading eyebrow="Ready to gift" title="Curated gift boxes" link={`/shop?category=${encodeURIComponent("Gift Boxes")}`} />
            <ProductRow products={giftBoxes} />
          </div>
        </section>
      )}

      {onSale.length > 0 && (
        <section data-testid="sale-section" className="py-14 sm:py-20 bg-gradient-to-b from-petal to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-8">
            <SectionHeading eyebrow="Limited time" title="Deals you'll love" link="/shop?sale=1" />
            <ProductRow products={onSale} testId="sale-row" />
          </div>
        </section>
      )}

      {underBudget.length > 0 && (
        <section data-testid="under-budget-section" className="py-14 sm:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-8">
            <SectionHeading eyebrow="Thoughtful & affordable" title={`Gifts under ${formatPrice(999)}`} link="/shop?price=1" />
            <ProductRow products={underBudget} />
          </div>
        </section>
      )}

      <BrandStory />
      {bannerSlots > 2 && <OfferBanner offer={banner(2)} variant={2} />}
      <CustomerReviews />
      <Newsletter />
    </div>
  );
}
