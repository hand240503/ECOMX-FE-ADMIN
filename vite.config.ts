import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      /** Nominatim — thêm User-Agent theo yêu cầu dịch vụ (địa chỉ / geocoding). */
      '/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/nominatim/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader(
              'User-Agent',
              'ecomx-fe/0.0 (geocoding; contact project maintainer)'
            );
          });
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@styles': '/src/styles',
      '@utils': '/src/utils',
      '@data': '/src/data',
      '@hooks': '/src/hooks'
    }
  }
})