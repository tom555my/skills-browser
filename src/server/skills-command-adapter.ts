import type { SkillScope } from '../features/skills/types';
import type { SkillsCommandResult } from '../features/skills/state';
import { getSkillsCliPath } from './embedded-skills';

export type { SkillScope } from '../features/skills/types';
export type { SkillsCommandResult } from '../features/skills/state';

export type ListSkillsOptions = {
  scope?: SkillScope;
  agents?: readonly string[];
  json?: boolean;
};

export type SearchSkillsOptions = {
  query?: string;
};

export type InstallSkillOptions = {
  source: string;
  scope?: SkillScope;
  agents?: readonly string[];
  skills?: readonly string[];
  copy?: boolean;
};

export type RemoveSkillsOptions = {
  names?: readonly string[];
  scope?: SkillScope;
  agents?: readonly string[];
};

export type UpdateSkillsOptions = {
  names?: readonly string[];
  scope?: SkillScope;
};

type SkillsCommandRunner = (args: readonly string[]) => Promise<SkillsCommandResult>;

const normalizeArgs = (values: readonly string[] | undefined): string[] => {
  if (!values) {
    return [];
  }

  return values.map((value) => value.trim()).filter((value) => value.length > 0);
};

const AGENT_ALIASES = new Map<string, string>([
  ['claude', 'claude-code'],
  ['copilot', 'github-copilot'],
  ['deep-agents', 'deepagents'],
  ['gemini', 'gemini-cli'],
  ['kimi-code-cli', 'kimi-cli'],
  ['qwen', 'qwen-code'],
]);

const normalizeAgentArg = (value: string): string => {
  if (value.trim() === '*') {
    return '*';
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return AGENT_ALIASES.get(normalized) ?? normalized;
};

const appendScopeFlag = (args: string[], scope: SkillScope | undefined): void => {
  if (scope === 'global') {
    args.push('--global');
    return;
  }

  if (scope === 'project') {
    args.push('--project');
  }
};

const appendMultiValueFlag = (
  args: string[],
  flag: '--agent' | '--skill',
  values: readonly string[] | undefined
): void => {
  const normalized =
    flag === '--agent' ? normalizeArgs(values).map(normalizeAgentArg) : normalizeArgs(values);
  const valuesToAppend = normalized.filter((value) => value.length > 0);

  if (valuesToAppend.length > 0) {
    args.push(flag, ...valuesToAppend);
  }
};

const runSkillsCommand: SkillsCommandRunner = async (args) => {
  const cliPath = await getSkillsCliPath();
  const process = await Bun.$`bun ${cliPath} ${args}`.cwd(getSkillsCommandCwd()).quiet().nothrow();

  return {
    ok: process.exitCode === 0,
    command: ['skills', ...args],
    stdout: process.stdout.toString(),
    stderr: process.stderr.toString(),
    exitCode: process.exitCode,
  };
};

export const getSkillsCommandCwd = (): string => {
  const launchCwd = process.env.SKILLS_BROWSER_LAUNCH_CWD?.trim();
  return launchCwd && launchCwd.length > 0 ? launchCwd : process.cwd();
};

export const createSkillsCommandAdapter = (runner: SkillsCommandRunner = runSkillsCommand) => {
  return {
    async listSkills(options: ListSkillsOptions = {}): Promise<SkillsCommandResult> {
      const args = ['list'];

      if (options.scope === 'global') {
        args.push('--global');
      }

      appendMultiValueFlag(args, '--agent', options.agents);

      if (options.json) {
        args.push('--json');
      }

      return runner(args);
    },

    async searchSkills(options: SearchSkillsOptions = {}): Promise<SkillsCommandResult> {
      const args = ['find'];
      const query = options.query?.trim();

      if (query) {
        args.push(query);
      }

      return runner(args);
    },

    async installSkill(options: InstallSkillOptions): Promise<SkillsCommandResult> {
      const source = options.source.trim();
      if (source.length === 0) {
        throw new Error('Skill source is required.');
      }

      const args = ['add', source];
      appendScopeFlag(args, options.scope);

      appendMultiValueFlag(args, '--agent', options.agents);
      appendMultiValueFlag(args, '--skill', options.skills);

      args.push('--yes');

      return runner(args);
    },

    async removeSkills(options: RemoveSkillsOptions = {}): Promise<SkillsCommandResult> {
      const args = ['remove', ...normalizeArgs(options.names)];

      if (options.scope === 'global') {
        args.push('--global');
      }

      appendMultiValueFlag(args, '--agent', options.agents);
      args.push('--yes');

      return runner(args);
    },

    async updateSkills(options: UpdateSkillsOptions = {}): Promise<SkillsCommandResult> {
      const args = ['update', ...normalizeArgs(options.names)];
      appendScopeFlag(args, options.scope);
      return runner(args);
    },
  };
};

export type SkillsCommandAdapter = ReturnType<typeof createSkillsCommandAdapter>;

export const skillsCommandAdapter = createSkillsCommandAdapter();
