import type {
  DashboardPayload,
  InstallSkillsRequest,
  InstallSkillsResponse,
  InstalledSkillsState,
  SkillDetailsPayload,
  SearchPayload,
  SkillsCommandResult,
  UpdateSkillsRequest,
  UpdateSkillsResponse,
} from '../features/skills/state';
import {
  mutationResponseSchema,
  parseDashboardPayload as parseDashboardPayloadSchema,
  parseRecord,
  parseSearchPayload as parseSearchPayloadSchema,
  parseSkillDetailsPayload as parseSkillDetailsPayloadSchema,
  parseSkillsCommandResult,
  parseUpdateSkillsResponse,
} from '../features/skills/schemas';
import type { SkillScope } from '../features/skills/types';

const getErrorMessage = (response: Response): string => {
  return `Request failed (${response.status} ${response.statusText})`;
};

const parseDashboardPayload = async (response: Response): Promise<DashboardPayload> => {
  if (!response.ok) {
    throw new Error(getErrorMessage(response));
  }

  const payload = parseDashboardPayloadSchema(await response.json());

  if (!payload) {
    throw new Error('Invalid API response.');
  }

  return payload;
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

  const parsed = mutationResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error('Invalid remove response.');
  }

  return parsed.data as RemoveInstalledSkillsResponse;
};

const parseSearchPayload = async (response: Response): Promise<SearchPayload> => {
  if (!response.ok) {
    throw new Error(getErrorMessage(response));
  }

  const payload = parseSearchPayloadSchema(await response.json());

  if (!payload) {
    throw new Error('Invalid API response.');
  }

  return payload;
};

const parseSkillDetailsPayload = async (response: Response): Promise<SkillDetailsPayload> => {
  if (!response.ok) {
    const payload = await response.json().catch(() => undefined);
    const error = parseRecord(payload)?.error;
    if (typeof error === 'string') {
      throw new Error(error);
    }

    throw new Error(getErrorMessage(response));
  }

  const payload = parseSkillDetailsPayloadSchema(await response.json());

  if (!payload) {
    throw new Error('Invalid skill details response.');
  }

  return payload;
};

const parseUpdateResponse = async (response: Response): Promise<UpdateSkillsResponse> => {
  if (!response.ok) {
    const payload = await response.json().catch(() => undefined);
    const error = parseRecord(payload)?.error;
    if (typeof error === 'string') {
      throw new Error(error);
    }

    throw new Error(getErrorMessage(response));
  }

  const payload = parseUpdateSkillsResponse(await response.json());
  if (!payload) {
    throw new Error('Invalid update response.');
  }

  if (!parseSkillsCommandResult(payload.command)) {
    throw new Error('Invalid update response.');
  }

  return payload;
};

const parseInstallResponse = async (response: Response): Promise<InstallSkillsResponse> => {
  if (!response.ok) {
    const payload = await response.json().catch(() => undefined);
    const error = parseRecord(payload)?.error;
    if (typeof error === 'string') {
      throw new Error(error);
    }

    throw new Error(getErrorMessage(response));
  }

  const parsed = mutationResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error('Invalid install response.');
  }

  return parsed.data as InstallSkillsResponse;
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

export const fetchSkillDetails = async (url: string): Promise<SkillDetailsPayload> => {
  const response = await fetch('/api/skill-details', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      url,
    }),
  });

  return parseSkillDetailsPayload(response);
};
