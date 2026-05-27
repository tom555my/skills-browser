export type SkillScope = 'project' | 'global';

export type InstalledSkill = {
  id: string;
  name: string;
  managed: boolean;
  source?: string;
  sourceUrl?: string;
  sourceType?: string;
  repository?: string;
  repositoryUrl?: string;
  scope: SkillScope;
  agents: string[];
  ref?: string;
  path?: string;
  installedAt?: string;
  updatedAt?: string;
};
