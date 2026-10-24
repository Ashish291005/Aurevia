import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "./ui/input";
import { INDIAN_STATES } from "../lib/format";

export const EMPTY_ADDRESS = { label: "Home", first_name: "", last_name: "", phone: "", address: "", city: "", state: "", zip: "", is_default: false };
const LABELS = ["Home", "Work", "Other"];

// One line for lists and pickers: "1 MG Road, Pune, Maharashtra 411001".
export const addressLine = (a) => [a.address, a.city, [a.state, a.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");

function Field({ label, id, className = "", children }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-xs tracking-[0.15em] uppercase font-body font-semibold text-stone-700 mb-2 block">{label}</label>
      {children}
    </div>
  );
}

// Add/edit form for the address book; same rules as checkout (10-digit mobile, 6-digit PIN).
export default function AddressForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState({ ...EMPTY_ADDRESS, ...initial });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const custom = !LABELS.slice(0, 2).includes(form.label);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="bg-white border border-stone-200 p-6 sm:p-8 space-y-5" data-testid="address-form">
      <div>
        <span className="text-xs tracking-[0.15em] uppercase font-body font-semibold text-stone-700 mb-2 block">Save as</span>
        <div className="flex flex-wrap gap-2">
          {LABELS.map(l => {
            const active = l === "Other" ? custom : form.label === l;
            return (
              <button key={l} type="button" onClick={() => setForm(f => ({ ...f, label: l === "Other" ? "" : l }))}
                className={`px-4 py-1.5 text-xs font-body font-semibold uppercase tracking-wider border ${active ? "border-burgundy bg-burgundy text-white" : "border-stone-300 text-stone-600 hover:border-gold"}`}>{l}</button>
            );
          })}
          {custom && <Input value={form.label} onChange={set("label")} maxLength={30} placeholder="e.g. Mom's place" className="h-9 w-48" aria-label="Address name" />}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="First name" id="ad-first"><Input id="ad-first" autoComplete="given-name" value={form.first_name} onChange={set("first_name")} required maxLength={60} /></Field>
        <Field label="Last name" id="ad-last"><Input id="ad-last" autoComplete="family-name" value={form.last_name} onChange={set("last_name")} required maxLength={60} /></Field>
        <Field label="Mobile number" id="ad-phone" className="sm:col-span-2">
          <Input id="ad-phone" type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} required maxLength={16}
            pattern="^(\+91[\s\-]?)?[6-9][0-9]{4}[\s\-]?[0-9]{5}$" title="Enter a 10-digit Indian mobile number" placeholder="98765 43210" />
        </Field>
        <Field label="Address (house no., street, area)" id="ad-address" className="sm:col-span-2">
          <Input id="ad-address" autoComplete="street-address" value={form.address} onChange={set("address")} required maxLength={200} />
        </Field>
        <Field label="City" id="ad-city"><Input id="ad-city" autoComplete="address-level2" value={form.city} onChange={set("city")} required maxLength={80} /></Field>
        <Field label="State" id="ad-state">
          <select id="ad-state" autoComplete="address-level1" value={form.state} onChange={set("state")} required
            className="flex h-11 w-full border border-stone-300 bg-white px-3 text-sm font-body outline-none focus:border-gold">
            <option value="">Select state</option>
            {INDIAN_STATES.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        </Field>
        <Field label="PIN code" id="ad-zip">
          <Input id="ad-zip" autoComplete="postal-code" inputMode="numeric" value={form.zip} onChange={set("zip")} required pattern="^[1-9][0-9]{5}$" title="Enter a 6-digit PIN code" maxLength={6} />
        </Field>
      </div>
      <label className="flex items-center gap-3 text-sm font-body text-stone-600 cursor-pointer">
        <input type="checkbox" checked={form.is_default} onChange={set("is_default")} className="w-4 h-4 accent-burgundy" />
        Use as my default address
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={saving} data-testid="address-save"
          className="flex items-center gap-2 bg-burgundy text-white px-8 py-3 text-xs tracking-[0.2em] uppercase font-body font-semibold hover:bg-burgundy-dark disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save address
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="px-6 py-3 text-xs tracking-[0.2em] uppercase font-body font-semibold text-stone-500 hover:text-burgundy">Cancel</button>}
      </div>
    </form>
  );
}
