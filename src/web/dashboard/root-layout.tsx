import { useEffect, useState } from 'react';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router';
import { Menu, Moon, Package, PackagePlus, RefreshCw, Settings, Sun, X } from 'lucide-react';

import { Button, buttonVariants } from '../components/ui/button';
import { cn } from '../lib/utils';
import { INSTALL_DIALOG_EVENT, THEME_STORAGE_KEY } from './constants';
import { DashboardDataProvider, useDashboardData } from './data';
import type { Theme } from './types';
import { getThemeFromDom } from './utils';

export function RootLayout() {
  return (
    <DashboardDataProvider>
      <div className="min-h-svh bg-background">
        <TopBar />
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <NuqsAdapter>
            <Outlet />
          </NuqsAdapter>
        </main>
      </div>
    </DashboardDataProvider>
  );
}

function TopBar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(getThemeFromDom);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { isRefreshing, refresh } = useDashboardData();

  useEffect(() => {
    setTheme(getThemeFromDom());
  }, []);

  const isBrowseActive = pathname === '/' || pathname.startsWith('/skill/');

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';

    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setTheme(nextTheme);
  };

  const openInstallDialog = () => {
    if (pathname !== '/') {
      window.location.assign('/?install=1');
      return;
    }

    window.dispatchEvent(new Event(INSTALL_DIALOG_EVENT));
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
            <Link
              to="/"
              className={buttonVariants({
                variant: isBrowseActive ? 'secondary' : 'ghost',
                size: 'sm',
              })}
            >
              Browse
            </Link>
            <Link
              to="/installed"
              className={buttonVariants({
                variant: pathname === '/installed' ? 'secondary' : 'ghost',
                size: 'sm',
              })}
            >
              Installed
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={openInstallDialog}
            aria-label="Install a skill"
          >
            <PackagePlus className="size-4" />
            <span className="hidden sm:inline">Install</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={isRefreshing}
            onClick={() => void refresh()}
            aria-label="Refresh installed skills"
          >
            <RefreshCw className={cn('size-4', isRefreshing ? 'animate-spin' : undefined)} />
            <span>{isRefreshing ? 'Refreshing' : 'Refresh'}</span>
          </Button>

          <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          <Link
            to="/settings"
            aria-label="Settings"
            className={buttonVariants({
              variant: pathname === '/settings' ? 'secondary' : 'ghost',
              size: 'icon-sm',
            })}
          >
            <Settings className="size-4" />
          </Link>

          <Button
            variant="ghost"
            size="icon-sm"
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
            <Link
              to="/installed"
              onClick={() => setIsMobileMenuOpen(false)}
              className={buttonVariants({
                variant: pathname === '/installed' ? 'secondary' : 'ghost',
                size: 'sm',
              })}
            >
              Installed
            </Link>
            <Link
              to="/settings"
              onClick={() => setIsMobileMenuOpen(false)}
              className={buttonVariants({
                variant: pathname === '/settings' ? 'secondary' : 'ghost',
                size: 'sm',
              })}
            >
              Settings
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
