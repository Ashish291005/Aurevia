import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { ProductsProvider } from "./context/ProductsContext";
import { SettingsProvider, useSettings } from "./context/SettingsContext";
import { WishlistProvider } from "./context/WishlistContext";
import { StorefrontProvider } from "./context/StorefrontContext";
import OfferPopup from "./components/home/OfferPopup";
import { WhatsAppButton } from "./components/lively";
import { ScrollToTop } from "./lib/hooks";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import ProductDetail from "./pages/ProductDetail";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderConfirmation from "./pages/OrderConfirmation";
import TrackOrder from "./pages/TrackOrder";
import Account from "./pages/Account";
import Wishlist from "./pages/Wishlist";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

function Layout() {
  const { showAnnouncement, ticker_messages } = useSettings();
  const hasTicker = showAnnouncement || (ticker_messages || []).length > 0;
  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <Navbar />
      {/* The announcement bar sits inside the fixed header, so push content down by its height. */}
      <main className={`flex-1 ${hasTicker ? "pt-9" : ""}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-confirmation/:number" element={<OrderConfirmation />} />
          <Route path="/track-order" element={<TrackOrder />} />
          <Route path="/account" element={<Account />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <OfferPopup />
      <WhatsAppButton />
    </div>
  );
}

function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <StorefrontProvider>
        <ProductsProvider>
          <CartProvider>
            <WishlistProvider>
              <BrowserRouter>
                <ScrollToTop />
                <Layout />
                <Toaster position="top-right" richColors closeButton toastOptions={{ className: "font-body" }} />
              </BrowserRouter>
            </WishlistProvider>
          </CartProvider>
        </ProductsProvider>
        </StorefrontProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}

export default App;
