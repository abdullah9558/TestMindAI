import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/TestMindAI/',
  build: {
    sourcemap: false,
  },
  plugins: [react(), tailwindcss()],
})