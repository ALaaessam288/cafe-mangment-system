import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],

  /*
   * Build straight into the folder Spring actually serves.
   *
   * The default outDir is frontend/dist, and nothing in the pom copied it into
   * src/main/resources/static — so the copy was a manual step someone had to remember.
   * Nobody did, between 26 Aug and 8 Sep: the app served a two-week-old bundle whose CSS
   * did not even contain the console's current class names, so every frontend change in
   * that window was invisible in the running app. emptyOutDir clears the stale hashed
   * assets instead of letting them pile up beside the new ones.
   */
  build: {
    // Relative to this config's root (the frontend folder), so it needs no __dirname.
    outDir: '../src/main/resources/static',
    emptyOutDir: true,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
