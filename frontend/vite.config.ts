import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 700 }, // the lazy-loaded 3D showcase (three.js) is ~640 kB
  server: {
    port: 5174,
    host: true,
  },
})
