import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./AuthContext";
import { AdminDataProvider } from "./AdminData";
import { useRoute } from "./lib/router";
import Layout, { NAV } from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Messages from "./pages/Messages";
import Subscribers from "./pages/Subscribers";
import Settings from "./pages/Settings";
import Homepage from "./pages/Homepage";
import Categories from "./pages/Categories";
import Offers from "./pages/Offers";

const PAGES = {
  dashboard: Dashboard, orders: Orders, products: Products, customers: Customers, messages: Messages, subscribers: Subscribers,
  homepage: Homepage, categories: Categories, offers: Offers, settings: Settings,
};

function AdminApp() {
  const { page, param } = useRoute();
  const known = NAV.some(n => n.page === page);
  const Page = PAGES[known ? page : "dashboard"];
  return (
    <AdminDataProvider>
      <Layout page={known ? page : "dashboard"}>
        <Page param={param} />
      </Layout>
    </AdminDataProvider>
  );
}

function Gate() {
  const { user } = useAuth();
  if (user === null) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-stone-500">Loading...</div>;
  }
  return user ? <AdminApp /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
      <Toaster position="top-right" richColors closeButton toastOptions={{ className: "font-body" }} />
    </AuthProvider>
  );
}
