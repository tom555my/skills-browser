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

`bun run dev` runs `embed:skills`, builds generated Tailwind CSS, starts the
server with `portless run --name sb`, and keeps CSS in watch mode. Generated
files under `src/server/.generated/` and `src/web/.generated/` are not committed.

## Code Style

- oxfmt for formatting: single quotes, semicolons, 100-column width, trailing commas
- oxlint for linting
- tsgo for typechecking
- Avoid comments unless they explain non-obvious behavior

Format checks in Lefthook use:

```bash
bun x oxfmt --check "src/**/*.{ts,tsx}"
```

## Before Submitting a PR

```bash
bun run lint
bun run typecheck
bun run test
```

Lefthook runs lint, format check, and typecheck before commits. It runs the test
suite before pushes. GitHub Actions runs lint, typecheck, and test on pushes and
pull requests to `main`.

## Project Structure

- `src/cli.ts` — runtime entrypoint, CLI argument parsing, Bun.serve
- `src/server/` — Hono API routes, installed/search/detail state loaders, and skills command adapter
- `src/features/skills/` — shared types and schemas
- `src/web/` — React 19 SPA with TanStack Router
- `scripts/embed-skills.ts` — bundles the upstream `skills` CLI dependency
- `scripts/build-styles.ts` — builds Tailwind CSS and copies Inter font assets

## Architecture Rules

- `npx skills` is the source of truth; never read canonical skill directories directly
- Never pass raw browser-provided shell strings through `src/server/skills-command-adapter.ts`
- Tailwind v4 source CSS lives in `src/web/styles/globals.css`; generated CSS is ignored
- Keep browser-facing API payloads parsed through schemas in `src/features/skills/schemas.ts`

## Releases

The release workflow is manual from GitHub Actions. It runs CI, bumps the npm
version, updates the matching unreleased changelog heading with the release
date, builds Linux and macOS binaries, publishes to npm, and creates a GitHub
Release.

## License

By contributing, you agree that your contributions will be licensed under the
MIT License.
