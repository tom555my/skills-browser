---
name: do-it
description: "Execute engineering tasks end-to-end with a standard delivery workflow: gather context, define a concrete plan, implement in small increments, validate behavior, and report outcomes. Use when requests involve building features, fixing bugs, refactoring code, integrating tools, or any 'just do it' coding task that needs reliable execution discipline."
---

# Do-It Workflow

## 1) Align on the target outcome

- Restate the requested outcome in concrete terms.
- Identify explicit constraints (tech stack, style, deadlines, non-goals).
- Infer practical done criteria before writing code.
- Surface blockers that require a user decision before proceeding.

## 2) Gather only the necessary context

- Inspect only the files and docs needed for the task.
- Prefer fast targeted discovery (`rg`, focused file reads, narrow command output).
- Reuse existing project patterns instead of introducing novel structure.
- Summarize key findings before making edits.

## 3) Plan the execution path

- Break the work into a short ordered task list.
- Prioritize the smallest meaningful increment first.
- Declare assumptions that can affect behavior or architecture.
- Revise the plan when new information invalidates assumptions.

## 4) Implement in tight feedback loops

For each task increment:

- Edit the minimum set of files required.
- Keep changes scoped to the user request.
- Preserve existing conventions unless there is a strong reason to deviate.
- Run a focused check immediately after each meaningful change.

## 5) Validate to production quality

- Run targeted tests first, then broader checks as needed.
- Verify edge cases, error paths, and user-visible behavior.
- Validate in-browser for UI work and in-terminal/service context for CLI or backend work.
- State exactly what could not be validated and why.

## 6) Close with a clear handoff

- Summarize what changed and the reason for each major change.
- Report important commands run and relevant results.
- Call out risk, limitations, or follow-up work if present.
- Suggest next steps only when they add clear value.

## Quality Bar

- Finish end-to-end whenever feasible in the same turn.
- Prefer deterministic execution over speculative guidance.
- Avoid unrelated refactors that increase review risk.
- Keep communication concise, factual, and actionable.
