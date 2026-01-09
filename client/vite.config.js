import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: './',  // CRITICAL: Required for Electron packaging
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
    // Pre-defined extensions for faster resolution
    extensions: ['.mjs', '.js', '.jsx', '.json']
  },
  server: {
    port: 5173,
    open: false,
    strictPort: false,
    // CRITICAL: Faster HMR connection
    hmr: {
      overlay: true,
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
      timeout: 30000
    },
    watch: {
      usePolling: false,
      ignored: ['**/node_modules/**', '**/.git/**']
    },
    middlewareMode: false,
    cors: {
      origin: '*',
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE']
    },
    https: false,
    fs: {
      strict: false,
      allow: ['..']
    },
    // FASTER: Pre-transform main files
    warmup: {
      clientFiles: [
        './src/main.jsx',
        './src/App.jsx',
        './src/components/Login.jsx',
        './src/pages/UserDashboard-Enhanced.jsx'
      ],
    },
    // CRITICAL: Headers for faster loading
    headers: {
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    }
  },
  build: {
    outDir: 'dist',
    minify: 'esbuild',
    sourcemap: false,
    reportCompressedSize: false,
    emptyOutDir: true,
    
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router-vendor': ['react-router-dom'],
          'anime-vendor': ['animejs']
        },
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      },
      external: []
    },
    
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    target: 'esnext',
    lib: false
  },
  
  // CRITICAL: Pre-bundle dependencies for MUCH faster startup
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react-router-dom',
      'animejs'
    ],
    exclude: ['node_modules/.vite'],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      },
      jsx: 'automatic',
      jsxDev: true,
      target: 'esnext'
    },
    // CRITICAL: Force pre-bundling on first start
    force: false, // Force rebuild of dependencies to fix slow startup
    // Faster dependency scanning
    entries: ['./src/main.jsx']
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
    '__DEV__': true,
    '__VITE_API_URL__': JSON.stringify('http://localhost:3002'), // Dev server port
    'process.env': {}
  },

  esbuild: {
    jsx: 'automatic',
    jsxInject: undefined,
    jsxFactory: undefined,
    jsxFragment: undefined,
    target: 'esnext',
    // Faster builds
    logLevel: 'error',
    logLimit: 10
  },

  // PERFORMANCE: Caching configuration
  cacheDir: 'node_modules/.vite',
  
  // CRITICAL: Faster module resolution (merged with resolve above)
})
