import { Hono } from 'hono';
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
import {
  createSkillsCommandAdapter,
  type SkillsCommandAdapter,
  type InstallSkillOptions,
} from './skills-command-adapter';
import { loadSkillDetailsState } from './skill-details-state';

type CommandAdapter = Pick<SkillsCommandAdapter, 'installSkill' | 'removeSkills' | 'updateSkills'>;

type CreateHonoAppOptions = {
  commandAdapter?: CommandAdapter;
  updateAdapter?: Pick<SkillsCommandAdapter, 'updateSkills'>;
  loadInstalledState?: typeof loadInstalledSkillsState;
  loadSearchState?: typeof loadSearchSkillsState;
  loadSkillDetails?: typeof loadSkillDetailsState;
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
    copy: record.copy === true,
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

const defaultCommandAdapter = createSkillsCommandAdapter();

const getSearchQuery = (value: unknown): string | undefined => {
  return parseTrimmedString(parseRecord(value)?.query);
};

const getSkillDetailsUrl = (value: unknown): string | undefined => {
  return parseTrimmedString(parseRecord(value)?.url);
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
  const loadDetailsState = options.loadSkillDetails ?? loadSkillDetailsState;
  const app = new Hono<EvlogVariables>();

  app.use(
    evlog({
      include: ['/api/**'],
      exclude: ['/api/health'],
      routes: {
        '/api/dashboard/**': { service: 'skills-browser-dashboard' },
        '/api/search': { service: 'skills-browser-search' },
        '/api/skill-details': { service: 'skills-browser-skill-details' },
      },
    })
  );

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

    return context.json({
      searchState: await loadSearchState(query),
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
      return context.json(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        400
      );
    }
  });

  return app;
};

export const honoApp = createHonoApp();
