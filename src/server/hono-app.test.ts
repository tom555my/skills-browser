import { describe, expect, it } from 'bun:test';

import type { SkillsCommandResult } from '../features/skills/state';
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
