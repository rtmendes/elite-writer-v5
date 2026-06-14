import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "client/**/*.test.{ts,tsx}",
      "client/**/*.spec.{ts,tsx}",
    ],
    // Plate's math kit imports katex's CSS; inlining routes that .css through
    // Vite's transform (stubbed in test) instead of Node's native loader.
    server: {
      deps: {
        inline: [/@platejs\//, /^platejs/, /katex/, /react-tweet/, /react-lite-youtube-embed/],
      },
    },
  },
});
