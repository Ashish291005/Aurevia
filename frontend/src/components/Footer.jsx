import { Link } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, Phone, MapPin } from "lucide-react";
import { Instagram, Facebook, Twitter } from "./ui/social-icons";
import { api, apiError } from "../lib/api";
import { useSettings } from "../context/SettingsContext";
import { useProducts } from "../context/ProductsContext";

export function SocialLinks({ className = "", iconClass = "w-5 h-5" }) {
  const s = useSettings();
  const links = [
    { url: s.instagram_url, label: "Instagram", Icon: Instagram },
    { url: s.facebook_url, label: "Facebook", Icon: Facebook },
    { url: s.twitter_url, label: "Twitter", Icon: Twitter },
  ].filter(l => l.url);
  if (!links.length) return null;
  return (
    <div className={`flex gap-4 ${className}`}>
      {links.map(({ url, label, Icon }) => (
        <a key={label} href={url} target="_blank" rel="noopener noreferrer" aria-label={label} data-testid={`social-${label.toLowerCase()}`}
          className="transition-colors hover:text-gold">
          <Icon className={iconClass} />
        </a>
      ))}
    </div>
  );
}

export default function Footer() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const settings = useSettings();
  const { categories } = useProducts();

  const handleNewsletter = async (e) => {
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
    <footer data-testid="footer" className="bg-burgundy text-white/80 font-body">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-16 sm:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-10">
          <div className="lg:col-span-2">
            <h3 className="font-heading text-3xl text-white tracking-[0.2em] mb-4">AUREVIA</h3>
            <p className="text-sm leading-relaxed text-white/60 max-w-sm">Where Elegance Shines. Anti-tarnish fashion jewellery and ready-to-gift boxes, designed in India for every celebration.</p>
            <ul className="mt-6 space-y-2 text-sm text-white/60">
              {settings.store_email && <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-gold shrink-0" /><a href={`mailto:${settings.store_email}`} className="hover:text-gold">{settings.store_email}</a></li>}
              {settings.store_phone && <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-gold shrink-0" /><a href={`tel:${settings.store_phone.replace(/[^+\d]/g, "")}`} className="hover:text-gold">{settings.store_phone}</a></li>}
              {settings.store_address && <li className="flex items-start gap-2"><MapPin className="w-4 h-4 text-gold shrink-0 mt-0.5" />{settings.store_address}</li>}
            </ul>
            <SocialLinks className="mt-6 text-white/60" />
          </div>

          <div>
            <h4 className="text-gold text-xs tracking-[0.2em] uppercase font-semibold mb-5">Shop</h4>
            <nav className="flex flex-col gap-3 text-sm">
              <Link to="/shop" className="text-white/60 hover:text-gold transition-colors">Shop All</Link>
              {categories.map(cat => (
                <Link key={cat} to={`/shop?category=${encodeURIComponent(cat)}`} data-testid={`footer-collection-${cat.toLowerCase()}`}
                  className="text-white/60 hover:text-gold transition-colors">{cat}</Link>
              ))}
            </nav>
          </div>

          <div>
            <h4 className="text-gold text-xs tracking-[0.2em] uppercase font-semibold mb-5">Help</h4>
            <nav className="flex flex-col gap-3 text-sm">
              {[
                { to: "/account", label: "My Account" },
                { to: "/track-order", label: "Track Order" },
                { to: "/wishlist", label: "Wishlist" },
                { to: "/about", label: "Our Story" },
                { to: "/contact", label: "Contact Us" },
              ].map(link => (
                <Link key={link.to} to={link.to} className="text-white/60 hover:text-gold transition-colors">{link.label}</Link>
              ))}
            </nav>
          </div>

          <div>
            <h4 className="text-gold text-xs tracking-[0.2em] uppercase font-semibold mb-5">Newsletter</h4>
            <p className="text-sm text-white/60 mb-4">Be the first to discover new collections and exclusive offers.</p>
            <form onSubmit={handleNewsletter} className="flex flex-col gap-3">
              <input
                data-testid="footer-newsletter-input"
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Your email"
                aria-label="Email address"
                className="bg-transparent border-b border-gold/40 focus:border-gold text-white placeholder:text-white/30 py-2 text-sm outline-none transition-colors"
                required
              />
              <button data-testid="footer-newsletter-submit" type="submit" disabled={submitting}
                className="text-xs tracking-[0.2em] uppercase text-gold hover:text-white transition-colors text-left font-semibold disabled:opacity-50">
                {submitting ? "Subscribing..." : "Subscribe"}
              </button>
            </form>
          </div>
        </div>

        <div className="border-t border-white/10 mt-14 pt-8 flex flex-col sm:flex-row gap-3 justify-between text-xs text-white/40">
          <p>&copy; {new Date().getFullYear()} Aurevia. All rights reserved.</p>
          <p>Fashion jewellery (gold-plated, AD & kundan) · Cash on delivery across India</p>
        </div>
      </div>
    </footer>
  );
}
