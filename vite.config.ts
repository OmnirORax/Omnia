import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import { discoverFunctions, generatedFunctionsPath } from "./scripts/discover-functions.mjs";

// https://viteplus.dev/config/
export default defineConfig({
  // Relative assets work at both a domain root and a repository subpath.
  base: "./",
  plugins: [{
    name: "configurable-function-discovery",
    buildStart() { discoverFunctions(); },
    configureServer(server) {
      const refresh = (path: string) => { if (path.endsWith(".function.ts")) { discoverFunctions(); server.ws.send({ type: "full-reload" }); } };
      server.watcher.on("add", refresh); server.watcher.on("unlink", refresh);
      server.httpServer?.once("close", () => { server.watcher.off("add", refresh); server.watcher.off("unlink", refresh); });
    },
    handleHotUpdate({ file, server }) {
      if (file.endsWith(".function.ts") || file === generatedFunctionsPath) {
        server.ws.send({ type: "full-reload" }); return [];
      }
    },
  }, react()],
});
