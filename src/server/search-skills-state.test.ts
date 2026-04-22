import { describe, expect, it } from 'bun:test';

import type { SkillsCommandResult } from '../features/skills/state';
import { loadSearchSkillsState } from './search-skills-state';

const FIXED_NOW = '2026-04-22T10:00:00.000Z';

const createResult = (
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

describe('search skills state loading', () => {
  it('loads and parses CLI text output with ANSI sequences', async () => {
    const calls: unknown[] = [];
    const adapter = {
      searchSkills: async (options: { query?: string } = {}) => {
        calls.push(options);
        return createResult(['find', 'tanstack'], {
          stdout: [
            '\u001b[38;5;145mdeckardger/tanstack-agent-skills@tanstack-query-best-practices\u001b[0m \u001b[36m3.9K installs\u001b[0m',
            '\u001b[38;5;102m└ https://skills.sh/deckardger/tanstack-agent-skills/tanstack-query-best-practices\u001b[0m',
          ].join('\n'),
        });
      },
    };

    const result = await loadSearchSkillsState(' tanstack ', {
      adapter,
      now: () => new Date(FIXED_NOW),
    });

    expect(calls).toEqual([{ query: 'tanstack' }]);
    expect(result.query).toBe('tanstack');
    expect(result.error).toBeNull();
    expect(result.parseWarning).toBeNull();
    expect(result.searchedAt).toBe(FIXED_NOW);
    expect(result.results).toEqual([
      {
        id: 'deckardger/tanstack-agent-skills@tanstack-query-best-practices:0',
        source: 'deckardger/tanstack-agent-skills@tanstack-query-best-practices',
        owner: 'deckardger',
        repository: 'tanstack-agent-skills',
        name: 'tanstack-query-best-practices',
        installs: '3.9K',
        url: 'https://skills.sh/deckardger/tanstack-agent-skills/tanstack-query-best-practices',
      },
    ]);
  });

  it('returns parse warning when successful output is unstructured', async () => {
    const adapter = {
      searchSkills: async () => {
        return createResult(['find', 'query'], {
          stdout: 'Search complete.',
        });
      },
    };

    const result = await loadSearchSkillsState('query', {
      adapter,
      now: () => new Date(FIXED_NOW),
    });

    expect(result.error).toBeNull();
    expect(result.results).toEqual([]);
    expect(result.parseWarning).toContain('could not be parsed');
  });

  it('returns actionable command failure error when find command fails', async () => {
    const adapter = {
      searchSkills: async () => {
        return createResult(['find', 'query'], {
          ok: false,
          exitCode: 1,
          stderr: 'network unavailable',
        });
      },
    };

    const result = await loadSearchSkillsState('query', {
      adapter,
      now: () => new Date(FIXED_NOW),
    });

    expect(result.results).toEqual([]);
    expect(result.parseWarning).toBeNull();
    expect(result.error).toContain('exit code 1');
    expect(result.error).toContain('stderr: network unavailable');
  });
});
