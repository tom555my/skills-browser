# shadcn/ui monorepo template

This is a TanStack Start monorepo template with shadcn/ui.

## Development

Start only the web dev server (recommended):

```bash
bun run dev
```

Other development commands:

```bash
bun run dev:all # run all workspace dev scripts in parallel
bun run dev:cli # run the CLI app only
```

## Adding components

To add components to your app, run the following command at the root of your `web` app:

```bash
bunx shadcn@latest add button -c apps/web
```

This will place the ui components in the `packages/ui/src/components` directory.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@skills-browser/ui/components/button";
```
