import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Input } from "./Input";

// Button link input with one-click suggestions for common storefront pages.
export default function LinkField({ value, onChange, testId }) {
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    api.get("/admin/categories").then(r => setCategories(r.data.map(c => c.name))).catch(() => {});
  }, []);

  const options = [
    { label: "Shop all", to: "/shop" },
    ...categories.map(c => ({ label: c, to: `/shop?category=${encodeURIComponent(c)}` })),
    { label: "For her", to: "/shop?for=her" },
    { label: "For him", to: "/shop?for=him" },
    { label: "For couples", to: "/shop?for=couples" },
    { label: "On sale", to: "/shop?sale=1" },
    { label: "Under ₹1,000", to: "/shop?price=1" },
  ];

  return (
    <div className="space-y-2">
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder="/shop?category=Rings" className="rounded-md" data-testid={testId} />
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <button key={o.to} type="button" onClick={() => onChange(o.to)}
            className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${value === o.to ? "bg-burgundy border-burgundy text-white" : "bg-white border-stone-300 text-stone-600 hover:border-burgundy"}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
