import { describe, expect, it } from 'bun:test';

import type { InstalledSkillsState } from '../features/skills/state';
import { loadSkillReadmeState } from './skill-readme-state';

const createInstalledState = (): InstalledSkillsState => {
  return {
    project: {
      scope: 'project',
      skills: [
        {
          id: 'project:find-skills:/tmp/find-skills',
          name: 'find-skills',
          managed: true,
          scope: 'project',
          agents: ['codex'],
          path: '/tmp/find-skills',
        },
      ],
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

describe('skill readme loading', () => {
  it('loads SKILL.md from the installed skill path reported by skills list', async () => {
    const readPaths: string[] = [];
    const readme = await loadSkillReadmeState('project:find-skills:/tmp/find-skills', {
      loadInstalledState: async () => createInstalledState(),
      now: () => new Date('2026-01-02T00:00:00.000Z'),
      readFile: async (path) => {
        readPaths.push(path);
        return '# Find Skills\n';
      },
    });

    expect(readPaths).toEqual(['/tmp/find-skills/SKILL.md']);
    expect(readme).toEqual({
      skillId: 'project:find-skills:/tmp/find-skills',
      markdown: '# Find Skills\n',
      loadedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it('rejects unknown skill ids before reading files', async () => {
    const readmePromise = loadSkillReadmeState('missing', {
      loadInstalledState: async () => createInstalledState(),
      readFile: async () => '# Find Skills\n',
    });

    await expect(readmePromise).rejects.toThrow('Installed skill was not found.');
  });
});
