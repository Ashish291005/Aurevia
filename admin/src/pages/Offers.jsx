import { useState } from "react";
import { Plus, BadgePercent, MessageSquareDashed, RectangleHorizontal } from "lucide-react";
import { useContent } from "../lib/useContent";
import { money } from "../lib/format";
import { Card, PageHeader, EmptyState, Button, ConfirmDialog, Drawer, Select } from "../components/ui";
import { Input } from "../components/Input";
import ImageField from "../components/ImageField";
import LinkField from "../components/LinkField";
import RowActions from "../components/ContentRow";

const FIELDS = ["title", "description", "code", "discount_type", "discount_value", "min_order", "image", "cta_text", "cta_link", "show_popup", "show_banner"];
const EMPTY = { title: "", description: "", code: "", discount_type: "percent", discount_value: 10, min_order: 0, image: "", cta_text: "Shop Now", cta_link: "/shop", show_popup: false, show_banner: true, active: true };

export const discountLabel = (o) => {
  if (!o.code) return "Announcement only (no code)";
  const amount = o.discount_type === "percent" ? `${o.discount_value}% off` : `${money(o.discount_value)} off`;
  return `${amount}${o.min_order ? ` on orders above ${money(o.min_order)}` : ""}`;
};

function Label({ children, hint }) {
  return <span className="block text-xs font-medium text-stone-600 mb-1.5">{children}{hint && <span className="font-normal text-stone-400"> · {hint}</span>}</span>;
}

export default function Offers() {
  const { items, saving, save, remove, move, toggleActive } = useContent("offers", "Offer");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [hasCode, setHasCode] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const open = (item) => {
    setEditing(item || {});
    setForm(item ? { ...EMPTY, ...item, discount_type: item.discount_type === "none" ? "percent" : item.discount_type } : EMPTY);
    setHasCode(item ? Boolean(item.code) : true);
  };
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v?.target ? (v.target.type === "checkbox" ? v.target.checked : v.target.value) : v }));

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      ...Object.fromEntries(FIELDS.map(f => [f, form[f]])),
      active: form.active,
      code: hasCode ? form.code.trim().toUpperCase() : "",
      discount_type: hasCode ? form.discount_type : "none",
      discount_value: hasCode ? Number(form.discount_value) || 0 : 0,
      min_order: hasCode ? Number(form.min_order) || 0 : 0,
    };
    const ok = await save(editing, payload);
    if (ok) setEditing(null);
  };

  const popupOffer = (items || []).find(o => o.active && o.show_popup);

  return (
    <div data-testid="offers-page">
      <PageHeader
        title="Offers & coupons"
        subtitle="Offers appear as the welcome popup and as banners across the homepage and shop. Coupon codes are applied in the cart."
        actions={<Button onClick={() => open(null)} data-testid="add-offer-btn"><Plus className="w-4 h-4" /> Add offer</Button>}
      />

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
          <EmptyState icon={BadgePercent} title="No offers yet" text="Create a coupon like WELCOME10 or an announcement like free gift wrapping."
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
                  </div>
                  <p className="text-sm text-stone-500 mt-0.5">{discountLabel(o)}</p>
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

          <Card className="p-4 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={hasCode} onChange={e => setHasCode(e.target.checked)} className="w-4 h-4 accent-burgundy" data-testid="offer-has-code" />
              <span className="text-sm text-stone-800 font-medium">Includes a coupon code</span>
            </label>
            {hasCode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block"><Label hint="customers type this in the cart">Code</Label>
                  <Input value={form.code} onChange={set("code")} required maxLength={30} pattern="[A-Za-z0-9_\-]{3,30}" title="3–30 letters, numbers, - or _" placeholder="DIWALI200" className="rounded-md uppercase" data-testid="offer-code" /></label>
                <label className="block"><Label>Discount type</Label>
                  <Select value={form.discount_type} onChange={set("discount_type")} className="w-full"
                    options={[{ value: "percent", label: "Percentage (%)" }, { value: "flat", label: "Flat amount (₹)" }]} /></label>
                <label className="block"><Label>{form.discount_type === "percent" ? "Percent off" : "Amount off (₹)"}</Label>
                  <Input type="number" min="1" max={form.discount_type === "percent" ? 90 : undefined} step="1" value={form.discount_value} onChange={set("discount_value")} required className="rounded-md" data-testid="offer-value" /></label>
                <label className="block"><Label hint="0 = no minimum">Minimum order (₹)</Label>
                  <Input type="number" min="0" step="1" value={form.min_order} onChange={set("min_order")} className="rounded-md" data-testid="offer-min" /></label>
                <p className="sm:col-span-2 text-xs text-stone-500 bg-stone-50 rounded px-3 py-2">Customers get: <strong>{discountLabel({ ...form, code: form.code || "CODE", discount_value: Number(form.discount_value) || 0, min_order: Number(form.min_order) || 0 })}</strong></p>
              </div>
            ) : (
              <p className="text-xs text-stone-500">Without a code this is an announcement only, e.g. "Free gift wrapping on every order".</p>
            )}
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block"><Label>Button text</Label>
              <Input value={form.cta_text} onChange={set("cta_text")} maxLength={30} className="rounded-md" /></label>
            <div className="sm:col-span-2"><Label>Button link</Label><LinkField value={form.cta_link} onChange={set("cta_link")} /></div>
          </div>

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

      <ConfirmDialog open={Boolean(deleting)} title="Delete offer?" message={<>{deleting?.title} will be removed{deleting?.code ? <> and the code <strong>{deleting.code}</strong> will stop working</> : ""}. Past orders keep their discount.</>}
        confirmLabel="Delete" onCancel={() => setDeleting(null)} onConfirm={async () => { await remove(deleting); setDeleting(null); }} />
    </div>
  );
}
