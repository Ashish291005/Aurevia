import { Link, useLocation, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import OrderDetails from "../components/OrderDetails";
import { formatDate } from "../lib/format";
import { usePageTitle } from "../lib/hooks";

export default function OrderConfirmation() {
  const { number } = useParams();
  const { state } = useLocation();
  const { user } = useAuth();
  const order = state?.order?.number === number ? state.order : null;
  usePageTitle("Order confirmed");

  return (
    <div data-testid="order-confirmation" className="pt-20 sm:pt-24">
      <div className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <CheckCircle className="w-14 h-14 text-gold mx-auto mb-5" />
          <h1 className="font-heading text-3xl sm:text-4xl text-stone-900 mb-3">Thank you for your order</h1>
          <p className="text-base text-stone-600 font-body">
            Order <strong data-testid="order-number" className="text-burgundy">{number}</strong> has been placed
            {order ? ` on ${formatDate(order.created_at)}` : ""}.
          </p>
          <p className="text-sm text-stone-500 font-body mt-1">Keep this number to track your order.</p>
        </motion.div>

        {order ? (
          <div className="bg-white border border-stone-200 p-6 sm:p-8">
            <OrderDetails order={order} />
          </div>
        ) : (
          <p className="text-center text-sm font-body text-stone-500">
            You can check the status any time on the <Link to="/track-order" className="text-gold font-semibold">Track Order</Link> page.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-10">
          <Link to="/shop" data-testid="continue-shopping-btn"
            className="text-center bg-burgundy text-white px-10 py-4 text-xs tracking-[0.2em] uppercase font-body font-semibold hover:bg-burgundy-dark transition-colors">
            Continue Shopping
          </Link>
          <Link to={user ? "/account?tab=orders" : `/track-order?number=${encodeURIComponent(number)}`} state={order ? { email: order.customer.email } : undefined}
            className="text-center border border-burgundy text-burgundy px-10 py-4 text-xs tracking-[0.2em] uppercase font-body font-semibold hover:bg-burgundy hover:text-white transition-colors">
            {user ? "View My Orders" : "Track This Order"}
          </Link>
        </div>
      </div>
    </div>
  );
}
