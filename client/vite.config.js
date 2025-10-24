import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
      jsxImportSource: 'react',
      babel: {
        plugins: [],
      },
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: false,
    strictPort: false, // Try next port if 5173 is busy
    hmr: {
      overlay: true,  // Enable error overlay for debugging
      protocol: 'ws',
      host: 'localhost',
      port: 5173
    },
    watch: {
      usePolling: false,
      ignored: ['**/node_modules/**', '**/.git/**']
    },
    // Middleware optimization
    middlewareMode: false,
    // Connection configuration
    cors: {
      origin: '*',
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE']
    },
    // Faster response for Electron
    https: false,
    // File system watcher settings
    fs: {
      strict: false
    },
    // Ensure warm up
    warmup: {
      clientFiles: ['./src/main.jsx', './src/App.jsx'],
    }
  },
  build: {
    outDir: 'dist',
    // Performance optimizations
    minify: 'esbuild',
    sourcemap: false,
    reportCompressedSize: false,
    emptyOutDir: true,
    
    // Code splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router-vendor': ['react-router-dom'],
          'anime-vendor': ['animejs']
        },
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      },
      // Optimize dependencies
      external: []
    },
    
    // Chunk optimization
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    
    // Speed improvements
    target: 'esnext',
    lib: false
  },
  
  // Pre-bundle dependencies - CRITICAL FOR REACT
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react-router-dom', 'animejs'],
    exclude: ['node_modules/.vite'],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      },
      // Ensure JSX is transformed correctly
      jsx: 'automatic',
      jsxDev: true,
    },
    // Force pre-bundling on server start
    force: false
  },
  
  // CSS optimization
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true
      }
    }
  },
  
  // Performance monitoring
  ssr: false,
  
  // Environmental variables
  define: {
    '__DEV__': true,
    '__VITE_API_URL__': JSON.stringify('http://localhost:3001'),
    'process.env': {}
  },

  // Ensure proper module resolution
  esbuild: {
    jsx: 'automatic',
    jsxInject: undefined, // Don't inject React import
    jsxFactory: undefined,
    jsxFragment: undefined
  }
})
