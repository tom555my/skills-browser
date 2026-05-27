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

    expect(calls).toEqual([['list', '--global', '--agent', 'claude', 'codex', '--json']]);
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
      ['add', 'owner/repo', '--global', '--agent', 'claude', '--skill', 'a', 'b', '--copy'],
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
      ['add', 'owner/repo', '--project', '--agent', 'codex', '--skill', 'do-it'],
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

    expect(calls).toEqual([['remove', 'skill-one', 'skill-two', '--global', '--agent', 'codex']]);
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
