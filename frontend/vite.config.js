import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this from /llm-council/, not the domain root
  base: '/llm-council/',
  plugins: [react(), tailwindcss()],
})
