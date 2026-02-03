// vite.config.js
import { defineConfig } from "file:///D:/RAYSAN/kmtifmsv2/kmtifmsv2/client/node_modules/vite/dist/node/index.js";
import react from "file:///D:/RAYSAN/kmtifmsv2/kmtifmsv2/client/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "D:\\RAYSAN\\kmtifmsv2\\kmtifmsv2\\client";
var vite_config_default = defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      "@components": path.resolve(__vite_injected_original_dirname, "./src/components"),
      "@services": path.resolve(__vite_injected_original_dirname, "./src/services"),
      "@utils": path.resolve(__vite_injected_original_dirname, "./src/utils"),
      "@store": path.resolve(__vite_injected_original_dirname, "./src/store")
    }
  },
  build: {
    // Output directory
    outDir: "dist",
    // Generate sourcemaps for production debugging
    sourcemap: false,
    // Chunk size warning limit (in KB)
    chunkSizeWarningLimit: 1e3,
    rollupOptions: {
      output: {
        // Manual chunks for better code splitting
        manualChunks: {
          // React vendor bundle
          "react-vendor": [
            "react",
            "react-dom",
            "react-router-dom"
          ],
          // UI components bundle
          "ui-components": [
            "./src/components/common",
            "./src/components/shared"
          ],
          // Zustand store
          "store": [
            "zustand"
          ]
        },
        // Naming pattern for chunks
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: "assets/[ext]/[name]-[hash].[ext]"
      }
    },
    // Minification
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        // Remove console.log in production
        drop_debugger: true
      }
    }
  },
  server: {
    port: 5173,
    strictPort: false,
    open: false
  },
  preview: {
    port: 4173
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxSQVlTQU5cXFxca210aWZtc3YyXFxcXGttdGlmbXN2MlxcXFxjbGllbnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXFJBWVNBTlxcXFxrbXRpZm1zdjJcXFxca210aWZtc3YyXFxcXGNsaWVudFxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovUkFZU0FOL2ttdGlmbXN2Mi9rbXRpZm1zdjIvY2xpZW50L3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XHJcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBiYXNlOiAnLi8nLFxyXG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcclxuXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMnKSxcclxuICAgICAgJ0Bjb21wb25lbnRzJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjL2NvbXBvbmVudHMnKSxcclxuICAgICAgJ0BzZXJ2aWNlcyc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYy9zZXJ2aWNlcycpLFxyXG4gICAgICAnQHV0aWxzJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjL3V0aWxzJyksXHJcbiAgICAgICdAc3RvcmUnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMvc3RvcmUnKVxyXG4gICAgfVxyXG4gIH0sXHJcblxyXG4gIGJ1aWxkOiB7XHJcbiAgICAvLyBPdXRwdXQgZGlyZWN0b3J5XHJcbiAgICBvdXREaXI6ICdkaXN0JyxcclxuXHJcbiAgICAvLyBHZW5lcmF0ZSBzb3VyY2VtYXBzIGZvciBwcm9kdWN0aW9uIGRlYnVnZ2luZ1xyXG4gICAgc291cmNlbWFwOiBmYWxzZSxcclxuXHJcbiAgICAvLyBDaHVuayBzaXplIHdhcm5pbmcgbGltaXQgKGluIEtCKVxyXG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxMDAwLFxyXG5cclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgLy8gTWFudWFsIGNodW5rcyBmb3IgYmV0dGVyIGNvZGUgc3BsaXR0aW5nXHJcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAvLyBSZWFjdCB2ZW5kb3IgYnVuZGxlXHJcbiAgICAgICAgICAncmVhY3QtdmVuZG9yJzogW1xyXG4gICAgICAgICAgICAncmVhY3QnLFxyXG4gICAgICAgICAgICAncmVhY3QtZG9tJyxcclxuICAgICAgICAgICAgJ3JlYWN0LXJvdXRlci1kb20nXHJcbiAgICAgICAgICBdLFxyXG5cclxuICAgICAgICAgIC8vIFVJIGNvbXBvbmVudHMgYnVuZGxlXHJcbiAgICAgICAgICAndWktY29tcG9uZW50cyc6IFtcclxuICAgICAgICAgICAgJy4vc3JjL2NvbXBvbmVudHMvY29tbW9uJyxcclxuICAgICAgICAgICAgJy4vc3JjL2NvbXBvbmVudHMvc2hhcmVkJ1xyXG4gICAgICAgICAgXSxcclxuXHJcbiAgICAgICAgICAvLyBadXN0YW5kIHN0b3JlXHJcbiAgICAgICAgICAnc3RvcmUnOiBbXHJcbiAgICAgICAgICAgICd6dXN0YW5kJ1xyXG4gICAgICAgICAgXVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8vIE5hbWluZyBwYXR0ZXJuIGZvciBjaHVua3NcclxuICAgICAgICBjaHVua0ZpbGVOYW1lczogJ2Fzc2V0cy9qcy9bbmFtZV0tW2hhc2hdLmpzJyxcclxuICAgICAgICBlbnRyeUZpbGVOYW1lczogJ2Fzc2V0cy9qcy9bbmFtZV0tW2hhc2hdLmpzJyxcclxuICAgICAgICBhc3NldEZpbGVOYW1lczogJ2Fzc2V0cy9bZXh0XS9bbmFtZV0tW2hhc2hdLltleHRdJ1xyXG4gICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIC8vIE1pbmlmaWNhdGlvblxyXG4gICAgbWluaWZ5OiAndGVyc2VyJyxcclxuICAgIHRlcnNlck9wdGlvbnM6IHtcclxuICAgICAgY29tcHJlc3M6IHtcclxuICAgICAgICBkcm9wX2NvbnNvbGU6IHRydWUsIC8vIFJlbW92ZSBjb25zb2xlLmxvZyBpbiBwcm9kdWN0aW9uXHJcbiAgICAgICAgZHJvcF9kZWJ1Z2dlcjogdHJ1ZVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgc2VydmVyOiB7XHJcbiAgICBwb3J0OiA1MTczLFxyXG4gICAgc3RyaWN0UG9ydDogZmFsc2UsXHJcbiAgICBvcGVuOiBmYWxzZVxyXG4gIH0sXHJcblxyXG4gIHByZXZpZXc6IHtcclxuICAgIHBvcnQ6IDQxNzNcclxuICB9XHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXdTLFNBQVMsb0JBQW9CO0FBQ3JVLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFGakIsSUFBTSxtQ0FBbUM7QUFLekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsTUFBTTtBQUFBLEVBQ04sU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBRWpCLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxNQUNwQyxlQUFlLEtBQUssUUFBUSxrQ0FBVyxrQkFBa0I7QUFBQSxNQUN6RCxhQUFhLEtBQUssUUFBUSxrQ0FBVyxnQkFBZ0I7QUFBQSxNQUNyRCxVQUFVLEtBQUssUUFBUSxrQ0FBVyxhQUFhO0FBQUEsTUFDL0MsVUFBVSxLQUFLLFFBQVEsa0NBQVcsYUFBYTtBQUFBLElBQ2pEO0FBQUEsRUFDRjtBQUFBLEVBRUEsT0FBTztBQUFBO0FBQUEsSUFFTCxRQUFRO0FBQUE7QUFBQSxJQUdSLFdBQVc7QUFBQTtBQUFBLElBR1gsdUJBQXVCO0FBQUEsSUFFdkIsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBO0FBQUEsUUFFTixjQUFjO0FBQUE7QUFBQSxVQUVaLGdCQUFnQjtBQUFBLFlBQ2Q7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFVBQ0Y7QUFBQTtBQUFBLFVBR0EsaUJBQWlCO0FBQUEsWUFDZjtBQUFBLFlBQ0E7QUFBQSxVQUNGO0FBQUE7QUFBQSxVQUdBLFNBQVM7QUFBQSxZQUNQO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFBQTtBQUFBLFFBR0EsZ0JBQWdCO0FBQUEsUUFDaEIsZ0JBQWdCO0FBQUEsUUFDaEIsZ0JBQWdCO0FBQUEsTUFDbEI7QUFBQSxJQUNGO0FBQUE7QUFBQSxJQUdBLFFBQVE7QUFBQSxJQUNSLGVBQWU7QUFBQSxNQUNiLFVBQVU7QUFBQSxRQUNSLGNBQWM7QUFBQTtBQUFBLFFBQ2QsZUFBZTtBQUFBLE1BQ2pCO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUVBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLFlBQVk7QUFBQSxJQUNaLE1BQU07QUFBQSxFQUNSO0FBQUEsRUFFQSxTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsRUFDUjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
