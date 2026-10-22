import { useEffect, useState } from "react";
import {
  LayoutDashboard, ShoppingCart, Package, Users, MessageSquare, Mail, Settings, LogOut, Store, Menu, X, Database,
  Images, LayoutGrid, BadgePercent, Star,
} from "lucide-react";
import { useAuth } from "../AuthContext";
import { useAdminData } from "../AdminData";
import { STORE_URL } from "../lib/api";

export const NAV = [
  { page: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { page: "orders", label: "Orders", Icon: ShoppingCart, badge: s => s?.open_orders },
  { page: "products", label: "Products", Icon: Package },
  { page: "customers", label: "Customers", Icon: Users },
  { page: "reviews", label: "Reviews", Icon: Star },
  { page: "messages", label: "Messages", Icon: MessageSquare, badge: s => s?.unread_messages },
  { page: "subscribers", label: "Subscribers", Icon: Mail },
  { page: "homepage", label: "Homepage carousel", Icon: Images, group: "Storefront" },
  { page: "categories", label: "Categories", Icon: LayoutGrid, group: "Storefront" },
  { page: "offers", label: "Offers & coupons", Icon: BadgePercent, group: "Storefront" },
  { page: "settings", label: "Settings", Icon: Settings, group: "Storefront" },
];

function Sidebar({ page, onNavigate }) {
  const { stats } = useAdminData();
  const { user, logout } = useAuth();
  return (
    <div className="h-full flex flex-col bg-burgundy text-white">
      <div className="px-6 h-16 flex items-center gap-3 border-b border-white/10">
        <img src={`${import.meta.env.BASE_URL}logo-light.png`} alt="Aurevia" className="h-8 w-auto" />
        <span className="text-[10px] tracking-[0.2em] uppercase text-gold font-semibold">Admin</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1" aria-label="Admin">
        {NAV.map(({ page: p, label, Icon, badge, group }, i) => {
          const count = badge?.(stats);
          const active = page === p;
          const heading = group && NAV[i - 1]?.group !== group;
          return (
            <div key={p}>
            {heading && <p className="px-3 pt-5 pb-1.5 text-[10px] tracking-[0.2em] uppercase text-white/40 font-semibold">{group}</p>}
            <a href={`#/${p}`} onClick={onNavigate} data-testid={`nav-${p}`} aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${active ? "bg-white/15 text-white font-semibold" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {count > 0 && <span data-testid={`nav-badge-${p}`} className="min-w-5 h-5 px-1.5 rounded-full bg-gold text-burgundy text-[11px] font-bold flex items-center justify-center">{count}</span>}
            </a>
            </div>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10 space-y-1">
        <a href={STORE_URL} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white/70 hover:bg-white/10 hover:text-white">
          <Store className="w-4 h-4" /> View store
        </a>
        <button onClick={logout} data-testid="admin-logout" className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white/70 hover:bg-white/10 hover:text-white">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
        <p className="px-3 pt-2 text-[11px] text-white/40 truncate">{user.email}</p>
      </div>
    </div>
  );
}

export default function Layout({ page, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { stats } = useAdminData();
  const current = NAV.find(n => n.page === page);

  useEffect(() => {
    document.title = `${current?.label || "Admin"} | Aurevia Admin`;
  }, [current]);

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 z-30">
        <Sidebar page={page} />
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 shadow-2xl">
            <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="absolute left-full ml-2 top-3 z-10 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"><X className="w-5 h-5" /></button>
            <Sidebar page={page} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <header className="lg:hidden sticky top-0 z-40 h-14 bg-burgundy text-white flex items-center justify-between px-4">
        <button onClick={() => setMobileOpen(true)} aria-label="Open menu" data-testid="mobile-menu" className="p-1"><Menu className="w-5 h-5" /></button>
        <img src={`${import.meta.env.BASE_URL}logo-light.png`} alt="Aurevia" className="h-7 w-auto" />
        <span className="w-7" />
      </header>

      <main className="px-4 sm:px-8 py-6 sm:py-8 max-w-7xl">
        {stats?.memory_db && (
          <div data-testid="memory-db-warning" className="flex gap-3 items-start rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 mb-6 text-sm">
            <Database className="w-4 h-4 shrink-0 mt-0.5" />
            <p><strong>Temporary database:</strong> changes reset when the backend restarts. Set <code className="bg-amber-100 px-1 rounded">DATABASE_URL</code> (Supabase) in <code className="bg-amber-100 px-1 rounded">backend/.env</code> to keep them.</p>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
