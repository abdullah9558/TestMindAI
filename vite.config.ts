import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Render and other root-domain hosts serve the app from `/`.
  // Set VITE_BASE_PATH=/TestMindAI/ only for a GitHub Pages build.
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    sourcemap: false,
  },
  plugins: [react(), tailwindcss()],
})
