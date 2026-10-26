import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Gift, Sparkles, HeartHandshake } from "lucide-react";
import { usePageTitle } from "../lib/hooks";

const HERO_IMG = "/images/hero/hero-1.webp";
const STORY_IMG = "/images/brand/brand-bg.webp";
const CTA_IMG = "/images/brand/pearl-bg.webp";

const fadeUp = { initial: { opacity: 0, y: 30 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.6 } };

const VALUES = [
  { Icon: Sparkles, title: "Fine-jewellery look", desc: "Polished yellow, rose and silver finishes with American Diamond and crystal stones, so every piece looks far more expensive than it is." },
  { Icon: ShieldCheck, title: "Skin-friendly & anti-tarnish", desc: "Nickel- and lead-free bases with an anti-tarnish coat. Kind to sensitive skin and made to keep their shine." },
  { Icon: Gift, title: "Gift-ready, always", desc: "Every order is packed with care, ready to give. Curated gift boxes take the guesswork out of gifting." },
  { Icon: HeartHandshake, title: "Honest pricing", desc: "We're a fashion jewellery brand, not a fine jeweller, and we say so. Designs start at ₹449, so you can gift often and gift well." },
];

export default function About() {
  usePageTitle("Our story");
  return (
    <div data-testid="about-page" className="pt-16 sm:pt-20">
      <div className="relative h-[46vh] sm:h-[56vh] overflow-hidden">
        <img src={HERO_IMG} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-burgundy/60" />
        <div className="relative h-full flex items-center justify-center text-center px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <p className="text-xs tracking-[0.3em] uppercase text-gold mb-4 font-body font-semibold">Our Story</p>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl text-white">Jewellery made for gifting</h1>
          </motion.div>
        </div>
      </div>

      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <motion.div {...fadeUp}>
            <p className="text-xs tracking-[0.2em] uppercase font-semibold text-gold mb-4 font-body">Who we are</p>
            <h2 className="font-heading text-3xl sm:text-4xl text-stone-900 mb-6 leading-snug">Beautiful pieces for every celebration, at prices that make sense</h2>
            <p className="text-base leading-relaxed text-stone-600 font-body mb-5">
              Aurevia started with a simple frustration: finding a gift that looked special, felt personal and didn't cost a fortune.
              So we set out to make fashion jewellery that people are genuinely proud to give and wear, from everyday studs to
              statement pendant sets and bangles.
            </p>
            <p className="text-base leading-relaxed text-stone-600 font-body">
              Our designs are made in India from brass and stainless steel with an anti-tarnish finish, in yellow, rose and silver tones,
              set with American Diamond and crystal stones. They are fashion jewellery, not precious metal, and that's the point: you get the look and
              the joy of fine jewellery for birthdays, anniversaries, Raksha Bandhan, Diwali, weddings and every "just because".
            </p>
          </motion.div>
          <motion.div {...fadeUp} className="overflow-hidden rounded-2xl">
            <img src={STORY_IMG} alt="Aurevia necklace and bangles" loading="lazy" className="w-full h-[420px] sm:h-[500px] object-cover" />
          </motion.div>
        </div>
      </section>

      <section className="py-20 sm:py-28 bg-blush">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <motion.div {...fadeUp} className="text-center mb-14">
            <p className="text-xs tracking-[0.2em] uppercase font-semibold text-gold mb-3 font-body">What we promise</p>
            <h2 className="font-heading text-3xl sm:text-4xl text-stone-900">The Aurevia promise</h2>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map(({ Icon, title, desc }, i) => (
              <motion.div key={title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
                data-testid={`value-${i}`} className="bg-white rounded-2xl p-7">
                <Icon className="w-8 h-8 text-gold mb-4" />
                <h3 className="font-heading text-xl text-stone-900 mb-2">{title}</h3>
                <p className="text-sm leading-relaxed text-stone-600 font-body">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-24 sm:py-32 overflow-hidden">
        <img src={CTA_IMG} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-burgundy/80" />
        <div className="relative text-center px-6">
          <motion.div {...fadeUp}>
            <h2 className="font-heading text-3xl sm:text-4xl text-white mb-5">Find the perfect gift</h2>
            <p className="text-sm text-white/75 font-body mb-10 max-w-lg mx-auto">Curated boxes for her, him and couples, wrapped free and delivered across India.</p>
            <Link to="/shop?category=Gift%20Boxes" data-testid="about-shop-link"
              className="inline-flex items-center gap-3 bg-gold hover:bg-gold-hover text-burgundy px-10 py-4 text-xs tracking-[0.2em] uppercase font-body font-semibold transition-colors">
              Shop Gift Boxes <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
