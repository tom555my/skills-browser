import { describe, expect, it } from 'bun:test';

import type { InstalledSkillsState, SkillsCommandResult } from '../features/skills/state';
import { createHonoApp } from './hono-app';

const createCommandResult = (
  args: readonly string[],
  overrides: Partial<SkillsCommandResult> = {}
): SkillsCommandResult => {
  return {
    ok: true,
    command: ['npx', 'skills', ...args],
    stdout: '',
    stderr: '',
    exitCode: 0,
    ...overrides,
  };
};

const createInstalledState = (): InstalledSkillsState => {
  return {
    project: {
      scope: 'project',
      skills: [],
      command: null,
      error: null,
      stale: false,
      lastSuccessfulAt: '2026-01-01T00:00:00.000Z',
    },
    global: {
      scope: 'global',
      skills: [],
      command: null,
      error: null,
      stale: false,
      lastSuccessfulAt: '2026-01-01T00:00:00.000Z',
    },
  };
};

describe('dashboard update route', () => {
  it('runs update with project scope and no names for update all', async () => {
    const calls: unknown[] = [];
    const app = createHonoApp({
      updateAdapter: {
        updateSkills: async (options = {}) => {
          calls.push(options);
          return createCommandResult(['update', '--project']);
        },
      },
    });

    const response = await app.request(
      new Request('http://localhost/api/dashboard/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scope: 'project' }),
      })
    );

    expect(response.status).toBe(200);
    expect(calls).toEqual([{ scope: 'project', names: undefined }]);
    const body = await response.json();
    expect(body).toEqual({
      scope: 'project',
      command: createCommandResult(['update', '--project']),
    });
  });

  it('normalizes selected names before update execution', async () => {
    const calls: unknown[] = [];
    const app = createHonoApp({
      updateAdapter: {
        updateSkills: async (options = {}) => {
          calls.push(options);
          return createCommandResult(['update', 'adapt', 'do-it', '--global']);
        },
      },
    });

    const response = await app.request(
      new Request('http://localhost/api/dashboard/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scope: 'global',
          names: ['  adapt  ', '', 'do-it'],
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(calls).toEqual([{ scope: 'global', names: ['adapt', 'do-it'] }]);
  });

  it('rejects invalid update payloads with bad scope or empty names', async () => {
    const app = createHonoApp({
      updateAdapter: {
        updateSkills: async () => createCommandResult(['update']),
      },
    });

    const invalidScopeResponse = await app.request(
      new Request('http://localhost/api/dashboard/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scope: 'team' }),
      })
    );
    const invalidNamesResponse = await app.request(
      new Request('http://localhost/api/dashboard/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scope: 'project', names: [' ', ''] }),
      })
    );

    expect(invalidScopeResponse.status).toBe(400);
    expect(invalidNamesResponse.status).toBe(400);
  });
});

describe('dashboard install route', () => {
  it('runs install with source, scope, agents, and skills', async () => {
    const calls: unknown[] = [];
    const app = createHonoApp({
      commandAdapter: {
        installSkill: async (options) => {
          calls.push(options);
          return createCommandResult([
            'add',
            'owner/repo@skill',
            '--global',
            '--agent',
            'codex',
            '--skill',
            'do-it',
          ]);
        },
        removeSkills: async () => createCommandResult(['remove']),
        updateSkills: async () => createCommandResult(['update']),
      },
      loadInstalledState: async () => createInstalledState(),
    });

    const response = await app.request(
      new Request('http://localhost/api/dashboard/install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: ' owner/repo@skill ',
          scope: 'global',
          agents: [' codex '],
          skills: [' do-it '],
          copy: true,
          previousState: createInstalledState(),
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(calls).toEqual([
      {
        source: 'owner/repo@skill',
        scope: 'global',
        agents: ['codex'],
        skills: ['do-it'],
        copy: false,
      },
    ]);
  });

  it('rejects invalid install payloads', async () => {
    const app = createHonoApp({
      commandAdapter: {
        installSkill: async () => createCommandResult(['add']),
        removeSkills: async () => createCommandResult(['remove']),
        updateSkills: async () => createCommandResult(['update']),
      },
      loadInstalledState: async () => createInstalledState(),
    });

    const response = await app.request(
      new Request('http://localhost/api/dashboard/install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: ' ',
          scope: 'project',
        }),
      })
    );

    expect(response.status).toBe(400);
  });
});

describe('dashboard remove route', () => {
  it('removes selected skills from every agent in the selected scope', async () => {
    const calls: unknown[] = [];
    const app = createHonoApp({
      commandAdapter: {
        installSkill: async () => createCommandResult(['add']),
        removeSkills: async (options) => {
          calls.push(options);
          return createCommandResult(['remove', 'animate', '--global', '--yes']);
        },
        updateSkills: async () => createCommandResult(['update']),
      },
      loadInstalledState: async () => createInstalledState(),
    });

    const response = await app.request(
      new Request('http://localhost/api/dashboard/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          names: [' animate '],
          scope: 'global',
          agents: ['Claude Code', 'Cline', 'Warp'],
          previousState: createInstalledState(),
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(calls).toEqual([
      {
        names: ['animate'],
        scope: 'global',
      },
    ]);
  });
});

describe('skill readme route', () => {
  it('returns installed skill markdown by skill id', async () => {
    const app = createHonoApp({
      loadSkillReadme: async (skillId) => ({
        skillId,
        markdown: '# Find Skills\n',
        loadedAt: '2026-01-02T00:00:00.000Z',
      }),
    });

    const response = await app.request(
      new Request('http://localhost/api/skill-readme', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ skillId: 'project:find-skills:/tmp/find-skills' }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      readme: {
        skillId: 'project:find-skills:/tmp/find-skills',
        markdown: '# Find Skills\n',
        loadedAt: '2026-01-02T00:00:00.000Z',
      },
    });
  });

  it('rejects empty skill readme ids', async () => {
    const app = createHonoApp({
      loadSkillReadme: async (skillId) => ({
        skillId,
        markdown: '# Find Skills\n',
        loadedAt: '2026-01-02T00:00:00.000Z',
      }),
    });

    const response = await app.request(
      new Request('http://localhost/api/skill-readme', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ skillId: ' ' }),
      })
    );

    expect(response.status).toBe(400);
  });
});
