import { cloudflare } from "@cloudflare/vite-plugin";
import { computerBundle } from "@cloudflare/computer/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare(), computerBundle()],
  resolve: { alias: { "@": fileURLToPath(new URL("./web", import.meta.url)) } },
});
