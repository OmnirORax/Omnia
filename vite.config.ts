import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";

// https://viteplus.dev/config/
export default defineConfig({
  // Relative assets work at both a domain root and a repository subpath.
  base: "./",
  plugins: [react()],
});
