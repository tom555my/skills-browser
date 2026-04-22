import { Hono } from 'hono';

import type {
  DashboardPayload,
  InstalledSkillsScopeState,
  InstalledSkillsState,
  SkillsCommandResult,
} from '../features/skills/state';
import type { SkillScope } from '../features/skills/types';
import { loadInstalledSkillsState } from './installed-skills-state';
import { loadSearchSkillsState } from './search-skills-state';
import { createSkillsCommandAdapter } from './skills-command-adapter';

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

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
};

const isScope = (value: unknown): value is SkillScope => {
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

type RemoveDashboardRequest = {
  names: string[];
  scope: SkillScope;
  agents: string[];
  previousState?: InstalledSkillsState;
};

const getRemoveDashboardRequest = (value: unknown): RemoveDashboardRequest | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (!isScope(value.scope)) {
    return null;
  }

  const names = normalizeStringArray(value.names);
  if (names.length === 0) {
    return null;
  }

  return {
    names,
    scope: value.scope,
    agents: normalizeStringArray(value.agents),
    previousState: getPreviousState(value),
  };
};

const createOperationFailureMessage = (result: SkillsCommandResult): string => {
  const exitCode = result.exitCode === null ? 'unknown' : String(result.exitCode);
  const command = result.command.join(' ');
  const stderr = result.stderr.trim();
  const stdout = result.stdout.trim();

  if (stderr.length > 0) {
    return `Command "${command}" failed (exit code ${exitCode}): ${stderr}`;
  }

  if (stdout.length > 0) {
    return `Command "${command}" failed (exit code ${exitCode}): ${stdout}`;
  }

  return `Command "${command}" failed (exit code ${exitCode}).`;
};

const skillsCommandAdapter = createSkillsCommandAdapter();

const getSearchQuery = (value: unknown): string | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  if (typeof value.query !== 'string') {
    return undefined;
  }

  const query = value.query.trim();
  if (query.length === 0) {
    return undefined;
  }

  return query;
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

honoApp.post('/api/dashboard/remove', async (context) => {
  const body = await context.req.json().catch(() => undefined);
  const request = getRemoveDashboardRequest(body);

  if (!request) {
    return context.json(
      {
        error:
          'Invalid remove payload. Provide non-empty names and a valid scope ("project" or "global").',
      },
      400
    );
  }

  const command = await skillsCommandAdapter.removeSkills({
    names: request.names,
    scope: request.scope,
    agents: request.agents,
  });

  const payload = await createDashboardPayload(request.previousState);
  const scopeState = payload.installedState[request.scope];
  payload.installedState[request.scope] = {
    ...scopeState,
    command,
    error: command.ok ? scopeState.error : createOperationFailureMessage(command),
  };

  return context.json({
    payload,
    command,
    scope: request.scope,
  });
});

honoApp.post('/api/search', async (context) => {
  const body = await context.req.json().catch(() => undefined);
  const query = getSearchQuery(body);

  if (!query) {
    return context.json({ error: 'Search query is required.' }, 400);
  }

  return context.json({
    searchState: await loadSearchSkillsState(query),
  });
});
