# Skills Browser Implementation Plan

## Ticket SB-001

Status: Done

Title: Replace Starter CLI With `skills-browser start`

Description:
Replace the current demo CLI flow with the production launcher command. The CLI
must expose `npx skills-browser start`, parse startup options, preserve the
working directory where the command was launched, and start the packaged web
server.

Acceptance Criteria:

- CLI supports `start`.
- CLI defaults to host `localhost` and port `1996`.
- CLI supports `--host <host>`.
- CLI supports `--port <number>`.
- CLI supports `--auto` to open the browser after startup.
- CLI prints the final local URL after startup.
- CLI exits with a clear error if the host or port is invalid.
- CLI exits with a clear error if the requested port is unavailable.

Depend On:

- None

## Ticket SB-002

Status: Done

Title: Build TanStack Start With Nitro Bun Output

Description:
Configure the web app for production startup through Nitro Bun output. The
packaged launcher should run the generated server output instead of relying on
the Vite development server.

Acceptance Criteria:

- `apps/web/vite.config.ts` configures Nitro with the Bun preset.
- Production build emits runnable Nitro server output.
- The generated server can be started with Bun.
- The server respects the host and port selected by the CLI launcher.
- Development flow with `bun run dev` remains available.

Depend On:

- SB-001

## Ticket SB-003

Status: Done

Title: Add Server-Side `npx skills` Command Adapter

Description:
Create a narrow server-only command adapter for the upstream `skills` CLI. The
adapter should expose typed operations and execute commands through Bun's `$`
function using `npx skills`.

Acceptance Criteria:

- Adapter lives in a server-only module.
- Adapter exposes typed functions for list, search, install, remove, and update.
- Adapter uses `npx skills` for upstream CLI execution.
- Adapter uses non-throwing command execution so failures return stdout, stderr,
  and exit codes.
- Adapter never accepts raw shell command strings from the client.
- Adapter returns structured command results with command args, stdout, stderr,
  success state, and exit code.
- Unit tests cover command argument construction.

Depend On:

- SB-002

## Ticket SB-004

Status: Not Started

Title: Implement Installed Skills Server State

Description:
Add server functions for loading installed skills from the upstream CLI. The
dashboard must rely only on JSON output from `npx skills list` and must not read
lock files or canonical skill directories directly in the first version.

Acceptance Criteria:

- Server function loads project skills with `npx skills list --json`.
- Server function loads global skills with `npx skills list --global --json`.
- Results are normalized into a shared `InstalledSkill` type.
- JSON parse failures return actionable errors.
- Previous successful state can remain visible when refresh fails.
- No lock-file or direct skill-directory reads are used for installed state.

Depend On:

- SB-003

## Ticket SB-005

Status: Done

Title: Build Dashboard Shell

Description:
Replace the starter home page with the first usable dashboard. The dashboard
should show project context, installed skills, scope filters, refresh controls,
and a command output area using the existing shadcn/ui visual language.

Acceptance Criteria:

- Home route renders the dashboard as the first screen.
- Dashboard shows the launch working directory.
- Dashboard shows project and global installed skills.
- Dashboard supports filtering or grouping by scope.
- Dashboard has a refresh action.
- Empty states are shown when no installed skills exist.
- Loading and failed-refresh states are visible.
- UI supports light and dark themes.
- Layout works at desktop and mobile widths.

Depend On:

- SB-004

## Ticket SB-006

Status: Not Started

Title: Implement Search Flow

Description:
Add search and discovery using the upstream CLI. Search must execute
`npx skills find <query>` from the server side and present results in a
scannable UI.

Acceptance Criteria:

- Search form accepts a query.
- Server function executes `npx skills find <query>`.
- UI shows pending, empty, success, and error states.
- Search output is parsed into displayable results when possible.
- Raw stdout and stderr remain available in the command output panel.
- Search does not call the skills.sh API directly.

Depend On:

- SB-003
- SB-005

## Ticket SB-007

Status: Not Started

Title: Implement Install Flow

Description:
Add a guided install flow from search results or manual source input. Users
should be able to choose scope, target agents, and optional skill filters before
running the install command.

Acceptance Criteria:

- Install can start from a search result.
- Install can start from manual source input.
- User can choose project or global scope.
- User can choose target agents with `--agent`.
- User can provide specific skills with `--skill`.
- Server function executes the corresponding `npx skills add ...` command.
- UI shows pending, success, and failure states.
- Installed skills refresh after successful install.
- Command output is shown for the completed operation.

Depend On:

- SB-004
- SB-006

## Ticket SB-008

Status: Completed

Title: Implement Remove Flow

Description:
Add removal for installed skills with explicit confirmation. Destructive actions
must be confirmation-gated and should clearly show the scope and affected skill
names before execution.

Acceptance Criteria:

- User can select one or more installed skills to remove.
- User can choose project or global scope.
- User can choose target agents with `--agent`.
- Removal requires explicit confirmation.
- Server function executes the corresponding `npx skills remove ...` command.
- UI shows pending, success, and failure states.
- Installed skills refresh after successful removal.
- Command output is shown for the completed operation.

Depend On:

- SB-004
- SB-005

## Ticket SB-009

Status: Not Started

Title: Implement Update Flow

Description:
Add update support for all installed skills in a selected scope and for selected
skills. Updates should be visible as command-backed operations and should
refresh installed state after success.

Acceptance Criteria:

- User can update all skills in project scope.
- User can update all skills in global scope.
- User can update selected skills.
- Server function executes the corresponding `npx skills update ...` command.
- UI shows pending, success, and failure states.
- Installed skills refresh after successful update.
- Command output is shown for the completed operation.

Depend On:

- SB-004
- SB-005

## Ticket SB-010

Status: Not Started

Title: Add Skill Detail View

Description:
Add a detail view for installed skills so users can inspect source, source type,
scope, agents, ref information, and available management actions.

Acceptance Criteria:

- User can open an installed skill detail view.
- Detail view shows all available normalized metadata.
- Detail view exposes relevant remove and update actions.
- Missing metadata is handled gracefully.
- Detail view layout works at desktop and mobile widths.

Depend On:

- SB-005
- SB-008
- SB-009

## Ticket SB-011

Status: Not Started

Title: Harden Validation and Error Handling

Description:
Harden all server and UI boundaries around command execution. The app runs local
commands, so validation must prevent arbitrary shell execution and failures must
be understandable.

Acceptance Criteria:

- Server functions validate operation inputs.
- Scope values are whitelisted.
- Host and port values are validated.
- Agent values are validated before command execution.
- Browser-provided raw shell command strings are rejected by design.
- Failed commands return visible stderr and exit code.
- Destructive actions remain confirmation-gated.
- Experimental `skills` commands are not exposed.

Depend On:

- SB-003
- SB-007
- SB-008
- SB-009
- SB-010

## Ticket SB-012

Status: Not Started

Title: Add Automated Verification

Description:
Add focused tests for command construction, server functions, and critical UI
flows. The test suite should cover the behavior most likely to regress as the
CLI wrapper evolves.

Acceptance Criteria:

- Command adapter unit tests cover list, search, install, remove, and update
  argument construction.
- Server function tests mock the command adapter.
- UI tests cover dashboard empty state.
- UI tests cover failed command output.
- UI tests cover remove confirmation.
- `bun run typecheck` passes.
- `bun run lint` passes.
- `bun run build` passes.

Depend On:

- SB-011

## Ticket SB-013

Status: Not Started

Title: Final UI Polish and Responsive Pass

Description:
Polish spacing, alignment, theme behavior, responsive layout, and interaction
states before shipping the first implementation.

Acceptance Criteria:

- Dashboard follows the existing shadcn/ui visual language.
- Light and dark themes are both reviewed.
- Long command output remains readable and contained.
- Text does not overflow controls at mobile or desktop widths.
- Loading, empty, success, and error states are visually consistent.
- Browser smoke test passes at desktop width.
- Browser smoke test passes at mobile width.

Depend On:

- SB-012
