import { describe, expect, it } from 'bun:test';

import type { InstalledSkill } from '../features/skills/types';
import type { SkillsCommandResult } from './skills-command-adapter.server';
import {
  loadGlobalInstalledSkills,
  loadInstalledSkillsState,
  loadProjectInstalledSkills,
} from './installed-skills-state.server';

const FIXED_NOW = '2026-04-22T10:00:00.000Z';

const createResult = (
  args: readonly string[],
  overrides: Partial<SkillsCommandResult> = {},
): SkillsCommandResult => {
  return {
    ok: true,
    command: ['npx', 'skills', ...args],
    stdout: '[]',
    stderr: '',
    exitCode: 0,
    ...overrides,
  };
};

const createInstalledSkill = (scope: 'project' | 'global', name: string): InstalledSkill => {
  return {
    id: `${scope}:${name}:${name}`,
    name,
    scope,
    agents: [],
  };
};

describe('installed skills state loading', () => {
  it('loads and normalizes project skills via list --json', async () => {
    const calls: unknown[] = [];
    const adapter = {
      listSkills: async (options = {}) => {
        calls.push(options);

        return createResult(['list', '--json'], {
          stdout: JSON.stringify([
            {
              name: '  do-it  ',
              path: '/tmp/do-it',
              scope: 'project',
              agents: ['Codex', '  ', 123],
              source: 'owner/repo',
              sourceType: 'github',
              ref: 'main',
            },
          ]),
        });
      },
    };

    const result = await loadProjectInstalledSkills({
      adapter,
      now: () => new Date(FIXED_NOW),
    });

    expect(calls).toEqual([{ scope: 'project', json: true }]);
    expect(result.scope).toBe('project');
    expect(result.stale).toBe(false);
    expect(result.error).toBeNull();
    expect(result.lastSuccessfulAt).toBe(FIXED_NOW);
    expect(result.skills).toEqual([
      {
        id: 'project:do-it:/tmp/do-it',
        name: 'do-it',
        path: '/tmp/do-it',
        scope: 'project',
        agents: ['Codex'],
        source: 'owner/repo',
        sourceType: 'github',
        ref: 'main',
      },
    ]);
  });

  it('loads global skills with --global --json', async () => {
    const calls: unknown[] = [];
    const adapter = {
      listSkills: async (options = {}) => {
        calls.push(options);

        return createResult(['list', '--global', '--json'], {
          stdout: JSON.stringify([{ name: 'adapt', agents: ['Claude Code'] }]),
        });
      },
    };

    const result = await loadGlobalInstalledSkills({ adapter, now: () => new Date(FIXED_NOW) });

    expect(calls).toEqual([{ scope: 'global', json: true }]);
    expect(result.scope).toBe('global');
    expect(result.skills).toEqual([
      {
        id: 'global:adapt:0',
        name: 'adapt',
        scope: 'global',
        agents: ['Claude Code'],
      },
    ]);
  });

  it('keeps previous successful project skills visible when JSON parsing fails', async () => {
    const previousSkill = createInstalledSkill('project', 'do-it');
    const adapter = {
      listSkills: async () => {
        return createResult(['list', '--json'], {
          stdout: 'not valid json',
        });
      },
    };

    const result = await loadProjectInstalledSkills({
      adapter,
      previousState: {
        scope: 'project',
        skills: [previousSkill],
        command: null,
        error: null,
        stale: false,
        lastSuccessfulAt: '2026-04-21T08:00:00.000Z',
      },
      now: () => new Date(FIXED_NOW),
    });

    expect(result.skills).toEqual([previousSkill]);
    expect(result.stale).toBe(true);
    expect(result.lastSuccessfulAt).toBe('2026-04-21T08:00:00.000Z');
    expect(result.error).toContain('Failed to parse project skills JSON');
    expect(result.error).toContain('npx skills list --json');
  });

  it('returns actionable command failure errors when list command fails', async () => {
    const adapter = {
      listSkills: async () => {
        return createResult(['list', '--global', '--json'], {
          ok: false,
          exitCode: 1,
          stderr: 'network unavailable',
        });
      },
    };

    const result = await loadGlobalInstalledSkills({ adapter, now: () => new Date(FIXED_NOW) });

    expect(result.skills).toEqual([]);
    expect(result.stale).toBe(false);
    expect(result.lastSuccessfulAt).toBeNull();
    expect(result.error).toContain('exit code 1');
    expect(result.error).toContain('stderr: network unavailable');
  });

  it('loads both scopes and preserves only the failing scope as stale', async () => {
    const calls: string[] = [];
    const adapter = {
      listSkills: async (options: { scope?: 'project' | 'global'; json?: boolean } = {}) => {
        const scope = options.scope === 'global' ? 'global' : 'project';
        calls.push(scope);

        if (scope === 'global') {
          return createResult(['list', '--global', '--json'], {
            stdout: 'invalid',
          });
        }

        return createResult(['list', '--json'], {
          stdout: JSON.stringify([{ name: 'do-it', agents: ['Codex'] }]),
        });
      },
    };

    const result = await loadInstalledSkillsState({
      adapter,
      previousState: {
        project: {
          scope: 'project',
          skills: [createInstalledSkill('project', 'old-project')],
          command: null,
          error: null,
          stale: false,
          lastSuccessfulAt: '2026-04-20T00:00:00.000Z',
        },
        global: {
          scope: 'global',
          skills: [createInstalledSkill('global', 'adapt')],
          command: null,
          error: null,
          stale: false,
          lastSuccessfulAt: '2026-04-20T00:00:00.000Z',
        },
      },
      now: () => new Date(FIXED_NOW),
    });

    expect(calls.sort()).toEqual(['global', 'project']);
    expect(result.project.stale).toBe(false);
    expect(result.project.lastSuccessfulAt).toBe(FIXED_NOW);
    expect(result.project.skills).toEqual([
      {
        id: 'project:do-it:0',
        name: 'do-it',
        scope: 'project',
        agents: ['Codex'],
      },
    ]);
    expect(result.global.stale).toBe(true);
    expect(result.global.skills).toEqual([createInstalledSkill('global', 'adapt')]);
    expect(result.global.lastSuccessfulAt).toBe('2026-04-20T00:00:00.000Z');
  });
});
