import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Set VITE_BASE to your repo name when deploying to GitHub Pages,
// e.g. VITE_BASE=/berlin-app3.0/  (leave blank for root deployments)
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/',
})
