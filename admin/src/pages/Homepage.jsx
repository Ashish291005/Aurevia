import { useState } from "react";
import { Plus, Images, ArrowRight } from "lucide-react";
import { useContent } from "../lib/useContent";
import { STORE_URL } from "../lib/api";
import { Card, PageHeader, EmptyState, Button, ConfirmDialog, Drawer } from "../components/ui";
import { Input } from "../components/Input";
import ImageField from "../components/ImageField";
import LinkField from "../components/LinkField";
import RowActions from "../components/ContentRow";

const FIELDS = ["image", "title", "subtitle", "cta_text", "cta_link"];
const EMPTY = { image: "", title: "", subtitle: "", cta_text: "Shop Now", cta_link: "/shop", active: true };

function Label({ children, hint }) {
  return <span className="block text-xs font-medium text-stone-600 mb-1.5">{children}{hint && <span className="font-normal text-stone-400"> · {hint}</span>}</span>;
}

function SlidePreview({ slide }) {
  return (
    <div className="relative aspect-[16/7] rounded-md overflow-hidden bg-stone-800">
      {slide.image && <img src={slide.image} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
      <div className="relative h-full flex flex-col justify-center p-5 max-w-[70%] text-white">
        <p className="font-heading text-xl sm:text-2xl leading-tight">{slide.title || "Slide title"}</p>
        {slide.subtitle && <p className="text-[11px] text-white/80 mt-1 line-clamp-2">{slide.subtitle}</p>}
        {slide.cta_link && <span className="mt-3 self-start inline-flex items-center gap-1 bg-white text-burgundy px-3 py-1.5 text-[10px] uppercase tracking-widest font-semibold">{slide.cta_text || "Shop Now"} <ArrowRight className="w-3 h-3" /></span>}
      </div>
    </div>
  );
}

export default function Homepage() {
  const { items, saving, save, remove, move, toggleActive } = useContent("slides", "Slide");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState(null);

  const open = (item) => { setEditing(item || {}); setForm(item ? { ...EMPTY, ...item } : EMPTY); };
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v?.target ? (v.target.type === "checkbox" ? v.target.checked : v.target.value) : v }));
  const submit = async (e) => {
    e.preventDefault();
    if (!form.image) return;
    const ok = await save(editing, { ...Object.fromEntries(FIELDS.map(f => [f, form[f]])), active: form.active });
    if (ok) setEditing(null);
  };

  const activeCount = (items || []).filter(s => s.active).length;

  return (
    <div data-testid="homepage-page">
      <PageHeader
        title="Homepage carousel"
        subtitle={items ? `${activeCount} of ${items.length} slides showing · rotates every 5 seconds` : "The rotating banner at the top of the storefront"}
        actions={<>
          <a href={STORE_URL} target="_blank" rel="noreferrer"><Button variant="secondary">Preview store</Button></a>
          <Button onClick={() => open(null)} data-testid="add-slide-btn"><Plus className="w-4 h-4" /> Add slide</Button>
        </>}
      />

      <Card>
        {items === null ? (
          <p className="py-16 text-center text-sm text-stone-500">Loading slides...</p>
        ) : items.length === 0 ? (
          <EmptyState icon={Images} title="No slides yet" text="Add a slide to show a carousel at the top of the homepage."
            action={<Button onClick={() => open(null)}><Plus className="w-4 h-4" /> Add slide</Button>} />
        ) : (
          <ul className="divide-y divide-stone-100">
            {items.map((s, i) => (
              <li key={s.id} data-testid={`slide-row-${i}`} className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 ${s.active ? "" : "bg-stone-50"}`}>
                <span className="hidden sm:block w-6 text-center text-xs text-stone-400 tabular-nums">{i + 1}</span>
                <img src={s.image} alt="" className={`w-full sm:w-48 aspect-[16/7] object-cover rounded-md bg-stone-100 ${s.active ? "" : "opacity-50"}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-900 truncate">{s.title || <span className="text-stone-400">Untitled slide</span>}</p>
                  <p className="text-sm text-stone-500 truncate">{s.subtitle}</p>
                  <p className="text-xs text-stone-400 mt-1 truncate">{s.cta_link ? <>Button "{s.cta_text || "Shop Now"}" → {s.cta_link}</> : "No button"}{!s.active && " · Hidden"}</p>
                </div>
                <RowActions index={i} total={items.length} item={s} onMove={move} onEdit={open} onDelete={setDeleting}
                  onToggle={(item) => toggleActive(item, FIELDS)} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Drawer open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? "Edit slide" : "Add slide"}
        footer={<div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button type="submit" form="slide-form" loading={saving} disabled={!form.image} data-testid="slide-save">{editing?.id ? "Save slide" : "Add slide"}</Button>
        </div>}>
        <form id="slide-form" onSubmit={submit} className="space-y-5">
          <div>
            <Label hint="wide photo, at least 1600px across">Image</Label>
            <ImageField value={form.image} onChange={set("image")} aspect="aspect-[16/7]" testId="slide-image" />
          </div>
          <label className="block"><Label hint={`${form.title.length}/80`}>Headline</Label>
            <Input value={form.title} onChange={set("title")} maxLength={80} placeholder="e.g. The Festive Edit" className="rounded-md" data-testid="slide-title" /></label>
          <label className="block"><Label hint={`${form.subtitle.length}/160`}>Subtext</Label>
            <Input value={form.subtitle} onChange={set("subtitle")} maxLength={160} placeholder="e.g. Kundan & AD sets for weddings" className="rounded-md" /></label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block"><Label>Button text</Label>
              <Input value={form.cta_text} onChange={set("cta_text")} maxLength={30} className="rounded-md" /></label>
            <div className="sm:col-span-2"><Label hint="leave empty for no button">Button link</Label>
              <LinkField value={form.cta_link} onChange={set("cta_link")} /></div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={set("active")} className="w-4 h-4 accent-burgundy" />
            <span className="text-sm text-stone-700">Show this slide on the homepage</span>
          </label>
          <div>
            <Label>Preview</Label>
            <SlidePreview slide={form} />
          </div>
        </form>
      </Drawer>

      <ConfirmDialog open={Boolean(deleting)} title="Delete slide?" message="This slide will be removed from the homepage carousel. You can hide it instead to keep it for later."
        confirmLabel="Delete" onCancel={() => setDeleting(null)} onConfirm={async () => { await remove(deleting); setDeleting(null); }} />
    </div>
  );
}
