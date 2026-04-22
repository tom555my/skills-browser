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

export type SearchResultSkill = {
  id: string;
  source: string;
  owner: string;
  repository: string;
  name: string;
  installs: string | null;
  url: string | null;
};

export type SearchSkillsState = {
  query: string;
  results: SearchResultSkill[];
  command: SkillsCommandResult;
  error: string | null;
  parseWarning: string | null;
  searchedAt: string;
};

export type SearchPayload = {
  searchState: SearchSkillsState;
};

export type UpdateSkillsRequest = {
  scope: SkillScope;
  names?: string[];
};

export type UpdateSkillsResponse = {
  scope: SkillScope;
  command: SkillsCommandResult;
};

export type InstallSkillsRequest = {
  source: string;
  scope: SkillScope;
  agents?: string[];
  skills?: string[];
  copy?: boolean;
  previousState?: InstalledSkillsState;
};

export type InstallSkillsResponse = {
  payload: DashboardPayload;
  command: SkillsCommandResult;
  scope: SkillScope;
};
