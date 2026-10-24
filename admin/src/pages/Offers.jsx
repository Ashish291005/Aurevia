import { useEffect, useState } from "react";
import { Plus, BadgePercent, MessageSquareDashed, RectangleHorizontal, Gift, Copy, TicketPercent } from "lucide-react";
import { useContent } from "../lib/useContent";
import { api } from "../lib/api";
import { couponStatus, couponSummary } from "../lib/format";
import { navigate } from "../lib/router";
import { Card, PageHeader, EmptyState, Button, ConfirmDialog, Drawer, Select } from "../components/ui";
import { Input } from "../components/Input";
import ImageField from "../components/ImageField";
import LinkField from "../components/LinkField";
import RowActions from "../components/ContentRow";
import PlacementGuide from "../components/PlacementGuide";

const FIELDS = ["title", "description", "code", "image", "cta_text", "cta_link", "show_popup", "show_banner", "ends_at"];

// <input type="datetime-local"> works in local time; the API stores UTC ISO strings.
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
const isExpired = (o) => o.ends_at && new Date(o.ends_at) <= new Date();
const EMPTY = { title: "", description: "", code: "", image: "", cta_text: "Shop Now", cta_link: "/shop", show_popup: false, show_banner: true, active: true, ends_at: null };

// Same look as the storefront's offer banner, so the admin sees what customers will see.
function BannerPreview({ offer }) {
  return (
    <div className="relative overflow-hidden rounded-md bg-gradient-to-r from-burgundy via-[#6b1d33] to-burgundy-dark text-white">
      {offer.image && <img src={offer.image} alt="" className="absolute inset-y-0 right-0 w-1/3 h-full object-cover opacity-30 [mask-image:linear-gradient(to_left,black,transparent)]" />}
      <div className="relative px-5 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <Gift className="w-8 h-8 text-gold shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-heading text-2xl leading-tight">{offer.title || "Your headline"}</p>
          {offer.description && <p className="text-xs text-white/75 mt-1">{offer.description}</p>}
          {offer.code && <p className="text-[10px] text-white/60 mt-1.5 underline">T&amp;C apply</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {offer.code && <span className="inline-flex items-center gap-1.5 border-2 border-dashed border-white/70 px-3 py-1.5 text-xs font-bold tracking-[0.15em]">{offer.code} <Copy className="w-3 h-3" /></span>}
          {offer.cta_text && <span className="text-[10px] tracking-[0.2em] uppercase font-semibold">{offer.cta_text} →</span>}
        </div>
      </div>
    </div>
  );
}

function Label({ children, hint }) {
  return <span className="block text-xs font-medium text-stone-600 mb-1.5">{children}{hint && <span className="font-normal text-stone-400"> · {hint}</span>}</span>;
}

export default function Offers() {
  const { items, saving, save, remove, move, toggleActive } = useContent("offers", "Offer");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState(null);
  const [coupons, setCoupons] = useState([]);

  useEffect(() => { api.get("/admin/coupons").then(r => setCoupons(r.data)).catch(() => {}); }, []);
  const couponFor = (code) => coupons.find(c => c.code === code);
  const offerLabel = (o) => {
    if (!o.code) return "Announcement only (no code)";
    const c = couponFor(o.code);
    if (!c) return `Shows ${o.code}`;
    const status = couponStatus(c);
    return `${couponSummary(c)}${status !== "Active" ? ` · coupon is ${status.toLowerCase()}, so the code is hidden on the store` : ""}`;
  };

  const open = (item) => {
    setEditing(item || {});
    setForm(item ? { ...EMPTY, ...item } : EMPTY);
  };
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v?.target ? (v.target.type === "checkbox" ? v.target.checked : v.target.value) : v }));
  const pickCoupon = (code) => setForm(f => {
    const c = couponFor(code);
    // Default the countdown to the coupon's own end date.
    return { ...f, code, ends_at: f.ends_at || c?.ends_at || null };
  });

  const submit = async (e) => {
    e.preventDefault();
    const payload = { ...Object.fromEntries(FIELDS.map(f => [f, form[f]])), active: form.active, ends_at: form.ends_at || null };
    const ok = await save(editing, payload);
    if (ok) setEditing(null);
  };

  const popupOffer = (items || []).find(o => o.active && o.show_popup);

  return (
    <div data-testid="offers-page">
      <PageHeader
        title="Offers & banners"
        subtitle="What customers see: the welcome popup and the banners across the homepage and shop. A banner can show one of your coupons; the discount rules are set on the Coupons page."
        actions={<>
          <Button variant="secondary" onClick={() => navigate("coupons")}><TicketPercent className="w-4 h-4" /> Coupons</Button>
          <Button onClick={() => open(null)} data-testid="add-offer-btn"><Plus className="w-4 h-4" /> Add offer</Button>
        </>}
      />

      <PlacementGuide items={[
        { img: "guide-banner.jpg", title: "Homepage banners", text: "Offers with \"Banner\" ticked appear in these full-width strips between homepage sections, in the order listed below (up to 3 spots)." },
        { img: "guide-popup.jpg", title: "Welcome popup", text: "The first visible offer with \"Popup\" ticked opens once per visit, a few seconds after the page loads." },
        { img: "guide-shop-banner.jpg", title: "Shop page", text: "The first banner offer also shows at the top of the Shop page." },
      ]} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <Card className="p-4 flex items-start gap-3">
          <MessageSquareDashed className="w-5 h-5 text-gold shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-stone-900">Welcome popup</p>
            <p className="text-stone-500">{popupOffer ? <>Showing <strong>{popupOffer.title}</strong>: the first visible offer marked "Popup", shown once per visit.</> : "No offer is marked as popup, so no popup is shown."}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-start gap-3">
          <RectangleHorizontal className="w-5 h-5 text-gold shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-stone-900">Banners</p>
            <p className="text-stone-500">{(items || []).filter(o => o.active && o.show_banner).length} banner offers, shown in this order through the homepage (up to 3 spots) and at the top of the shop.</p>
          </div>
        </Card>
      </div>

      <Card>
        {items === null ? (
          <p className="py-16 text-center text-sm text-stone-500">Loading offers...</p>
        ) : items.length === 0 ? (
          <EmptyState icon={BadgePercent} title="No offers yet" text="Create a coupon like WELCOME10 or an announcement like free shipping above ₹999."
            action={<Button onClick={() => open(null)}><Plus className="w-4 h-4" /> Add offer</Button>} />
        ) : (
          <ul className="divide-y divide-stone-100">
            {items.map((o, i) => (
              <li key={o.id} data-testid={`offer-row-${o.code || i}`} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 ${o.active ? "" : "bg-stone-50"}`}>
                <span className="hidden sm:block w-6 text-center text-xs text-stone-400 tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`font-medium ${o.active ? "text-stone-900" : "text-stone-400"}`}>{o.title}</p>
                    {o.code && <span className="px-2 py-0.5 border border-dashed border-burgundy/50 text-burgundy text-xs font-bold tracking-wider rounded">{o.code}</span>}
                    {o.show_popup && <span className="px-2 py-0.5 rounded-full bg-gold/15 text-[#7a5d22] text-[11px] font-medium">Popup</span>}
                    {o.show_banner && <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[11px] font-medium">Banner</span>}
                    {!o.active && <span className="text-xs text-stone-400">Hidden</span>}
                    {o.ends_at && <span className={`text-[11px] ${isExpired(o) ? "text-red-700" : "text-stone-500"}`}>{isExpired(o) ? "Expired" : `Ends ${new Date(o.ends_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`}</span>}
                  </div>
                  <p className="text-sm text-stone-500 mt-0.5">{offerLabel(o)}</p>
                </div>
                <RowActions index={i} total={items.length} item={o} onMove={move} onEdit={open} onDelete={setDeleting}
                  onToggle={(item) => toggleActive(item, FIELDS)} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Drawer open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? "Edit offer" : "Add offer"}
        footer={<div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button type="submit" form="offer-form" loading={saving} disabled={!form.title.trim()} data-testid="offer-save">{editing?.id ? "Save offer" : "Add offer"}</Button>
        </div>}>
        <form id="offer-form" onSubmit={submit} className="space-y-5">
          <label className="block"><Label hint={`${form.title.length}/80`}>Headline</Label>
            <Input value={form.title} onChange={set("title")} maxLength={80} required placeholder="e.g. Flat ₹200 off this Diwali" className="rounded-md" data-testid="offer-title" /></label>
          <label className="block"><Label hint={`${form.description.length}/200`}>Details</Label>
            <Input value={form.description} onChange={set("description")} maxLength={200} placeholder="e.g. On orders above ₹1,999. Ends Sunday." className="rounded-md" /></label>

          <Card className="p-4 space-y-3">
            <label className="block"><Label hint="shown with a copy button and T&C">Coupon to show</Label>
              <Select value={form.code} onChange={pickCoupon} className="w-full" data-testid="offer-code"
                options={[{ value: "", label: "None: announcement only (e.g. free shipping above ₹999)" },
                  ...coupons.map(c => ({ value: c.code, label: `${c.code} · ${c.description || couponSummary(c)}${couponStatus(c) !== "Active" ? ` (${couponStatus(c).toLowerCase()})` : ""}` }))]} /></label>
            {form.code && couponFor(form.code) && (
              <p className="text-xs text-stone-500 bg-stone-50 rounded px-3 py-2">Rules: <strong>{couponSummary(couponFor(form.code))}</strong></p>
            )}
            <button type="button" onClick={() => navigate("coupons")} className="text-xs font-medium text-burgundy hover:text-gold">
              {coupons.length ? "Create or edit coupons →" : "No coupons yet. Create one on the Coupons page →"}
            </button>
          </Card>

          <div>
            <Label>Preview (banner)</Label>
            <BannerPreview offer={form} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block"><Label>Button text</Label>
              <Input value={form.cta_text} onChange={set("cta_text")} maxLength={30} className="rounded-md" /></label>
            <div className="sm:col-span-2"><Label>Button link</Label><LinkField value={form.cta_link} onChange={set("cta_link")} /></div>
          </div>

          <label className="block">
            <Label hint="optional · shows a live countdown; the offer and its code stop automatically">Ends at</Label>
            <div className="flex gap-2">
              <Input type="datetime-local" value={toLocalInput(form.ends_at)} onChange={e => setForm(f => ({ ...f, ends_at: fromLocalInput(e.target.value) }))} className="rounded-md max-w-xs" data-testid="offer-ends-at" />
              {form.ends_at && <Button type="button" variant="ghost" onClick={() => setForm(f => ({ ...f, ends_at: null }))}>No end date</Button>}
            </div>
          </label>

          <div>
            <Label hint="optional, used in the popup">Image</Label>
            <div className="max-w-xs"><ImageField value={form.image} onChange={set("image")} aspect="aspect-[4/3]" /></div>
          </div>

          <div className="space-y-2">
            <Label>Where to show it</Label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.show_popup} onChange={set("show_popup")} className="mt-0.5 w-4 h-4 accent-burgundy" data-testid="offer-popup" />
              <span className="text-sm text-stone-700">Welcome popup <span className="block text-xs text-stone-400">Shown once per visit. If several offers are ticked, the highest in the list wins.</span></span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.show_banner} onChange={set("show_banner")} className="mt-0.5 w-4 h-4 accent-burgundy" />
              <span className="text-sm text-stone-700">Banner on the homepage &amp; shop</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={set("active")} className="mt-0.5 w-4 h-4 accent-burgundy" />
              <span className="text-sm text-stone-700">Active <span className="block text-xs text-stone-400">Inactive offers are hidden and their coupon codes stop working.</span></span>
            </label>
          </div>
        </form>
      </Drawer>

      <ConfirmDialog open={Boolean(deleting)} title="Delete offer?" message={<>{deleting?.title} will be removed from the store.{deleting?.code ? <> The coupon <strong>{deleting.code}</strong> keeps working; turn it off on the Coupons page if needed.</> : ""}</>}
        confirmLabel="Delete" onCancel={() => setDeleting(null)} onConfirm={async () => { await remove(deleting); setDeleting(null); }} />
    </div>
  );
}
