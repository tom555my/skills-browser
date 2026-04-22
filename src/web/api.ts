import type { DashboardPayload, InstalledSkillsState } from '../features/skills/state';

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

export const fetchDashboardState = async (): Promise<DashboardPayload> => {
  const response = await fetch('/api/dashboard', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  return parseDashboardPayload(response);
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
