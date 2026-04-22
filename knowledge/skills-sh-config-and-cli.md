# skills.sh: local config storage and CLI usage

This note summarizes how `skills` (https://github.com/vercel-labs/skills) stores data on user devices and how the CLI is used.

## 1) Where data is stored on disk

## Canonical install directories

`skills` keeps a canonical skills directory, then links/copies into agent-specific paths.

- Project scope canonical directory: `<cwd>/.agents/skills/`
- Global scope canonical directory: `~/.agents/skills/`

Source: `src/installer.ts` (`getCanonicalSkillsDir`).

In symlink mode (default when useful), skills are written once to canonical and symlinked into each selected agent dir.
In copy mode (`--copy`), each agent gets its own copy directly.

Source: `src/installer.ts` (`installSkillForAgent`, `installRemoteSkillForAgent`, `installWellKnownSkillForAgent`, `installBlobSkillForAgent`).

## Agent-specific directories

Each agent has:

- `skillsDir` (project relative path under the repo)
- `globalSkillsDir` (absolute path in user home/config)

Definitions are in `src/agents.ts`. Examples:

- Claude Code: project `.claude/skills`, global `~/.claude/skills` (or `$CLAUDE_CONFIG_DIR/skills`)
- Codex: project `.agents/skills`, global `~/.codex/skills` (or `$CODEX_HOME/skills`)
- Cursor: project `.agents/skills`, global `~/.cursor/skills`
- OpenCode: project `.agents/skills`, global `~/.config/opencode/skills` (XDG config home based)

The full supported-agent table is also published in upstream README under "Supported Agents".

## Lock files (actual config/state files)

`skills` uses two lock files:

1. Project lock file
- Path: `<cwd>/skills-lock.json`
- Managed by: `src/local-lock.ts`
- Purpose: project-scoped reproducibility; intended to be committed
- Entry data includes: `source`, `ref?`, `sourceType`, `computedHash`

2. Global lock file
- Path: `$XDG_STATE_HOME/skills/.skill-lock.json` if `XDG_STATE_HOME` is set
- Fallback path: `~/.agents/.skill-lock.json`
- Managed by: `src/skill-lock.ts` and also update flow in `src/cli.ts`
- Entry data includes: `source`, `sourceType`, `sourceUrl`, `ref?`, `skillPath?`, `skillFolderHash`, timestamps
- Also stores UI/state bits: dismissed prompts and `lastSelectedAgents`

## Path-related environment variables

- `XDG_STATE_HOME`: controls global lock location (`.../skills/.skill-lock.json`)
- `XDG_CONFIG_HOME`: influences agents that use XDG config paths (via `xdg-basedir`), e.g. OpenCode/Amp/Goose
- `CODEX_HOME`: overrides Codex global base (default `~/.codex`)
- `CLAUDE_CONFIG_DIR`: overrides Claude Code global base (default `~/.claude`)

Source: `src/agents.ts`, `src/skill-lock.ts`, `src/cli.ts`, `tests/xdg-config-paths.test.ts`.

## 2) CLI usage (implementation-accurate)

Main entry:

- `npx skills <command> [options]`

Source: `src/cli.ts`.

## Commands and aliases

- `add` (aliases: `a`, `install`, `i`)
- `remove` (aliases: `rm`, `r`)
- `list` (alias: `ls`)
- `find` (aliases: `search`, `f`, `s`)
- `update` (aliases: `check`, `upgrade`)
- `init`
- `experimental_install`
- `experimental_sync`

## `add` usage

Typical:

- `npx skills add <source>`

Supported source forms (from parser + README):

- GitHub shorthand: `owner/repo`
- GitHub URL: `https://github.com/owner/repo`
- GitHub tree URL with subpath
- GitLab URL/tree URL
- direct git URL / SSH URL
- local path: `./dir`, `../dir`, absolute path
- well-known HTTP(S) skill hosts (non-GitHub/GitLab URLs)

Extra source syntax:

- `owner/repo@skill-name` (filter skill)
- `#ref` fragment for branch/tag ref (git-like sources)

`add` options:

- `-g, --global`
- `-a, --agent <agents...>`
- `-s, --skill <skills...>`
- `-l, --list`
- `-y, --yes`
- `--copy`
- `--all` (expands to `--skill '*' --agent '*' -y`)
- `--full-depth`
- `--dangerously-accept-openclaw-risks`

Source: `src/add.ts` (`parseAddOptions`, `runAdd`) and README.

## `list` usage

- `npx skills list`
- Defaults to project scope only
- Use `-g` for global scope

Options:

- `-g, --global`
- `-a, --agent <agents...>`
- `--json`

Source: `src/list.ts`.

## `remove` usage

- `npx skills remove [skills...]`

Options:

- `-g, --global`
- `-a, --agent <agents...>`
- `-y, --yes`
- `--all`

Source: `src/remove.ts`.

## `update` usage

- `npx skills update [skills...]`

Options:

- `-g, --global`
- `-p, --project`
- `-y, --yes`

Behavior note:

- With `-y` and no explicit scope flags, it auto-selects `project` if project skills exist, otherwise `global`.

Source: `src/cli.ts` (`parseUpdateOptions`, `resolveUpdateScope`).

## `find` usage

- `npx skills find [query]`
- Uses `https://skills.sh/api/search` by default (override with `SKILLS_API_URL`)
- Interactive mode lets user select and then runs `add`

Source: `src/find.ts`.

## Experimental commands

- `experimental_install`: restores from `skills-lock.json` (project lock)
  - installs non-`node_modules` entries via `add`
  - routes `node_modules` entries through `experimental_sync`
- `experimental_sync`: scans `node_modules` for `SKILL.md`, installs project-scoped skills, updates `skills-lock.json`
  - options: `-a/--agent`, `-y/--yes`, `-f/--force`

Source: `src/install.ts`, `src/sync.ts`.

## 3) Practical implications for our app

For a local skills manager UI/CLI companion, the most reliable files to index are:

- project lock: `<workspace>/skills-lock.json`
- global lock: `$XDG_STATE_HOME/skills/.skill-lock.json` or `~/.agents/.skill-lock.json`
- canonical skill dirs:
  - project: `<workspace>/.agents/skills/`
  - global: `~/.agents/skills/`

Then augment with agent-specific dirs from `src/agents.ts` when you need per-agent linkage visibility.
