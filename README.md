# Skills Browser

Local web UI for browsing, installing, updating, and removing AI agent skills
through the upstream `skills` CLI.

## Usage

Skills Browser is distributed as a Bun-powered npm CLI. Install
[Bun](https://bun.sh/) first, then run:

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

Install dependencies:

```bash
bun install
```

Start the development server:

```bash
bun run dev
```

This starts the app at `http://localhost:1996` with Tailwind processed from
`src/web/styles/globals.css` at serve time.

## Release Checks

Before publishing:

```bash
bun run lint
bun run typecheck
bun run test
bun run pack:dry-run
```

`pack:dry-run` runs npm's packaging flow, including the `prepack` script that
embeds the upstream `skills` CLI assets used by the server.

Publish with:

```bash
npm publish
```

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

The compiled binary is for local distribution and is not the npm package entry.
