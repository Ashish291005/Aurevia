import { useEffect, useMemo, useState } from "react";
import { Users, Download, Mail } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "../lib/api";
import { navigate } from "../lib/router";
import { money, formatDate, timeAgo, downloadCsv } from "../lib/format";
import { Card, PageHeader, EmptyState, SearchInput, Button, Select } from "../components/ui";

const SORTS = {
  newest: (a, b) => (b.created_at || "").localeCompare(a.created_at || ""),
  spent: (a, b) => b.spent - a.spent,
  orders: (a, b) => b.orders - a.orders,
  name: (a, b) => a.name.localeCompare(b.name),
};

export default function Customers() {
  const [customers, setCustomers] = useState(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    api.get("/admin/customers").then(r => setCustomers(r.data)).catch(err => {
      toast.error(apiError(err, "Could not load customers"));
      setCustomers([]);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (customers || [])
      .filter(c => !q || c.name.toLowerCase().includes(q) || c.email.includes(q))
      .sort(SORTS[sort]);
  }, [customers, query, sort]);

  const totals = useMemo(() => ({
    buyers: (customers || []).filter(c => c.orders > 0).length,
    spent: (customers || []).reduce((s, c) => s + c.spent, 0),
  }), [customers]);

  return (
    <div data-testid="customers-page">
      <PageHeader
        title="Customers"
        subtitle={customers ? `${customers.length} registered · ${totals.buyers} have ordered · ${money(totals.spent)} lifetime spend` : "Registered shoppers"}
        actions={<Button variant="secondary" disabled={!filtered.length}
          onClick={() => downloadCsv(`aurevia-customers-${new Date().toISOString().slice(0, 10)}.csv`, [
            ["Name", "Email", "Joined", "Orders", "Total spent", "Last order"],
            ...filtered.map(c => [c.name, c.email, c.created_at, c.orders, c.spent, c.last_order || ""]),
          ])}><Download className="w-4 h-4" /> Export CSV</Button>}
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <SearchInput value={query} onChange={setQuery} placeholder="Search name or email" testId="customers-search" />
        <Select value={sort} onChange={setSort} options={[
          { value: "newest", label: "Newest first" }, { value: "spent", label: "Top spenders" },
          { value: "orders", label: "Most orders" }, { value: "name", label: "Name A–Z" },
        ]} />
      </div>

      <Card className="overflow-x-auto">
        {customers === null ? (
          <p className="py-16 text-center text-sm text-stone-500">Loading customers...</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title={customers.length ? "No matching customers" : "No customers yet"}
            text={customers.length ? "Try a different search." : "Shoppers who create an account will appear here. Guest orders are listed under Orders."} />
        ) : (
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium text-right">Orders</th>
                <th className="px-4 py-3 font-medium text-right">Total spent</th>
                <th className="px-4 py-3 font-medium">Last order</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} data-testid={`customer-row-${c.email}`} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-burgundy/10 text-burgundy text-xs font-semibold flex items-center justify-center shrink-0">
                        {c.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-stone-900 font-medium truncate">{c.name}</span>
                        <span className="block text-xs text-stone-400 truncate">{c.email}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{formatDate(c.created_at)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-700">{c.orders}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-900">{money(c.spent)}</td>
                  <td className="px-4 py-3 text-stone-500">{c.last_order ? timeAgo(c.last_order) : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {c.orders > 0 && <button onClick={() => navigate("orders", { query: c.email })} className="px-2 py-1 text-xs text-stone-600 hover:text-burgundy underline">View orders</button>}
                      <a href={`mailto:${c.email}`} title="Email customer" className="p-1.5 text-stone-400 hover:text-gold"><Mail className="w-4 h-4" /></a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
