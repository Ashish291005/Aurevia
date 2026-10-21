import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8000";

export default defineConfig(({ command }) => ({
  // Production is served from /admin/ on the same domain as the storefront (see the root vercel.json).
  base: command === "build" ? "/admin/" : "/",
  // Services receive the original request path (/admin/...), so the built files live under dist/admin/
  // and their on-disk paths match the public URLs exactly.
  build: { outDir: "dist/admin", emptyOutDir: true },
  plugins: [react()],
  server: {
    port: 3001,
    strictPort: true,
    // Same-origin API calls keep the auth cookies first-party.
    proxy: {
      "/api": BACKEND,
      "/uploads": BACKEND,
      // Product photos in frontend/public/images are served by the storefront (same origin on the live site).
      "/images": process.env.STORE_URL || "http://localhost:3000",
    },
  },
}));
