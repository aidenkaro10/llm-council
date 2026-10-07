import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this from /llm-council/, not the domain root
  base: '/llm-council/',
  plugins: [react()],
})
