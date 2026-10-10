import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
export default defineConfig({
  plugins: [svelte()],
  define: {
    __APP_VERSION__: JSON.stringify("development"),
    __BUILD_ID__: JSON.stringify("development"),
    __SOURCE__: JSON.stringify("uncommitted"),
  },
  build: {
    target: "es2022",
    license: { fileName: "licenses.md" },
    rolldownOptions: {
      output: { postBanner: "/* Dependency notices: /licenses.md */" },
    },
  },
});
