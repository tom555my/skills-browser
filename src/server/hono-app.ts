import { Hono } from 'hono';

import type {
  DashboardPayload,
  InstallSkillsResponse,
  InstalledSkillsScopeState,
  InstalledSkillsState,
  SkillsCommandResult,
  UpdateSkillsRequest,
  UpdateSkillsResponse,
} from '../features/skills/state';
import type { SkillScope } from '../features/skills/types';
import { loadInstalledSkillsState } from './installed-skills-state';
import { loadSearchSkillsState } from './search-skills-state';
import {
  createSkillsCommandAdapter,
  type SkillsCommandAdapter,
  type InstallSkillOptions,
} from './skills-command-adapter';

type CommandAdapter = Pick<SkillsCommandAdapter, 'installSkill' | 'removeSkills' | 'updateSkills'>;

type CreateHonoAppOptions = {
  commandAdapter?: CommandAdapter;
  updateAdapter?: Pick<SkillsCommandAdapter, 'updateSkills'>;
  loadInstalledState?: typeof loadInstalledSkillsState;
  loadSearchState?: typeof loadSearchSkillsState;
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

type InstallDashboardRequest = InstallSkillOptions & {
  scope: SkillScope;
  previousState?: InstalledSkillsState;
};

const getUpdateDashboardRequest = (value: unknown): UpdateSkillsRequest | null => {
  if (!isRecord(value) || !isScope(value.scope)) {
    return null;
  }

  if (!('names' in value)) {
    return {
      scope: value.scope,
    };
  }

  const names = normalizeStringArray(value.names);
  if (names.length === 0) {
    return null;
  }

  return {
    scope: value.scope,
    names,
  };
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

const getInstallDashboardRequest = (value: unknown): InstallDashboardRequest | null => {
  if (!isRecord(value) || !isScope(value.scope) || typeof value.source !== 'string') {
    return null;
  }

  const source = value.source.trim();
  if (source.length === 0) {
    return null;
  }

  return {
    source,
    scope: value.scope,
    agents: normalizeStringArray(value.agents),
    skills: normalizeStringArray(value.skills),
    copy: value.copy === true,
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

const defaultCommandAdapter = createSkillsCommandAdapter();

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

const createDashboardPayload = async (options: {
  loadInstalledState: typeof loadInstalledSkillsState;
  previousState?: InstalledSkillsState;
}): Promise<DashboardPayload> => {
  return {
    launchDirectory: getLaunchDirectory(),
    loadedAt: new Date().toISOString(),
    installedState: await options.loadInstalledState({
      previousState: options.previousState,
    }),
  };
};

export const createHonoApp = (options: CreateHonoAppOptions = {}) => {
  const commandAdapter: CommandAdapter = {
    installSkill: options.commandAdapter?.installSkill ?? defaultCommandAdapter.installSkill,
    removeSkills: options.commandAdapter?.removeSkills ?? defaultCommandAdapter.removeSkills,
    updateSkills:
      options.commandAdapter?.updateSkills ??
      options.updateAdapter?.updateSkills ??
      defaultCommandAdapter.updateSkills,
  };
  const loadInstalledState = options.loadInstalledState ?? loadInstalledSkillsState;
  const loadSearchState = options.loadSearchState ?? loadSearchSkillsState;
  const app = new Hono();

  app.get('/api/health', (context) => {
    return context.json({ ok: true });
  });

  app.get('/api/dashboard', async (context) => {
    return context.json(
      await createDashboardPayload({
        loadInstalledState,
      })
    );
  });

  app.post('/api/dashboard/refresh', async (context) => {
    const body = await context.req.json().catch(() => undefined);
    const previousState = getPreviousState(body);

    return context.json(
      await createDashboardPayload({
        loadInstalledState,
        previousState,
      })
    );
  });

  app.post('/api/dashboard/remove', async (context) => {
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

    const command = await commandAdapter.removeSkills({
      names: request.names,
      scope: request.scope,
      agents: request.agents,
    });

    const payload = await createDashboardPayload({
      loadInstalledState,
      previousState: request.previousState,
    });
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

  app.post('/api/dashboard/install', async (context) => {
    const body = await context.req.json().catch(() => undefined);
    const request = getInstallDashboardRequest(body);

    if (!request) {
      return context.json(
        {
          error:
            'Invalid install payload. Provide source, scope ("project" or "global"), and optional agent or skill arrays.',
        },
        400
      );
    }

    const command = await commandAdapter.installSkill({
      source: request.source,
      scope: request.scope,
      agents: request.agents,
      skills: request.skills,
      copy: request.copy,
    });

    const payload = await createDashboardPayload({
      loadInstalledState,
      previousState: request.previousState,
    });
    const scopeState = payload.installedState[request.scope];
    payload.installedState[request.scope] = {
      ...scopeState,
      command,
      error: command.ok ? scopeState.error : createOperationFailureMessage(command),
    };

    const response: InstallSkillsResponse = {
      payload,
      command,
      scope: request.scope,
    };

    return context.json(response);
  });

  app.post('/api/dashboard/update', async (context) => {
    const body = await context.req.json().catch(() => undefined);
    const request = getUpdateDashboardRequest(body);

    if (!request) {
      return context.json({ error: 'Invalid update request.' }, 400);
    }

    const command = await commandAdapter.updateSkills({
      scope: request.scope,
      names: request.names,
    });

    const response: UpdateSkillsResponse = {
      scope: request.scope,
      command,
    };

    return context.json(response);
  });

  app.post('/api/search', async (context) => {
    const body = await context.req.json().catch(() => undefined);
    const query = getSearchQuery(body);

    if (!query) {
      return context.json({ error: 'Search query is required.' }, 400);
    }

    return context.json({
      searchState: await loadSearchState(query),
    });
  });

  return app;
};

export const honoApp = createHonoApp();
