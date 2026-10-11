import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShoppingBag, User, Menu, LogOut, Heart, Search, Package, MapPin } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { useSettings } from "../context/SettingsContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import SearchOverlay from "./SearchOverlay";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop" },
  { to: "/shop?category=Gift%20Boxes", label: "Gifts" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

function CountBadge({ count, testId }) {
  if (!count) return null;
  return (
    <span data-testid={testId} className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 flex items-center justify-center rounded-full bg-burgundy text-white text-[10px] font-bold">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { showAnnouncement, announcement_text } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location]);

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const isActive = (to) => {
    const [path, query] = to.split("?");
    if (path === "/") return location.pathname === "/";
    if (!location.pathname.startsWith(path)) return false;
    // "Shop" and "Gifts" share /shop; tell them apart by the query string.
    const current = new URLSearchParams(location.search).get("category");
    const target = query ? new URLSearchParams(query).get("category") : null;
    return target ? current === target : current !== "Gift Boxes";
  };

  return (
    <header data-testid="navbar" className="fixed top-0 left-0 right-0 z-50">
      {showAnnouncement && (
        <div data-testid="announcement-bar" className="h-9 bg-burgundy text-white flex items-center justify-center px-4">
          <p className="text-[11px] sm:text-xs tracking-[0.15em] uppercase font-body truncate">{announcement_text}</p>
        </div>
      )}
      <div className={`transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur-xl shadow-sm" : "bg-white/80 backdrop-blur-md"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Mobile menu */}
            <div className="lg:hidden w-20">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <button data-testid="mobile-menu-btn" className="p-2 -ml-2 text-stone-800 hover:text-gold transition-colors" aria-label="Open menu">
                    <Menu className="w-5 h-5" />
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 bg-cream">
                  <SheetHeader>
                    <SheetTitle className="font-heading text-2xl text-burgundy tracking-[0.2em]">AUREVIA</SheetTitle>
                  </SheetHeader>
                  <nav className="mt-8 flex flex-col gap-5">
                    {navLinks.map(link => (
                      <Link key={link.to} to={link.to} data-testid={`mobile-nav-${link.label.toLowerCase()}`}
                        className={`text-lg font-body tracking-wide transition-colors ${isActive(link.to) ? "text-gold" : "text-stone-700 hover:text-gold"}`}>
                        {link.label}
                      </Link>
                    ))}
                  </nav>
                  <div className="mt-8 pt-6 border-t border-stone-200 flex flex-col gap-4 text-sm font-body text-stone-600">
                    <Link to={user ? "/account" : "/login"} className="flex items-center gap-3 hover:text-gold"><User className="w-4 h-4" /> {user ? "My Account" : "Sign In"}</Link>
                    <Link to="/wishlist" className="flex items-center gap-3 hover:text-gold"><Heart className="w-4 h-4" /> Wishlist {wishlistCount > 0 && `(${wishlistCount})`}</Link>
                    <Link to="/track-order" className="flex items-center gap-3 hover:text-gold"><MapPin className="w-4 h-4" /> Track Order</Link>
                    {user && (
                      <button onClick={handleLogout} className="flex items-center gap-3 text-left text-red-700 hover:text-red-800"><LogOut className="w-4 h-4" /> Sign Out</button>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Logo */}
            <Link to="/" data-testid="logo-link" className="font-heading text-2xl sm:text-3xl tracking-[0.2em] text-burgundy font-semibold">
              AUREVIA
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-10">
              {navLinks.map(link => (
                <Link key={link.to} to={link.to} data-testid={`nav-${link.label.toLowerCase()}`}
                  className={`gold-underline text-sm tracking-[0.15em] uppercase font-body font-medium transition-colors ${isActive(link.to) ? "text-gold" : "text-stone-700 hover:text-gold"}`}>
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right icons */}
            <div className="flex items-center justify-end gap-0.5 sm:gap-2 w-20 lg:w-auto">
              <button onClick={() => setSearchOpen(true)} data-testid="search-btn" className="p-2 text-stone-700 hover:text-gold transition-colors" aria-label="Search">
                <Search className="w-5 h-5" />
              </button>
              <Link to="/wishlist" data-testid="wishlist-link" className="relative p-2 text-stone-700 hover:text-gold transition-colors hidden sm:block" aria-label="Wishlist">
                <Heart className="w-5 h-5" />
                <CountBadge count={wishlistCount} testId="wishlist-count" />
              </Link>
              <Link to="/cart" data-testid="cart-icon-link" className="relative p-2 text-stone-700 hover:text-gold transition-colors" aria-label="Cart">
                <ShoppingBag className="w-5 h-5" />
                <CountBadge count={totalItems} testId="cart-count" />
              </Link>

              <div className="hidden sm:block">
                {user ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button data-testid="user-menu-btn" className="p-2 text-stone-700 hover:text-gold transition-colors" aria-label="Account">
                        <User className="w-5 h-5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-white">
                      <div className="px-3 py-2">
                        <p className="text-sm font-medium text-stone-900 truncate">{user.name}</p>
                        <p className="text-xs text-stone-500 truncate">{user.email}</p>
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem data-testid="account-menu-item" onClick={() => navigate("/account")}>
                        <User className="w-4 h-4 mr-2" /> My Account
                      </DropdownMenuItem>
                      <DropdownMenuItem data-testid="orders-menu-item" onClick={() => navigate("/account?tab=orders")}>
                        <Package className="w-4 h-4 mr-2" /> My Orders
                      </DropdownMenuItem>
                      <DropdownMenuItem data-testid="wishlist-menu-item" onClick={() => navigate("/wishlist")}>
                        <Heart className="w-4 h-4 mr-2" /> Wishlist
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem data-testid="logout-menu-item" onClick={handleLogout} className="text-red-600">
                        <LogOut className="w-4 h-4 mr-2" /> Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Link to="/login" state={{ from: location.pathname }} data-testid="login-link" className="block p-2 text-stone-700 hover:text-gold transition-colors" aria-label="Sign in">
                    <User className="w-5 h-5" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <SearchOverlay open={searchOpen} onClose={closeSearch} />
    </header>
  );
}
