## Design Context

- **Users:** Developers who install and manage AI agent skills from [skills.sh](https://skills.sh/).
- **Aesthetic:** Clean, technical, minimal developer-tool aesthetic. shadcn/ui defaults are the north star — neutral oklch palette, Inter Variable, generous whitespace, no decoration.
- **Theme:** Light + dark mode (both first-class). Dark class toggled via `skills-browser-theme` localStorage key.
- **Anti-patterns:** Playful, heavy, overly designed consumer aesthetics.

## Commands

```bash
bun run dev          # build CSS + start dev server at localhost:1996
bun run build        # build CSS + compile to dist/skills-browser (single binary)
bun run test         # bun test
bun run lint         # oxlint src
bun run typecheck    # tsc --noEmit
bun run format       # oxfmt src/**/*.{ts,tsx}
```

No CI workflow exists yet. Run `lint → typecheck → test` before committing.

## Architecture

Single-package Bun application. Not a monorepo.

- **`src/cli.ts`** — CLI entrypoint. Only command: `start`. Uses `@clack/prompts`, serves the SPA via `Bun.serve` with Hono for API routes.
- **`src/server/`** — Hono API (`/api/health`, `/api/dashboard`, `/api/dashboard/refresh`).
- **`src/web/`** — React 19 SPA (TanStack React Router, no SSR). HTML entry: `src/web/index.html`, JS entry: `src/web/main.tsx`.
- **`src/web/components/ui/`** — shadcn/ui components (base-ui/react primitives + CVA).
- **`src/web/styles/globals.css`** — Tailwind v4 source. `generated.css` is the build output (committed or regenerated on dev).
- **`src/features/`** — Feature modules (types + state logic), shared between server and web.
- **`src/types/modules.d.ts`** — Declares `*.css` and `*.html` modules for TypeScript.

Build compiles to a single binary: `bun build --compile ./src/cli.ts --outfile ./dist/skills-browser`.

## Key Quirks

- **CSS build:** `build:font` copies Inter woff2 files and runs Tailwind. `generated.css` is imported in `main.tsx` — never edit it directly.
- **shadcn components** use `@base-ui/react` primitives (not Radix). Components live in `src/web/components/ui/`.
- **Tailwind @source** in `globals.css` scans both `../web/` and `../../features/` for class usage.
- **Formatter** is oxfmt (not Prettier). Config in `.oxfmtrc.json`. Sorts Tailwind classes in `cn()`/`cva()` calls.
- **Bun linker** is set to `isolated` in `bunfig.toml`.

## Code Style

- No comments unless asked.
- Single quotes, semicolons, 100 char print width, trailing commas (ES5), LF line endings.
- `cn()` utility in `src/web/lib/utils.ts` for merging Tailwind classes.
