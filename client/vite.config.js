import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false, // Don't auto-open browser since we're using Electron
    hmr: {
      overlay: false // Disable error overlay for better performance
    }
  },
  build: {
    outDir: 'dist',
    // Performance optimizations
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true
      }
    },
    // Code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'anime-vendor': ['animejs']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    // Improve build speed
    sourcemap: false,
    reportCompressedSize: false
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom']
  }
})
