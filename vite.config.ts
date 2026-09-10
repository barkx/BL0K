import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Bind mounts on Windows and macOS do not deliver filesystem events into a
    // Linux container, so the dev container sets VITE_POLLING=1 to get HMR.
    watch: process.env.VITE_POLLING === '1' ? { usePolling: true, interval: 300 } : undefined,
  },
})
