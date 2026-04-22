# Technical Architecture

## Overview

Skills Browser is now a single-package Bun application.

- One entrypoint: `src/cli.ts`
- One runtime process: Bun HTTP server + Hono API
- One web app: TanStack React Router SPA bundled from `src/web/index.html`
- One build artifact: standalone binary from `bun build --compile`

## Runtime Structure

### CLI + Server

`src/cli.ts` parses CLI arguments, validates host/port, and starts Bun with:

- HTML route for the SPA (`/`)
- Hono fetch handler for API endpoints (`/api/*`)

### API Layer

`src/server/hono-app.ts` defines API routes:

- `GET /api/health`
- `GET /api/dashboard`
- `POST /api/dashboard/refresh`

Domain logic remains in:

- `src/server/skills-command-adapter.ts`
- `src/server/installed-skills-state.ts`

### SPA Layer

The browser app is a client-rendered SPA:

- `src/web/index.html`
- `src/web/main.tsx`
- `src/web/router.tsx`
- `src/web/dashboard-page.tsx`

The SPA uses `fetch` against Hono API routes instead of server-side TanStack Start functions.

## Styling

- Source styles: `src/web/styles/globals.css`
- Compiled styles: `src/web/styles/generated.css`
- Inter font files copied into `src/web/styles/files/`

`build:css` performs font copy + Tailwind compilation before dev/build/start scripts.

## Build and Distribution

### Local dev

```bash
bun run dev
```

### Build executable

```bash
bun run build
```

Output:

```bash
dist/skills-browser
```

Run binary:

```bash
./dist/skills-browser start
```
