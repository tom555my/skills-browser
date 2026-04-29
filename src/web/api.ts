import type {
  DashboardPayload,
  InstallSkillsRequest,
  InstallSkillsResponse,
  InstalledSkillsState,
  SkillDetailsPayload,
  SkillReadmePayload,
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
  parseSkillReadmePayload as parseSkillReadmePayloadSchema,
  parseUpdateSkillsResponse,
} from '../features/skills/schemas';
import type { SkillScope } from '../features/skills/types';

type PayloadParser<T> = (value: unknown) => T | undefined;

const jsonHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const getResponseErrorMessage = (response: Response): string => {
  return `Request failed (${response.status} ${response.statusText})`;
};

const getApiErrorMessage = async (response: Response): Promise<string> => {
  const payload = await response.json().catch(() => undefined);
  const error = parseRecord(payload)?.error;
  if (typeof error === 'string') {
    return error;
  }

  return getResponseErrorMessage(response);
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

const parsePayloadResponse = async <T>(
  response: Response,
  parsePayload: PayloadParser<T>,
  invalidMessage: string
): Promise<T> => {
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response));
  }

  const payload = parsePayload(await response.json());

  if (!payload) {
    throw new Error(invalidMessage);
  }

  return payload;
};

const parseMutationResponse = async <T>(response: Response, invalidMessage: string): Promise<T> => {
  return parsePayloadResponse(
    response,
    (value) => {
      const result = mutationResponseSchema.safeParse(value);
      return result.success ? (result.data as T) : undefined;
    },
    invalidMessage
  );
};

const postJson = (url: string, body: unknown): Promise<Response> => {
  return fetch(url, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
};

const parseDashboardPayload = (response: Response): Promise<DashboardPayload> => {
  return parsePayloadResponse(response, parseDashboardPayloadSchema, 'Invalid API response.');
};

const parseRemoveInstalledSkillsResponse = (
  response: Response
): Promise<RemoveInstalledSkillsResponse> => {
  return parseMutationResponse(response, 'Invalid remove response.');
};

const parseSearchPayload = (response: Response): Promise<SearchPayload> => {
  return parsePayloadResponse(response, parseSearchPayloadSchema, 'Invalid API response.');
};

const parseSkillDetailsPayload = (response: Response): Promise<SkillDetailsPayload> => {
  return parsePayloadResponse(
    response,
    parseSkillDetailsPayloadSchema,
    'Invalid skill details response.'
  );
};

const parseSkillReadmePayload = (response: Response): Promise<SkillReadmePayload> => {
  return parsePayloadResponse(
    response,
    parseSkillReadmePayloadSchema,
    'Invalid skill readme response.'
  );
};

const parseUpdateResponse = (response: Response): Promise<UpdateSkillsResponse> => {
  return parsePayloadResponse(response, parseUpdateSkillsResponse, 'Invalid update response.');
};

const parseInstallResponse = (response: Response): Promise<InstallSkillsResponse> => {
  return parseMutationResponse(response, 'Invalid install response.');
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
  const response = await postJson('/api/dashboard/remove', {
    names: input.names,
    scope: input.scope,
    agents: input.agents,
    previousState: input.previousState,
  });

  return parseRemoveInstalledSkillsResponse(response);
};

export const updateDashboardSkills = async (
  input: UpdateSkillsRequest
): Promise<UpdateSkillsResponse> => {
  const response = await postJson('/api/dashboard/update', {
    scope: input.scope,
    names: input.names,
  });

  return parseUpdateResponse(response);
};

export const installDashboardSkills = async (
  input: InstallSkillsRequest
): Promise<InstallSkillsResponse> => {
  const response = await postJson('/api/dashboard/install', {
    source: input.source,
    scope: input.scope,
    agents: input.agents,
    skills: input.skills,
    copy: input.copy,
    previousState: input.previousState,
  });

  return parseInstallResponse(response);
};

export const refreshDashboardState = async (
  previousState?: InstalledSkillsState
): Promise<DashboardPayload> => {
  const response = await postJson('/api/dashboard/refresh', {
    previousState,
  });

  return parseDashboardPayload(response);
};

export const searchSkills = async (query: string): Promise<SearchPayload> => {
  const response = await postJson('/api/search', {
    query,
  });

  return parseSearchPayload(response);
};

export const fetchSkillDetails = async (url: string): Promise<SkillDetailsPayload> => {
  const response = await postJson('/api/skill-details', {
    url,
  });

  return parseSkillDetailsPayload(response);
};

export const fetchSkillReadme = async (skillId: string): Promise<SkillReadmePayload> => {
  const response = await postJson('/api/skill-readme', {
    skillId,
  });

  return parseSkillReadmePayload(response);
};
