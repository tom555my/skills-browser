import { Link, Outlet, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';

import { DashboardPage } from './dashboard-page';

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
});

const routeTree = rootRoute.addChildren([indexRoute]);

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
});

function RootLayout() {
  return <Outlet />;
}

function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center gap-3 p-6 text-sm">
      <h1 className="text-lg font-medium">Page not found</h1>
      <p className="text-muted-foreground">The page you requested does not exist.</p>
      <Link className="underline underline-offset-4" to="/">
        Go back home
      </Link>
    </main>
  );
}

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
