import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { SiteLayout } from './components/layout/SiteLayout';
import { PageLoadingFallback } from './components/common/States';
import { publicRouteLoaders } from './lib/public-route-loaders';

if (typeof document !== 'undefined') {
  document.body.classList.remove('overflow-locked');
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  document.documentElement.style.overflow = '';
}

const Home = lazy(() => import('./pages/Home').then((module) => ({ default: module.Home })));
const Guides = lazy(() => publicRouteLoaders['/guides']().then((module) => ({ default: module.Guides })));
const Opportunities = lazy(() => publicRouteLoaders['/opportunities']().then((module) => ({ default: module.Opportunities })));
const Contact = lazy(() => publicRouteLoaders['/contact']().then((module) => ({ default: module.Contact })));
const Prices = lazy(() => publicRouteLoaders['/consultation']().then((module) => ({ default: module.Prices })));
const Resources = lazy(() => publicRouteLoaders['/resources']().then((module) => ({ default: module.Resources })));
const Privacy = lazy(() => import('./pages/Privacy').then((module) => ({ default: module.Privacy })));
const Terms = lazy(() => import('./pages/Terms').then((module) => ({ default: module.Terms })));
const Unsubscribe = lazy(() => import('./pages/Unsubscribe').then((module) => ({ default: module.Unsubscribe })));
const NotFound = lazy(() => import('./pages/NotFound').then((module) => ({ default: module.NotFound })));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin').then((module) => ({ default: module.AdminLogin })));
const AdminDashboardRoute = lazy(() => import('./pages/admin/AdminDashboard').then((module) => ({ default: module.AdminDashboardRoute })));

const children = [
  { index: true, element: <Home /> },
  { path: 'guides', element: <Guides /> },
  { path: 'opportunities', element: <Opportunities /> },
  { path: 'contact', element: <Contact /> },
  { path: 'consultation', element: <Prices /> },
  { path: 'resources', element: <Resources /> },
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
  { path: '/admin', element: <Suspense fallback={<PageLoadingFallback shape="form" />}><AdminLogin /></Suspense> },
  { path: '/admin/dashboard', element: <Suspense fallback={<PageLoadingFallback shape="cards" />}><AdminDashboardRoute /></Suspense> },
]);
