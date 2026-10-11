import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Star, Send, ShieldCheck, Gift, Truck, RotateCcw, Banknote } from "lucide-react";
import { toast } from "sonner";
import ProductCard from "../components/ProductCard";
import HeroCarousel from "../components/home/HeroCarousel";
import CategoryTiles from "../components/home/CategoryTiles";
import OfferBanner from "../components/home/OfferBanner";
import ShopForTiles from "../components/home/ShopForTiles";
import { testimonials } from "../data/products";
import { useProducts } from "../context/ProductsContext";
import { useStorefront } from "../context/StorefrontContext";
import { useSettings } from "../context/SettingsContext";
import { api, apiError } from "../lib/api";
import { formatPrice } from "../lib/format";
import { usePageTitle } from "../lib/hooks";

const CRAFT_IMG = "https://images.unsplash.com/photo-1620656798579-1984d9e87df7?w=1200&q=80";
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

function ProductRow({ products }) {
  // Left-to-right row of compact cards; scrolls sideways on smaller screens.
  return (
    <div className="flex gap-4 sm:gap-6 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
      {products.map(p => (
        <div key={p.id} className="snap-start shrink-0 w-[44%] sm:w-[30%] lg:w-[23%]">
          <ProductCard product={p} />
        </div>
      ))}
    </div>
  );
}

function TrustStrip() {
  const { free_shipping_threshold, shipping_fee } = useSettings();
  const items = [
    { Icon: ShieldCheck, title: "Anti-tarnish & skin-safe", text: "Nickel & lead free" },
    { Icon: Gift, title: "Free gift wrapping", text: "With a note card" },
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
            Aurevia is a fashion jewellery label. Our pieces are crafted in brass and stainless steel, finished with
            gold, rose-gold and rhodium plating, and set with American Diamond (AD), kundan and crystal stones —
            so you get the shine of fine jewellery without the fine-jewellery price.
          </p>
          <p className="font-body text-stone-600 leading-relaxed mb-8">
            Every design is anti-tarnish coated, nickel-free and arrives gift-ready in our signature box, making it
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

function Testimonials() {
  return (
    <section className="py-16 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        <div className="text-center mb-12">
          <p className="text-[11px] tracking-[0.2em] uppercase font-semibold text-gold font-body">Loved across India</p>
          <h2 className="font-heading text-3xl sm:text-4xl text-stone-900">What our customers say</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center px-6 py-9 rounded-2xl border border-stone-200 bg-cream">
              <div className="flex justify-center gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, idx) => <Star key={idx} className="w-4 h-4 fill-gold text-gold" />)}
              </div>
              <p className="font-heading text-lg italic text-stone-700 mb-5 leading-relaxed">"{t.text}"</p>
              <p className="text-xs tracking-[0.15em] uppercase font-body font-semibold text-stone-500">{t.name}</p>
            </motion.div>
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
            <SectionHeading eyebrow="Most loved" title="Bestsellers" link="/shop" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-10">
              {bestsellers.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
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
      <Testimonials />
      <Newsletter />
    </div>
  );
}
