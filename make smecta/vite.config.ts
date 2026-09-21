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
  plugins: [react(), {
    name: 'protect-local-api',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith('/api')) return next();
        const origin = request.headers.origin;
        const referer = request.headers.referer;
        let trusted = request.headers['sec-fetch-site'] !== 'cross-site';
        try {
          const expected = `http://${request.headers.host}`;
          if (origin) trusted &&= new URL(origin).origin === expected;
          if (referer) trusted &&= new URL(referer).origin === expected;
          if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method ?? 'GET') && !origin && !referer) trusted = false;
        } catch { trusted = false; }
        if (!trusted) { response.statusCode = 403; response.end('Forbidden'); return; }
        next();
      });
    },
  }],
  server: {
    fs: {
      deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx}', '**/.git/**', '**/.dev.vars*', '**/wrangler.local.json', '**/*passkey*', '**/artifacts/**', '**/.wrangler/**'],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        configure(proxy) {
          // Development only: the browser uses this Vite origin, including LAN preview.
          proxy.on('proxyReq', request => {
            request.setHeader('Origin', 'http://127.0.0.1:8787');
            request.setHeader('Referer', 'http://127.0.0.1:8787/');
          });
        },
      },
    },
  },
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
