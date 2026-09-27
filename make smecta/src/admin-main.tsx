import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { RouterProvider } from 'react-router-dom';
import { adminRouter } from './AdminApp';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ToastProvider } from './components/ui/Toast';
import './i18n';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/globals.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider><RouterProvider router={adminRouter} /></ToastProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  </StrictMode>,
);
