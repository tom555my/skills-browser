import { join } from 'node:path';

import type { InstalledSkillsState, SkillReadmeState } from '../features/skills/state';
import { loadInstalledSkillsState } from './installed-skills-state';

type LoadSkillReadmeStateOptions = {
  loadInstalledState?: typeof loadInstalledSkillsState;
  now?: () => Date;
  readFile?: (path: string) => Promise<string>;
};

const readUtf8File = async (path: string): Promise<string> => {
  return Bun.file(path).text();
};

export const loadSkillReadmeState = async (
  skillId: string,
  options: LoadSkillReadmeStateOptions = {}
): Promise<SkillReadmeState> => {
  const normalizedSkillId = skillId.trim();
  if (normalizedSkillId.length === 0) {
    throw new Error('Skill id is required.');
  }

  const loadInstalledState = options.loadInstalledState ?? loadInstalledSkillsState;
  const installedState: InstalledSkillsState = await loadInstalledState();
  const skill = [...installedState.project.skills, ...installedState.global.skills].find(
    (item) => item.id === normalizedSkillId
  );

  if (!skill) {
    throw new Error('Installed skill was not found.');
  }

  if (!skill.path) {
    throw new Error('Installed skill does not expose a readable path.');
  }

  const readFile = options.readFile ?? readUtf8File;
  const markdown = await readFile(join(skill.path, 'SKILL.md')).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read SKILL.md: ${message}`);
  });

  return {
    skillId: normalizedSkillId,
    markdown,
    loadedAt: (options.now ?? (() => new Date()))().toISOString(),
  };
};
