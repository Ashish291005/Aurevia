import { useState } from "react";
import { motion } from "framer-motion";
import { Send, MapPin, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import { SocialLinks } from "../components/Footer";
import { useSettings } from "../context/SettingsContext";
import { api, apiError } from "../lib/api";
import { usePageTitle } from "../lib/hooks";


export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const settings = useSettings();
  usePageTitle("Contact");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await api.post("/contact", form);
      toast.success(data.message);
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      toast.error(apiError(err, "Failed to send message"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="contact-page" className="pt-16 sm:pt-20">
      {/* Header */}
      <div className="bg-burgundy py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="text-xs tracking-[0.2em] uppercase font-semibold text-gold mb-3 font-body">Get in Touch</p>
            <h1 className="font-heading text-4xl sm:text-5xl text-white tracking-tight">Contact Us</h1>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-16 sm:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Form */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h2 className="font-heading text-2xl sm:text-3xl text-stone-900 mb-2">Send Us a Message</h2>
            <p className="text-sm text-stone-500 font-body mb-8">We'd love to hear from you. Fill out the form below and we'll respond within 24 hours.</p>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="text-xs tracking-[0.15em] uppercase font-body font-semibold text-stone-700 mb-2 block">Name</label>
                <Input data-testid="contact-name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Your name" className="rounded-none border-stone-300 font-body" required />
              </div>
              <div>
                <label className="text-xs tracking-[0.15em] uppercase font-body font-semibold text-stone-700 mb-2 block">Email</label>
                <Input data-testid="contact-email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="your@email.com" className="rounded-none border-stone-300 font-body" required />
              </div>
              <div>
                <label className="text-xs tracking-[0.15em] uppercase font-body font-semibold text-stone-700 mb-2 block">Message</label>
                <textarea data-testid="contact-message" value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  placeholder="Your message..." rows={5} required
                  className="flex w-full border border-stone-300 bg-transparent px-3 py-2 text-sm font-body placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold" />
              </div>
              <button data-testid="contact-submit-btn" type="submit" disabled={submitting}
                className="flex items-center justify-center gap-3 bg-burgundy text-white w-full py-4 text-xs tracking-[0.2em] uppercase font-body font-semibold hover:bg-burgundy-dark transition-colors disabled:opacity-50">
                <Send className="w-4 h-4" /> {submitting ? "Sending..." : "Send Message"}
              </button>
            </form>
          </motion.div>

          {/* Info */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            <h2 className="font-heading text-2xl sm:text-3xl text-stone-900 mb-8">Visit Us</h2>
            <div className="space-y-6 mb-10">
              {settings.store_address && (
                <div className="flex items-start gap-4">
                  <MapPin className="w-5 h-5 text-gold mt-0.5 shrink-0" />
                  <div>
                    <p className="font-body font-semibold text-sm text-stone-800">Flagship Boutique</p>
                    <p className="text-sm text-stone-500 font-body">{settings.store_address}</p>
                  </div>
                </div>
              )}
              {settings.store_email && (
                <div className="flex items-start gap-4">
                  <Mail className="w-5 h-5 text-gold mt-0.5 shrink-0" />
                  <div>
                    <p className="font-body font-semibold text-sm text-stone-800">Email</p>
                    <a href={`mailto:${settings.store_email}`} className="text-sm text-stone-500 font-body hover:text-gold">{settings.store_email}</a>
                  </div>
                </div>
              )}
              {settings.store_phone && (
                <div className="flex items-start gap-4">
                  <Phone className="w-5 h-5 text-gold mt-0.5 shrink-0" />
                  <div>
                    <p className="font-body font-semibold text-sm text-stone-800">Phone</p>
                    <a href={`tel:${settings.store_phone.replace(/[^+\d]/g, "")}`} className="text-sm text-stone-500 font-body hover:text-gold">{settings.store_phone}</a>
                  </div>
                </div>
              )}
            </div>

            {(settings.instagram_url || settings.facebook_url || settings.twitter_url) && (
              <>
                <Separator className="mb-8" />
                <div className="mb-10">
                  <h3 className="text-xs tracking-[0.2em] uppercase font-semibold text-gold mb-4 font-body">Follow Us</h3>
                  <SocialLinks className="gap-5 text-stone-500" />
                </div>
              </>
            )}

            {settings.store_address && (
              <div data-testid="store-map" className="aspect-video bg-stone-200 overflow-hidden border border-stone-200">
                <iframe
                  title="Store location"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(settings.store_address)}&z=15&output=embed`}
                  className="w-full h-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
