import { useEffect, useState } from "react";
import { Save, Megaphone, Truck, Store, Share2, KeyRound, MessageCircle, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { api, apiError, STORE_URL } from "../lib/api";
import { money } from "../lib/format";
import { Card, PageHeader, Button } from "../components/ui";
import { Input } from "../components/Input";

function Section({ icon: Icon, title, description, children }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-5">
        <span className="w-9 h-9 rounded-md bg-burgundy/10 text-burgundy flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></span>
        <div>
          <h2 className="text-base font-semibold text-stone-900">{title}</h2>
          {description && <p className="text-sm text-stone-500">{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-stone-600 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-stone-400 mt-1">{hint}</span>}
    </label>
  );
}

function PasswordCard() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    if (form.next.length < 8) { toast.error("Use at least 8 characters for the admin password"); return; }
    if (form.next !== form.confirm) { toast.error("New passwords don't match"); return; }
    setSaving(true);
    try {
      await api.post("/auth/change-password", { current_password: form.current, new_password: form.next });
      toast.success("Admin password updated");
      setForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      toast.error(apiError(err, "Could not change password"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Section icon={KeyRound} title="Admin password" description="Change the password for the account you're signed in with.">
      <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Current password"><Input type="password" autoComplete="current-password" value={form.current} onChange={set("current")} required className="rounded-md" /></Field>
        <Field label="New password"><Input type="password" autoComplete="new-password" value={form.next} onChange={set("next")} required minLength={8} className="rounded-md" /></Field>
        <Field label="Confirm new password"><Input type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} required className="rounded-md" /></Field>
        <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-stone-400">If ADMIN_PASSWORD is set in backend/.env, it overrides this on restart.</p>
          <Button type="submit" loading={saving}>Update password</Button>
        </div>
      </form>
    </Section>
  );
}

const STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"];

// Nimbus shipping: where couriers pick up from, and the default parcel size. Admin-only (not public settings).
function ShippingCard() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get("/admin/shipping").then(r => setForm(r.data)).catch(err => toast.error(apiError(err, "Could not load shipping settings"))); }, []);
  if (!form) return null;
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { nimbus_connected, ...rest } = form;
      const num = (v) => Math.max(1, Math.round(Number(v) || 1));
      const { data } = await api.put("/admin/shipping", { ...rest, package_weight: num(rest.package_weight), package_length: num(rest.package_length),
        package_breadth: num(rest.package_breadth), package_height: num(rest.package_height) });
      setForm(data);
      toast.success("Shipping settings saved");
    } catch (err) {
      toast.error(apiError(err, "Could not save shipping settings"));
    } finally {
      setSaving(false);
    }
  };
  const text = (k, label, props = {}) => (
    <Field label={label} hint={props.hint}><Input value={form[k] || ""} onChange={set(k)} className="rounded-md" {...props} hint={undefined} /></Field>
  );
  return (
    <form onSubmit={save} data-testid="shipping-settings">
      <Section icon={Truck} title="Shipping · Nimbus" description="Your pickup (warehouse) address and default parcel size, used when you click Ship with Nimbus on an order.">
        <p className={`text-xs rounded px-3 py-2 mb-4 ${form.nimbus_connected ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
          {form.nimbus_connected ? "Nimbus account connected." : "Nimbus account not connected yet: add NIMBUS_EMAIL and NIMBUS_PASSWORD in Vercel → Environment Variables, then redeploy."}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {text("warehouse_name", "Warehouse name", { maxLength: 20, required: true, placeholder: "Aurevia Studio", hint: "Short name, max 20 characters (shown in Nimbus)" })}
          {text("pickup_name", "Contact person", { maxLength: 200, required: true })}
          {text("pickup_phone", "Pickup phone", { maxLength: 16, required: true, placeholder: "98765 43210" })}
          {text("pickup_address", "Address", { maxLength: 200, required: true })}
          {text("pickup_address_2", "Address line 2 (landmark)", { maxLength: 200 })}
          {text("pickup_city", "City", { maxLength: 40, required: true })}
          <Field label="State">
            <select value={form.pickup_state || ""} onChange={set("pickup_state")} required className="h-10 w-full border border-stone-300 rounded-md bg-white px-3 text-sm outline-none focus:border-gold">
              <option value="">Select state</option>
              {STATES.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </Field>
          {text("pickup_pincode", "PIN code", { maxLength: 6, required: true, pattern: "[1-9][0-9]{5}", inputMode: "numeric" })}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          {text("package_weight", "Default weight (g)", { type: "number", min: 1 })}
          {text("package_length", "Length (cm)", { type: "number", min: 1 })}
          {text("package_breadth", "Breadth (cm)", { type: "number", min: 1 })}
          {text("package_height", "Height (cm)", { type: "number", min: 1 })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 items-end">
          {text("nimbus_subdomain", "Tracking page subdomain", { maxLength: 60, hint: "Customers track at <subdomain>.nmbus.co/track/<AWB>" })}
          <label className="flex items-center gap-3 text-sm text-stone-700 cursor-pointer pb-2">
            <input type="checkbox" checked={Boolean(form.auto_pickup)} onChange={set("auto_pickup")} className="w-4 h-4 accent-burgundy" />
            Request courier pickup automatically when booking
          </label>
        </div>
        <div className="mt-5"><Button type="submit" loading={saving}><Save className="w-4 h-4" /> Save shipping settings</Button></div>
      </Section>
    </form>
  );
}

export default function Settings() {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/settings").then(r => { setForm(r.data); setSaved(r.data); }).catch(err => toast.error(apiError(err, "Could not load settings")));
  }, []);

  if (!form) return <p className="py-20 text-center text-sm text-stone-500">Loading settings...</p>;

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const fee = Number(form.shipping_fee) || 0;
  const threshold = Number(form.free_shipping_threshold) || 0;
  const shippingSummary = fee <= 0
    ? "Shipping is free on every order."
    : threshold > 0
      ? `Orders under ${money(threshold)} pay ${money(fee)} shipping; ${money(threshold)} and over ship free.`
      : `Every order pays ${money(fee)} shipping.`;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put("/admin/settings", { ...form, shipping_fee: fee, free_shipping_threshold: threshold });
      setForm(data);
      setSaved(data);
      toast.success("Settings saved — the storefront updates on next page load");
    } catch (err) {
      toast.error(apiError(err, "Could not save settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="settings-page">
      <PageHeader title="Settings" subtitle="Store details and rules shown across the storefront." />

      <form onSubmit={save} className="space-y-5">
        <Section icon={Megaphone} title="Announcement bar" description="A slim banner at the very top of every storefront page.">
          <label className="flex items-center gap-3 mb-4 cursor-pointer">
            <input type="checkbox" checked={form.announcement_enabled} onChange={set("announcement_enabled")} className="w-4 h-4 accent-burgundy" data-testid="settings-announcement-enabled" />
            <span className="text-sm text-stone-700">Show the announcement bar</span>
          </label>
          <Field label="Message" hint={`${form.announcement_text.length}/200 characters`}>
            <Input value={form.announcement_text} onChange={set("announcement_text")} maxLength={200} placeholder="e.g. Diwali sale: 20% off pendant sets" className="rounded-md" data-testid="settings-announcement-text" />
          </Field>
          {form.announcement_enabled && form.announcement_text.trim() && (
            <div className="mt-4">
              <p className="text-xs text-stone-400 mb-1">Preview</p>
              <div className="h-9 bg-burgundy text-white flex items-center justify-center px-4 rounded">
                <p className="text-xs tracking-[0.15em] uppercase truncate">{form.announcement_text}</p>
              </div>
            </div>
          )}
        </Section>

        <Section icon={Megaphone} title="Scrolling ticker" description="Short messages that scroll in the top bar, after the announcement above.">
          <div className="space-y-2">
            {(form.ticker_messages || []).map((m, i) => (
              <div key={i} className="flex gap-2">
                <Input value={m} maxLength={80} onChange={e => setForm(f => ({ ...f, ticker_messages: f.ticker_messages.map((x, j) => (j === i ? e.target.value : x)) }))} className="rounded-md" />
                <Button type="button" variant="ghost" onClick={() => setForm(f => ({ ...f, ticker_messages: f.ticker_messages.filter((_, j) => j !== i) }))} aria-label="Remove message"><X className="w-4 h-4" /></Button>
              </div>
            ))}
            {(form.ticker_messages || []).length < 8 && (
              <Button type="button" variant="secondary" onClick={() => setForm(f => ({ ...f, ticker_messages: [...(f.ticker_messages || []), ""] }))}><Plus className="w-4 h-4" /> Add message</Button>
            )}
          </div>
        </Section>

        <Section icon={MessageCircle} title="WhatsApp chat" description="Shows a floating WhatsApp button on every storefront page. Leave empty to hide it.">
          <Field label="WhatsApp number" hint="10-digit mobile number; +91 is added automatically">
            <Input value={form.whatsapp_number || ""} onChange={set("whatsapp_number")} placeholder="98765 43210" maxLength={20} className="rounded-md max-w-xs" data-testid="settings-whatsapp" />
          </Field>
        </Section>

        <Section icon={Truck} title="Shipping" description="Used for cart totals and charged on every new order.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Shipping fee (₹)" hint="0 = always free">
              <Input type="number" min="0" step="0.01" value={form.shipping_fee} onChange={set("shipping_fee")} required className="rounded-md" data-testid="settings-shipping-fee" />
            </Field>
            <Field label="Free shipping from (₹)" hint="0 = no free-shipping threshold">
              <Input type="number" min="0" step="0.01" value={form.free_shipping_threshold} onChange={set("free_shipping_threshold")} required className="rounded-md" data-testid="settings-free-threshold" />
            </Field>
          </div>
          <p className="mt-3 text-sm text-stone-600 bg-stone-50 rounded px-3 py-2">{shippingSummary}</p>
        </Section>

        <Section icon={Store} title="Store details" description="Shown in the footer and on the Contact page (with a map of the address).">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contact email"><Input type="email" value={form.store_email} onChange={set("store_email")} maxLength={120} className="rounded-md" /></Field>
            <Field label="Phone"><Input value={form.store_phone} onChange={set("store_phone")} maxLength={40} className="rounded-md" /></Field>
            <div className="sm:col-span-2">
              <Field label="Boutique address"><Input value={form.store_address} onChange={set("store_address")} maxLength={200} className="rounded-md" /></Field>
            </div>
          </div>
        </Section>

        <Section icon={Share2} title="Social media" description="Icons only appear on the storefront for links you fill in.">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Instagram URL"><Input value={form.instagram_url} onChange={set("instagram_url")} placeholder="https://instagram.com/..." className="rounded-md" /></Field>
            <Field label="Facebook URL"><Input value={form.facebook_url} onChange={set("facebook_url")} placeholder="https://facebook.com/..." className="rounded-md" /></Field>
            <Field label="X / Twitter URL"><Input value={form.twitter_url} onChange={set("twitter_url")} placeholder="https://x.com/..." className="rounded-md" /></Field>
          </div>
        </Section>

        <div className="sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 bg-stone-50/95 backdrop-blur flex items-center justify-end gap-3 border-t border-stone-200 sm:border-0">
          {dirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
          <a href={STORE_URL} target="_blank" rel="noreferrer" className="text-xs text-stone-500 underline hover:text-burgundy">Open storefront</a>
          <Button type="submit" loading={saving} disabled={!dirty} data-testid="settings-save"><Save className="w-4 h-4" /> Save settings</Button>
        </div>
      </form>

      <div className="mt-8">
        <ShippingCard />
      </div>

      <div className="mt-8">
        <PasswordCard />
      </div>
    </div>
  );
}
