import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@store': path.resolve(__dirname, './src/store')
    }
  },

  build: {
    // Output directory
    outDir: 'dist',

    // Generate sourcemaps for production debugging
    sourcemap: false,

    // Chunk size warning limit (in KB)
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        // Manual chunks for better code splitting
        manualChunks: {
          // React vendor bundle
          'react-vendor': [
            'react',
            'react-dom',
            'react-router-dom'
          ],

          // UI components bundle
          'ui-components': [
            './src/components/common',
            './src/components/shared'
          ],

          // Zustand store
          'store': [
            'zustand'
          ]
        },

        // Naming pattern for chunks
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },

    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
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
