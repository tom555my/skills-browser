import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';

import {
  BrowsePage,
  ErrorPage,
  InstalledPage,
  NotFoundPage,
  RootLayout,
  SettingsPage,
  SkillDetailsPage,
} from './dashboard-page';
import type { ScopeFilter } from './dashboard/types';

type BrowseSearch = {
  search?: string;
  scope?: ScopeFilter;
  install?: string;
  q?: string;
  preview?: string;
};

const isScopeFilter = (value: unknown): value is ScopeFilter =>
  value === 'all' || value === 'project' || value === 'global';

const getStringSearchValue = (value: unknown) => (typeof value === 'string' ? value : undefined);

const validateBrowseSearch = (search: Record<string, unknown>): BrowseSearch => ({
  search: getStringSearchValue(search.search),
  scope: isScopeFilter(search.scope) ? search.scope : undefined,
  install: getStringSearchValue(search.install),
  q: getStringSearchValue(search.q),
  preview: getStringSearchValue(search.preview),
});

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

const browseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: validateBrowseSearch,
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
  defaultPreloadDelay: 50,
  defaultPreloadStaleTime: 0,
  defaultErrorComponent: ErrorPage,
  defaultNotFoundComponent: NotFoundPage,
  defaultStructuralSharing: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
