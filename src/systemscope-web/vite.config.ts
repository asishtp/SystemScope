import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: { outDir: '../SystemScope.Api/wwwroot', emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:5080' } },
})
