import { useEffect, useMemo, useState } from "react";
import { Star, Eye, EyeOff, Trash2, BadgeCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { api, apiError, STORE_URL } from "../lib/api";
import { formatDate } from "../lib/format";
import { Card, PageHeader, EmptyState, SearchInput, ConfirmDialog, Select } from "../components/ui";

function StarsRow({ value }) {
  return <span className="inline-flex">{[1, 2, 3, 4, 5].map(i => <Star key={i} className={`w-3.5 h-3.5 ${i <= value ? "fill-gold text-gold" : "text-stone-300"}`} />)}</span>;
}

export default function Reviews() {
  const [reviews, setReviews] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [deleting, setDeleting] = useState(null);

  const load = () => api.get("/admin/reviews").then(r => setReviews(r.data)).catch(err => { toast.error(apiError(err, "Could not load reviews")); setReviews([]); });
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (reviews || []).filter(r =>
      (filter === "all" || (filter === "hidden" ? r.hidden : filter === "low" ? r.rating <= 2 && !r.hidden : !r.hidden)) &&
      (!q || [r.name, r.product_name, r.title, r.body].some(v => v?.toLowerCase().includes(q)))
    );
  }, [reviews, query, filter]);

  const toggle = async (r) => {
    try {
      const { data } = await api.patch(`/admin/reviews/${r.id}`, { hidden: !r.hidden });
      setReviews(list => list.map(x => (x.id === r.id ? { ...x, hidden: !r.hidden } : x)));
      toast.success(data.message);
    } catch (err) { toast.error(apiError(err, "Update failed")); }
  };

  const avg = reviews?.filter(r => !r.hidden).length ? (reviews.filter(r => !r.hidden).reduce((s, r) => s + r.rating, 0) / reviews.filter(r => !r.hidden).length).toFixed(1) : "—";

  return (
    <div data-testid="reviews-page">
      <PageHeader title="Reviews" subtitle={reviews ? `${reviews.length} reviews · average ${avg}★ · hidden reviews don't count towards ratings` : "Customer product reviews"} />
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <SearchInput value={query} onChange={setQuery} placeholder="Search reviews or products" />
        <Select value={filter} onChange={setFilter} options={[
          { value: "all", label: "All reviews" }, { value: "visible", label: "Visible" }, { value: "low", label: "Low ratings (1–2★)" }, { value: "hidden", label: "Hidden" },
        ]} />
      </div>
      <Card>
        {reviews === null ? <p className="py-16 text-center text-sm text-stone-500">Loading reviews...</p>
          : filtered.length === 0 ? <EmptyState icon={Star} title={reviews.length ? "No matching reviews" : "No reviews yet"} text={reviews.length ? "Try another filter." : "Signed-in customers can review products from the product page."} />
          : (
            <ul className="divide-y divide-stone-100">
              {filtered.map(r => (
                <li key={r.id} className={`p-4 flex gap-4 ${r.hidden ? "bg-stone-50 opacity-70" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StarsRow value={r.rating} />
                      {r.title && <span className="font-medium text-stone-900">{r.title}</span>}
                      {r.hidden && <span className="text-xs text-stone-500">Hidden</span>}
                    </div>
                    <p className="text-sm text-stone-600 mt-1 whitespace-pre-line">{r.body}</p>
                    <p className="text-xs text-stone-400 mt-1.5 flex flex-wrap items-center gap-1">
                      <span className="text-stone-700">{r.name}</span>
                      {r.verified && <span className="inline-flex items-center gap-0.5 text-emerald-700"><BadgeCheck className="w-3.5 h-3.5" /> Verified</span>}
                      · {formatDate(r.created_at)} · on
                      <a href={`${STORE_URL}/product/${r.product_id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-burgundy">{r.product_name} <ExternalLink className="w-3 h-3" /></a>
                    </p>
                  </div>
                  <div className="flex items-start shrink-0">
                    <button onClick={() => toggle(r)} title={r.hidden ? "Show on store" : "Hide from store"} className="p-2 text-stone-400 hover:text-burgundy">{r.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                    <button onClick={() => setDeleting(r)} title="Delete" className="p-2 text-stone-400 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </Card>
      <ConfirmDialog open={Boolean(deleting)} title="Delete review?" message={`${deleting?.name}'s review will be permanently removed and the product rating recalculated.`} confirmLabel="Delete"
        onCancel={() => setDeleting(null)} onConfirm={async () => {
          try { await api.delete(`/admin/reviews/${deleting.id}`); toast.success("Review deleted"); setReviews(l => l.filter(x => x.id !== deleting.id)); }
          catch (err) { toast.error(apiError(err, "Delete failed")); }
          setDeleting(null);
        }} />
    </div>
  );
}
