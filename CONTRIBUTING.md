# Contributing to Skills Browser

Skills Browser is a local web UI for managing AI agent skills through the
upstream `skills` CLI. We welcome contributions.

## Getting Started

Skills Browser requires [Bun](https://bun.sh/) >= 1.3.13.

```bash
bun install
bun run dev
```

The dev server starts at `http://localhost:1996`.

## Code Style

- oxfmt for formatting: single quotes, semicolons, 100-column width, trailing commas
- oxlint for linting
- tsgo for typechecking
- Avoid comments unless they explain non-obvious behavior

## Before Submitting a PR

```bash
bun run lint
bun run typecheck
bun run test
```

## Project Structure

- `src/cli.ts` — runtime entrypoint, CLI argument parsing, Bun.serve
- `src/server/` — Hono API routes and skills command adapter
- `src/features/skills/` — shared types and schemas
- `src/web/` — React 19 SPA with TanStack Router

## Architecture Rules

- `npx skills` is the source of truth; never read canonical skill directories directly
- Never pass raw browser-provided shell strings through `src/server/skills-command-adapter.ts`
- Tailwind v4 classes go in `src/web/styles/globals.css`

## License

By contributing, you agree that your contributions will be licensed under the
MIT License.
