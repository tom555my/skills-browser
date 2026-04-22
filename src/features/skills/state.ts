import type { InstalledSkill, SkillScope } from './types';

export type SkillsCommandResult = {
  ok: boolean;
  command: string[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

export type InstalledSkillsScopeState = {
  scope: SkillScope;
  skills: InstalledSkill[];
  command: SkillsCommandResult | null;
  error: string | null;
  stale: boolean;
  lastSuccessfulAt: string | null;
};

export type InstalledSkillsState = {
  project: InstalledSkillsScopeState;
  global: InstalledSkillsScopeState;
};

export type DashboardPayload = {
  launchDirectory: string;
  loadedAt: string;
  installedState: InstalledSkillsState;
};

export type UpdateSkillsRequest = {
  scope: SkillScope;
  names?: string[];
};

export type UpdateSkillsResponse = {
  scope: SkillScope;
  command: SkillsCommandResult;
};
