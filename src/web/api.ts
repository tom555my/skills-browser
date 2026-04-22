import type {
  DashboardPayload,
  InstallSkillsRequest,
  InstallSkillsResponse,
  InstalledSkillsState,
  SearchPayload,
  SkillsCommandResult,
  UpdateSkillsRequest,
  UpdateSkillsResponse,
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

const isCommandResult = (value: unknown): value is SkillsCommandResult => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.ok === 'boolean' &&
    Array.isArray(value.command) &&
    typeof value.stdout === 'string' &&
    typeof value.stderr === 'string' &&
    (typeof value.exitCode === 'number' || value.exitCode === null)
  );
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

const parseSearchPayload = async (response: Response): Promise<SearchPayload> => {
  if (!response.ok) {
    throw new Error(getErrorMessage(response));
  }

  const payload = await response.json();

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid API response.');
  }

  return payload as SearchPayload;
};

const parseUpdateResponse = async (response: Response): Promise<UpdateSkillsResponse> => {
  if (!response.ok) {
    const payload = await response.json().catch(() => undefined);
    if (isRecord(payload) && typeof payload.error === 'string') {
      throw new Error(payload.error);
    }

    throw new Error(getErrorMessage(response));
  }

  const payload = await response.json();
  if (!isRecord(payload) || (payload.scope !== 'project' && payload.scope !== 'global')) {
    throw new Error('Invalid update response.');
  }

  if (!isCommandResult(payload.command)) {
    throw new Error('Invalid update response.');
  }

  return payload as UpdateSkillsResponse;
};

const parseInstallResponse = async (response: Response): Promise<InstallSkillsResponse> => {
  if (!response.ok) {
    const payload = await response.json().catch(() => undefined);
    if (isRecord(payload) && typeof payload.error === 'string') {
      throw new Error(payload.error);
    }

    throw new Error(getErrorMessage(response));
  }

  const payload = await response.json();
  if (!isRecord(payload)) {
    throw new Error('Invalid install response.');
  }

  if (!isRecord(payload.payload) || !isCommandResult(payload.command)) {
    throw new Error('Invalid install response.');
  }

  if (payload.scope !== 'project' && payload.scope !== 'global') {
    throw new Error('Invalid install response.');
  }

  return payload as InstallSkillsResponse;
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

export const updateDashboardSkills = async (
  input: UpdateSkillsRequest
): Promise<UpdateSkillsResponse> => {
  const response = await fetch('/api/dashboard/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      scope: input.scope,
      names: input.names,
    }),
  });

  return parseUpdateResponse(response);
};

export const installDashboardSkills = async (
  input: InstallSkillsRequest
): Promise<InstallSkillsResponse> => {
  const response = await fetch('/api/dashboard/install', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      source: input.source,
      scope: input.scope,
      agents: input.agents,
      skills: input.skills,
      copy: input.copy,
      previousState: input.previousState,
    }),
  });

  return parseInstallResponse(response);
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

export const searchSkills = async (query: string): Promise<SearchPayload> => {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query,
    }),
  });

  return parseSearchPayload(response);
};
