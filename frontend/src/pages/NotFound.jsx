import { Link } from "react-router-dom";
import { usePageTitle } from "../lib/hooks";

export default function NotFound() {
  usePageTitle("Page not found");
  return (
    <div data-testid="not-found-page" className="pt-40 pb-28 text-center px-6">
      <p className="font-heading text-7xl text-gold mb-4">404</p>
      <h1 className="font-heading text-3xl text-stone-900 mb-2">This page has slipped away</h1>
      <p className="font-body text-stone-500 mb-8">The page you're looking for doesn't exist or has moved.</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/" className="bg-burgundy text-white px-10 py-4 text-xs tracking-[0.2em] uppercase font-body font-semibold hover:bg-burgundy-dark">Go home</Link>
        <Link to="/shop" className="border border-burgundy text-burgundy px-10 py-4 text-xs tracking-[0.2em] uppercase font-body font-semibold hover:bg-burgundy hover:text-white">Shop the collection</Link>
      </div>
    </div>
  );
}
