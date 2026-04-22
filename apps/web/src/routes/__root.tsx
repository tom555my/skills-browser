import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router';

import appCss from '@skills-browser/ui/styles/globals.css?url';

const themeScript = `
(() => {
  try {
    const key = 'skills-browser-theme';
    const savedTheme = localStorage.getItem(key);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme ? savedTheme === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', isDark);
  } catch {}
})();
`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Skills Browser',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
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
