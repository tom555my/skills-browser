import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';

import {
  BrowsePage,
  InstalledPage,
  NotFoundPage,
  RootLayout,
  SettingsPage,
  SkillDetailsPage,
} from './dashboard-page';

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

const browseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: BrowsePage,
});

const installedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'installed',
  component: InstalledPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'settings',
  component: SettingsPage,
});

const skillDetailsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'skill/$skillId',
  component: SkillDetailsPage,
});

const routeTree = rootRoute.addChildren([
  browseRoute,
  installedRoute,
  settingsRoute,
  skillDetailsRoute,
]);

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
