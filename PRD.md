# Skills Browser PRD

## Overview

Skills Browser is a local web UI for developers who use the `skills` CLI from
[skills.sh](https://skills.sh/). It wraps the `skills` command set in a
dashboard-style interface so users can browse, search, install, update, remove,
and inspect AI agent skills without leaving their browser.

The application is launched from the terminal with:

```bash
npx skills-browser start
```

By default, the command starts a local web server on port `1996`. Users can
override the port with `--port`.

## Problem

The `skills` CLI is powerful, but the command-line interface makes it harder to:

- Compare available skills before installing them.
- See which skills are installed across project and global scopes.
- Understand which agents a skill is installed for.
- Review command output, failures, and installation state in a persistent view.
- Manage skills while staying oriented inside a project workspace.

Skills Browser keeps the CLI as the source of truth while providing a faster
visual workflow for common skill management tasks.

## Users

Primary users are developers who install and manage AI agent skills for local
agent tools such as Codex, Claude Code, Cursor, OpenCode, and related developer
assistants.

These users are comfortable with terminal workflows, but want a clean companion
UI for discovery, inspection, and day-to-day management.

## Goals

- Provide a local dashboard for all core `skills` CLI actions.
- Preserve compatibility with the upstream `skills` CLI by executing it on the
  server side instead of reimplementing its behavior.
- Make installed skill state visible across project and global scopes.
- Make search and installation flows faster than typing commands manually.
- Surface command progress, stdout, stderr, and errors clearly.
- Match the existing shadcn/ui-based developer-tool aesthetic.

## Non-Goals

- Do not replace or fork the upstream `skills` CLI.
- Do not host a remote multi-user service.
- Do not sync skill state to a cloud account.
- Do not edit `SKILL.md` content in the first version.
- Do not expose experimental `skills` commands in the first version.
- Do not introduce a separate persistent database unless `skills` CLI output
  proves insufficient.

## Happy Flow

1. User runs `npx skills-browser start`.
2. CLI starts the web server on `http://localhost:1996`.
3. Browser opens or the CLI prints the local URL.
4. User lands on a dashboard showing installed skills and available actions.
5. User searches for a skill using the skills.sh index.
6. User selects a result, reviews details, target scope, and target agents.
7. User installs the skill.
8. The app runs the corresponding `npx skills add ...` command through a server
   function.
9. UI shows progress, command output, and the updated installed skills list.

## Functional Requirements

### CLI Launcher

- Provide `npx skills-browser start`.
- Start the web app on port `1996` by default.
- Support `--port <number>`.
- Support `--host <host>`, defaulting to `localhost`.
- Support `--auto` to open the browser automatically after the server starts.
- Print the local URL after the server starts.
- Fail clearly if the requested port is unavailable.

### Dashboard

- Show project context, including the current working directory.
- Show installed skills grouped or filterable by scope:
  - Project
  - Global
- Show skill metadata when available:
  - Name
  - Source
  - Source type
  - Installed scope
  - Target agents
  - Ref or version information
  - Last updated or installed timestamp when available
- Provide quick actions for search, install, remove, update, and refresh.

### Search and Discovery

- Support searching skills through `npx skills find <query>`.
- Show search results in a scannable list.
- Support opening a result detail view before installation.
- Let users choose target scope and agents before installing.

### Install

- Support installing by source:
  - GitHub shorthand
  - GitHub URL
  - GitLab URL
  - Local path
  - Well-known skill source
- Support target scope:
  - Project
  - Global
- Support target agents with `--agent`.
- Support selecting specific skills with `--skill` when the source contains more
  than one skill.
- Surface install output and errors.
- Refresh installed state after completion.

### List

- Support project list via `npx skills list --json`.
- Support global list via `npx skills list --global --json`.
- Do not read lock files or canonical skill directories directly for installed
  state in the first version.

### Remove

- Support removing one or more skills.
- Support project and global scopes.
- Support target agents with `--agent`.
- Require explicit confirmation before destructive actions.
- Surface remove output and errors.

### Update

- Support updating all skills in a selected scope.
- Support updating selected skills.
- Support project and global scopes.
- Surface update output and errors.

### Command Output

- Show command status:
  - Pending
  - Running
  - Succeeded
  - Failed
- Show stdout and stderr in a readable command log.
- Preserve the most recent command history for the current browser session.
- Do not persist command history across app restarts.
- Never hide a failed command behind a generic error.

## UX Requirements

- Use the existing shadcn/ui visual language.
- Support light and dark themes.
- Use a neutral oklch grayscale palette.
- Prioritize dense, readable management UI over decorative presentation.
- Keep primary workflows available from the first screen.
- Use clear empty states when no skills are installed or no search results exist.
- Make long command output scrollable without shifting the page layout.
- Make destructive actions visually distinct and confirmation-gated.

## Technical Requirements

- Keep the CLI as the source of truth for skill behavior.
- Execute `npx skills` only from server-side code.
- Use Bun's `$` function for server-side command execution.
- Avoid direct client-side shell access.
- Validate command arguments before execution.
- Do not pass arbitrary browser-provided command strings into a shell.
- Respect the current working directory used to launch `skills-browser`.
- Support local-only usage by default.

## Success Metrics

- User can launch the app with one command.
- User can complete search, install, list, update, and remove flows from the UI.
- Installed state matches the output of `npx skills list`.
- Failed CLI commands are visible and actionable.
- Common operations feel instant for local state and responsive for network
  search/install flows.

## Milestones

### M1: Local Launcher and Dashboard

- Implement `npx skills-browser start`.
- Serve the web app on port `1996`.
- Show installed skills for project and global scopes.
- Add manual refresh.

### M2: Search and Install

- Add search UI.
- Add install flow with scope and agent selection.
- Show command progress and output.

### M3: Manage Installed Skills

- Add remove flow.
- Add update flow.
- Add detail views for installed skills.

### M4: Polish and Reliability

- Improve loading, empty, and error states.
- Add command history.
- Add tests for command construction and server functions.
- Verify responsive behavior and dark mode.

## Open Questions

- None currently.
