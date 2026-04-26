import type { ReactNode } from 'react';

import type { DashboardPayload, SkillsCommandResult } from '../../features/skills/state';
import type { InstalledSkill, SkillScope } from '../../features/skills/types';

export type Theme = 'light' | 'dark';
export type ScopeFilter = 'all' | SkillScope;
export type InstalledTab = 'all' | SkillScope;
export type SkillDetailsTab = 'overview' | 'activity' | 'output';
export type SearchStatus = 'idle' | 'pending' | 'success' | 'empty' | 'error';

export type BrowserSkill = InstalledSkill & {
  description: string;
  primarySource: string;
  activityAt: string | null;
  installCommand: string;
};

export type RemoveOutcome = {
  status: 'success' | 'failure';
  scope: SkillScope;
  names: string[];
  command: SkillsCommandResult;
};

export type InstallOutcome = {
  status: 'success' | 'failure';
  source: string;
  scope: SkillScope;
  command: SkillsCommandResult;
};

export type UpdateStatus = {
  tone: 'success' | 'error';
  message: string;
} | null;

export type DashboardDataValue = {
  payload: DashboardPayload | null;
  skills: BrowserSkill[];
  isInitialLoading: boolean;
  isRefreshing: boolean;
  errorMessage: string | null;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
  getSkillById: (skillId: string) => BrowserSkill | undefined;
};

export type StatusTone = 'success' | 'error';
export type StatusMessage = { tone: StatusTone; message: string } | null;
export type ComponentChildren = ReactNode;
