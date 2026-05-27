import { Hono, type Context } from 'hono';
import { initLogger } from 'evlog';
import { evlog, type EvlogVariables } from 'evlog/hono';

import type {
  DashboardPayload,
  InstallSkillsResponse,
  InstalledSkillsState,
  SkillsCommandResult,
  UpdateSkillsRequest,
  UpdateSkillsResponse,
} from '../features/skills/state';
import {
  parseInstalledSkillsState,
  parseRecord,
  parseSkillScope,
  parseStringArray,
  parseTrimmedString,
} from '../features/skills/schemas';
import type { SkillScope } from '../features/skills/types';
import { loadInstalledSkillsState } from './installed-skills-state';
import { loadSearchSkillsState } from './search-skills-state';
import { loadSkillReadmeState } from './skill-readme-state';
import {
  createSkillsCommandAdapter,
  type SkillsCommandAdapter,
  type InstallSkillOptions,
} from './skills-command-adapter';
import { loadSkillDetailsState } from './skill-details-state';

type CommandAdapter = Pick<SkillsCommandAdapter, 'installSkill' | 'removeSkills' | 'updateSkills'>;

type HonoContext = Context<EvlogVariables>;

type CreateHonoAppOptions = {
  commandAdapter?: CommandAdapter;
  updateAdapter?: Pick<SkillsCommandAdapter, 'updateSkills'>;
  loadInstalledState?: typeof loadInstalledSkillsState;
  loadSearchState?: typeof loadSearchSkillsState;
  loadSkillDetails?: typeof loadSkillDetailsState;
  loadSkillReadme?: typeof loadSkillReadmeState;
};

const getLaunchDirectory = () => {
  const fromEnv = process.env.SKILLS_BROWSER_LAUNCH_CWD?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }

  return process.cwd();
};

const getPreviousState = (value: unknown): InstalledSkillsState | undefined => {
  const record = parseRecord(value);
  if (!record) {
    return undefined;
  }

  return parseInstalledSkillsState(record.previousState);
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

initLogger({
  env: {
    service: 'skills-browser',
    environment: process.env.NODE_ENV ?? 'development',
  },
  drain: process.env.NODE_ENV === 'test' ? () => {} : undefined,
  silent: process.env.NODE_ENV === 'test',
});

const getUpdateDashboardRequest = (value: unknown): UpdateSkillsRequest | null => {
  const record = parseRecord(value);
  const scope = parseSkillScope(record?.scope);
  if (!record || !scope) {
    return null;
  }

  if (!('names' in record)) {
    return {
      scope,
    };
  }

  const names = parseStringArray(record.names);
  if (names.length === 0) {
    return null;
  }

  return {
    scope,
    names,
  };
};

const getRemoveDashboardRequest = (value: unknown): RemoveDashboardRequest | null => {
  const record = parseRecord(value);
  const scope = parseSkillScope(record?.scope);
  if (!record || !scope) {
    return null;
  }

  const names = parseStringArray(record.names);
  if (names.length === 0) {
    return null;
  }

  return {
    names,
    scope,
    agents: parseStringArray(record.agents),
    previousState: getPreviousState(record),
  };
};

const getInstallDashboardRequest = (value: unknown): InstallDashboardRequest | null => {
  const record = parseRecord(value);
  const scope = parseSkillScope(record?.scope);
  const source = parseTrimmedString(record?.source);
  if (!record || !scope || !source) {
    return null;
  }

  return {
    source,
    scope,
    agents: parseStringArray(record.agents),
    skills: parseStringArray(record.skills),
    copy: false,
    previousState: getPreviousState(record),
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

const MAX_LOG_OUTPUT_LENGTH = 2_000;

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const getLogOutput = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.length <= MAX_LOG_OUTPUT_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_LOG_OUTPUT_LENGTH)}...`;
};

const logServerError = (
  context: HonoContext,
  error: unknown,
  fields: Record<string, unknown> = {}
) => {
  const log = context.get('log');
  const message = getErrorMessage(error);

  log.error(error instanceof Error ? error : message, {
    server: {
      error: message,
      ...fields,
    },
  });
};

const logCommandFailure = (
  context: HonoContext,
  operation: string,
  result: SkillsCommandResult
) => {
  if (result.ok) {
    return;
  }

  logServerError(context, createOperationFailureMessage(result), {
    operation,
    command: result.command,
    exitCode: result.exitCode,
    stdout: getLogOutput(result.stdout),
    stderr: getLogOutput(result.stderr),
  });
};

const logInstalledStateFailures = (
  context: HonoContext,
  operation: string,
  state: InstalledSkillsState
) => {
  for (const scope of ['project', 'global'] as const) {
    const scopeState = state[scope];
    if (!scopeState.error) {
      continue;
    }

    logServerError(context, scopeState.error, {
      operation,
      scope,
      stale: scopeState.stale,
      command: scopeState.command?.command,
      exitCode: scopeState.command?.exitCode,
      stdout: getLogOutput(scopeState.command?.stdout),
      stderr: getLogOutput(scopeState.command?.stderr),
    });
  }
};

const defaultCommandAdapter = createSkillsCommandAdapter();

const getSearchQuery = (value: unknown): string | undefined => {
  return parseTrimmedString(parseRecord(value)?.query);
};

const getSkillDetailsUrl = (value: unknown): string | undefined => {
  return parseTrimmedString(parseRecord(value)?.url);
};

const getSkillReadmeId = (value: unknown): string | undefined => {
  return parseTrimmedString(parseRecord(value)?.skillId);
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

const createDashboardMutationPayload = async (options: {
  loadInstalledState: typeof loadInstalledSkillsState;
  previousState?: InstalledSkillsState;
  scope: SkillScope;
  command: SkillsCommandResult;
}): Promise<DashboardPayload> => {
  const payload = await createDashboardPayload({
    loadInstalledState: options.loadInstalledState,
    previousState: options.previousState,
  });
  const scopeState = payload.installedState[options.scope];

  payload.installedState[options.scope] = {
    ...scopeState,
    command: options.command,
    error: options.command.ok ? scopeState.error : createOperationFailureMessage(options.command),
  };

  return payload;
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
  const loadDetailsState = options.loadSkillDetails ?? loadSkillDetailsState;
  const loadReadmeState = options.loadSkillReadme ?? loadSkillReadmeState;
  const app = new Hono<EvlogVariables>();

  app.use(
    evlog({
      include: ['/api/**'],
      exclude: ['/api/health'],
      routes: {
        '/api/dashboard/**': { service: 'skills-browser-dashboard' },
        '/api/search': { service: 'skills-browser-search' },
        '/api/skill-details': { service: 'skills-browser-skill-details' },
        '/api/skill-readme': { service: 'skills-browser-skill-readme' },
      },
    })
  );

  app.onError((error, context) => {
    logServerError(context, error, {
      operation: 'request',
      path: context.req.path,
      method: context.req.method,
    });

    return context.json(
      {
        error: getErrorMessage(error),
      },
      500
    );
  });

  app.get('/api/health', (context) => {
    return context.json({ ok: true });
  });

  app.get('/api/dashboard', async (context) => {
    const payload = await createDashboardPayload({
      loadInstalledState,
    });
    logInstalledStateFailures(context, 'dashboard.load', payload.installedState);

    return context.json(payload);
  });

  app.post('/api/dashboard/refresh', async (context) => {
    const body = await context.req.json().catch(() => undefined);
    const previousState = getPreviousState(body);

    const payload = await createDashboardPayload({
      loadInstalledState,
      previousState,
    });
    logInstalledStateFailures(context, 'dashboard.refresh', payload.installedState);

    return context.json(payload);
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

    context.get('log').set({
      dashboard: {
        operation: 'remove',
        scope: request.scope,
        skillCount: request.names.length,
        agentCount: request.agents.length,
      },
    });

    const command = await commandAdapter.removeSkills({
      names: request.names,
      scope: request.scope,
    });

    const payload = await createDashboardMutationPayload({
      loadInstalledState,
      previousState: request.previousState,
      scope: request.scope,
      command,
    });
    logCommandFailure(context, 'dashboard.remove', command);
    logInstalledStateFailures(context, 'dashboard.remove.refresh', payload.installedState);

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

    context.get('log').set({
      dashboard: {
        operation: 'install',
        scope: request.scope,
        agentCount: request.agents?.length ?? 0,
        skillCount: request.skills?.length ?? 0,
        copy: request.copy,
      },
    });

    const command = await commandAdapter.installSkill({
      source: request.source,
      scope: request.scope,
      agents: request.agents,
      skills: request.skills,
      copy: request.copy,
    });

    const payload = await createDashboardMutationPayload({
      loadInstalledState,
      previousState: request.previousState,
      scope: request.scope,
      command,
    });

    const response: InstallSkillsResponse = {
      payload,
      command,
      scope: request.scope,
    };
    logCommandFailure(context, 'dashboard.install', command);
    logInstalledStateFailures(context, 'dashboard.install.refresh', payload.installedState);

    return context.json(response);
  });

  app.post('/api/dashboard/update', async (context) => {
    const body = await context.req.json().catch(() => undefined);
    const request = getUpdateDashboardRequest(body);

    if (!request) {
      return context.json({ error: 'Invalid update request.' }, 400);
    }

    context.get('log').set({
      dashboard: {
        operation: 'update',
        scope: request.scope,
        skillCount: request.names?.length ?? 0,
        updateAll: !request.names,
      },
    });

    const command = await commandAdapter.updateSkills({
      scope: request.scope,
      names: request.names,
    });

    const response: UpdateSkillsResponse = {
      scope: request.scope,
      command,
    };
    logCommandFailure(context, 'dashboard.update', command);

    return context.json(response);
  });

  app.post('/api/search', async (context) => {
    const body = await context.req.json().catch(() => undefined);
    const query = getSearchQuery(body);

    if (!query) {
      return context.json({ error: 'Search query is required.' }, 400);
    }

    context.get('log').set({
      search: {
        queryLength: query.length,
      },
    });

    const searchState = await loadSearchState(query);
    logCommandFailure(context, 'search', searchState.command);

    return context.json({
      searchState,
    });
  });

  app.post('/api/skill-details', async (context) => {
    const body = await context.req.json().catch(() => undefined);
    const url = getSkillDetailsUrl(body);

    if (!url) {
      return context.json({ error: 'Skill details URL is required.' }, 400);
    }

    context.get('log').set({
      skillDetails: {
        urlLength: url.length,
      },
    });

    try {
      return context.json({
        details: await loadDetailsState(url),
      });
    } catch (error) {
      logServerError(context, error, {
        operation: 'skill-details',
      });

      return context.json(
        {
          error: getErrorMessage(error),
        },
        400
      );
    }
  });

  app.post('/api/skill-readme', async (context) => {
    const body = await context.req.json().catch(() => undefined);
    const skillId = getSkillReadmeId(body);

    if (!skillId) {
      return context.json({ error: 'Skill id is required.' }, 400);
    }

    context.get('log').set({
      skillReadme: {
        skillIdLength: skillId.length,
      },
    });

    try {
      return context.json({
        readme: await loadReadmeState(skillId),
      });
    } catch (error) {
      logServerError(context, error, {
        operation: 'skill-readme',
      });

      return context.json(
        {
          error: getErrorMessage(error),
        },
        400
      );
    }
  });

  return app;
};

export const honoApp = createHonoApp();
