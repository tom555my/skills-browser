# Skills Browser

A single-package Bun application with:

- `src/cli.ts` as the only entrypoint
- Hono API routes (`/api/*`)
- TanStack React Router SPA served from `src/web/index.html`
- Single-binary output via `bun build --compile`

## Development

```bash
bun run dev
```

This starts the app at `http://localhost:1996` with Tailwind processed from
`src/web/styles/globals.css` at serve time.

## Build Single Binary

```bash
bun run build
```

Output binary:

```bash
dist/skills-browser
```

Run it:

```bash
./dist/skills-browser start
```
