export type SkillScope = 'project' | 'global';

export type InstalledSkill = {
  id: string;
  name: string;
  source?: string;
  sourceType?: string;
  scope: SkillScope;
  agents: string[];
  ref?: string;
  path?: string;
  installedAt?: string;
  updatedAt?: string;
};
