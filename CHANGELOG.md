# Changelog

## [0.1.3] - unreleased

- Local dashboard for browsing, filtering, installing, updating, and removing AI agent skills
- Project and global installed-state loading through the upstream `skills` CLI
- Catalog search with details previews from skills.sh
- Installed skill detail route with rendered `SKILL.md` instructions
- One-click install into project or global scope with optional agent and skill selection
- Individual managed-skill update and installed-skill removal actions
- Stale-state fallback when a dashboard refresh fails after a previous successful load
- Dark and light mode with persisted `skills-browser-theme` preference; dark mode is the default
- Generated Tailwind v4 CSS pipeline and bundled Inter Variable font asset
- Single binary build via `bun build --compile`
