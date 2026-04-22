import { Hono } from 'hono';

import type {
  DashboardPayload,
  InstalledSkillsScopeState,
  InstalledSkillsState,
} from '../features/skills/state';
import { loadInstalledSkillsState } from './installed-skills-state';

const getLaunchDirectory = () => {
  const fromEnv = process.env.SKILLS_BROWSER_LAUNCH_CWD?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }

  return process.cwd();
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isScopeState = (value: unknown): value is InstalledSkillsScopeState => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.scope === 'project' || value.scope === 'global') &&
    Array.isArray(value.skills) &&
    typeof value.stale === 'boolean' &&
    (typeof value.lastSuccessfulAt === 'string' || value.lastSuccessfulAt === null) &&
    (typeof value.error === 'string' || value.error === null) &&
    (value.command === null || isRecord(value.command))
  );
};

const isInstalledState = (value: unknown): value is InstalledSkillsState => {
  if (!isRecord(value)) {
    return false;
  }

  return isScopeState(value.project) && isScopeState(value.global);
};

const getPreviousState = (value: unknown): InstalledSkillsState | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const previousState = value.previousState;
  if (!isInstalledState(previousState)) {
    return undefined;
  }

  return previousState;
};

const createDashboardPayload = async (
  previousState?: InstalledSkillsState
): Promise<DashboardPayload> => {
  return {
    launchDirectory: getLaunchDirectory(),
    loadedAt: new Date().toISOString(),
    installedState: await loadInstalledSkillsState({
      previousState,
    }),
  };
};

export const honoApp = new Hono();

honoApp.get('/api/health', (context) => {
  return context.json({ ok: true });
});

honoApp.get('/api/dashboard', async (context) => {
  return context.json(await createDashboardPayload());
});

honoApp.post('/api/dashboard/refresh', async (context) => {
  const body = await context.req.json().catch(() => undefined);
  const previousState = getPreviousState(body);

  return context.json(await createDashboardPayload(previousState));
});
