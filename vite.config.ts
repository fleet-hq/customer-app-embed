import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => {
  const isLibrary = mode === "production";
  return {
    root: isLibrary ? undefined : "sandbox",
    server: {
      port: 4321,
      strictPort: false,
      cors: true,
    },
    build: {
      target: "es2020",
      outDir: resolve(__dirname, "dist"),
      emptyOutDir: true,
      sourcemap: true,
      lib: {
        entry: resolve(__dirname, "src/loader.ts"),
        name: "FleetHQEmbed",
        formats: ["iife"],
        fileName: () => "embed.js",
      },
      rollupOptions: {
        output: {
          extend: true,
        },
      },
    },
    define: {
      __EMBED_VERSION__: JSON.stringify("0.1.0"),
    },
  };
});
