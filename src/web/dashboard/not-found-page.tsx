import { Link } from '@tanstack/react-router';

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[50svh] w-full max-w-xl flex-col justify-center gap-3 p-6 text-sm">
      <h1 className="text-lg font-medium">Page not found</h1>
      <p className="text-muted-foreground">The page you requested does not exist.</p>
      <Link className="underline underline-offset-4" to="/">
        Go back home
      </Link>
    </main>
  );
}
