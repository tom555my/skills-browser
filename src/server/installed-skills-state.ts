import { homedir } from 'node:os';
import { join } from 'node:path';

import type { InstalledSkill, SkillScope } from '../features/skills/types';
import type {
  InstalledSkillsScopeState,
  InstalledSkillsState,
  SkillsCommandResult,
} from '../features/skills/state';
import {
  parseRecord,
  parseSkillScope,
  parseStringArray,
  parseTrimmedString,
} from '../features/skills/schemas';
import { createSkillsCommandAdapter, type SkillsCommandAdapter } from './skills-command-adapter';

type SkillsListAdapter = Pick<SkillsCommandAdapter, 'listSkills'>;

type SkillLockEntry = {
  source?: string;
  sourceUrl?: string;
  sourceType?: string;
  ref?: string;
  skillPath?: string;
  skillFolderHash?: string;
  computedHash?: string;
  pluginName?: string;
  installedAt?: string;
  updatedAt?: string;
};

type SkillLockEntries = Record<string, SkillLockEntry>;

type LoadInstalledSkillsScopeOptions = {
  adapter?: SkillsListAdapter;
  loadLockEntries?: (scope: SkillScope) => Promise<SkillLockEntries>;
  previousState?: InstalledSkillsScopeState;
  now?: () => Date;
};

type LoadInstalledSkillsStateOptions = {
  adapter?: SkillsListAdapter;
  loadLockEntries?: (scope: SkillScope) => Promise<SkillLockEntries>;
  previousState?: InstalledSkillsState;
  now?: () => Date;
};

const defaultAdapter = createSkillsCommandAdapter();

const MAX_OUTPUT_SNIPPET_LENGTH = 240;

const createEmptyScopeState = (scope: SkillScope): InstalledSkillsScopeState => {
  return {
    scope,
    skills: [],
    command: null,
    error: null,
    stale: false,
    lastSuccessfulAt: null,
  };
};

const truncateOutput = (value: string): string => {
  if (value.length <= MAX_OUTPUT_SNIPPET_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_OUTPUT_SNIPPET_LENGTH)}...`;
};

const getScope = (value: unknown, fallbackScope: SkillScope): SkillScope => {
  return parseSkillScope(value) ?? fallbackScope;
};

const readJsonFile = async (path: string): Promise<unknown> => {
  return JSON.parse(await Bun.file(path).text());
};

const normalizeLockEntries = (value: unknown): SkillLockEntries => {
  const record = parseRecord(value);
  const skills = parseRecord(record?.skills);
  if (!record || !skills || typeof record.version !== 'number') {
    return {};
  }

  const entries: SkillLockEntries = {};
  for (const [name, rawEntry] of Object.entries(skills)) {
    const entry = parseRecord(rawEntry);
    if (!entry) {
      continue;
    }

    entries[name] = {
      source: parseTrimmedString(entry.source),
      sourceUrl: parseTrimmedString(entry.sourceUrl),
      sourceType: parseTrimmedString(entry.sourceType),
      ref: parseTrimmedString(entry.ref),
      skillPath: parseTrimmedString(entry.skillPath),
      skillFolderHash: parseTrimmedString(entry.skillFolderHash),
      computedHash: parseTrimmedString(entry.computedHash),
      pluginName: parseTrimmedString(entry.pluginName),
      installedAt: parseTrimmedString(entry.installedAt),
      updatedAt: parseTrimmedString(entry.updatedAt),
    };
  }

  return entries;
};

const getGlobalLockPath = (): string => {
  const xdgStateHome = process.env.XDG_STATE_HOME?.trim();
  if (xdgStateHome) {
    return join(xdgStateHome, 'skills', '.skill-lock.json');
  }

  return join(homedir(), '.agents', '.skill-lock.json');
};

const getProjectLockPath = (): string => {
  const launchCwd = process.env.SKILLS_BROWSER_LAUNCH_CWD?.trim();
  return join(launchCwd && launchCwd.length > 0 ? launchCwd : process.cwd(), 'skills-lock.json');
};

const loadDefaultLockEntries = async (scope: SkillScope): Promise<SkillLockEntries> => {
  const lockPath = scope === 'global' ? getGlobalLockPath() : getProjectLockPath();

  try {
    return normalizeLockEntries(await readJsonFile(lockPath));
  } catch {
    return {};
  }
};

const getRepositoryFromSource = (
  source: string | undefined,
  sourceUrl: string | undefined
): { repository?: string; repositoryUrl?: string } => {
  const urlInput = sourceUrl ?? source;

  if (urlInput) {
    try {
      const url = new URL(urlInput);
      const host = url.hostname.toLowerCase();
      const parts = url.pathname
        .replace(/\.git$/, '')
        .split('/')
        .filter((part) => part.length > 0);

      if ((host === 'github.com' || host === 'gitlab.com') && parts.length >= 2) {
        const repository = `${parts[0]}/${parts[1]}`;
        return {
          repository,
          repositoryUrl: `${url.protocol}//${url.hostname}/${repository}`,
        };
      }
    } catch {
      // Fall through to shorthand parsing.
    }
  }

  const shorthand = source?.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:[@#].*)?$/);
  if (!shorthand) {
    return {};
  }

  const repository = `${shorthand[1]}/${shorthand[2]}`;
  return {
    repository,
    repositoryUrl: `https://github.com/${repository}`,
  };
};

const createInstalledSkillId = (input: {
  scope: SkillScope;
  name: string;
  path?: string;
  source?: string;
  index: number;
}): string => {
  const identity = input.path ?? input.source ?? String(input.index);
  return `${input.scope}:${input.name}:${identity}`;
};

const getOutputSnippet = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return '<empty>';
  }

  return truncateOutput(trimmed);
};

const createCommandFailureMessage = (scope: SkillScope, result: SkillsCommandResult): string => {
  const exitCode = result.exitCode === null ? 'unknown' : String(result.exitCode);
  const stderr = result.stderr.trim();
  const stdout = result.stdout.trim();
  const outputLine =
    stderr.length > 0
      ? `stderr: ${truncateOutput(stderr)}.`
      : stdout.length > 0
        ? `stdout: ${truncateOutput(stdout)}.`
        : 'No output was produced.';

  return `Command "${result.command.join(' ')}" failed while loading ${scope} skills (exit code ${exitCode}). ${outputLine}`;
};

const createJsonParseMessage = (input: {
  scope: SkillScope;
  result: SkillsCommandResult;
  cause: unknown;
}): string => {
  const causeMessage = input.cause instanceof Error ? input.cause.message : String(input.cause);

  return [
    `Failed to parse ${input.scope} skills JSON from "${input.result.command.join(' ')}".`,
    `Parser error: ${causeMessage}.`,
    `stdout: ${getOutputSnippet(input.result.stdout)}.`,
    `stderr: ${getOutputSnippet(input.result.stderr)}.`,
  ].join(' ');
};

const normalizeInstalledSkills = (input: {
  scope: SkillScope;
  result: SkillsCommandResult;
  lockEntries: SkillLockEntries;
}): InstalledSkill[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.result.stdout);
  } catch (error) {
    throw new Error(
      createJsonParseMessage({ scope: input.scope, result: input.result, cause: error })
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      createJsonParseMessage({
        scope: input.scope,
        result: input.result,
        cause: `Expected an array but received ${typeof parsed}.`,
      })
    );
  }

  const normalized: InstalledSkill[] = [];

  for (const [index, item] of parsed.entries()) {
    const record = parseRecord(item);
    if (!record) {
      continue;
    }

    const name = parseTrimmedString(record.name);
    if (!name) {
      continue;
    }

    const scope = getScope(record.scope, input.scope);
    const path = parseTrimmedString(record.path);
    const lockEntry = input.lockEntries[name];
    const source = lockEntry?.source ?? parseTrimmedString(record.source);
    const sourceUrl = lockEntry?.sourceUrl ?? parseTrimmedString(record.sourceUrl);
    const sourceType = lockEntry?.sourceType ?? parseTrimmedString(record.sourceType);
    const ref = lockEntry?.ref ?? parseTrimmedString(record.ref);
    const installedAt = lockEntry?.installedAt ?? parseTrimmedString(record.installedAt);
    const updatedAt = lockEntry?.updatedAt ?? parseTrimmedString(record.updatedAt);
    const agents = parseStringArray(record.agents);
    const repository = getRepositoryFromSource(source, sourceUrl);

    normalized.push({
      id: createInstalledSkillId({ scope, name, path, source, index }),
      name,
      managed: Boolean(lockEntry),
      scope,
      path,
      source,
      sourceUrl,
      sourceType,
      repository: repository.repository,
      repositoryUrl: repository.repositoryUrl,
      ref,
      agents,
      installedAt,
      updatedAt,
    });
  }

  return normalized.sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) {
      return byName;
    }

    return left.id.localeCompare(right.id);
  });
};

const createFailedState = (input: {
  scope: SkillScope;
  result: SkillsCommandResult;
  error: string;
  previousState?: InstalledSkillsScopeState;
}): InstalledSkillsScopeState => {
  const previous = input.previousState;
  const hasPreviousSuccess =
    previous?.lastSuccessfulAt !== null && previous?.lastSuccessfulAt !== undefined;

  if (!hasPreviousSuccess) {
    return {
      ...createEmptyScopeState(input.scope),
      command: input.result,
      error: input.error,
    };
  }

  return {
    scope: input.scope,
    skills: previous.skills,
    command: input.result,
    error: input.error,
    stale: true,
    lastSuccessfulAt: previous.lastSuccessfulAt,
  };
};

const loadInstalledSkillsForScope = async (
  scope: SkillScope,
  options: LoadInstalledSkillsScopeOptions = {}
): Promise<InstalledSkillsScopeState> => {
  const { adapter = defaultAdapter, previousState, now = () => new Date() } = options;

  const result = await adapter.listSkills({ scope, json: true });
  const lockEntries = await (options.loadLockEntries ?? loadDefaultLockEntries)(scope);

  if (!result.ok) {
    return createFailedState({
      scope,
      result,
      error: createCommandFailureMessage(scope, result),
      previousState,
    });
  }

  try {
    const skills = normalizeInstalledSkills({ scope, result, lockEntries });

    return {
      scope,
      skills,
      command: result,
      error: null,
      stale: false,
      lastSuccessfulAt: now().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return createFailedState({
      scope,
      result,
      error: message,
      previousState,
    });
  }
};

export const loadProjectInstalledSkills = (
  options: LoadInstalledSkillsScopeOptions = {}
): Promise<InstalledSkillsScopeState> => {
  return loadInstalledSkillsForScope('project', options);
};

export const loadGlobalInstalledSkills = (
  options: LoadInstalledSkillsScopeOptions = {}
): Promise<InstalledSkillsScopeState> => {
  return loadInstalledSkillsForScope('global', options);
};

export const loadInstalledSkillsState = async (
  options: LoadInstalledSkillsStateOptions = {}
): Promise<InstalledSkillsState> => {
  const { adapter = defaultAdapter, previousState, now } = options;
  const [project, global] = await Promise.all([
    loadProjectInstalledSkills({
      adapter,
      loadLockEntries: options.loadLockEntries,
      previousState: previousState?.project,
      now,
    }),
    loadGlobalInstalledSkills({
      adapter,
      loadLockEntries: options.loadLockEntries,
      previousState: previousState?.global,
      now,
    }),
  ]);

  return { project, global };
};
