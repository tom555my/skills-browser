import * as z from 'zod/mini';

import type {
  DashboardPayload,
  InstalledSkillsState,
  SearchPayload,
  SkillDetailsPayload,
  SkillsCommandResult,
  UpdateSkillsResponse,
} from './state';
import type { SkillScope } from './types';

export const skillScopeSchema = z.enum(['project', 'global']);

export const trimmedStringSchema = z.string().check(z.trim(), z.minLength(1));

const recordSchema = z.record(z.string(), z.unknown());

export const skillsCommandResultSchema = z.object({
  ok: z.boolean(),
  command: z.array(z.string()),
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.nullable(z.number()),
});

export const installedSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.optional(z.string()),
  sourceType: z.optional(z.string()),
  scope: skillScopeSchema,
  agents: z.array(z.string()),
  ref: z.optional(z.string()),
  path: z.optional(z.string()),
  installedAt: z.optional(z.string()),
  updatedAt: z.optional(z.string()),
});

export const installedSkillsScopeStateSchema = z.object({
  scope: skillScopeSchema,
  skills: z.array(installedSkillSchema),
  command: z.nullable(skillsCommandResultSchema),
  error: z.nullable(z.string()),
  stale: z.boolean(),
  lastSuccessfulAt: z.nullable(z.string()),
});

export const installedSkillsStateSchema = z.object({
  project: installedSkillsScopeStateSchema,
  global: installedSkillsScopeStateSchema,
});

export const dashboardPayloadSchema = z.object({
  launchDirectory: z.string(),
  loadedAt: z.string(),
  installedState: installedSkillsStateSchema,
});

export const searchResultSkillSchema = z.object({
  id: z.string(),
  source: z.string(),
  owner: z.string(),
  repository: z.string(),
  name: z.string(),
  installs: z.nullable(z.string()),
  url: z.nullable(z.string()),
});

export const searchPayloadSchema = z.object({
  searchState: z.object({
    query: z.string(),
    results: z.array(searchResultSkillSchema),
    command: skillsCommandResultSchema,
    error: z.nullable(z.string()),
    parseWarning: z.nullable(z.string()),
    searchedAt: z.string(),
  }),
});

export const skillDetailsPayloadSchema = z.object({
  details: z.object({
    title: z.string(),
    description: z.nullable(z.string()),
    canonicalUrl: z.string(),
    installCommand: z.nullable(z.string()),
    summaryHtml: z.nullable(z.string()),
    readmeHtml: z.nullable(z.string()),
    weeklyInstalls: z.nullable(z.string()),
    repository: z.nullable(z.string()),
    repositoryUrl: z.nullable(z.string()),
    githubStars: z.nullable(z.string()),
    firstSeen: z.nullable(z.string()),
    audits: z.array(
      z.object({
        name: z.string(),
        status: z.string(),
        url: z.string(),
      })
    ),
    fetchedAt: z.string(),
  }),
});

export const updateSkillsResponseSchema = z.object({
  scope: skillScopeSchema,
  command: skillsCommandResultSchema,
});

export const mutationResponseSchema = z.object({
  payload: dashboardPayloadSchema,
  command: skillsCommandResultSchema,
  scope: skillScopeSchema,
});

export const parseSkillScope = (value: unknown): SkillScope | undefined => {
  const result = skillScopeSchema.safeParse(value);
  return result.success ? result.data : undefined;
};

export const parseTrimmedString = (value: unknown): string | undefined => {
  const result = trimmedStringSchema.safeParse(value);
  return result.success ? result.data : undefined;
};

export const parseRecord = (value: unknown): Record<string, unknown> | undefined => {
  const result = recordSchema.safeParse(value);
  return result.success ? result.data : undefined;
};

export const parseStringArray = (value: unknown): string[] => {
  const result = z.array(z.unknown()).safeParse(value);
  if (!result.success) {
    return [];
  }

  return result.data
    .map((item) => parseTrimmedString(item))
    .filter((item): item is string => item !== undefined);
};

export const parseInstalledSkillsState = (value: unknown): InstalledSkillsState | undefined => {
  const result = installedSkillsStateSchema.safeParse(value);
  return result.success ? (result.data as InstalledSkillsState) : undefined;
};

export const parseSkillsCommandResult = (value: unknown): SkillsCommandResult | undefined => {
  const result = skillsCommandResultSchema.safeParse(value);
  return result.success ? (result.data as SkillsCommandResult) : undefined;
};

export const parseDashboardPayload = (value: unknown): DashboardPayload | undefined => {
  const result = dashboardPayloadSchema.safeParse(value);
  return result.success ? (result.data as DashboardPayload) : undefined;
};

export const parseSearchPayload = (value: unknown): SearchPayload | undefined => {
  const result = searchPayloadSchema.safeParse(value);
  return result.success ? (result.data as SearchPayload) : undefined;
};

export const parseSkillDetailsPayload = (value: unknown): SkillDetailsPayload | undefined => {
  const result = skillDetailsPayloadSchema.safeParse(value);
  return result.success ? (result.data as SkillDetailsPayload) : undefined;
};

export const parseUpdateSkillsResponse = (value: unknown): UpdateSkillsResponse | undefined => {
  const result = updateSkillsResponseSchema.safeParse(value);
  return result.success ? (result.data as UpdateSkillsResponse) : undefined;
};
