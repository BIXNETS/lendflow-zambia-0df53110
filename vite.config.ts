import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Nitro produces the Vercel-compatible server output. It is enabled on Vercel
// (VERCEL=1 is set during their builds) or locally with DEPLOY_TARGET=vercel,
// so the default Lovable build output stays unchanged.
const useNitro = process.env["VERCEL"] === "1" || process.env["DEPLOY_TARGET"] === "vercel";

export default defineConfig({
  server: { port: 8080, host: true },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    ...(useNitro
      ? [
          nitro({
            preset: "vercel",
            // Vercel serves the SSR entry point from .output/server/index.mjs
            // and static assets from .output/public.
          }),
        ]
      : []),
    react(),
  ],
});
