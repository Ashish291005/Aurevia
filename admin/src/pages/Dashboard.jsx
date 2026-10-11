import { useEffect } from "react";
import { DollarSign, ShoppingCart, Clock, Receipt, Package, AlertTriangle, Users, Mail, ArrowRight } from "lucide-react";
import { useAuth } from "../AuthContext";
import { useAdminData } from "../AdminData";
import { navigate } from "../lib/router";
import { money, moneyCompact, timeAgo } from "../lib/format";
import { Card, PageHeader, StatusBadge, EmptyState, Button } from "../components/ui";
import SalesChart from "../components/SalesChart";

function Stat({ icon: Icon, label, value, hint, onClick, tone = "text-stone-900" }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick} className={`text-left bg-white border border-stone-200 rounded-lg p-4 ${onClick ? "hover:border-gold transition-colors" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-stone-500">{label}</p>
        <Icon className="w-4 h-4 text-gold" />
      </div>
      <p className={`text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="text-xs text-stone-400 mt-1">{hint}</p>}
    </Comp>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { stats, reloadStats } = useAdminData();

  useEffect(() => { reloadStats(); }, [reloadStats]);

  if (!stats) return <p className="py-20 text-center text-sm text-stone-500">Loading dashboard...</p>;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div data-testid="admin-dashboard">
      <PageHeader
        title={`${greeting}, ${user.name || "Admin"}`}
        subtitle="Here's what's happening in your store."
        actions={<Button onClick={() => navigate("products/new")} data-testid="dashboard-add-product">Add product</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Stat icon={DollarSign} label="Revenue" value={moneyCompact(stats.revenue)} hint="All time, excl. cancelled" />
        <Stat icon={ShoppingCart} label="Orders" value={stats.orders} hint={`${stats.pending_orders} awaiting confirmation`} onClick={() => navigate("orders")} />
        <Stat icon={Clock} label="Open orders" value={stats.open_orders} hint="Pending + processing" tone={stats.open_orders ? "text-amber-700" : "text-stone-900"} onClick={() => navigate("orders")} />
        <Stat icon={Receipt} label="Avg. order value" value={money(stats.avg_order_value)} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Stat icon={Package} label="Products" value={stats.products} hint={stats.hidden_products ? `${stats.hidden_products} hidden from store` : "All visible"} onClick={() => navigate("products")} />
        <Stat icon={AlertTriangle} label="Low / out of stock" value={`${stats.low_stock} / ${stats.out_of_stock}`} hint={`Inventory value ${moneyCompact(stats.inventory_value)}`} tone={stats.out_of_stock ? "text-red-700" : stats.low_stock ? "text-amber-700" : "text-stone-900"} onClick={() => navigate("products")} />
        <Stat icon={Users} label="Customers" value={stats.users} onClick={() => navigate("customers")} />
        <Stat icon={Mail} label="Subscribers" value={stats.subscribers} hint={stats.unread_messages ? `${stats.unread_messages} unread messages` : undefined} onClick={() => navigate("subscribers")} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <Card className="xl:col-span-2 p-5">
          <SalesChart data={stats.sales_by_day} />
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-stone-900">Needs restocking</h2>
            <button onClick={() => navigate("products")} className="text-xs text-stone-500 hover:text-burgundy">All products</button>
          </div>
          {stats.low_stock_products.length === 0 ? (
            <p className="text-sm text-stone-500 py-8 text-center">Every product is well stocked.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {stats.low_stock_products.map(p => (
                <li key={p.id}>
                  <button onClick={() => navigate(`products/${p.id}`)} className="w-full flex items-center gap-3 py-2 text-left hover:bg-stone-50">
                    <img src={p.images?.[0]} alt="" className="w-9 h-10 object-cover rounded bg-stone-100" />
                    <span className="flex-1 text-sm text-stone-800 truncate">{p.name}</span>
                    <span className={`text-xs font-semibold ${p.stock === 0 ? "text-red-700" : "text-amber-700"}`}>{p.stock === 0 ? "Sold out" : `${p.stock} left`}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-2 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-stone-900">Recent orders</h2>
            <button onClick={() => navigate("orders")} className="flex items-center gap-1 text-xs text-stone-500 hover:text-burgundy">View all <ArrowRight className="w-3 h-3" /></button>
          </div>
          {stats.recent_orders.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="No orders yet" text="Orders placed on the storefront will show up here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <tbody>
                  {stats.recent_orders.map(o => (
                    <tr key={o.id} onClick={() => navigate(`orders/${o.id}`)} className="border-b border-stone-100 last:border-0 hover:bg-stone-50 cursor-pointer">
                      <td className="py-2.5 pr-3 font-medium text-stone-900">{o.number}</td>
                      <td className="py-2.5 pr-3 text-stone-600 truncate max-w-[10rem]">{o.customer.first_name} {o.customer.last_name}</td>
                      <td className="py-2.5 pr-3 text-stone-400 text-xs whitespace-nowrap">{timeAgo(o.created_at)}</td>
                      <td className="py-2.5 pr-3"><StatusBadge status={o.status} /></td>
                      <td className="py-2.5 text-right tabular-nums text-stone-900">{money(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-stone-900 mb-3">Best sellers</h2>
          {stats.top_products.length === 0 ? (
            <p className="text-sm text-stone-500 py-8 text-center">Sales data will appear after the first orders.</p>
          ) : (
            <ol className="space-y-3">
              {stats.top_products.map((p, i) => (
                <li key={p.product_id} className="flex items-center gap-3">
                  <span className="w-5 text-xs text-stone-400 tabular-nums">{i + 1}</span>
                  <img src={p.image} alt="" className="w-9 h-10 object-cover rounded bg-stone-100" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-800 truncate">{p.name}</p>
                    <p className="text-xs text-stone-500">{p.units} sold · {money(p.revenue)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
