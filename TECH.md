# Technical Architecture

## Overview

Skills Browser is a single-package Bun application.

- One entrypoint: `src/cli.ts`
- One runtime process: Bun HTTP server + Hono API
- One web app: TanStack React Router SPA bundled from `src/web/index.html`
- One generated CSS artifact for local/build output: `src/web/.generated/globals.css`
- One compiled distribution artifact: standalone binary from `bun build --compile`

## Runtime Structure

### CLI + Server

`src/cli.ts` parses CLI arguments, validates host/port, checks that the port is
available, records the launch directory in `SKILLS_BROWSER_LAUNCH_CWD`, switches
to the application root when running from source, and starts Bun with:

- HTML route for the SPA (`/`)
- Hono fetch handler for API endpoints (`/api/*`)

Supported command:

```bash
skills-browser start [--host <host>] [--port <number>] [--auto]
```

Defaults are `localhost:1996`. `HOST` and `PORT` environment variables are used
when the matching flags are omitted. `--auto` opens the local URL in the system
browser.

### API Layer

`src/server/hono-app.ts` defines API routes:

- `GET /api/health`
- `GET /api/dashboard`
- `POST /api/dashboard/refresh`
- `POST /api/dashboard/remove`
- `POST /api/dashboard/install`
- `POST /api/dashboard/update`
- `POST /api/search`
- `POST /api/skill-details`
- `POST /api/skill-readme`

Domain logic remains in:

- `src/server/skills-command-adapter.ts`
- `src/server/installed-skills-state.ts`
- `src/server/search-skills-state.ts`
- `src/server/skill-details-state.ts`
- `src/server/skill-readme-state.ts`

`src/server/skills-command-adapter.ts` is the only boundary that builds
upstream `skills` CLI commands. It normalizes scope and agent arguments before
running the embedded CLI through Bun.

Installed state is loaded by running `skills list --json` for project and global
scope. Skill lock files are used only to enrich installed skills with managed
metadata such as source, ref, repository, and timestamps. If a refresh fails
after a previous success, the API returns the last successful scope state marked
as stale.

Installed skill detail pages load `SKILL.md` through `/api/skill-readme` by
matching the current installed skill id from CLI-derived state, then reading the
resolved installed path for that skill.

### SPA Layer

The browser app is a client-rendered SPA:

- `src/web/index.html`
- `src/web/main.tsx`
- `src/web/router.tsx`
- `src/web/dashboard-page.tsx`

The SPA uses `fetch` against Hono API routes instead of server-side TanStack Start functions.

Routes are declared manually:

- `/` — dashboard and install dialog
- `/skill/$skillId` — installed skill detail page with rendered `SKILL.md`

TanStack Query owns dashboard, search preview, and installed readme request
caching. `nuqs` keeps filters, install dialog state, search query, and preview
selection in URL search params.

## Styling

- Source styles: `src/web/styles/globals.css`
- Generated styles: `src/web/.generated/globals.css`
- Loaded in: `src/web/index.html` via `<link rel="stylesheet" href="./.generated/globals.css" />`
- Tailwind processing: `scripts/build-styles.ts`, which also copies the Inter Variable font asset into `src/web/assets/`
- Bun static serving also keeps `bun-plugin-tailwind` configured in `bunfig.toml`.
- `src/web/.generated/` is ignored and should not be committed.

Theme is controlled by the `skills-browser-theme` localStorage key and a `dark`
class on `<html>`. Dark mode is the default when no saved theme exists.

## Generated Files

- `scripts/embed-skills.ts` bundles `skills` and `yaml` into `src/server/.generated/skills-bundle.ts`.
- `scripts/build-styles.ts` generates `src/web/.generated/globals.css`.
- Both generated directories are ignored by git.

## Build and Distribution

### Local dev

```bash
bun run dev
```

This runs `embed:skills`, builds CSS once, starts the server through
`portless run --name sb`, and starts the Tailwind watcher.

### Build executable

```bash
bun run build
```

This runs `embed:skills`, builds minified CSS, and compiles `src/cli.ts`.

Output:

```bash
dist/skills-browser
```

Run binary:

```bash
./dist/skills-browser start
```
