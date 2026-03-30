import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      // FIX: The previous regex was double-applying and producing data-no-data-no-crossorigin.
      // We only want to strip the `crossorigin` attribute from <link> tags that don't need it.
      // The safest approach: strip standalone crossorigin attributes entirely from the HTML.
      name: 'remove-crossorigin',
      transformIndexHtml(html) {
        // Match bare `crossorigin` attribute (with or without value) on any tag
        return html.replace(/\s+crossorigin(?:="[^"]*")?/g, '')
      }
    }
  ],
  base: './',
  server: {
    port: 5174,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Ensure assets use relative paths — critical for Electron file:// protocol
    assetsDir: 'assets',
  },
})
