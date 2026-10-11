import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { usePageTitle } from "../lib/hooks";
import { Input } from "../components/ui/input";

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = location.state?.from || "/";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  usePageTitle("Create account");

  if (user) return <Navigate to={destination} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    const result = await register(name, email, password);
    setLoading(false);
    if (result.success) {
      navigate(destination, { replace: true });
    } else {
      setError(result.error);
    }
  };

  return (
    <div data-testid="register-page" className="pt-20 sm:pt-24 min-h-[80vh] flex items-center justify-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="font-heading text-3xl sm:text-4xl text-stone-900 tracking-tight mb-2">Create Account</h1>
          <p className="text-sm text-stone-500 font-body">Join the world of Aurevia</p>
        </div>

        {error && (
          <div data-testid="register-error" className="bg-red-50 border border-red-200 text-red-600 text-sm font-body px-4 py-3 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-xs tracking-[0.15em] uppercase font-body font-semibold text-stone-700 mb-2 block">Full Name</label>
            <Input data-testid="register-name" value={name} onChange={e => setName(e.target.value)}
              placeholder="Your full name" className="rounded-none border-stone-300 font-body" required />
          </div>
          <div>
            <label className="text-xs tracking-[0.15em] uppercase font-body font-semibold text-stone-700 mb-2 block">Email</label>
            <Input data-testid="register-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com" className="rounded-none border-stone-300 font-body" required />
          </div>
          <div>
            <label className="text-xs tracking-[0.15em] uppercase font-body font-semibold text-stone-700 mb-2 block">Password</label>
            <Input data-testid="register-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Min 6 characters" className="rounded-none border-stone-300 font-body" required />
          </div>
          <button data-testid="register-submit-btn" type="submit" disabled={loading}
            className="w-full bg-burgundy text-white py-4 text-xs tracking-[0.2em] uppercase font-body font-semibold hover:bg-burgundy-dark transition-colors disabled:opacity-50">
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-stone-500 font-body mt-8">
          Already have an account?{" "}
          <Link to="/login" state={location.state} data-testid="login-link" className="text-gold hover:text-gold-hover transition-colors font-semibold">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
