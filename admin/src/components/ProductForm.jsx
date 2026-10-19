import { useEffect, useRef, useState } from "react";
import { X, Upload, Link2, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "../lib/api";
import { Input } from "./Input";
import { RECIPIENTS } from "../lib/format";

const EMPTY = {
  name: "", category: "", price: "", compare_at_price: "", stock: "10", description: "",
  images: [], materials: [], sizes: [], bestseller: false, active: true, recipients: ["her"],
};

const toForm = (p) => ({
  ...EMPTY, ...p,
  price: String(p.price ?? ""),
  compare_at_price: p.compare_at_price ? String(p.compare_at_price) : "",
  stock: String(p.stock ?? 0),
  active: p.active !== false,
  recipients: p.recipients?.length ? p.recipients : ["her"],
});

function TagInput({ id, values, onChange, placeholder, testId }) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const parts = draft.split(",").map(s => s.trim()).filter(Boolean);
    if (parts.length) onChange([...values, ...parts.filter(p => !values.includes(p))]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-2 border border-stone-300 bg-white px-2 py-2 min-h-11 focus-within:border-gold">
      {values.map(v => (
        <span key={v} className="inline-flex items-center gap-1 bg-stone-100 px-2 py-1 text-xs font-body text-stone-700">
          {v}
          <button type="button" onClick={() => onChange(values.filter(x => x !== v))} aria-label={`Remove ${v}`} className="text-stone-400 hover:text-red-600">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        data-testid={testId}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); }
          else if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={commit}
        placeholder={values.length ? "" : placeholder}
        className="flex-1 min-w-[8rem] bg-transparent text-sm font-body outline-none placeholder:text-stone-400"
      />
    </div>
  );
}

function Field({ label, htmlFor, hint, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-xs tracking-[0.15em] uppercase font-body font-semibold text-stone-700 mb-2 block">{label}</label>
      {children}
      {hint && <p className="text-xs text-stone-400 font-body mt-1">{hint}</p>}
    </div>
  );
}

// `product` = edit an existing product; `initial` = prefill a new one (e.g. duplicate).
export default function ProductForm({ product, initial, categories, onClose, onSaved }) {
  const isEdit = Boolean(product);
  const [form, setForm] = useState(() => (product ? toForm(product) : initial ? toForm(initial) : EMPTY));
  const [imageLink, setImageLink] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !saving && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose, saving]);

  const set = (key) => (value) => setForm(f => ({ ...f, [key]: value }));
  const setFromEvent = (key) => (e) => set(key)(e.target.value);

  const handleFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        const { data } = await api.post("/admin/upload", body);
        setForm(f => ({ ...f, images: [...f.images, data.url] }));
      }
    } catch (err) {
      toast.error(apiError(err, "Upload failed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addImageLink = () => {
    const url = imageLink.trim();
    if (!/^https?:\/\//i.test(url)) { toast.error("Enter a full image URL starting with http(s)://"); return; }
    if (!form.images.includes(url)) set("images")([...form.images, url]);
    setImageLink("");
  };

  const makeMain = (img) => set("images")([img, ...form.images.filter(i => i !== img)]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.images.length) { toast.error("Add at least one image"); return; }
    if (!form.recipients.length) { toast.error("Choose at least one 'Shop for' group"); return; }
    if (form.compare_at_price && Number(form.compare_at_price) <= Number(form.price)) {
      toast.error("The 'compare at' price must be higher than the price (or leave it empty)");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name, category: form.category, description: form.description,
      price: Number(form.price), stock: Number(form.stock || 0),
      compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
      images: form.images, materials: form.materials, sizes: form.sizes, bestseller: form.bestseller, active: form.active,
      recipients: form.recipients,
    };
    try {
      const { data } = isEdit
        ? await api.put(`/admin/products/${product.id}`, payload)
        : await api.post("/admin/products", payload);
      toast.success(isEdit ? "Product updated" : "Product added");
      onSaved(data);
    } catch (err) {
      toast.error(apiError(err, "Could not save product"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-black/50" onClick={() => !saving && onClose()} />
      <form
        onSubmit={handleSubmit}
        data-testid="product-form"
        className="relative bg-cream w-full sm:max-w-3xl max-h-screen sm:max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-cream border-b border-stone-200 px-6 py-4">
          <h2 className="font-heading text-2xl text-burgundy">{isEdit ? "Edit Product" : "Add New Product"}</h2>
          <button type="button" onClick={onClose} disabled={saving} className="text-stone-500 hover:text-burgundy" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <Field label="Product name" htmlFor="pf-name">
              <Input id="pf-name" data-testid="pf-name" required maxLength={120} value={form.name} onChange={setFromEvent("name")} placeholder="e.g. Emerald Halo Ring" />
            </Field>
          </div>
          <Field label="Category" htmlFor="pf-category" hint="Add or rename categories in the Categories section">
            <select id="pf-category" data-testid="pf-category" required value={form.category} onChange={setFromEvent("category")}
              className="flex h-11 w-full border border-stone-300 bg-white px-3 text-sm outline-none focus:border-gold">
              <option value="">Select a category</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
              {form.category && !categories.includes(form.category) && <option value={form.category}>{form.category} (missing)</option>}
            </select>
          </Field>
          <Field label="Stock" htmlFor="pf-stock" hint="0 = sold out (still visible, can't be bought)">
            <Input id="pf-stock" data-testid="pf-stock" type="number" required min="0" step="1" value={form.stock} onChange={setFromEvent("stock")} />
          </Field>
          <Field label="Selling price (₹)" htmlFor="pf-price">
            <Input id="pf-price" data-testid="pf-price" type="number" required min="0.01" step="0.01" value={form.price} onChange={setFromEvent("price")} placeholder="799" />
          </Field>
          <Field label="MRP / compare-at price (₹)" htmlFor="pf-compare" hint="Optional. Set higher than the selling price to show a discount">
            <Input id="pf-compare" data-testid="pf-compare" type="number" min="0" step="0.01" value={form.compare_at_price} onChange={setFromEvent("compare_at_price")} placeholder="e.g. 1199" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Description" htmlFor="pf-description">
              <textarea
                id="pf-description" data-testid="pf-description" rows={3} maxLength={2000}
                value={form.description} onChange={setFromEvent("description")}
                placeholder="Describe the design, stones, plating and who it makes a great gift for..."
                className="w-full border border-stone-300 bg-white px-3 py-2 text-sm font-body outline-none focus:border-gold resize-y"
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field label="Images" hint="The first image is the main photo. JPG, PNG, WEBP or GIF up to 4 MB.">
              <div className="flex flex-wrap gap-3 mb-3">
                {form.images.map((img, i) => (
                  <div key={img} className={`relative w-24 h-28 border-2 ${i === 0 ? "border-gold" : "border-stone-200"} bg-stone-100 group`}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    {i === 0 && <span className="absolute bottom-0 inset-x-0 bg-gold text-white text-[10px] text-center uppercase tracking-wider py-0.5">Main</span>}
                    <div className="absolute top-1 right-1 flex gap-1">
                      {i !== 0 && (
                        <button type="button" onClick={() => makeMain(img)} title="Make main image" className="bg-white/90 p-1 text-stone-600 hover:text-gold">
                          <Star className="w-3 h-3" />
                        </button>
                      )}
                      <button type="button" onClick={() => set("images")(form.images.filter(x => x !== img))} title="Remove image" className="bg-white/90 p-1 text-stone-600 hover:text-red-600">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  data-testid="pf-upload-btn"
                  className="w-24 h-28 border-2 border-dashed border-stone-300 flex flex-col items-center justify-center gap-1 text-stone-500 hover:border-gold hover:text-gold text-xs font-body disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  {uploading ? "Uploading" : "Upload"}
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden data-testid="pf-file-input" onChange={e => handleFiles([...e.target.files])} />
              </div>
              <div className="flex gap-2">
                <Input
                  value={imageLink} onChange={e => setImageLink(e.target.value)} placeholder="...or paste an image URL"
                  data-testid="pf-image-url"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addImageLink(); } }}
                />
                <button type="button" onClick={addImageLink} className="shrink-0 flex items-center gap-2 border border-stone-300 bg-white px-4 text-xs uppercase tracking-wider font-body text-stone-700 hover:border-gold hover:text-gold">
                  <Link2 className="w-4 h-4" /> Add
                </button>
              </div>
            </Field>
          </div>

          <Field label="Sizes" htmlFor="pf-sizes" hint="Press Enter or comma after each. Empty = One Size">
            <TagInput id="pf-sizes" testId="pf-sizes" values={form.sizes} onChange={set("sizes")} placeholder="Adjustable, 2.4, 2.6 or 16 inch" />
          </Field>
          <Field label="Materials" htmlFor="pf-materials" hint="Press Enter or comma after each">
            <TagInput id="pf-materials" testId="pf-materials" values={form.materials} onChange={set("materials")} placeholder="Gold-plated, Rose gold-plated" />
          </Field>

          <div className="md:col-span-2">
            <span className="text-xs tracking-[0.15em] uppercase font-body font-semibold text-stone-700 mb-2 block">Shop for</span>
            <div className="flex flex-wrap gap-2" data-testid="pf-recipients">
              {RECIPIENTS.map(r => {
                const on = form.recipients.includes(r.value);
                return (
                  <button key={r.value} type="button" aria-pressed={on}
                    onClick={() => set("recipients")(on ? form.recipients.filter(x => x !== r.value) : [...form.recipients, r.value])}
                    className={`px-4 h-10 border text-sm transition-colors ${on ? "bg-burgundy border-burgundy text-white" : "bg-white border-stone-300 text-stone-700 hover:border-burgundy"}`}>
                    {r.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-stone-400 font-body mt-1">Controls the "Who are you shopping for?" tiles and the Shop For filter on the storefront</p>
          </div>

          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-start gap-3 cursor-pointer select-none border border-stone-200 bg-white p-3">
              <input type="checkbox" data-testid="pf-active" checked={form.active} onChange={e => set("active")(e.target.checked)} className="mt-0.5 w-4 h-4 accent-burgundy" />
              <span className="text-sm font-body text-stone-700"><strong>Visible in store</strong><span className="block text-xs text-stone-500">Untick to hide it without deleting (drafts, seasonal pieces)</span></span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer select-none border border-stone-200 bg-white p-3">
              <input type="checkbox" data-testid="pf-bestseller" checked={form.bestseller} onChange={e => set("bestseller")(e.target.checked)} className="mt-0.5 w-4 h-4 accent-burgundy" />
              <span className="text-sm font-body text-stone-700"><strong>Bestseller</strong><span className="block text-xs text-stone-500">Featured on the home page with a badge</span></span>
            </label>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 bg-cream border-t border-stone-200 px-6 py-4">
          <button type="button" onClick={onClose} disabled={saving} className="px-6 py-3 text-xs tracking-[0.2em] uppercase font-body font-semibold text-stone-600 hover:text-burgundy">
            Cancel
          </button>
          <button type="submit" data-testid="pf-submit" disabled={saving || uploading}
            className="flex items-center gap-2 bg-burgundy text-white px-8 py-3 text-xs tracking-[0.2em] uppercase font-body font-semibold hover:bg-burgundy-dark transition-colors disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Add Product"}
          </button>
        </div>
      </form>
    </div>
  );
}
