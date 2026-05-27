# Skills Browser

Local web UI for browsing, installing, updating, and removing AI agent skills
through the upstream [`skills`](https://github.com/vercel-labs/skills) CLI.

Skills Browser gives you a visual dashboard over your installed skills — see
what's installed, discover new skills from [skills.sh](https://skills.sh),
install with one click, and keep everything up to date. It wraps `npx skills`
so that the CLI remains the source of truth.

## Features

- **Dashboard** — view all installed skills grouped by agent, with status indicators
- **Catalog search** — search the skills.sh catalog and preview skill details before installing
- **One-click install** — install skills from the catalog with a single click
- **Updates** — see which installed skills have updates available and apply them
- **Remove** — remove skills from your agents
- **Dark and light mode** — system-aware with persisted preference
- **Single binary** — compile to a standalone executable with `bun build --compile`

## Usage

Skills Browser requires [Bun](https://bun.sh/) >= 1.3.13.

```bash
npx skills-browser start
```

The app starts at `http://localhost:1996` by default.

Options:

```bash
npx skills-browser start --host localhost --port 1996 --auto
```

`--auto` opens the local URL in your browser after the server starts.

## Development

```bash
bun install
bun run dev
```

The dev server starts at `http://localhost:1996`.

### Before committing

```bash
bun run lint
bun run typecheck
bun run test
```

## Build Single Binary

```bash
bun run build
```

Output:

```bash
dist/skills-browser
```

Run it:

```bash
./dist/skills-browser start
```

## Architecture

- **Runtime:** Bun HTTP server + Hono API (`src/cli.ts`)
- **API:** Hono routes under `/api/*` (`src/server/hono-app.ts`)
- **Client:** React 19 SPA with TanStack Router (`src/web/`)
- **Shared:** Types and schemas (`src/features/skills/`)
- **Build:** Single binary via `bun build --compile`

See [TECH.md](TECH.md) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT — see [LICENSE](LICENSE) for details.
