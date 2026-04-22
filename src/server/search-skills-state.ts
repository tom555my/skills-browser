import type {
  SearchResultSkill,
  SearchSkillsState,
  SkillsCommandResult,
} from '../features/skills/state';
import { createSkillsCommandAdapter, type SkillsCommandAdapter } from './skills-command-adapter';

type SkillsSearchAdapter = Pick<SkillsCommandAdapter, 'searchSkills'>;

type LoadSearchSkillsStateOptions = {
  adapter?: SkillsSearchAdapter;
  now?: () => Date;
};

const defaultAdapter = createSkillsCommandAdapter();

const MAX_OUTPUT_SNIPPET_LENGTH = 240;
const SOURCE_LINE_PATTERN = /^([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+)(?:\s+(.*))?$/;
const URL_PATTERN = /(https?:\/\/\S+)/;
const INSTALLS_PATTERN = /([0-9][0-9.,]*[KM]?)\s+installs/i;
const ANSI_ESCAPE_PATTERN = new RegExp(String.raw`\u001b\[[0-?]*[ -/]*[@-~]`, 'g');
const ANSI_OSC_PATTERN = new RegExp(String.raw`\u001b\][^\u0007]*(?:\u0007|\u001b\\)`, 'g');

const truncateOutput = (value: string): string => {
  if (value.length <= MAX_OUTPUT_SNIPPET_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_OUTPUT_SNIPPET_LENGTH)}...`;
};

const stripAnsi = (value: string): string => {
  return value.replace(ANSI_ESCAPE_PATTERN, '').replace(ANSI_OSC_PATTERN, '');
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

const getRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const createCommandFailureMessage = (query: string, result: SkillsCommandResult): string => {
  const exitCode = result.exitCode === null ? 'unknown' : String(result.exitCode);
  const stderr = result.stderr.trim();
  const stdout = result.stdout.trim();
  const outputLine =
    stderr.length > 0
      ? `stderr: ${truncateOutput(stderr)}.`
      : stdout.length > 0
        ? `stdout: ${truncateOutput(stdout)}.`
        : 'No output was produced.';

  return `Command "${result.command.join(' ')}" failed while searching for "${query}" (exit code ${exitCode}). ${outputLine}`;
};

const createResult = (input: {
  source: string;
  owner: string;
  repository: string;
  name: string;
  installs?: string;
  url?: string;
  index: number;
}): SearchResultSkill => {
  return {
    id: `${input.source}:${input.index}`,
    source: input.source,
    owner: input.owner,
    repository: input.repository,
    name: input.name,
    installs: input.installs ?? null,
    url: input.url ?? null,
  };
};

const splitSource = (
  source: string
): { owner: string; repository: string; name: string } | null => {
  const match = source.match(SOURCE_LINE_PATTERN);
  if (!match) {
    return null;
  }

  return {
    owner: match[1],
    repository: match[2],
    name: match[3],
  };
};

const parseJsonResults = (stdout: string): SearchResultSkill[] | null => {
  const trimmed = stripAnsi(stdout).trim();
  if (!(trimmed.startsWith('[') || trimmed.startsWith('{'))) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) {
    return null;
  }

  const normalized: SearchResultSkill[] = [];

  for (const [index, item] of parsed.entries()) {
    const record = getRecord(item);
    if (!record) {
      continue;
    }

    const directSource = normalizeString(record.source);
    const owner = normalizeString(record.owner);
    const repository = normalizeString(record.repository) ?? normalizeString(record.repo);
    const name = normalizeString(record.name) ?? normalizeString(record.skill);
    const url = normalizeString(record.url);
    const installs = normalizeString(record.installs) ?? normalizeString(record.installCount);

    if (directSource) {
      const parts = splitSource(directSource);
      if (!parts) {
        continue;
      }

      normalized.push(
        createResult({
          source: directSource,
          owner: parts.owner,
          repository: parts.repository,
          name: parts.name,
          installs,
          url,
          index,
        })
      );
      continue;
    }

    if (!owner || !repository || !name) {
      continue;
    }

    const source = `${owner}/${repository}@${name}`;
    normalized.push(
      createResult({
        source,
        owner,
        repository,
        name,
        installs,
        url,
        index,
      })
    );
  }

  return normalized;
};

const parseTextResults = (
  stdout: string
): { results: SearchResultSkill[]; parseWarning: string | null } => {
  const normalizedOutput = stripAnsi(stdout);
  const lines = normalizedOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const results: SearchResultSkill[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const currentLine = lines[index];
    const match = currentLine.match(SOURCE_LINE_PATTERN);
    if (!match) {
      continue;
    }

    const metadata = normalizeString(match[4]);
    const installsMatch = metadata?.match(INSTALLS_PATTERN);
    const installs = installsMatch ? installsMatch[1] : undefined;

    let url: string | undefined;
    const nextLine = lines[index + 1];
    if (nextLine) {
      const urlMatch = nextLine.match(URL_PATTERN);
      if (urlMatch) {
        url = urlMatch[1];
        index += 1;
      }
    }

    const source = `${match[1]}/${match[2]}@${match[3]}`;
    const resultIndex = results.length;
    results.push(
      createResult({
        source,
        owner: match[1],
        repository: match[2],
        name: match[3],
        installs,
        url,
        index: resultIndex,
      })
    );
  }

  if (results.length > 0) {
    return {
      results,
      parseWarning: null,
    };
  }

  const normalizedLower = normalizedOutput.toLowerCase();
  const hasNoResultsMarker =
    normalizedLower.includes('no skills found') || normalizedLower.includes('no results');
  if (hasNoResultsMarker || normalizedOutput.trim().length === 0) {
    return {
      results: [],
      parseWarning: null,
    };
  }

  return {
    results: [],
    parseWarning: 'Search output could not be parsed into structured results.',
  };
};

export const loadSearchSkillsState = async (
  query: string,
  options: LoadSearchSkillsStateOptions = {}
): Promise<SearchSkillsState> => {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length === 0) {
    throw new Error('Search query is required.');
  }

  const { adapter = defaultAdapter, now = () => new Date() } = options;
  const result = await adapter.searchSkills({ query: normalizedQuery });
  const searchedAt = now().toISOString();

  if (!result.ok) {
    return {
      query: normalizedQuery,
      results: [],
      command: result,
      error: createCommandFailureMessage(normalizedQuery, result),
      parseWarning: null,
      searchedAt,
    };
  }

  const parsedFromJson = parseJsonResults(result.stdout);
  if (parsedFromJson) {
    return {
      query: normalizedQuery,
      results: parsedFromJson,
      command: result,
      error: null,
      parseWarning: null,
      searchedAt,
    };
  }

  const parsedFromText = parseTextResults(result.stdout);
  return {
    query: normalizedQuery,
    results: parsedFromText.results,
    command: result,
    error: null,
    parseWarning: parsedFromText.parseWarning,
    searchedAt,
  };
};
