# Skills Browser

Local web UI for browsing, installing, updating, and removing AI agent skills
through the upstream [`skills`](https://github.com/vercel-labs/skills) CLI.

Skills Browser gives you a visual dashboard over your installed skills — see
what's installed, discover new skills from [skills.sh](https://skills.sh),
preview catalog details, install with one click, and keep everything up to date.
It wraps the upstream `skills` CLI so that `npx skills` remains the source of
truth for installed state.

## Features

- **Dashboard** — view all installed skills grouped by agent, with status indicators
- **Scope filters** — switch between all, project, and global installations
- **Catalog search** — search the skills.sh catalog and preview skill details before installing
- **One-click install** — install catalog or direct-source skills into project or global scope
- **Installed skill details** — inspect metadata and rendered `SKILL.md` instructions
- **Updates** — update individual managed skills
- **Remove** — remove skills from your agents
- **Resilient refresh** — preserve the last successful dashboard state when a refresh fails
- **Dark and light mode** — persisted preference, with dark mode as the default
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
`HOST` and `PORT` environment variables can set the defaults when flags are not
provided.

## Development

```bash
bun install
bun run dev
```

The dev server starts at `http://localhost:1996`.

`bun run dev` embeds the upstream `skills` CLI bundle, builds Tailwind CSS, and
runs the server through `portless run --name sb` while the CSS watcher keeps
`src/web/.generated/globals.css` up to date.

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
- **API:** Hono routes for dashboard, install/remove/update, search, catalog details, and installed `SKILL.md` reads (`src/server/hono-app.ts`)
- **Client:** React 19 SPA with TanStack Router (`src/web/`)
- **Shared:** Types and schemas (`src/features/skills/`)
- **Styling:** Tailwind v4 CSS generated from `src/web/styles/globals.css`
- **Build:** Embedded `skills` bundle, generated CSS, and single binary via `bun build --compile`

See [TECH.md](TECH.md) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT — see [LICENSE](LICENSE) for details.
