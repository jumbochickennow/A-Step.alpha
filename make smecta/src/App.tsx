import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { SiteLayout } from './components/layout/SiteLayout';
import { PageLoadingFallback } from './components/common/States';

const Home = lazy(() => import('./pages/Home').then((module) => ({ default: module.Home })));
const Guides = lazy(() => import('./pages/Guides').then((module) => ({ default: module.Guides })));
const Opportunities = lazy(() => import('./pages/Opportunities').then((module) => ({ default: module.Opportunities })));
const About = lazy(() => import('./pages/About').then((module) => ({ default: module.About })));
const Contact = lazy(() => import('./pages/Contact').then((module) => ({ default: module.Contact })));
const Privacy = lazy(() => import('./pages/Privacy').then((module) => ({ default: module.Privacy })));
const Terms = lazy(() => import('./pages/Terms').then((module) => ({ default: module.Terms })));
const Unsubscribe = lazy(() => import('./pages/Unsubscribe').then((module) => ({ default: module.Unsubscribe })));
const NotFound = lazy(() => import('./pages/NotFound').then((module) => ({ default: module.NotFound })));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin').then((module) => ({ default: module.AdminLogin })));
const AdminDashboardRoute = lazy(() => import('./pages/admin/AdminDashboard').then((module) => ({ default: module.AdminDashboardRoute })));
const AdminRedirect = lazy(() => import('./pages/admin/AdminDashboard').then((module) => ({ default: module.AdminRedirect })));

const children = [
  { index: true, element: <Home /> },
  { path: 'guides', element: <Guides /> },
  { path: 'opportunities', element: <Opportunities /> },
  { path: 'about', element: <About /> },
  { path: 'contact', element: <Contact /> },
  { path: 'privacy', element: <Privacy /> },
  { path: 'terms', element: <Terms /> },
  { path: 'unsubscribe', element: <Unsubscribe /> },
  { path: '*', element: <NotFound /> },
];

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  { path: '/', element: <SiteLayout />, children },
  { path: '/fr', element: <SiteLayout />, children },
  { path: '/ar', element: <SiteLayout />, children },
  // Isolated administrative bundles load behind the branded page fallback.
  { path: '/astep-control-vault', element: <Suspense fallback={<PageLoadingFallback />}><AdminLogin /></Suspense> },
  { path: '/astep-control-vault/dashboard', element: <Suspense fallback={<PageLoadingFallback />}><AdminDashboardRoute /></Suspense> },
  { path: '/admin/*', element: <Suspense fallback={<PageLoadingFallback />}><AdminRedirect /></Suspense> },
]);
