# Skills Browser Technical Design

## Architecture

Skills Browser is a Bun workspace with three main areas:

- `apps/cli`: terminal entrypoint for `npx skills-browser start`.
- `apps/web`: TanStack Start web application.
- `packages/ui`: shared shadcn/ui components and global styles.

The browser client never runs shell commands directly. It calls TanStack Start
server functions. Those server functions call the upstream `skills` CLI with
Bun's `$` function and return structured command results to the UI.

```txt
Browser UI
  -> TanStack Start server function
    -> Bun $ command adapter
      -> npx skills <command> [args]
        -> skills lock files and skill directories
```

## Runtime Model

The intended production command is:

```bash
npx skills-browser start --port 1996
```

Defaults:

- Host: `localhost`
- Port: `1996`
- Working directory: the directory where the user launched the command

The host can be overridden with `--host` for remote development environments:

```bash
npx skills-browser start --host 0.0.0.0 --port 1996
```

The launch working directory matters because project-scoped `skills` commands
read and write files relative to the current project, including
`skills-lock.json` and `.agents/skills/`.

Production hosting should use Nitro output for TanStack Start. Configure Nitro
with the Bun preset and start the generated server output:

```ts
// apps/web/vite.config.ts
nitro({ preset: 'bun' })
```

```bash
bun run .output/server/index.mjs
```

## CLI Application

`apps/cli` owns the user-facing terminal command.

Responsibilities:

- Parse `start` options.
- Resolve the port, defaulting to `1996`.
- Resolve the host, defaulting to `localhost`.
- Open the browser after startup when `--auto` is provided.
- Start the web server.
- Pass launch context to the web server:
  - Initial working directory
  - Port
  - Host
- Print the local URL.
- Exit with a clear error when startup fails.

Target command shape:

```bash
npx skills-browser start
npx skills-browser start --port 2000
npx skills-browser start --host 0.0.0.0 --port 1996
npx skills-browser start --auto
```

The package binary should be named `skills-browser` for publishing.

## Web Application

`apps/web` owns the dashboard, routes, server functions, and browser state.

Recommended route structure:

```txt
apps/web/src/routes/
  __root.tsx
  index.tsx
  skills.$skillId.tsx
```

Recommended supporting modules:

```txt
apps/web/src/server/
  skills-cli.ts
  skills-state.ts

apps/web/src/features/skills/
  components/
  hooks/
  types.ts
```

Keep server-only command execution in `apps/web/src/server`. UI components
should consume typed functions and should not build shell commands.

## Command Adapter

Create a narrow adapter around `npx skills`. The adapter should accept
structured arguments and produce a structured result.

Example types:

```ts
type SkillsCommandResult = {
  ok: boolean;
  command: string[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

type SkillScope = 'project' | 'global';
```

The adapter should expose operations instead of a generic shell endpoint:

- `listSkills({ scope, agents })`
- `searchSkills({ query })`, implemented with `npx skills find <query>`
- `installSkill({ source, scope, agents, skills, copy })`
- `removeSkills({ names, scope, agents })`
- `updateSkills({ names, scope })`

Use Bun's `$` function on the server side. Prefer array/structured
interpolation and validated arguments. Do not accept a raw command string from
the client. Use Bun shell's non-throwing mode for command execution so failed
commands can still return stderr and an exit code to the UI.

Conceptual example:

```ts
import { $ } from 'bun';

export async function listProjectSkills() {
  const result = await $`npx skills list --json`.quiet().nothrow();

  return {
    ok: result.exitCode === 0,
    command: ['npx', 'skills', 'list', '--json'],
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    exitCode: result.exitCode,
  };
}
```

For commands with optional arguments, build the argument list in TypeScript,
validate each value, then pass it to the command runner.

## Server Functions

Server functions should be the only boundary exposed to the client.

Recommended functions:

- `getSkillsDashboardState`
- `searchSkills`
- `installSkill`
- `removeSkill`
- `updateSkill`

Each mutation should:

1. Validate input.
2. Run the command adapter.
3. Return stdout, stderr, and status.
4. Refresh or invalidate installed-skill state.

## Installed State

Primary source:

- `npx skills list --json`
- `npx skills list --global --json`

Do not read lock files or canonical skill directories directly for installed
state in the first version. The dashboard should rely on the JSON output from
`npx skills list` so upstream CLI behavior remains the source of truth.

## Data Shapes

Recommended normalized skill shape:

```ts
type InstalledSkill = {
  id: string;
  name: string;
  source?: string;
  sourceType?: string;
  scope: 'project' | 'global';
  agents: string[];
  ref?: string;
  path?: string;
  installedAt?: string;
  updatedAt?: string;
};
```

Recommended command log shape:

```ts
type CommandLogEntry = {
  id: string;
  operation: 'list' | 'search' | 'install' | 'remove' | 'update';
  command: string[];
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  stdout: string;
  stderr: string;
  exitCode: number | null;
  startedAt: string;
  finishedAt?: string;
};
```

Command log entries are session-only browser state. Do not persist command
history to disk in the first version.

## UI Composition

Use `packages/ui` for shared shadcn/ui components. Add new components with:

```bash
bunx shadcn@latest add <component> -c apps/web
```

The product should stay close to shadcn defaults:

- Inter Variable
- Neutral oklch grayscale tokens
- First-class light and dark themes
- Minimal layout
- Clear tables, lists, dialogs, and forms

Expected dashboard regions:

- Header with project path and refresh action.
- Sidebar or tab list for installed, search, and command history.
- Main content list/table for skills.
- Detail panel or route for selected skill.
- Command output panel for recent operations.

## Validation and Safety

The app runs local commands, so the server boundary must be strict.

Rules:

- Never expose a raw shell endpoint.
- Whitelist supported operations.
- Validate scope values.
- Validate port range in the CLI.
- Validate agents against the supported values returned by the app or
  documented by `skills`.
- Treat sources as arguments, not executable command fragments.
- Show the exact command arguments in the UI for transparency.
- Confirm destructive commands before running remove actions.

## Error Handling

Every server function should return command output even when the command fails.

UI states:

- Loading: command in progress.
- Empty: no installed skills or no search results.
- Error: command failed, with stderr and exit code visible.
- Stale: refresh failed, but previous dashboard state is still displayed.

Avoid generic failure messages when stderr is available.

## Testing

Recommended coverage:

- Unit tests for command argument construction.
- Unit tests for JSON parsing.
- Server function tests with the command adapter mocked.
- UI tests for install, remove confirmation, empty states, and failed command
  output.
- Browser smoke test for the dashboard at desktop and mobile widths.

Commands:

```bash
bun run typecheck
bun run lint
bun run build
```

Use `bun test` if test files are added.

## Development Commands

Current workspace commands:

```bash
bun install
bun run dev
bun run dev:cli
bun run typecheck
bun run lint
bun run build
```

The web app currently runs through Vite/TanStack Start during development. The
target launcher should start the Nitro Bun output on the selected host and port
for the packaged `skills-browser` experience.

## Implementation Sequence

1. Replace the starter CLI with a `start` command.
2. Configure the web server launcher to use host `localhost` and port `1996` by
   default, with `--host`, `--port`, and `--auto` overrides.
3. Add a server-side `skills` command adapter.
4. Add dashboard state loading for project and global installed skills.
5. Build the dashboard UI.
6. Add search and install flows.
7. Add remove and update flows.
8. Add command history and error display.
9. Add tests for command construction and critical UI flows.

## Open Technical Questions

- None currently.
