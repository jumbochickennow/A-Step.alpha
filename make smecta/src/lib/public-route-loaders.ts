/** Share the same dynamic imports between lazy routes and navigation intent preloading. */
export const publicRouteLoaders = {
  '/opportunities': () => import('../pages/Opportunities'),
  '/guides': () => import('../pages/Guides'),
  '/about': () => import('../pages/About'),
  '/contact': () => import('../pages/Contact'),
  '/resources': () => import('../pages/Resources'),
  '/consultation': () => import('../pages/Prices'),
} as const;

export type PreloadablePublicRoute = keyof typeof publicRouteLoaders;

export function preloadPublicRoute(path: PreloadablePublicRoute) {
  // A failed speculative download must not interrupt navigation. The route's
  // lazy import still handles its own error if the visitor clicks the link.
  void publicRouteLoaders[path]().catch(() => {});
}
