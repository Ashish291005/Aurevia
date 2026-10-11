import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { useAuth } from "../AuthContext";
import { Input } from "../components/Input";

export default function Login() {
  const { login, notice } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.success) setError(result.error);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-burgundy p-12 text-white">
        <p className="font-heading text-3xl tracking-[0.3em]">AUREVIA</p>
        <div>
          <p className="text-xs tracking-[0.25em] uppercase text-gold font-semibold mb-4">Store Administration</p>
          <h1 className="font-heading text-5xl leading-tight mb-4">Manage your collection.</h1>
          <p className="text-white/60 max-w-md">Add new pieces, update prices and stock, and keep the storefront looking its best.</p>
        </div>
        <p className="text-xs text-white/40">Authorised staff only</p>
      </div>

      <div className="flex items-center justify-center p-6 bg-cream">
        <form onSubmit={handleSubmit} data-testid="admin-login-form" className="w-full max-w-sm">
          <div className="lg:hidden font-heading text-3xl tracking-[0.3em] text-burgundy text-center mb-10">AUREVIA</div>
          <div className="w-12 h-12 bg-burgundy/10 text-burgundy flex items-center justify-center mb-6">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="font-heading text-3xl text-stone-900 mb-1">Admin sign in</h2>
          <p className="text-sm text-stone-500 mb-8">Use your administrator account.</p>

          {(error || notice) && (
            <div data-testid="admin-login-error" className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6">
              {error || notice}
            </div>
          )}

          <label htmlFor="email" className="text-xs tracking-[0.15em] uppercase font-semibold text-stone-700 mb-2 block">Email</label>
          <Input id="email" type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className="mb-5" />

          <label htmlFor="password" className="text-xs tracking-[0.15em] uppercase font-semibold text-stone-700 mb-2 block">Password</label>
          <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="mb-8" />

          <button type="submit" disabled={loading} data-testid="admin-login-submit"
            className="w-full flex items-center justify-center gap-2 bg-burgundy text-white py-3.5 text-xs tracking-[0.2em] uppercase font-semibold hover:bg-burgundy-dark transition-colors disabled:opacity-60">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
