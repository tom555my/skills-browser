import { describe, expect, it } from 'bun:test';

import type { SkillsCommandResult } from '../features/skills/state';
import { createSkillsCommandAdapter } from './skills-command-adapter';

const createResult = (args: readonly string[]): SkillsCommandResult => {
  return {
    ok: true,
    command: ['skills', ...args],
    stdout: '',
    stderr: '',
    exitCode: 0,
  };
};

describe('skills command adapter argument construction', () => {
  it('builds list command args', async () => {
    const calls: string[][] = [];
    const adapter = createSkillsCommandAdapter(async (args) => {
      calls.push([...args]);
      return createResult(args);
    });

    await adapter.listSkills({ scope: 'global', agents: ['claude', 'codex'], json: true });

    expect(calls).toEqual([['list', '--global', '--agent', 'claude-code', 'codex', '--json']]);
  });

  it('builds search command args', async () => {
    const calls: string[][] = [];
    const adapter = createSkillsCommandAdapter(async (args) => {
      calls.push([...args]);
      return createResult(args);
    });

    await adapter.searchSkills({ query: 'tanstack' });

    expect(calls).toEqual([['find', 'tanstack']]);
  });

  it('builds install command args', async () => {
    const calls: string[][] = [];
    const adapter = createSkillsCommandAdapter(async (args) => {
      calls.push([...args]);
      return createResult(args);
    });

    await adapter.installSkill({
      source: 'owner/repo',
      scope: 'global',
      agents: ['claude'],
      skills: ['a', 'b'],
      copy: true,
    });

    expect(calls).toEqual([
      ['add', 'owner/repo', '--global', '--agent', 'claude-code', '--skill', 'a', 'b', '--yes'],
    ]);
  });

  it('builds install command args for project scope', async () => {
    const calls: string[][] = [];
    const adapter = createSkillsCommandAdapter(async (args) => {
      calls.push([...args]);
      return createResult(args);
    });

    await adapter.installSkill({
      source: 'owner/repo',
      scope: 'project',
      agents: ['codex'],
      skills: ['do-it'],
    });

    expect(calls).toEqual([
      ['add', 'owner/repo', '--project', '--agent', 'codex', '--skill', 'do-it', '--yes'],
    ]);
  });

  it('builds remove command args', async () => {
    const calls: string[][] = [];
    const adapter = createSkillsCommandAdapter(async (args) => {
      calls.push([...args]);
      return createResult(args);
    });

    await adapter.removeSkills({
      names: ['skill-one', 'skill-two'],
      scope: 'global',
      agents: ['codex'],
    });

    expect(calls).toEqual([
      ['remove', 'skill-one', 'skill-two', '--global', '--agent', 'codex', '--yes'],
    ]);
  });

  it('normalizes display agent labels before building command args', async () => {
    const calls: string[][] = [];
    const adapter = createSkillsCommandAdapter(async (args) => {
      calls.push([...args]);
      return createResult(args);
    });

    await adapter.removeSkills({
      names: ['animate'],
      scope: 'global',
      agents: ['Claude Code', 'Cline', 'Warp'],
    });

    expect(calls).toEqual([
      ['remove', 'animate', '--global', '--agent', 'claude-code', 'cline', 'warp', '--yes'],
    ]);
  });

  it('preserves wildcard agent selectors for install command args', async () => {
    const calls: string[][] = [];
    const adapter = createSkillsCommandAdapter(async (args) => {
      calls.push([...args]);
      return createResult(args);
    });

    await adapter.installSkill({
      source: 'owner/repo',
      agents: ['*'],
    });

    expect(calls).toEqual([['add', 'owner/repo', '--agent', '*', '--yes']]);
  });

  it('normalizes legacy agent aliases before building command args', async () => {
    const calls: string[][] = [];
    const adapter = createSkillsCommandAdapter(async (args) => {
      calls.push([...args]);
      return createResult(args);
    });

    await adapter.installSkill({
      source: 'owner/repo',
      agents: ['claude', 'copilot', 'gemini', 'deep-agents', 'kimi-code-cli'],
    });

    expect(calls).toEqual([
      [
        'add',
        'owner/repo',
        '--agent',
        'claude-code',
        'github-copilot',
        'gemini-cli',
        'deepagents',
        'kimi-cli',
        '--yes',
      ],
    ]);
  });

  it('builds update command args', async () => {
    const calls: string[][] = [];
    const adapter = createSkillsCommandAdapter(async (args) => {
      calls.push([...args]);
      return createResult(args);
    });

    await adapter.updateSkills({ names: ['skill-one'], scope: 'project' });

    expect(calls).toEqual([['update', 'skill-one', '--project']]);
  });
});
