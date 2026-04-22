import { Hono } from 'hono';

import type {
  DashboardPayload,
  InstalledSkillsScopeState,
  InstalledSkillsState,
  UpdateSkillsRequest,
  UpdateSkillsResponse,
} from '../features/skills/state';
import type { SkillScope } from '../features/skills/types';
import { loadInstalledSkillsState } from './installed-skills-state';
import { skillsCommandAdapter, type SkillsCommandAdapter } from './skills-command-adapter';

type UpdateSkillsAdapter = Pick<SkillsCommandAdapter, 'updateSkills'>;

type CreateHonoAppOptions = {
  updateAdapter?: UpdateSkillsAdapter;
  loadState?: typeof loadInstalledSkillsState;
};

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

const isSkillScope = (value: unknown): value is SkillScope => {
  return value === 'project' || value === 'global';
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

const normalizeSkillNames = (value: unknown): string[] | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const names = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);

  if (names.length === 0) {
    return null;
  }

  return names;
};

const getUpdateRequest = (value: unknown): UpdateSkillsRequest | null => {
  if (!isRecord(value) || !isSkillScope(value.scope)) {
    return null;
  }

  const names = normalizeSkillNames(value.names);
  if (names === null) {
    return null;
  }

  return {
    scope: value.scope,
    names,
  };
};

const createDashboardPayload = async (
  loadState: typeof loadInstalledSkillsState,
  previousState?: InstalledSkillsState
): Promise<DashboardPayload> => {
  return {
    launchDirectory: getLaunchDirectory(),
    loadedAt: new Date().toISOString(),
    installedState: await loadState({
      previousState,
    }),
  };
};

export const createHonoApp = (options: CreateHonoAppOptions = {}) => {
  const updateAdapter = options.updateAdapter ?? skillsCommandAdapter;
  const loadState = options.loadState ?? loadInstalledSkillsState;
  const app = new Hono();

  app.get('/api/health', (context) => {
    return context.json({ ok: true });
  });

  app.get('/api/dashboard', async (context) => {
    return context.json(await createDashboardPayload(loadState));
  });

  app.post('/api/dashboard/refresh', async (context) => {
    const body = await context.req.json().catch(() => undefined);
    const previousState = getPreviousState(body);

    return context.json(await createDashboardPayload(loadState, previousState));
  });

  app.post('/api/dashboard/update', async (context) => {
    const body = await context.req.json().catch(() => undefined);
    const updateRequest = getUpdateRequest(body);

    if (!updateRequest) {
      return context.json({ error: 'Invalid update request.' }, 400);
    }

    const command = await updateAdapter.updateSkills({
      scope: updateRequest.scope,
      names: updateRequest.names,
    });

    const response: UpdateSkillsResponse = {
      scope: updateRequest.scope,
      command,
    };

    return context.json(response);
  });

  return app;
};

export const honoApp = createHonoApp();
