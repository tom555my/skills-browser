import type {
  DashboardPayload,
  InstalledSkillsState,
  SkillsCommandResult,
  UpdateSkillsRequest,
  UpdateSkillsResponse,
} from '../features/skills/state';

const getErrorMessage = (response: Response): string => {
  return `Request failed (${response.status} ${response.statusText})`;
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
    throw new Error('Invalid API response.');
  }

  if (!isCommandResult(payload.command)) {
    throw new Error('Invalid API response.');
  }

  return payload as UpdateSkillsResponse;
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

export const updateDashboardSkills = async (
  request: UpdateSkillsRequest
): Promise<UpdateSkillsResponse> => {
  const response = await fetch('/api/dashboard/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(request),
  });

  return parseUpdateResponse(response);
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
