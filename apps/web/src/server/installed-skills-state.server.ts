import type { InstalledSkill, SkillScope } from '../features/skills/types';
import { createSkillsCommandAdapter, type SkillsCommandAdapter, type SkillsCommandResult } from './skills-command-adapter.server';

type SkillsListAdapter = Pick<SkillsCommandAdapter, 'listSkills'>;

export type InstalledSkillsScopeState = {
  scope: SkillScope;
  skills: InstalledSkill[];
  command: SkillsCommandResult | null;
  error: string | null;
  stale: boolean;
  lastSuccessfulAt: string | null;
};

export type InstalledSkillsState = {
  project: InstalledSkillsScopeState;
  global: InstalledSkillsScopeState;
};

type LoadInstalledSkillsScopeOptions = {
  adapter?: SkillsListAdapter;
  previousState?: InstalledSkillsScopeState;
  now?: () => Date;
};

type LoadInstalledSkillsStateOptions = {
  adapter?: SkillsListAdapter;
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

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed;
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizeString).filter((item): item is string => item !== undefined);
};

const getScope = (value: unknown, fallbackScope: SkillScope): SkillScope => {
  if (value === 'project' || value === 'global') {
    return value;
  }

  return fallbackScope;
};

const getRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
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
  const outputLine = stderr.length > 0 ? `stderr: ${truncateOutput(stderr)}.` : stdout.length > 0 ? `stdout: ${truncateOutput(stdout)}.` : 'No output was produced.';

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
}): InstalledSkill[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.result.stdout);
  } catch (error) {
    throw new Error(createJsonParseMessage({ scope: input.scope, result: input.result, cause: error }));
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      createJsonParseMessage({
        scope: input.scope,
        result: input.result,
        cause: `Expected an array but received ${typeof parsed}.`,
      }),
    );
  }

  const normalized: InstalledSkill[] = [];

  for (const [index, item] of parsed.entries()) {
    const record = getRecord(item);
    if (!record) {
      continue;
    }

    const name = normalizeString(record.name);
    if (!name) {
      continue;
    }

    const scope = getScope(record.scope, input.scope);
    const path = normalizeString(record.path);
    const source = normalizeString(record.source);
    const sourceType = normalizeString(record.sourceType);
    const ref = normalizeString(record.ref);
    const installedAt = normalizeString(record.installedAt);
    const updatedAt = normalizeString(record.updatedAt);
    const agents = normalizeStringArray(record.agents);

    normalized.push({
      id: createInstalledSkillId({ scope, name, path, source, index }),
      name,
      scope,
      path,
      source,
      sourceType,
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
  const hasPreviousSuccess = previous?.lastSuccessfulAt !== null && previous?.lastSuccessfulAt !== undefined;

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
  options: LoadInstalledSkillsScopeOptions = {},
): Promise<InstalledSkillsScopeState> => {
  const { adapter = defaultAdapter, previousState, now = () => new Date() } = options;

  const result = await adapter.listSkills({ scope, json: true });

  if (!result.ok) {
    return createFailedState({
      scope,
      result,
      error: createCommandFailureMessage(scope, result),
      previousState,
    });
  }

  try {
    const skills = normalizeInstalledSkills({ scope, result });

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
  options: LoadInstalledSkillsScopeOptions = {},
): Promise<InstalledSkillsScopeState> => {
  return loadInstalledSkillsForScope('project', options);
};

export const loadGlobalInstalledSkills = (
  options: LoadInstalledSkillsScopeOptions = {},
): Promise<InstalledSkillsScopeState> => {
  return loadInstalledSkillsForScope('global', options);
};

export const loadInstalledSkillsState = async (
  options: LoadInstalledSkillsStateOptions = {},
): Promise<InstalledSkillsState> => {
  const { adapter = defaultAdapter, previousState, now } = options;
  const [project, global] = await Promise.all([
    loadProjectInstalledSkills({
      adapter,
      previousState: previousState?.project,
      now,
    }),
    loadGlobalInstalledSkills({
      adapter,
      previousState: previousState?.global,
      now,
    }),
  ]);

  return { project, global };
};
