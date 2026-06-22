import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "WardleyDemo",
      formats: ["iife"],
      fileName: () => "wardley-demo.js",
    },
    rollupOptions: {
      output: {
        exports: "default",
      },
    },
  },
});
