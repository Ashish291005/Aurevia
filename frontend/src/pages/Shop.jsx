import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { SlidersHorizontal, X, Search } from "lucide-react";
import { useProducts } from "../context/ProductsContext";
import ProductCard from "../components/ProductCard";
import { matchesQuery } from "../components/SearchOverlay";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { Separator } from "../components/ui/separator";
import { usePageTitle } from "../lib/hooks";
import { RECIPIENTS } from "../lib/format";
import OfferBanner from "../components/home/OfferBanner";
import { useStorefront } from "../context/StorefrontContext";

const priceRanges = [
  { label: "All Prices", min: 0, max: Infinity },
  { label: "Under ₹1,000", min: 0, max: 1000 },
  { label: "₹1,000 – ₹2,000", min: 1000, max: 2000 },
  { label: "Above ₹2,000", min: 2000, max: Infinity },
];

const SORTS = {
  featured: "Featured",
  newest: "Newest",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  name: "Name: A to Z",
};

function FilterButton({ active, onClick, children, testId }) {
  return (
    <button data-testid={testId} onClick={onClick}
      className={`text-left text-sm font-body py-1.5 transition-colors ${active ? "text-burgundy font-semibold" : "text-stone-600 hover:text-burgundy"}`}>
      {children}
    </button>
  );
}

function FilterPanel({ filters, setFilter }) {
  const { categories } = useProducts();
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xs tracking-[0.2em] uppercase font-semibold text-gold mb-4 font-body">Category</h3>
        <div className="flex flex-col gap-1">
          <FilterButton testId="filter-all" active={filters.category === "All"} onClick={() => setFilter({ category: null })}>All Categories</FilterButton>
          {categories.map(cat => (
            <FilterButton key={cat} testId={`filter-${cat.toLowerCase()}`} active={filters.category === cat} onClick={() => setFilter({ category: cat })}>{cat}</FilterButton>
          ))}
        </div>
      </div>
      <Separator />
      <div>
        <h3 className="text-xs tracking-[0.2em] uppercase font-semibold text-gold mb-4 font-body">Shop For</h3>
        <div className="flex flex-col gap-1">
          <FilterButton testId="for-all" active={!filters.for} onClick={() => setFilter({ for: null })}>Everyone</FilterButton>
          {RECIPIENTS.map(r => (
            <FilterButton key={r.value} testId={`for-${r.value}`} active={filters.for === r.value} onClick={() => setFilter({ for: r.value })}>{r.label}</FilterButton>
          ))}
        </div>
      </div>
      <Separator />
      <div>
        <h3 className="text-xs tracking-[0.2em] uppercase font-semibold text-gold mb-4 font-body">Price Range</h3>
        <div className="flex flex-col gap-1">
          {priceRanges.map((r, i) => (
            <FilterButton key={r.label} testId={`price-range-${i}`} active={filters.price === i} onClick={() => setFilter({ price: i || null })}>{r.label}</FilterButton>
          ))}
        </div>
      </div>
      <Separator />
      <div className="space-y-3">
        <h3 className="text-xs tracking-[0.2em] uppercase font-semibold text-gold mb-4 font-body">Availability</h3>
        <label className="flex items-center gap-3 text-sm font-body text-stone-700 cursor-pointer">
          <input type="checkbox" data-testid="filter-in-stock" checked={filters.inStock} onChange={e => setFilter({ stock: e.target.checked ? "1" : null })} className="w-4 h-4 accent-burgundy" />
          In stock only
        </label>
        <label className="flex items-center gap-3 text-sm font-body text-stone-700 cursor-pointer">
          <input type="checkbox" data-testid="filter-on-sale" checked={filters.onSale} onChange={e => setFilter({ sale: e.target.checked ? "1" : null })} className="w-4 h-4 accent-burgundy" />
          On sale
        </label>
      </div>
    </div>
  );
}

export default function Shop() {
  const { products, loading } = useProducts();
  const { bannerOffers } = useStorefront();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileFilters, setMobileFilters] = useState(false);
  usePageTitle("Shop");

  // Filters live in the URL so links (footer, search, home collections) and the back button just work.
  const filters = {
    category: searchParams.get("category") || "All",
    price: Math.min(Number(searchParams.get("price")) || 0, priceRanges.length - 1),
    sort: SORTS[searchParams.get("sort")] ? searchParams.get("sort") : "featured",
    q: searchParams.get("q") || "",
    inStock: searchParams.get("stock") === "1",
    onSale: searchParams.get("sale") === "1",
    for: RECIPIENTS.some(r => r.value === searchParams.get("for")) ? searchParams.get("for") : "",
  };
  const forLabel = RECIPIENTS.find(r => r.value === filters.for)?.label;

  const setFilter = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([k, v]) => (v === null || v === "" || v === undefined ? next.delete(k) : next.set(k, String(v))));
    setSearchParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    const range = priceRanges[filters.price];
    let result = products.filter(p =>
      (filters.category === "All" || p.category === filters.category) &&
      p.price >= range.min && p.price < range.max &&
      (!filters.inStock || p.stock !== 0) &&
      (!filters.onSale || (p.compare_at_price && p.compare_at_price > p.price)) &&
      (!filters.for || (p.recipients || ["her"]).includes(filters.for)) &&
      matchesQuery(p, filters.q)
    );
    if (filters.sort === "price-asc") result = [...result].sort((a, b) => a.price - b.price);
    else if (filters.sort === "price-desc") result = [...result].sort((a, b) => b.price - a.price);
    else if (filters.sort === "name") result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    else if (filters.sort === "newest") result = [...result].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    return result;
  }, [products, filters.category, filters.price, filters.sort, filters.q, filters.inStock, filters.onSale, filters.for]);

  const activeChips = [
    filters.q && { key: "q", label: `"${filters.q}"` },
    filters.category !== "All" && { key: "category", label: filters.category },
    forLabel && { key: "for", label: forLabel },
    filters.price !== 0 && { key: "price", label: priceRanges[filters.price].label },
    filters.inStock && { key: "stock", label: "In stock" },
    filters.onSale && { key: "sale", label: "On sale" },
  ].filter(Boolean);

  const clearAll = () => setSearchParams(filters.sort !== "featured" ? { sort: filters.sort } : {}, { replace: true });

  return (
    <div data-testid="shop-page" className="pt-16 sm:pt-20">
      <div className="bg-burgundy py-14 sm:py-16">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="text-xs tracking-[0.2em] uppercase font-semibold text-gold mb-3 font-body">{filters.q ? "Search results" : "Browse"}</p>
            <h1 className="font-heading text-4xl sm:text-5xl text-white tracking-tight">
              {filters.q ? `“${filters.q}”` : filters.category !== "All" ? filters.category : forLabel ? `Gifts ${forLabel.toLowerCase()}` : "Our Collection"}
            </h1>
          </motion.div>
        </div>
      </div>

      {bannerOffers[0] && <OfferBanner offer={bannerOffers[0]} variant={1} />}

      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-10 sm:py-14">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-6">
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              data-testid="shop-search"
              value={filters.q}
              onChange={e => setFilter({ q: e.target.value })}
              placeholder="Search the collection"
              aria-label="Search the collection"
              className="w-full h-11 border border-stone-300 bg-white pl-9 pr-3 text-sm font-body outline-none focus:border-gold"
            />
          </div>
          <div className="flex items-center gap-3">
            <button data-testid="mobile-filter-btn" onClick={() => setMobileFilters(true)}
              className="lg:hidden flex items-center gap-2 h-11 text-sm font-body text-stone-700 border border-stone-300 bg-white px-4">
              <SlidersHorizontal className="w-4 h-4" /> Filters {activeChips.length > 0 && `(${activeChips.length})`}
            </button>
            <div className="w-56">
              <Select value={filters.sort} onValueChange={(v) => setFilter({ sort: v === "featured" ? null : v })}>
                <SelectTrigger data-testid="sort-select" aria-label="Sort products">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SORTS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-8 min-h-8">
          <p className="text-sm text-stone-500 font-body mr-2" data-testid="product-count">
            {loading ? "Loading..." : `${filtered.length} ${filtered.length === 1 ? "piece" : "pieces"}`}
          </p>
          {activeChips.map(chip => (
            <button key={chip.key} onClick={() => setFilter({ [chip.key]: null })}
              className="inline-flex items-center gap-1.5 bg-white border border-stone-300 px-3 py-1 text-xs font-body text-stone-700 hover:border-burgundy hover:text-burgundy">
              {chip.label} <X className="w-3 h-3" />
            </button>
          ))}
          {activeChips.length > 1 && (
            <button data-testid="clear-filters-btn" onClick={clearAll} className="text-xs font-body text-stone-500 underline hover:text-burgundy ml-1">Clear all</button>
          )}
        </div>

        <Sheet open={mobileFilters} onOpenChange={setMobileFilters}>
          <SheetContent side="left" className="w-80 overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="font-heading text-xl text-burgundy">Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <FilterPanel filters={filters} setFilter={setFilter} />
              <button onClick={() => setMobileFilters(false)}
                className="mt-8 w-full bg-burgundy text-white py-3 text-xs tracking-[0.2em] uppercase font-body font-semibold">
                Show {filtered.length} {filtered.length === 1 ? "piece" : "pieces"}
              </button>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex gap-12">
          <aside className="hidden lg:block w-56 shrink-0">
            <FilterPanel filters={filters} setFilter={setFilter} />
          </aside>

          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-4 sm:gap-x-6 gap-y-10">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-[4/5] bg-stone-200" />
                    <div className="h-4 bg-stone-200 mt-4 w-2/3" />
                    <div className="h-4 bg-stone-200 mt-2 w-1/3" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-stone-300">
                <p className="text-xl text-stone-700 font-heading">No pieces match your filters</p>
                <p className="text-sm text-stone-400 font-body mt-2 mb-6">Try a different search or remove a filter.</p>
                <button onClick={clearAll} className="text-xs tracking-[0.2em] uppercase font-body font-semibold text-burgundy hover:text-gold">Clear filters</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-4 sm:gap-x-6 gap-y-10">
                {filtered.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
