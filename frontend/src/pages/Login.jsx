
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { usePageTitle } from "../lib/hooks";
import { Input } from "../components/ui/input";
import GoogleSignIn from "../components/GoogleSignIn";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = () => location.state?.from || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  usePageTitle("Sign in");

  if (user) return <Navigate to={destination(user)} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      navigate(destination(result.user), { replace: true });
    } else {
      setError(result.error);
    }
  };

  return (
    <div data-testid="login-page" className="pt-20 sm:pt-24 min-h-[80vh] flex items-center justify-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="font-heading text-3xl sm:text-4xl text-stone-900 tracking-tight mb-2">Welcome Back</h1>
          <p className="text-sm text-stone-500 font-body">Sign in to your Aurevia account</p>
        </div>

        {error && (
          <div data-testid="login-error" className="bg-red-50 border border-red-200 text-red-600 text-sm font-body px-4 py-3 mb-6">
            {error}
          </div>
        )}

        <GoogleSignIn onSuccess={(u) => navigate(destination(u), { replace: true })} onError={setError} divider="or sign in with email" />

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-xs tracking-[0.15em] uppercase font-body font-semibold text-stone-700 mb-2 block">Email</label>
            <Input data-testid="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com" className="rounded-none border-stone-300 font-body" required />
          </div>
          <div>
            <label className="text-xs tracking-[0.15em] uppercase font-body font-semibold text-stone-700 mb-2 block">Password</label>
            <Input data-testid="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password" className="rounded-none border-stone-300 font-body" required />
          </div>
          <button data-testid="login-submit-btn" type="submit" disabled={loading}
            className="w-full bg-burgundy text-white py-4 text-xs tracking-[0.2em] uppercase font-body font-semibold hover:bg-burgundy-dark transition-colors disabled:opacity-50">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm text-stone-500 font-body mt-8">
          Don't have an account?{" "}
          <Link to="/register" state={location.state} data-testid="register-link" className="text-gold hover:text-gold-hover transition-colors font-semibold">Create one</Link>
        </p>
      </motion.div>
    </div>
  );
}
