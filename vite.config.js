import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Vercel serves dist/404.html for HTTP 404s. Copy the SPA shell so missing
 *  routes still boot Uni Deals chrome instead of the default Vercel page. */
function copySpaFallback404() {
  return {
    name: "copy-spa-fallback-404",
    closeBundle() {
      const indexHtml = resolve("dist/index.html");
      if (!existsSync(indexHtml)) return;
      copyFileSync(indexHtml, resolve("dist/404.html"));
    },
  };
}

export default defineConfig({
  plugins: [react(), copySpaFallback404()],
});
