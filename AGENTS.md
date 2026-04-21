## Design Context

### Users
Developers who install and manage AI agent skills from [skills.sh](https://skills.sh/). They use a local CLI (`apps/cli` with `@clack/prompts`) that launches a web frontend (`apps/web`) to browse, search, and manage their installed skills.

### Brand Personality
Clean, technical, precise. Think GitHub, Linear, Vercel. The shadcn/ui default aesthetic is the target — neutral palette, Inter font, generous whitespace, no unnecessary decoration.

### Aesthetic Direction
- **Visual tone:** Minimal developer-tool aesthetic
- **Theme:** Light + dark mode (both first-class)
- **Colors:** Neutral oklch grayscale palette (current defaults). No brand color needed yet.
- **Typography:** Inter Variable, clean hierarchy
- **References:** shadcn/ui defaults are the north star
- **Anti-references:** Playful, heavy, overly designed consumer apps

### Design Principles
1. **Utility over ornament** — Every element should serve the user's job of managing skills. No decorative flourishes.
2. **Density with breathing room** — Show enough information to be useful, but don't cram. Use whitespace deliberately.
3. **CLI-first, web-supportive** — The CLI is the primary interface; the web app is the visual companion for browsing/managing.
4. **Neutral & extensible** — Stick to the shadcn/ui design language so it's easy to add components and maintain consistency.
5. **Fast & responsive** — This is a local tool. It should feel instant.

## Project Structure

- `apps/web` — TanStack Start frontend (React 19, shadcn/ui, Tailwind v4)
- `apps/cli` — CLI entrypoint using `@clack/prompts`
- `packages/ui` — Shared UI components (shadcn/ui, base-ui/react primitives)

## Tooling

- **Linter:** oxlint (`oxlint.json`)
- **Formatter:** oxfmt (`.oxfmtrc.json`)
- **Monorepo:** pnpm workspace (no turborepo)
- **Package manager:** pnpm@10.33.0
