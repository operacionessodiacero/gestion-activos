import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.VITE_BASE || '/gestion-activos/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Gestión de Activos Industriales',
        short_name: 'Activos',
        description: 'Levantamiento, verificación y caracterización de activos físicos',
        lang: 'es',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: { navigateFallback: 'index.html', maximumFileSizeToCacheInBytes: 5_000_000 }
    })
  ],
  build: { chunkSizeWarningLimit: 2000 }
});
