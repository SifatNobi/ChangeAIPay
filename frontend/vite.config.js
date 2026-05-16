const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");

module.exports = defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
    minify: "esbuild",
    rollupOptions: {
      input: "index.html"
    }
  },
  server: {
    port: 5173,
    strictPort: false
  }
});
