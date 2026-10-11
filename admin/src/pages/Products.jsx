import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ExternalLink, Star, Copy, Eye, EyeOff, Package, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api, apiError, STORE_URL } from "../lib/api";
import { navigate } from "../lib/router";
import { useAdminData } from "../AdminData";
import { money, RECIPIENTS } from "../lib/format";
import { Card, PageHeader, EmptyState, SearchInput, Button, ConfirmDialog, Select } from "../components/ui";
import ProductForm from "../components/ProductForm";


function StockBadge({ stock }) {
  if (stock === 0) return <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-red-50 text-red-700 ring-1 ring-inset ring-red-200">Sold out</span>;
  if (stock <= 5) return <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200">{stock} left</span>;
  return <span className="text-sm tabular-nums text-stone-600">{stock}</span>;
}

const editable = ({ id, created_at, updated_at, ...rest }) => rest;

export default function Products({ param }) {
  const [products, setProducts] = useState(null);
  const [managedCategories, setManagedCategories] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [visibility, setVisibility] = useState("all");
  const [duplicate, setDuplicate] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const { reloadStats } = useAdminData();

  const load = useCallback(async () => {
    try {
      const [{ data }, cats] = await Promise.all([api.get("/admin/products"), api.get("/admin/categories")]);
      setProducts(data);
      setManagedCategories(cats.data.map(c => c.name));
    } catch (err) {
      toast.error(apiError(err, "Could not load products"));
      setProducts([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Managed categories (Categories section), plus any legacy names still used by products.
  const categories = useMemo(() => {
    const extra = [...new Set((products || []).map(p => p.category))].filter(c => !managedCategories.includes(c));
    return [...managedCategories, ...extra];
  }, [products, managedCategories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products || []).filter(p =>
      (category === "all" || p.category === category) &&
      (stockFilter === "all" || (stockFilter === "low" ? p.stock > 0 && p.stock <= 5 : p.stock === 0)) &&
      (visibility === "all" || (visibility === "hidden" ? p.active === false : p.active !== false)) &&
      (!q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
    );
  }, [products, query, category, stockFilter, visibility]);

  // Route: #/products/new opens a blank form, #/products/<id> opens that product.
  const editing = param === "new" ? null : products?.find(p => p.id === param);
  const formOpen = param === "new" || Boolean(editing) || Boolean(duplicate);

  const closeForm = () => { setDuplicate(null); if (param) navigate("products"); };
  const afterSave = () => { closeForm(); load(); reloadStats(); };

  const quickUpdate = async (p, changes, message) => {
    try {
      const { data } = await api.put(`/admin/products/${p.id}`, { ...editable(p), ...changes });
      setProducts(list => list.map(x => (x.id === data.id ? data : x)));
      toast.success(message);
      reloadStats();
    } catch (err) {
      toast.error(apiError(err, "Update failed"));
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      const { data } = await api.delete(`/admin/products/${deleting.id}`);
      toast.success(data.message);
      setDeleting(null);
      load();
      reloadStats();
    } catch (err) {
      toast.error(apiError(err, "Delete failed"));
    } finally {
      setBusy(false);
    }
  };

  const filtersActive = query || category !== "all" || stockFilter !== "all" || visibility !== "all";

  return (
    <div data-testid="products-page">
      <PageHeader
        title="Products"
        subtitle={products ? `${products.length} products · ${products.filter(p => p.active === false).length} hidden` : "Manage your catalogue"}
        actions={<>
          <Button variant="secondary" onClick={load} title="Refresh"><RefreshCw className="w-4 h-4" /></Button>
          <Button onClick={() => navigate("products/new")} data-testid="add-product-btn"><Plus className="w-4 h-4" /> Add product</Button>
        </>}
      />

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by name or ID" testId="admin-search" />
        <Select value={category} onChange={setCategory} data-testid="admin-category-filter"
          options={[{ value: "all", label: "All categories" }, ...categories.map(c => ({ value: c, label: c }))]} />
        <Select value={stockFilter} onChange={setStockFilter} data-testid="admin-stock-filter"
          options={[{ value: "all", label: "Any stock" }, { value: "low", label: "Low stock (1–5)" }, { value: "out", label: "Sold out" }]} />
        <Select value={visibility} onChange={setVisibility} data-testid="admin-visibility-filter"
          options={[{ value: "all", label: "Visible & hidden" }, { value: "visible", label: "Visible only" }, { value: "hidden", label: "Hidden only" }]} />
      </div>

      <Card className="overflow-x-auto">
        {products === null ? (
          <p className="py-16 text-center text-sm text-stone-500">Loading products...</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Package} title={filtersActive ? "No products match" : "No products yet"}
            text={filtersActive ? "Try clearing a filter." : "Add your first piece to start selling."}
            action={!filtersActive && <Button onClick={() => navigate("products/new")}><Plus className="w-4 h-4" /> Add product</Button>} />
        ) : (
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium text-right">Price</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium text-center">Visible</th>
                <th className="px-4 py-3 font-medium text-center">Bestseller</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const hidden = p.active === false;
                return (
                  <tr key={p.id} data-testid={`admin-row-${p.id}`} className={`border-b border-stone-100 last:border-0 hover:bg-stone-50 ${hidden ? "bg-stone-50/60" : ""}`}>
                    <td className="px-4 py-2.5">
                      <button onClick={() => navigate(`products/${p.id}`)} className="flex items-center gap-3 text-left group">
                        <img src={p.images[0]} alt="" className={`w-11 h-12 object-cover rounded bg-stone-100 shrink-0 ${hidden ? "opacity-50" : ""}`} />
                        <span className="min-w-0">
                          <span className="block font-medium text-stone-900 group-hover:text-burgundy truncate max-w-[16rem]">{p.name}</span>
                          <span className="block text-xs text-stone-400 truncate">{p.id}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="block text-stone-600">{p.category}</span>
                      <span className="block text-[11px] text-stone-400">{(p.recipients || ["her"]).map(r => RECIPIENTS.find(x => x.value === r)?.label.replace("For ", "")).join(" · ")}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className="text-stone-900">{money(p.price)}</span>
                      {p.compare_at_price && <span className="block text-xs text-stone-400 line-through">{money(p.compare_at_price)}</span>}
                    </td>
                    <td className="px-4 py-2.5"><StockBadge stock={p.stock ?? 0} /></td>
                    <td className="px-4 py-2.5 text-center">
                      <button onClick={() => quickUpdate(p, { active: hidden }, hidden ? `${p.name} is now visible` : `${p.name} hidden from store`)}
                        data-testid={`toggle-visible-${p.id}`} title={hidden ? "Hidden — click to show in store" : "Visible — click to hide"}
                        className={hidden ? "text-stone-400 hover:text-burgundy" : "text-emerald-700 hover:text-stone-500"}>
                        {hidden ? <EyeOff className="w-4 h-4 mx-auto" /> : <Eye className="w-4 h-4 mx-auto" />}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button onClick={() => quickUpdate(p, { bestseller: !p.bestseller }, p.bestseller ? "Removed from bestsellers" : "Marked as bestseller")}
                        data-testid={`toggle-bestseller-${p.id}`} title={p.bestseller ? "Remove from bestsellers" : "Mark as bestseller"}
                        className={p.bestseller ? "text-gold hover:text-gold-hover" : "text-stone-300 hover:text-gold"}>
                        <Star className={`w-4 h-4 mx-auto ${p.bestseller ? "fill-gold" : ""}`} />
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end">
                        {!hidden && <a href={`${STORE_URL}/product/${p.id}`} target="_blank" rel="noreferrer" title="View in store" className="p-2 text-stone-400 hover:text-gold"><ExternalLink className="w-4 h-4" /></a>}
                        <button onClick={() => setDuplicate({ ...editable(p), name: `${p.name} (Copy)`, active: false })} title="Duplicate" className="p-2 text-stone-400 hover:text-burgundy"><Copy className="w-4 h-4" /></button>
                        <button onClick={() => navigate(`products/${p.id}`)} title="Edit" data-testid={`edit-${p.id}`} className="p-2 text-stone-400 hover:text-burgundy"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDeleting(p)} title="Delete" data-testid={`delete-${p.id}`} className="p-2 text-stone-400 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {formOpen && (
        <ProductForm
          key={editing?.id || (duplicate ? "duplicate" : "new")}
          product={editing || null}
          initial={duplicate}
          categories={managedCategories}
          onClose={closeForm}
          onSaved={afterSave}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete product?"
        message={<><strong>{deleting?.name}</strong> will be permanently removed from the store. Past orders keep their details. Tip: hide it instead if you might sell it again.</>}
        confirmLabel="Delete"
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
