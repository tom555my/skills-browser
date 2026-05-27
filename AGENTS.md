## Product Context

- Local web UI for developers managing AI agent skills from `skills.sh` through the upstream `skills` CLI.
- Keep `npx skills` as the source of truth; do not read canonical skill directories directly for installed state.
- Visual language is shadcn/ui-style developer tooling: neutral oklch palette, Inter Variable, generous whitespace, light and dark modes, no playful/consumer decoration.
- Theme is controlled by the `skills-browser-theme` localStorage key and a `dark` class on `<html>`; dark is the default when no saved theme exists.

## Commands

```bash
bun install          # setup; Bun linker is isolated in bunfig.toml
bun run dev          # embed:skills + build CSS + portless server + CSS watch, localhost:1996
bun run start        # embed:skills + build CSS + NODE_ENV=production bun run src/cli.ts start
bun run build        # embed:skills + build CSS + bun build --compile, outputs ./dist/skills-browser
bun run lint         # oxlint src
bun run typecheck    # embed:skills + tsgo --noEmit
bun run test         # bun test
bun run format       # oxfmt
```

- Run a focused test with `bun test src/server/<name>.test.ts`.
- Before committing: `bun run lint` → `bun run typecheck` → `bun run test`.
- Lefthook enforces pre-commit (lint, format, typecheck) and pre-push (test).
- GitHub Actions CI runs lint → typecheck → test on push/PR to main.
- Release workflow runs CI, bumps version, updates changelog date, builds binaries, publishes npm, and creates a GitHub Release.
- The compiled binary runs as `./dist/skills-browser start`; CLI options are `--host <host>`, `--port <number>`, and `--auto`.
- `HOST` and `PORT` environment variables set CLI defaults when flags are omitted.

## Architecture

- Single-package Bun app, not a monorepo. Package manager is `bun@1.3.13`.
- `src/cli.ts` is the only runtime entrypoint. It validates host/port, saves the launch cwd in `SKILLS_BROWSER_LAUNCH_CWD`, and serves the app with `Bun.serve`.
- `src/server/hono-app.ts` owns API routes: `/api/health`, `/api/dashboard`, `/api/dashboard/refresh`, `/api/dashboard/remove`, `/api/dashboard/install`, `/api/dashboard/update`, `/api/search`, `/api/skill-details`, `/api/skill-readme`.
- `src/server/skills-command-adapter.ts` is the narrow server-side boundary for `npx skills`; never pass raw browser-provided shell strings through it.
- Installed state comes from `skills list --json`; lock files only enrich state with managed metadata.
- `src/server/skill-readme-state.ts` reads an installed skill `SKILL.md` only after resolving the skill from current CLI-derived installed state.
- `src/features/skills/` contains shared types, schemas, and state shapes used by both server and web.
- `src/web/` is a client-rendered React 19 SPA. HTML entry is `src/web/index.html`; JS entry is `src/web/main.tsx`.
- TanStack Router routes are declared manually in `src/web/router.tsx`; there is no generated route tree or SSR.
- Current SPA routes are `/` and `/skill/$skillId`.

## Generated Files

- `scripts/embed-skills.ts` bundles the `skills` and `yaml` packages into `src/server/.generated/skills-bundle.ts` (auto-generated, do not edit).
- `scripts/build-styles.ts` builds Tailwind CSS into `src/web/.generated/globals.css` and copies the Inter Variable font asset into `src/web/assets/`.
- `embed:skills` runs before dev, start, build, typecheck, and prepack.
- Generated directories under `src/server/.generated/` and `src/web/.generated/` are ignored and must not be committed.

## Styling And UI

- Tailwind v4 source lives in `src/web/styles/globals.css`; the browser loads generated CSS from `src/web/.generated/globals.css`.
- `bunfig.toml` also keeps `bun-plugin-tailwind` configured for Bun static serving.
- Do not commit generated CSS.
- `globals.css` uses `@source "../**/*.{ts,tsx}"` and `@source "../../features/**/*.{ts,tsx}"`; classes in shared feature code can affect Tailwind output.
- shadcn config is `components.json` with `style: "base-nova"`, `rsc: false`, Tailwind CSS at `src/web/styles/globals.css`, lucide icons, and aliases under `@/web/...`.
- Existing shadcn UI components in `src/web/components/ui/` use `@base-ui/react` primitives, not Radix.
- Use `cn()` from `src/web/lib/utils.ts` for class merging.

## Code Style

- oxfmt, not Prettier: single quotes, semicolons, 100-column width, trailing commas where valid in ES5, LF endings.
- `.oxfmtrc.json` sorts Tailwind classes in `cn()` and `cva()` calls using `src/web/styles/globals.css` as the Tailwind v4 stylesheet.
- TypeScript is strict with `noUnusedLocals` and `noUnusedParameters`; keep test doubles and imports minimal.
- Avoid comments unless they explain non-obvious behavior.
