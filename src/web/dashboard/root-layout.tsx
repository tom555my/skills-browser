import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router';
import { Menu, Moon, Package, PackagePlus, RefreshCw, Sun, X } from 'lucide-react';
import { Toaster } from 'sileo';

import { Button, buttonVariants } from '../components/ui/button';
import { INSTALL_DIALOG_EVENT, THEME_STORAGE_KEY } from './constants';
import { AnimatedText, LoadingGlyph } from './components';
import { DashboardDataProvider, useDashboardActions } from './data';
import type { ScopeFilter, Theme } from './types';
import { getThemeFromDom, scopeLabel } from './utils';

export function RootLayout() {
  const [theme, setTheme] = useState<Theme>(getThemeFromDom);

  useEffect(() => {
    setTheme(getThemeFromDom());
  }, []);

  return (
    <DashboardDataProvider>
      <Toaster
        position="top-left"
        offset={{ top: 64, left: 16 }}
        theme="light"
        options={{ duration: 4200, roundness: 8 }}
      />
      <div className="min-h-svh bg-background">
        <NuqsAdapter>
          <TopBar theme={theme} onThemeChange={setTheme} />
          <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            <Outlet />
          </main>
        </NuqsAdapter>
      </div>
    </DashboardDataProvider>
  );
}

function TopBar(props: { theme: Theme; onThemeChange: (theme: Theme) => void }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const navigate = useNavigate();
  const { isRefreshing, refresh } = useDashboardActions();
  const [scopeFilter, setScopeFilter] = useQueryState(
    'scope',
    parseAsStringEnum<ScopeFilter>(['all', 'project', 'global']).withDefault('all')
  );

  const isBrowseActive = pathname === '/' || pathname.startsWith('/skill/');
  const showScopeFilter = pathname === '/';

  const toggleTheme = () => {
    const nextTheme: Theme = props.theme === 'dark' ? 'light' : 'dark';

    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    props.onThemeChange(nextTheme);
  };

  const openInstallDialog = () => {
    if (pathname !== '/') {
      void navigate({
        to: '/',
        search: (previous) => ({ ...previous, install: '1' }),
      });
      return;
    }

    window.dispatchEvent(new Event(INSTALL_DIALOG_EVENT));
  };

  const handleRefresh = () => {
    void refresh().catch(() => undefined);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Package className="size-5" />
            <span className="hidden sm:inline">Skills Browser</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {showScopeFilter ? (
              <div className="hidden items-center rounded-lg border bg-background p-0.5 md:flex">
                {(['all', 'project', 'global'] as ScopeFilter[]).map((scope) => (
                  <Button
                    key={scope}
                    size="sm"
                    variant={scopeFilter === scope ? 'secondary' : 'ghost'}
                    onClick={() => void setScopeFilter(scope)}
                  >
                    {scope === 'all' ? 'All' : scopeLabel(scope)}
                  </Button>
                ))}
              </div>
            ) : null}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openInstallDialog} aria-label="Install a skill">
            <PackagePlus className="size-4" />
            <span className="hidden sm:inline">Install</span>
          </Button>

          <Button
            variant="outline"
            disabled={isRefreshing}
            onClick={handleRefresh}
            aria-label="Refresh installed skills"
          >
            {isRefreshing ? (
              <LoadingGlyph label="Refreshing installed skills" size={14} />
            ) : (
              <RefreshCw className="size-4" />
            )}
            <AnimatedText className="text-left">
              {isRefreshing ? 'Refreshing' : 'Refresh'}
            </AnimatedText>
          </Button>

          <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label="Toggle theme">
            {props.theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <nav className="border-t px-4 py-2 md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            <Link
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className={buttonVariants({
                variant: isBrowseActive ? 'secondary' : 'ghost',
                size: 'sm',
              })}
            >
              Browse
            </Link>
            {showScopeFilter ? (
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-md border bg-background p-1">
                {(['all', 'project', 'global'] as ScopeFilter[]).map((scope) => (
                  <Button
                    key={scope}
                    size="sm"
                    variant={scopeFilter === scope ? 'secondary' : 'ghost'}
                    onClick={() => {
                      void setScopeFilter(scope);
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    {scope === 'all' ? 'All' : scopeLabel(scope)}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
