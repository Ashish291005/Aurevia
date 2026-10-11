import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Star, BadgeCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../context/ProductsContext";
import { api, apiError } from "../lib/api";
import { formatDate } from "../lib/format";
import { Stars } from "./Stars";

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Your rating" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} star${i > 1 ? "s" : ""}`}
          onMouseEnter={() => setHover(i)} onClick={() => onChange(i)} className="p-0.5 transition-transform hover:scale-110">
          <Star className={`w-7 h-7 ${(hover || value) >= i ? "fill-gold text-gold" : "text-stone-300"}`} />
        </button>
      ))}
    </div>
  );
}

export default function Reviews({ productId }) {
  const { user } = useAuth();
  const { refresh } = useProducts();
  const location = useLocation();
  const [reviews, setReviews] = useState(null);
  const [writing, setWriting] = useState(false);
  const [form, setForm] = useState({ rating: 0, title: "", body: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get(`/products/${productId}/reviews`).then(r => setReviews(r.data)).catch(() => setReviews([]));
  }, [productId]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.rating) { toast.error("Please choose a star rating"); return; }
    setSaving(true);
    try {
      await api.post(`/products/${productId}/reviews`, form);
      toast.success("Thanks for your review!");
      setWriting(false);
      setForm({ rating: 0, title: "", body: "" });
      load();
      refresh();
    } catch (err) {
      toast.error(apiError(err, "Couldn't post your review"));
    } finally {
      setSaving(false);
    }
  };

  if (reviews === null) return null;
  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  const dist = [5, 4, 3, 2, 1].map(n => ({ n, c: reviews.filter(r => r.rating === n).length }));

  return (
    <section id="reviews" data-testid="reviews-section" className="mt-20 scroll-mt-28">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <h2 className="font-heading text-3xl text-stone-900">Customer reviews</h2>
        {user ? (
          !writing && <button onClick={() => setWriting(true)} data-testid="write-review-btn" className="rounded-full border border-burgundy text-burgundy px-6 py-2.5 text-xs tracking-[0.15em] uppercase font-body font-semibold hover:bg-burgundy hover:text-white transition-colors">Write a review</button>
        ) : (
          <Link to="/login" state={{ from: location.pathname }} className="text-sm font-body text-burgundy underline hover:text-rose">Sign in to write a review</Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="rounded-2xl bg-petal p-6 self-start">
          {count ? (
            <>
              <div className="flex items-end gap-3">
                <span className="font-heading text-5xl text-stone-900">{avg.toFixed(1)}</span>
                <div className="pb-1.5"><Stars value={avg} size="w-4 h-4" /><p className="text-xs text-stone-500 font-body mt-1">{count} {count === 1 ? "review" : "reviews"}</p></div>
              </div>
              <div className="mt-5 space-y-1.5">
                {dist.map(({ n, c }) => (
                  <div key={n} className="flex items-center gap-2 text-xs font-body text-stone-600">
                    <span className="w-6">{n}★</span>
                    <div className="flex-1 h-2 rounded-full bg-white overflow-hidden"><div className="h-full bg-gold rounded-full" style={{ width: `${(c / count) * 100}%` }} /></div>
                    <span className="w-6 text-right tabular-nums">{c}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm font-body text-stone-600">No reviews yet. Bought this piece? Be the first to share what you think.</p>
          )}
        </div>

        <div className="lg:col-span-2 space-y-5">
          {writing && (
            <form onSubmit={submit} data-testid="review-form" className="rounded-2xl ring-1 ring-stone-200 bg-white p-6 space-y-4">
              <StarPicker value={form.rating} onChange={(rating) => setForm(f => ({ ...f, rating }))} />
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} maxLength={80} placeholder="Headline (optional)" aria-label="Review headline"
                className="w-full h-11 rounded-lg border border-stone-300 px-3 text-sm font-body outline-none focus:border-gold" />
              <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} required minLength={3} maxLength={1500} rows={4} placeholder="How does it look, feel and wear?" aria-label="Your review" data-testid="review-body"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-body outline-none focus:border-gold resize-y" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setWriting(false)} className="px-5 py-2.5 text-xs uppercase tracking-wider font-body font-semibold text-stone-500">Cancel</button>
                <button type="submit" disabled={saving} data-testid="review-submit" className="flex items-center gap-2 rounded-full bg-burgundy text-white px-6 py-2.5 text-xs uppercase tracking-wider font-body font-semibold hover:bg-rose disabled:opacity-60">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Post review
                </button>
              </div>
            </form>
          )}
          {reviews.map(r => (
            <article key={r.id} className="border-b border-stone-200 pb-5">
              <div className="flex items-center gap-3">
                <Stars value={r.rating} />
                {r.title && <p className="font-body font-semibold text-stone-900">{r.title}</p>}
              </div>
              <p className="font-body text-sm text-stone-600 mt-2 whitespace-pre-line">{r.body}</p>
              <p className="text-xs font-body text-stone-400 mt-2 flex items-center gap-1.5">
                <span className="text-stone-700 font-semibold">{r.name}</span>
                {r.verified && <span className="inline-flex items-center gap-0.5 text-emerald-700"><BadgeCheck className="w-3.5 h-3.5" /> Verified buyer</span>}
                · {formatDate(r.created_at)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
