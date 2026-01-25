// vite.config.js
import { defineConfig } from "file:///D:/RAYSAN/kmtifmsv2/kmtifmsv2/client/node_modules/vite/dist/node/index.js";
import react from "file:///D:/RAYSAN/kmtifmsv2/kmtifmsv2/client/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "D:\\RAYSAN\\kmtifmsv2\\kmtifmsv2\\client";
var vite_config_default = defineConfig({
  base: "./",
  // CRITICAL: Required for Electron packaging
  plugins: [
    react({
      jsxRuntime: "automatic",
      jsxImportSource: "react",
      babel: {
        plugins: []
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    },
    // Pre-defined extensions for faster resolution
    extensions: [".mjs", ".js", ".jsx", ".json"]
  },
  server: {
    port: 5173,
    open: false,
    strictPort: false,
    // CRITICAL: Faster HMR connection
    hmr: {
      overlay: true,
      protocol: "ws",
      host: "localhost",
      port: 5173,
      timeout: 3e4
    },
    watch: {
      usePolling: false,
      ignored: ["**/node_modules/**", "**/.git/**"]
    },
    middlewareMode: false,
    cors: {
      origin: "*",
      methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"]
    },
    https: false,
    fs: {
      strict: false,
      allow: [".."]
    },
    // FASTER: Pre-transform main files
    warmup: {
      clientFiles: [
        "./src/main.jsx",
        "./src/App.jsx",
        "./src/components/Login.jsx",
        "./src/pages/UserDashboard-Enhanced.jsx"
      ]
    },
    // CRITICAL: Headers for faster loading
    headers: {
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff"
    }
  },
  build: {
    outDir: "dist",
    minify: "esbuild",
    sourcemap: false,
    reportCompressedSize: false,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "router-vendor": ["react-router-dom"],
          "anime-vendor": ["animejs"]
        },
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      },
      external: []
    },
    chunkSizeWarningLimit: 1e3,
    cssCodeSplit: true,
    target: "esnext",
    lib: false
  },
  // CRITICAL: Pre-bundle dependencies for MUCH faster startup
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react-router-dom",
      "animejs"
    ],
    exclude: ["node_modules/.vite"],
    esbuildOptions: {
      define: {
        global: "globalThis"
      },
      jsx: "automatic",
      jsxDev: true,
      target: "esnext"
    },
    // CRITICAL: Force pre-bundling on first start
    force: false,
    // Force rebuild of dependencies to fix slow startup
    // Faster dependency scanning
    entries: ["./src/main.jsx"]
  },
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true
      }
    }
  },
  ssr: false,
  define: {
    "__DEV__": true,
    "__VITE_API_URL__": JSON.stringify("http://localhost:3001"),
    "process.env": {}
  },
  esbuild: {
    jsx: "automatic",
    jsxInject: void 0,
    jsxFactory: void 0,
    jsxFragment: void 0,
    target: "esnext",
    // Faster builds
    logLevel: "error",
    logLimit: 10
  },
  // PERFORMANCE: Caching configuration
  cacheDir: "node_modules/.vite"
  // CRITICAL: Faster module resolution (merged with resolve above)
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxSQVlTQU5cXFxca210aWZtc3YyXFxcXGttdGlmbXN2MlxcXFxjbGllbnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXFJBWVNBTlxcXFxrbXRpZm1zdjJcXFxca210aWZtc3YyXFxcXGNsaWVudFxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovUkFZU0FOL2ttdGlmbXN2Mi9rbXRpZm1zdjIvY2xpZW50L3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBiYXNlOiAnLi8nLCAgLy8gQ1JJVElDQUw6IFJlcXVpcmVkIGZvciBFbGVjdHJvbiBwYWNrYWdpbmdcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCh7XHJcbiAgICAgIGpzeFJ1bnRpbWU6ICdhdXRvbWF0aWMnLFxyXG4gICAgICBqc3hJbXBvcnRTb3VyY2U6ICdyZWFjdCcsXHJcbiAgICAgIGJhYmVsOiB7XHJcbiAgICAgICAgcGx1Z2luczogW10sXHJcbiAgICAgIH0sXHJcbiAgICB9KVxyXG4gIF0sXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMnKSxcclxuICAgIH0sXHJcbiAgICAvLyBQcmUtZGVmaW5lZCBleHRlbnNpb25zIGZvciBmYXN0ZXIgcmVzb2x1dGlvblxyXG4gICAgZXh0ZW5zaW9uczogWycubWpzJywgJy5qcycsICcuanN4JywgJy5qc29uJ11cclxuICB9LFxyXG4gIHNlcnZlcjoge1xyXG4gICAgcG9ydDogNTE3MyxcclxuICAgIG9wZW46IGZhbHNlLFxyXG4gICAgc3RyaWN0UG9ydDogZmFsc2UsXHJcbiAgICAvLyBDUklUSUNBTDogRmFzdGVyIEhNUiBjb25uZWN0aW9uXHJcbiAgICBobXI6IHtcclxuICAgICAgb3ZlcmxheTogdHJ1ZSxcclxuICAgICAgcHJvdG9jb2w6ICd3cycsXHJcbiAgICAgIGhvc3Q6ICdsb2NhbGhvc3QnLFxyXG4gICAgICBwb3J0OiA1MTczLFxyXG4gICAgICB0aW1lb3V0OiAzMDAwMFxyXG4gICAgfSxcclxuICAgIHdhdGNoOiB7XHJcbiAgICAgIHVzZVBvbGxpbmc6IGZhbHNlLFxyXG4gICAgICBpZ25vcmVkOiBbJyoqL25vZGVfbW9kdWxlcy8qKicsICcqKi8uZ2l0LyoqJ11cclxuICAgIH0sXHJcbiAgICBtaWRkbGV3YXJlTW9kZTogZmFsc2UsXHJcbiAgICBjb3JzOiB7XHJcbiAgICAgIG9yaWdpbjogJyonLFxyXG4gICAgICBtZXRob2RzOiBbJ0dFVCcsICdIRUFEJywgJ1BVVCcsICdQQVRDSCcsICdQT1NUJywgJ0RFTEVURSddXHJcbiAgICB9LFxyXG4gICAgaHR0cHM6IGZhbHNlLFxyXG4gICAgZnM6IHtcclxuICAgICAgc3RyaWN0OiBmYWxzZSxcclxuICAgICAgYWxsb3c6IFsnLi4nXVxyXG4gICAgfSxcclxuICAgIC8vIEZBU1RFUjogUHJlLXRyYW5zZm9ybSBtYWluIGZpbGVzXHJcbiAgICB3YXJtdXA6IHtcclxuICAgICAgY2xpZW50RmlsZXM6IFtcclxuICAgICAgICAnLi9zcmMvbWFpbi5qc3gnLFxyXG4gICAgICAgICcuL3NyYy9BcHAuanN4JyxcclxuICAgICAgICAnLi9zcmMvY29tcG9uZW50cy9Mb2dpbi5qc3gnLFxyXG4gICAgICAgICcuL3NyYy9wYWdlcy9Vc2VyRGFzaGJvYXJkLUVuaGFuY2VkLmpzeCdcclxuICAgICAgXSxcclxuICAgIH0sXHJcbiAgICAvLyBDUklUSUNBTDogSGVhZGVycyBmb3IgZmFzdGVyIGxvYWRpbmdcclxuICAgIGhlYWRlcnM6IHtcclxuICAgICAgJ0NhY2hlLUNvbnRyb2wnOiAnbm8tY2FjaGUnLFxyXG4gICAgICAnWC1Db250ZW50LVR5cGUtT3B0aW9ucyc6ICdub3NuaWZmJ1xyXG4gICAgfVxyXG4gIH0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIG91dERpcjogJ2Rpc3QnLFxyXG4gICAgbWluaWZ5OiAnZXNidWlsZCcsXHJcbiAgICBzb3VyY2VtYXA6IGZhbHNlLFxyXG4gICAgcmVwb3J0Q29tcHJlc3NlZFNpemU6IGZhbHNlLFxyXG4gICAgZW1wdHlPdXREaXI6IHRydWUsXHJcbiAgICBcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAncmVhY3QtdmVuZG9yJzogWydyZWFjdCcsICdyZWFjdC1kb20nXSxcclxuICAgICAgICAgICdyb3V0ZXItdmVuZG9yJzogWydyZWFjdC1yb3V0ZXItZG9tJ10sXHJcbiAgICAgICAgICAnYW5pbWUtdmVuZG9yJzogWydhbmltZWpzJ11cclxuICAgICAgICB9LFxyXG4gICAgICAgIGVudHJ5RmlsZU5hbWVzOiAnYXNzZXRzL1tuYW1lXS1baGFzaF0uanMnLFxyXG4gICAgICAgIGNodW5rRmlsZU5hbWVzOiAnYXNzZXRzL1tuYW1lXS1baGFzaF0uanMnLFxyXG4gICAgICAgIGFzc2V0RmlsZU5hbWVzOiAnYXNzZXRzL1tuYW1lXS1baGFzaF1bZXh0bmFtZV0nXHJcbiAgICAgIH0sXHJcbiAgICAgIGV4dGVybmFsOiBbXVxyXG4gICAgfSxcclxuICAgIFxyXG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxMDAwLFxyXG4gICAgY3NzQ29kZVNwbGl0OiB0cnVlLFxyXG4gICAgdGFyZ2V0OiAnZXNuZXh0JyxcclxuICAgIGxpYjogZmFsc2VcclxuICB9LFxyXG4gIFxyXG4gIC8vIENSSVRJQ0FMOiBQcmUtYnVuZGxlIGRlcGVuZGVuY2llcyBmb3IgTVVDSCBmYXN0ZXIgc3RhcnR1cFxyXG4gIG9wdGltaXplRGVwczoge1xyXG4gICAgaW5jbHVkZTogW1xyXG4gICAgICAncmVhY3QnLFxyXG4gICAgICAncmVhY3QtZG9tJyxcclxuICAgICAgJ3JlYWN0L2pzeC1ydW50aW1lJyxcclxuICAgICAgJ3JlYWN0LXJvdXRlci1kb20nLFxyXG4gICAgICAnYW5pbWVqcydcclxuICAgIF0sXHJcbiAgICBleGNsdWRlOiBbJ25vZGVfbW9kdWxlcy8udml0ZSddLFxyXG4gICAgZXNidWlsZE9wdGlvbnM6IHtcclxuICAgICAgZGVmaW5lOiB7XHJcbiAgICAgICAgZ2xvYmFsOiAnZ2xvYmFsVGhpcydcclxuICAgICAgfSxcclxuICAgICAganN4OiAnYXV0b21hdGljJyxcclxuICAgICAganN4RGV2OiB0cnVlLFxyXG4gICAgICB0YXJnZXQ6ICdlc25leHQnXHJcbiAgICB9LFxyXG4gICAgLy8gQ1JJVElDQUw6IEZvcmNlIHByZS1idW5kbGluZyBvbiBmaXJzdCBzdGFydFxyXG4gICAgZm9yY2U6IGZhbHNlLCAvLyBGb3JjZSByZWJ1aWxkIG9mIGRlcGVuZGVuY2llcyB0byBmaXggc2xvdyBzdGFydHVwXHJcbiAgICAvLyBGYXN0ZXIgZGVwZW5kZW5jeSBzY2FubmluZ1xyXG4gICAgZW50cmllczogWycuL3NyYy9tYWluLmpzeCddXHJcbiAgfSxcclxuICBcclxuICBjc3M6IHtcclxuICAgIHByZXByb2Nlc3Nvck9wdGlvbnM6IHtcclxuICAgICAgc2Nzczoge1xyXG4gICAgICAgIHF1aWV0RGVwczogdHJ1ZVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSxcclxuICBcclxuICBzc3I6IGZhbHNlLFxyXG4gIFxyXG4gIGRlZmluZToge1xyXG4gICAgJ19fREVWX18nOiB0cnVlLFxyXG4gICAgJ19fVklURV9BUElfVVJMX18nOiBKU09OLnN0cmluZ2lmeSgnaHR0cDovL2xvY2FsaG9zdDozMDAxJyksXHJcbiAgICAncHJvY2Vzcy5lbnYnOiB7fVxyXG4gIH0sXHJcblxyXG4gIGVzYnVpbGQ6IHtcclxuICAgIGpzeDogJ2F1dG9tYXRpYycsXHJcbiAgICBqc3hJbmplY3Q6IHVuZGVmaW5lZCxcclxuICAgIGpzeEZhY3Rvcnk6IHVuZGVmaW5lZCxcclxuICAgIGpzeEZyYWdtZW50OiB1bmRlZmluZWQsXHJcbiAgICB0YXJnZXQ6ICdlc25leHQnLFxyXG4gICAgLy8gRmFzdGVyIGJ1aWxkc1xyXG4gICAgbG9nTGV2ZWw6ICdlcnJvcicsXHJcbiAgICBsb2dMaW1pdDogMTBcclxuICB9LFxyXG5cclxuICAvLyBQRVJGT1JNQU5DRTogQ2FjaGluZyBjb25maWd1cmF0aW9uXHJcbiAgY2FjaGVEaXI6ICdub2RlX21vZHVsZXMvLnZpdGUnLFxyXG4gIFxyXG4gIC8vIENSSVRJQ0FMOiBGYXN0ZXIgbW9kdWxlIHJlc29sdXRpb24gKG1lcmdlZCB3aXRoIHJlc29sdmUgYWJvdmUpXHJcbn0pXHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBd1MsU0FBUyxvQkFBb0I7QUFDclUsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUZqQixJQUFNLG1DQUFtQztBQUl6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixNQUFNO0FBQUE7QUFBQSxFQUNOLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxNQUNKLFlBQVk7QUFBQSxNQUNaLGlCQUFpQjtBQUFBLE1BQ2pCLE9BQU87QUFBQSxRQUNMLFNBQVMsQ0FBQztBQUFBLE1BQ1o7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQTtBQUFBLElBRUEsWUFBWSxDQUFDLFFBQVEsT0FBTyxRQUFRLE9BQU87QUFBQSxFQUM3QztBQUFBLEVBQ0EsUUFB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
