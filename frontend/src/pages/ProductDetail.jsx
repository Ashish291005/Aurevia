import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShoppingBag, Heart, ChevronRight, Truck, Shield, Gem, Minus, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { useProducts } from "../context/ProductsContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { useSettings } from "../context/SettingsContext";
import ProductCard, { PriceTag } from "../components/ProductCard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Separator } from "../components/ui/separator";
import { imageUrl } from "../lib/api";
import { formatPrice, RECIPIENTS } from "../lib/format";
import { usePageTitle } from "../lib/hooks";

function OptionGroup({ label, options, value, onChange, testId }) {
  return (
    <div>
      <p className="text-xs tracking-[0.15em] uppercase font-body font-semibold text-stone-700 mb-3">
        {label}: <span className="normal-case tracking-normal font-normal text-stone-500">{value}</span>
      </p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label} data-testid={testId}>
        {options.map(opt => (
          <button key={opt} type="button" role="radio" aria-checked={value === opt} onClick={() => onChange(opt)}
            className={`min-w-12 px-4 h-11 border text-sm font-body transition-colors ${value === opt ? "border-burgundy bg-burgundy text-white" : "border-stone-300 bg-white text-stone-700 hover:border-burgundy"}`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProductView({ product }) {
  const { products } = useProducts();
  const { addItem, items } = useCart();
  const wishlist = useWishlist();
  const settings = useSettings();
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState(0);
  const [size, setSize] = useState(product.sizes[0]);
  const [material, setMaterial] = useState(product.materials[0]);
  const [quantity, setQuantity] = useState(1);
  usePageTitle(product.name);

  // Products from the bundled fallback catalog have no stock field; treat them as available.
  const stock = typeof product.stock === "number" ? product.stock : 99;
  const inCart = items.filter(i => i.productId === product.id).reduce((s, i) => s + i.quantity, 0);
  const canAdd = Math.max(0, stock - inCart);
  const soldOut = stock === 0;
  const saved = wishlist.has(product.id);
  const onSale = product.compare_at_price && product.compare_at_price > product.price;
  const related = products.filter(p => p.id !== product.id && p.category === product.category).slice(0, 4);
  const threshold = settings.free_shipping_threshold;

  const handleAddToCart = (goToCart = false) => {
    const result = addItem(product, size, material, quantity);
    if (!result.ok) { toast.error(result.message); return; }
    toast.success(result.message || `${product.name} added to cart`, {
      action: goToCart ? undefined : { label: "View cart", onClick: () => navigate("/cart") },
    });
    setQuantity(1);
    if (goToCart) navigate("/checkout");
  };

  return (
    <div data-testid="product-detail-page" className="pt-16 sm:pt-20">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-8 sm:py-12">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-body text-stone-500 mb-8">
          <Link to="/" className="hover:text-gold">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to={`/shop?category=${encodeURIComponent(product.category)}`} data-testid="back-to-shop" className="hover:text-gold">{product.category}</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-stone-800 truncate">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <div className="relative aspect-[4/5] overflow-hidden bg-stone-100 mb-4">
              <img data-testid="product-main-image" src={imageUrl(product.images[selectedImage] || product.images[0])} alt={product.name} className="w-full h-full object-cover" />
              {onSale && !soldOut && <span className="absolute top-4 left-4 bg-burgundy text-white text-[10px] tracking-wider uppercase px-2.5 py-1 font-body font-semibold">Sale</span>}
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {product.images.map((img, i) => (
                  <button key={img} data-testid={`product-thumbnail-${i}`} onClick={() => setSelectedImage(i)} aria-label={`View image ${i + 1}`}
                    className={`w-20 h-24 shrink-0 overflow-hidden border-2 transition-colors ${selectedImage === i ? "border-gold" : "border-transparent hover:border-stone-300"}`}>
                    <img src={imageUrl(img)} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }} className="lg:sticky lg:top-28 lg:self-start">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <p className="text-xs tracking-[0.2em] uppercase font-semibold text-gold font-body">{product.category}</p>
              {(product.recipients || []).map(r => (
                <span key={r} className="text-[10px] tracking-wider uppercase font-body font-semibold bg-blush text-burgundy px-2 py-0.5 rounded-full">
                  {RECIPIENTS.find(x => x.value === r)?.label || r}
                </span>
              ))}
            </div>
            <h1 data-testid="product-name" className="font-heading text-3xl sm:text-4xl text-stone-900 tracking-tight mb-3">{product.name}</h1>
            <div data-testid="product-price" className="text-2xl font-heading text-gold mb-2">
              <PriceTag product={product} />
              {onSale && <span className="ml-3 align-middle text-xs font-body font-semibold text-burgundy">Save {formatPrice(product.compare_at_price - product.price)}</span>}
            </div>
            <p data-testid="product-stock" className={`text-xs tracking-wider uppercase font-body font-semibold mb-6 ${soldOut ? "text-red-700" : stock <= 5 ? "text-amber-700" : "text-emerald-700"}`}>
              {soldOut ? "Out of stock" : stock <= 5 ? `Only ${stock} left` : "In stock"}
            </p>
            {product.description && <p className="text-base leading-relaxed text-stone-600 font-body mb-8">{product.description}</p>}

            <Separator className="mb-8" />

            <div className="space-y-6 mb-8">
              {product.sizes.length > 1 || product.sizes[0] !== "One Size"
                ? <OptionGroup label="Size" options={product.sizes} value={size} onChange={setSize} testId="size-select" />
                : null}
              {product.materials.length > 1 || product.materials[0] !== "Standard"
                ? <OptionGroup label="Material" options={product.materials} value={material} onChange={setMaterial} testId="material-select" />
                : null}
              {!soldOut && (
                <div>
                  <p className="text-xs tracking-[0.15em] uppercase font-body font-semibold text-stone-700 mb-3">Quantity</p>
                  <div className="inline-flex items-center border border-stone-300 bg-white">
                    <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Decrease quantity"
                      className="w-11 h-11 flex items-center justify-center text-stone-600 hover:text-burgundy disabled:opacity-30"><Minus className="w-4 h-4" /></button>
                    <span data-testid="product-qty" className="w-12 text-center text-sm font-body">{quantity}</span>
                    <button type="button" onClick={() => setQuantity(q => Math.min(Math.max(canAdd, 1), q + 1))} disabled={quantity >= canAdd} aria-label="Increase quantity"
                      className="w-11 h-11 flex items-center justify-center text-stone-600 hover:text-burgundy disabled:opacity-30"><Plus className="w-4 h-4" /></button>
                  </div>
                  {inCart > 0 && <p className="text-xs text-stone-500 font-body mt-2 flex items-center gap-1"><Check className="w-3 h-3 text-emerald-700" /> {inCart} already in your cart</p>}
                </div>
              )}
            </div>

            <div className="flex gap-3 mb-3">
              <button data-testid="add-to-cart-btn" onClick={() => handleAddToCart(false)} disabled={soldOut || canAdd === 0}
                className="flex-1 flex items-center justify-center gap-3 bg-burgundy text-white py-4 text-xs tracking-[0.2em] uppercase font-body font-semibold hover:bg-burgundy-dark transition-colors disabled:bg-stone-400 disabled:cursor-not-allowed">
                <ShoppingBag className="w-4 h-4" /> {soldOut ? "Sold Out" : canAdd === 0 ? "All in Cart" : "Add to Cart"}
              </button>
              <button data-testid="product-wishlist-btn" aria-pressed={saved}
                onClick={() => toast.success(wishlist.toggle(product.id) ? "Saved to wishlist" : "Removed from wishlist")}
                className={`w-14 flex items-center justify-center border transition-colors ${saved ? "border-burgundy text-burgundy" : "border-stone-300 text-stone-600 hover:border-gold hover:text-gold"}`}
                aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}>
                <Heart className={`w-5 h-5 ${saved ? "fill-burgundy" : ""}`} />
              </button>
            </div>
            {!soldOut && canAdd > 0 && (
              <button data-testid="buy-now-btn" onClick={() => handleAddToCart(true)}
                className="w-full mb-10 border border-burgundy text-burgundy py-4 text-xs tracking-[0.2em] uppercase font-body font-semibold hover:bg-burgundy hover:text-white transition-colors">
                Buy Now
              </button>
            )}

            <Accordion type="single" collapsible className="border-t border-stone-200 mt-6">
              <AccordionItem value="details" className="border-stone-200">
                <AccordionTrigger data-testid="accordion-details" className="font-body text-sm tracking-wider uppercase text-stone-700 hover:no-underline hover:text-gold">
                  <span className="flex items-center gap-2"><Gem className="w-4 h-4" /> Details</span>
                </AccordionTrigger>
                <AccordionContent className="font-body text-sm text-stone-600 leading-relaxed">
                  Finish: {product.materials.join(" / ")}. Aurevia is fashion jewellery: a brass or stainless-steel base with anti-tarnish plating
                  {" "}and AD, kundan or crystal stones. It's nickel- and lead-free and gentle on sensitive skin. Not real gold or silver.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="shipping" className="border-stone-200">
                <AccordionTrigger data-testid="accordion-shipping" className="font-body text-sm tracking-wider uppercase text-stone-700 hover:no-underline hover:text-gold">
                  <span className="flex items-center gap-2"><Truck className="w-4 h-4" /> Shipping</span>
                </AccordionTrigger>
                <AccordionContent className="font-body text-sm text-stone-600 leading-relaxed">
                  {settings.shipping_fee <= 0
                    ? "Complimentary shipping on all orders."
                    : threshold > 0
                      ? `Complimentary shipping on orders over ${formatPrice(threshold)}; otherwise ${formatPrice(settings.shipping_fee)}.`
                      : `Flat-rate shipping of ${formatPrice(settings.shipping_fee)}.`}
                  {" "}Delivered across India in 3–7 working days, with cash on delivery available. Every order is gift-wrapped free with a note card.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="guarantee" className="border-stone-200">
                <AccordionTrigger data-testid="accordion-guarantee" className="font-body text-sm tracking-wider uppercase text-stone-700 hover:no-underline hover:text-gold">
                  <span className="flex items-center gap-2"><Shield className="w-4 h-4" /> Care &amp; Returns</span>
                </AccordionTrigger>
                <AccordionContent className="font-body text-sm text-stone-600 leading-relaxed">
                  To keep the shine, avoid perfume, water and sweat, and store pieces in the pouch provided. Every piece has a 6-month plating warranty
                  {" "}and easy 7-day returns on unused items in their original packaging.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </motion.div>
        </div>

        {related.length > 0 && (
          <section className="mt-24" data-testid="related-products">
            <div className="flex items-end justify-between mb-10">
              <h2 className="font-heading text-3xl text-stone-900">You may also like</h2>
              <Link to={`/shop?category=${encodeURIComponent(product.category)}`} className="gold-underline text-xs tracking-[0.2em] uppercase text-stone-600 hover:text-gold font-body">View all</Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-10">
              {related.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const { getProductById, loading } = useProducts();
  const product = getProductById(id);

  if (!product && loading) {
    return <div className="pt-40 pb-24 text-center font-body text-stone-500">Loading...</div>;
  }

  if (!product) {
    return (
      <div className="pt-40 pb-24 text-center px-6">
        <h1 className="font-heading text-3xl text-stone-900 mb-2">Product not found</h1>
        <p className="font-body text-stone-500 mb-6">This piece may have been sold out or removed from the collection.</p>
        <Link to="/shop" className="text-xs tracking-[0.2em] uppercase font-body font-semibold text-burgundy hover:text-gold">Browse the collection</Link>
      </div>
    );
  }

  // Keyed by id so selections reset when navigating between products.
  return <ProductView key={product.id} product={product} />;
}
