import type {
  DashboardPayload,
  InstalledSkillsState,
  SkillsCommandResult,
} from '../features/skills/state';
import type { SkillScope } from '../features/skills/types';

const getErrorMessage = (response: Response): string => {
  return `Request failed (${response.status} ${response.statusText})`;
};

const parseDashboardPayload = async (response: Response): Promise<DashboardPayload> => {
  if (!response.ok) {
    throw new Error(getErrorMessage(response));
  }

  const payload = await response.json();

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid API response.');
  }

  return payload as DashboardPayload;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export type RemoveInstalledSkillsInput = {
  names: string[];
  scope: SkillScope;
  agents?: string[];
  previousState?: InstalledSkillsState;
};

export type RemoveInstalledSkillsResponse = {
  payload: DashboardPayload;
  command: SkillsCommandResult;
  scope: SkillScope;
};

const parseRemoveInstalledSkillsResponse = async (
  response: Response
): Promise<RemoveInstalledSkillsResponse> => {
  if (!response.ok) {
    throw new Error(getErrorMessage(response));
  }

  const payload = await response.json();

  if (!isRecord(payload)) {
    throw new Error('Invalid remove response.');
  }

  if (!isRecord(payload.payload) || !isRecord(payload.command)) {
    throw new Error('Invalid remove response.');
  }

  if (payload.scope !== 'project' && payload.scope !== 'global') {
    throw new Error('Invalid remove response.');
  }

  return payload as RemoveInstalledSkillsResponse;
};

export const fetchDashboardState = async (): Promise<DashboardPayload> => {
  const response = await fetch('/api/dashboard', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  return parseDashboardPayload(response);
};

export const removeInstalledSkills = async (
  input: RemoveInstalledSkillsInput
): Promise<RemoveInstalledSkillsResponse> => {
  const response = await fetch('/api/dashboard/remove', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      names: input.names,
      scope: input.scope,
      agents: input.agents,
      previousState: input.previousState,
    }),
  });

  return parseRemoveInstalledSkillsResponse(response);
};

export const refreshDashboardState = async (
  previousState?: InstalledSkillsState
): Promise<DashboardPayload> => {
  const response = await fetch('/api/dashboard/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      previousState,
    }),
  });

  return parseDashboardPayload(response);
};
