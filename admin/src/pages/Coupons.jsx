import { useEffect, useState } from "react";
import { Plus, TicketPercent, Copy, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useContent } from "../lib/useContent";
import { api } from "../lib/api";
import { couponStatus, couponSummary } from "../lib/format";
import { Card, PageHeader, EmptyState, Button, ConfirmDialog, Drawer, Select } from "../components/ui";
import { Input } from "../components/Input";
import PlacementGuide from "../components/PlacementGuide";

const FIELDS = ["code", "description", "discount_type", "discount_value", "max_discount", "min_order", "starts_at", "ends_at",
  "usage_limit", "per_customer_limit", "first_order_only", "show_in_cart", "terms", "active"];
const EMPTY = { code: "", description: "", discount_type: "percent", discount_value: 10, max_discount: 0, min_order: 0, starts_at: null, ends_at: null,
  usage_limit: 0, per_customer_limit: 1, first_order_only: false, show_in_cart: true, terms: "", active: true };

// <input type="datetime-local"> works in local time; the API stores UTC ISO strings.
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

const STATUS_STYLE = {
  Active: "bg-emerald-50 text-emerald-800", Scheduled: "bg-sky-50 text-sky-800", Expired: "bg-red-50 text-red-700",
  "Used up": "bg-amber-50 text-amber-800", Off: "bg-stone-100 text-stone-500",
};

// A sensible starting point the admin can edit; the rules themselves are shown to customers automatically.
const standardTerms = (store) => [
  "Discount applies to the product value only; shipping charges are not discounted.",
  "Not valid on gift cards or previous orders.",
  "If an order is returned or cancelled, the coupon value is not refunded or reissued.",
  `${store || "Aurevia"} may change or withdraw this offer at any time without notice.`,
].join("\n");

function Label({ children, hint }) {
  return <span className="block text-xs font-medium text-stone-600 mb-1.5">{children}{hint && <span className="font-normal text-stone-400"> · {hint}</span>}</span>;
}

function Toggle({ checked, onChange, title, text, testId }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 w-4 h-4 accent-burgundy" data-testid={testId} />
      <span className="text-sm text-stone-700">{title}{text && <span className="block text-xs text-stone-400">{text}</span>}</span>
    </label>
  );
}

export default function Coupons() {
  const { items, saving, save, remove, toggleActive } = useContent("coupons", "Coupon");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState(null);
  const [storeName, setStoreName] = useState("Aurevia");

  useEffect(() => { api.get("/settings").then(r => r.data?.store_name && setStoreName(r.data.store_name)).catch(() => {}); }, []);

  const open = (item) => { setEditing(item || {}); setForm(item ? { ...EMPTY, ...item } : EMPTY); };
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v?.target ? (v.target.type === "checkbox" ? v.target.checked : v.target.value) : v }));
  const num = (v) => Number(v) || 0;

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      ...Object.fromEntries(FIELDS.map(f => [f, form[f]])),
      code: form.code.trim().toUpperCase(),
      discount_value: num(form.discount_value), max_discount: form.discount_type === "percent" ? num(form.max_discount) : 0,
      min_order: num(form.min_order), usage_limit: Math.max(0, Math.floor(num(form.usage_limit))),
      per_customer_limit: Math.max(0, Math.floor(num(form.per_customer_limit))),
    };
    if (await save(editing, payload)) setEditing(null);
  };

  const preview = { ...form, discount_value: num(form.discount_value), max_discount: num(form.max_discount), min_order: num(form.min_order),
    usage_limit: num(form.usage_limit), per_customer_limit: num(form.per_customer_limit) };

  return (
    <div data-testid="coupons-page">
      <PageHeader
        title="Coupons"
        subtitle="Create discount codes and their rules. Customers apply them in the cart or at checkout; to advertise one, pick it on an offer banner or the popup."
        actions={<Button onClick={() => open(null)} data-testid="add-coupon-btn"><Plus className="w-4 h-4" /> New coupon</Button>}
      />

      <PlacementGuide items={[
        { img: "guide-coupon-cart.jpg", title: "Cart & checkout", text: "Codes with \"Suggest at checkout\" on are listed under the coupon box, each with a T&C link. Free-delivery codes show the delivery charge crossed out." },
        { img: "guide-banner.jpg", title: "Offer banners & popup", text: "Pick a coupon on an offer (Offers & banners page) to show its code with a copy button." },
      ]} />

      <Card>
        {items === null ? (
          <p className="py-16 text-center text-sm text-stone-500">Loading coupons...</p>
        ) : items.length === 0 ? (
          <EmptyState icon={TicketPercent} title="No coupons yet" text="Create a code like WELCOME10 (first order) or DIWALI200 (flat ₹200 off)."
            action={<Button onClick={() => open(null)}><Plus className="w-4 h-4" /> New coupon</Button>} />
        ) : (
          <ul className="divide-y divide-stone-100">
            {items.map(c => {
              const status = couponStatus(c);
              return (
                <li key={c.id} data-testid={`coupon-row-${c.code}`} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => { navigator.clipboard?.writeText(c.code); toast.success(`${c.code} copied`); }} title="Copy code"
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-dashed border-burgundy/50 text-burgundy text-xs font-bold tracking-wider rounded hover:bg-burgundy/5">
                        {c.code} <Copy className="w-3 h-3" />
                      </button>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLE[status]}`}>{status}</span>
                      {!c.show_in_cart && <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[11px] font-medium">Private</span>}
                      {c.description && <span className="text-sm text-stone-700">{c.description}</span>}
                    </div>
                    <p className="text-sm text-stone-500 mt-1">{couponSummary(c)}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-sm text-stone-600 tabular-nums" title="Orders that used this code (cancelled orders don't count)">
                      {c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ""} used
                    </span>
                    <Button variant="ghost" onClick={() => toggleActive(c, FIELDS)}>{c.active ? "Turn off" : "Turn on"}</Button>
                    <Button variant="secondary" onClick={() => open(c)} data-testid={`coupon-edit-${c.code}`}>Edit</Button>
                    <Button variant="ghost" className="text-red-700" onClick={() => setDeleting(c)}>Delete</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Drawer open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${editing.code}` : "New coupon"}
        footer={<div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button type="submit" form="coupon-form" loading={saving} disabled={!form.code.trim()} data-testid="coupon-save">{editing?.id ? "Save coupon" : "Create coupon"}</Button>
        </div>}>
        <form id="coupon-form" onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block"><Label hint="what customers type">Code</Label>
              <Input value={form.code} onChange={set("code")} required maxLength={30} pattern="[A-Za-z0-9_\-]{3,30}" title="3–30 letters, numbers, - or _"
                placeholder="DIWALI200" className="rounded-md uppercase" data-testid="coupon-code" /></label>
            <label className="block"><Label hint="shown next to the code">Short description</Label>
              <Input value={form.description} onChange={set("description")} maxLength={120} placeholder="Flat ₹200 off this Diwali" className="rounded-md" data-testid="coupon-description" /></label>
          </div>

          <Card className="p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Discount</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="block"><Label>Type</Label>
                <Select value={form.discount_type} onChange={set("discount_type")} className="w-full"
                  options={[{ value: "percent", label: "Percentage (%)" }, { value: "flat", label: "Flat amount (₹)" }, { value: "free_shipping", label: "Free delivery" }]} /></label>
              {form.discount_type === "free_shipping" ? (
                <p className="sm:col-span-2 self-end text-xs text-stone-500 bg-stone-50 rounded px-3 py-2.5">The delivery charge becomes <strong>₹0</strong> on orders using this code. Product prices stay the same.</p>
              ) : (
                <label className="block"><Label>{form.discount_type === "percent" ? "Percent off" : "Amount off (₹)"}</Label>
                  <Input type="number" min="1" max={form.discount_type === "percent" ? 90 : undefined} step="1" value={form.discount_value} onChange={set("discount_value")} required className="rounded-md" data-testid="coupon-value" /></label>
              )}
              {form.discount_type === "percent" && (
                <label className="block"><Label hint="0 = no cap">Max discount (₹)</Label>
                  <Input type="number" min="0" step="1" value={form.max_discount} onChange={set("max_discount")} className="rounded-md" data-testid="coupon-max" /></label>
              )}
            </div>
          </Card>

          <Card className="p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Who can use it</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="block"><Label hint="0 = none">Minimum order (₹)</Label>
                <Input type="number" min="0" step="1" value={form.min_order} onChange={set("min_order")} className="rounded-md" data-testid="coupon-min" /></label>
              <label className="block"><Label hint="0 = unlimited">Uses per customer</Label>
                <Input type="number" min="0" step="1" value={form.per_customer_limit} onChange={set("per_customer_limit")} className="rounded-md" data-testid="coupon-per-customer" /></label>
              <label className="block"><Label hint="0 = unlimited">Total uses</Label>
                <Input type="number" min="0" step="1" value={form.usage_limit} onChange={set("usage_limit")} className="rounded-md" data-testid="coupon-usage-limit" /></label>
            </div>
            <Toggle checked={form.first_order_only} onChange={set("first_order_only")} title="First order only" text="Only customers who haven't ordered before (checked by email)." testId="coupon-first-order" />
          </Card>

          <Card className="p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">When</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block"><Label hint="empty = right away">Starts</Label>
                <Input type="datetime-local" value={toLocalInput(form.starts_at)} onChange={e => setForm(f => ({ ...f, starts_at: fromLocalInput(e.target.value) }))} className="rounded-md" /></label>
              <label className="block"><Label hint="empty = no end">Ends</Label>
                <Input type="datetime-local" value={toLocalInput(form.ends_at)} onChange={e => setForm(f => ({ ...f, ends_at: fromLocalInput(e.target.value) }))} className="rounded-md" data-testid="coupon-ends" /></label>
            </div>
          </Card>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label hint="one point per line">Terms &amp; conditions</Label>
              <Button type="button" variant="ghost" onClick={() => setForm(f => ({ ...f, terms: f.terms.trim() ? `${f.terms.trim()}\n${standardTerms(storeName)}` : standardTerms(storeName) }))}>
                <Wand2 className="w-4 h-4" /> Add standard T&amp;C
              </Button>
            </div>
            <textarea value={form.terms} onChange={set("terms")} rows={5} maxLength={2000} data-testid="coupon-terms"
              placeholder={"e.g. Valid on prepaid orders only.\nNot valid on Gift Boxes."}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-gold" />
            <div className="text-xs text-stone-500 bg-stone-50 rounded px-3 py-2">
              <p className="font-medium text-stone-700 mb-1">Customers will see under "T&amp;C apply":</p>
              <ul className="list-disc pl-4 space-y-0.5">{couponSummary(preview, { asTerms: true }).map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          </div>

          <div className="space-y-2">
            <Toggle checked={form.show_in_cart} onChange={set("show_in_cart")} title="Suggest at checkout"
              text="Listed under the coupon box in the cart and checkout. Turn off for private codes you share yourself (influencers, WhatsApp, customer apologies)." testId="coupon-show-in-cart" />
            <Toggle checked={form.active} onChange={set("active")} title="Active" text="Turned-off coupons stop working immediately; banners showing them hide the code." />
          </div>
          <p className="text-xs text-stone-500 bg-stone-50 rounded px-3 py-2">Summary: <strong>{couponSummary(preview)}</strong></p>
        </form>
      </Drawer>

      <ConfirmDialog open={Boolean(deleting)} title="Delete coupon?"
        message={<>The code <strong>{deleting?.code}</strong> will stop working and banners showing it will hide the code. Past orders keep their discount. To pause it instead, use <strong>Turn off</strong>.</>}
        confirmLabel="Delete" onCancel={() => setDeleting(null)} onConfirm={async () => { await remove(deleting); setDeleting(null); }} />
    </div>
  );
}
