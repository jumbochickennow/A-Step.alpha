import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const environment = loadEnv(mode, process.cwd(), 'VITE_');
    const siteUrl = (process.env.VITE_SITE_URL || environment.VITE_SITE_URL || '').trim().replace(/\/+$/, '');
    let site: URL;
    try { site = new URL(siteUrl); } catch { throw new Error('VITE_SITE_URL must be configured for production builds'); }
    const isLocalhost = /^(?:localhost|127\.0\.0\.1|\[::1\])$/.test(site.hostname);
    const developmentLocalhost = mode === 'development' && isLocalhost;
    if (site.origin !== siteUrl
      || (!developmentLocalhost && site.protocol !== 'https:')
      || (!developmentLocalhost && isLocalhost)) {
      throw new Error('VITE_SITE_URL must be a production HTTPS origin');
    }
    process.env.VITE_SITE_URL = siteUrl;
  }
  return ({
  plugins: [react()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Administrative portal code — including its heavy charting deps —
          // is isolated from public visitor bundles entirely.
          if (
            id.includes('/pages/admin/') || id.includes('\\pages\\admin\\') ||
            id.includes('/components/admin/') || id.includes('\\components\\admin\\') ||
            id.includes('chart.js') || id.includes('react-chartjs-2') || id.includes('@kurkle')
          ) {
            return 'admin-portal';
          }
          if (id.includes('node_modules')) {
            // Precise React core matching so react-i18next / lucide-react /
            // @tanstack do not get swallowed by the bare 'react' substring.
            if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|@remix-run)[\\/]/.test(id)) {
              return 'vendor-react';
            }
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'vendor-i18n';
            }
            if (id.includes('lucide-react') || id.includes('@radix-ui')) {
              return 'vendor-ui';
            }
            return 'vendor-libs';
          }
          return undefined;
        },
      },
    },
  },
  });
});
