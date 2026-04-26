import { ErrorComponent, Link, useRouter } from '@tanstack/react-router';

import { Button } from '../components/ui/button';

export function ErrorPage({ error }: { error: Error }) {
  const router = useRouter();

  return (
    <main className="mx-auto flex min-h-[50svh] w-full max-w-xl flex-col justify-center gap-4 p-6 text-sm">
      <div className="space-y-2">
        <h1 className="text-lg font-medium">Something went wrong</h1>
        <p className="text-muted-foreground">
          The dashboard could not finish rendering this route.
        </p>
      </div>
      <ErrorComponent error={error} />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => void router.invalidate()}>
          Try again
        </Button>
        <Link className="underline underline-offset-4" to="/">
          Go back home
        </Link>
      </div>
    </main>
  );
}
