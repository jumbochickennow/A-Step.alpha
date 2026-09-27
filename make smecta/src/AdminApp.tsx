import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { PageLoadingFallback } from './components/common/States';

const AdminLogin = lazy(() => import('./pages/admin/AdminLogin').then(({ AdminLogin }) => ({ default: AdminLogin })));
const AdminDashboardRoute = lazy(() => import('./pages/admin/AdminDashboard').then(({ AdminDashboardRoute }) => ({ default: AdminDashboardRoute })));

export const adminRouter = createBrowserRouter([
  { path: '/', element: <Navigate to="/admin" replace /> },
  { path: '/admin', element: <Suspense fallback={<PageLoadingFallback shape="form" />}><AdminLogin /></Suspense> },
  { path: '/admin/dashboard', element: <Suspense fallback={<PageLoadingFallback shape="cards" />}><AdminDashboardRoute /></Suspense> },
  { path: '*', element: <Navigate to="/admin" replace /> },
]);
