import { useState } from "react";
import { Plus, LayoutGrid } from "lucide-react";
import { useContent } from "../lib/useContent";
import { navigate } from "../lib/router";
import { Card, PageHeader, EmptyState, Button, ConfirmDialog, Drawer } from "../components/ui";
import { Input } from "../components/Input";
import ImageField from "../components/ImageField";
import RowActions from "../components/ContentRow";
import PlacementGuide from "../components/PlacementGuide";

const FIELDS = ["name", "image"];
const EMPTY = { name: "", image: "", active: true };

export default function Categories() {
  const { items, saving, save, remove, move, toggleActive } = useContent("categories", "Category");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState(null);

  const open = (item) => { setEditing(item || {}); setForm(item ? { ...EMPTY, ...item } : EMPTY); };
  const submit = async (e) => {
    e.preventDefault();
    const ok = await save(editing, { name: form.name, image: form.image, active: form.active });
    if (ok) setEditing(null);
  };
  const renaming = editing?.id && form.name.trim() && form.name.trim() !== editing.name;

  return (
    <div data-testid="categories-page">
      <PageHeader
        title="Categories"
        subtitle="The square category tiles on the homepage, the shop filters and the footer. Use the arrows to set their order."
        actions={<Button onClick={() => open(null)} data-testid="add-category-btn"><Plus className="w-4 h-4" />

      <PlacementGuide items={[{ img: "guide-categories.jpg", title: "Category circles", text: "The round tiles under \"What are you looking for?\" on the homepage, in the order listed below. Clicking one opens the shop filtered to that category." }]} /> Add category</Button>}
      />

      <Card>
        {items === null ? (
          <p className="py-16 text-center text-sm text-stone-500">Loading categories...</p>
        ) : items.length === 0 ? (
          <EmptyState icon={LayoutGrid} title="No categories yet" text="Create categories like Rings or Gift Boxes, then assign products to them."
            action={<Button onClick={() => open(null)}><Plus className="w-4 h-4" /> Add category</Button>} />
        ) : (
          <ul className="divide-y divide-stone-100">
            {items.map((c, i) => (
              <li key={c.id} data-testid={`category-row-${c.name}`} className={`flex items-center gap-4 p-4 ${c.active ? "" : "bg-stone-50"}`}>
                <span className="hidden sm:block w-6 text-center text-xs text-stone-400 tabular-nums">{i + 1}</span>
                <img src={c.image} alt="" className={`w-14 h-14 rounded-xl object-cover bg-stone-100 ${c.active ? "" : "opacity-50"}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-900">{c.name}{!c.active && <span className="ml-2 text-xs font-normal text-stone-400">Hidden</span>}</p>
                  <button onClick={() => navigate("products")} className="text-xs text-stone-500 hover:text-burgundy">{c.product_count} {c.product_count === 1 ? "product" : "products"}</button>
                </div>
                <RowActions index={i} total={items.length} item={c} onMove={move} onEdit={open} onDelete={setDeleting}
                  onToggle={(item) => toggleActive(item, FIELDS)}
                  deleteDisabledReason={c.product_count ? `Move its ${c.product_count} product(s) to another category first` : ""} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="text-xs text-stone-400 mt-3">Hidden categories disappear from the homepage tiles and filters, but their products stay for sale.</p>

      <Drawer open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${editing.name}` : "Add category"} width="max-w-lg"
        footer={<div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button type="submit" form="category-form" loading={saving} disabled={!form.name.trim() || !form.image} data-testid="category-save">{editing?.id ? "Save" : "Add category"}</Button>
        </div>}>
        <form id="category-form" onSubmit={submit} className="space-y-5">
          <label className="block">
            <span className="block text-xs font-medium text-stone-600 mb-1.5">Name</span>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={40} required placeholder="e.g. Anklets" className="rounded-md" data-testid="category-name" />
            {renaming && editing.product_count > 0 && <span className="block text-xs text-amber-700 mt-1">Its {editing.product_count} product(s) will move to the new name automatically.</span>}
          </label>
          <div>
            <span className="block text-xs font-medium text-stone-600 mb-1.5">Tile image <span className="font-normal text-stone-400">· square works best</span></span>
            <div className="max-w-[220px]"><ImageField value={form.image} onChange={(v) => setForm(f => ({ ...f, image: v }))} aspect="aspect-square" testId="category-image" /></div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 accent-burgundy" />
            <span className="text-sm text-stone-700">Show on the storefront</span>
          </label>
        </form>
      </Drawer>

      <ConfirmDialog open={Boolean(deleting)} title={`Delete ${deleting?.name}?`} message="The category tile and filter will be removed from the storefront."
        confirmLabel="Delete" onCancel={() => setDeleting(null)} onConfirm={async () => { await remove(deleting); setDeleting(null); }} />
    </div>
  );
}
