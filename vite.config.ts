import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  server: {
    port: Number(process.env.PORT) || 5199,
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", ".claude/worktrees/**"],
  },
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
