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

This runs a Tailwind CSS build and starts the app at `http://localhost:1996`.

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
