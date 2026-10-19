import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { products as fallbackProducts } from "../data/products";
import { useStorefront } from "./StorefrontContext";

const ProductsContext = createContext(null);


export function ProductsProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const storefront = useStorefront();

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/products");
      if (!Array.isArray(data)) throw new Error("Unexpected response");
      setProducts(data);
    } catch {
      // Backend unreachable: show the bundled catalog so the storefront still works.
      setProducts(fallbackProducts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => {
    // Category order comes from the admin panel; fall back to the categories products use.
    const managed = storefront.categories.map(c => c.name);
    const categories = managed.length ? managed : [...new Set(products.map(p => p.category))];
    return {
      products,
      loading,
      refresh,
      categories,
      getProductById: (id) => products.find(p => p.id === id),
      getBestsellers: () => products.filter(p => p.bestseller),
    };
  }, [products, loading, refresh, storefront.categories]);

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export const useProducts = () => useContext(ProductsContext);
