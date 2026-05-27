import type { InstalledSkillsState, SkillsCommandResult } from '../../features/skills/state';
import type { InstalledSkill, SkillScope } from '../../features/skills/types';

import type { BrowserSkill, Theme } from './types';

export const getThemeFromDom = (): Theme => {
  if (typeof document === 'undefined') {
    return 'light';
  }

  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
};

export const buildSkills = (installedState: InstalledSkillsState): BrowserSkill[] => {
  const merged = [...installedState.project.skills, ...installedState.global.skills];

  return merged
    .map((skill) => {
      const description = buildSkillDescription(skill);
      const primarySource = skill.managed
        ? (skill.repository ?? skill.sourceUrl ?? skill.source ?? 'Unknown repository')
        : (skill.path ?? skill.source ?? 'Unknown source');
      const activityAt = skill.updatedAt ?? skill.installedAt ?? null;
      const activityTimestamp = activityAt ? Date.parse(activityAt) : 0;

      return {
        ...skill,
        description,
        primarySource,
        activityAt,
        activityTimestamp: Number.isNaN(activityTimestamp) ? 0 : activityTimestamp,
        installCommand: buildInstallCommand(skill),
        searchableText: [
          skill.name,
          description,
          primarySource,
          skill.scope,
          skill.sourceType ?? '',
          skill.ref ?? '',
          ...skill.agents,
        ]
          .join(' ')
          .toLowerCase(),
      };
    })
    .sort((left, right) => {
      if (left.activityTimestamp !== right.activityTimestamp) {
        return right.activityTimestamp - left.activityTimestamp;
      }

      return left.name.localeCompare(right.name);
    });
};

const buildSkillDescription = (skill: InstalledSkill): string => {
  const fragments: string[] = [];

  if (skill.sourceType) {
    fragments.push(`Source type: ${skill.sourceType}`);
  }

  if (!skill.managed) {
    fragments.push('Local skill');
  } else if (skill.repository) {
    fragments.push(`Repository: ${skill.repository}`);
  } else if (skill.path) {
    fragments.push('Managed local source');
  } else if (skill.source) {
    fragments.push('Managed source');
  }

  if (skill.agents.length > 0) {
    fragments.push(`${skill.agents.length} agent target${skill.agents.length === 1 ? '' : 's'}`);
  }

  if (fragments.length === 0) {
    return 'Installed skill discovered from command output.';
  }

  return fragments.join(' • ');
};

const buildInstallCommand = (skill: InstalledSkill): string => {
  const source = skill.source ?? skill.name;
  const scopeFlag = skill.scope === 'global' ? '--global' : '--project';
  return `npx skills add ${source} ${scopeFlag}`;
};

export const buildSkillActivity = (skill: BrowserSkill, loadedAt: string) => {
  const events: Array<{ label: string; timestamp: string }> = [];

  if (skill.installedAt) {
    events.push({
      label: `Installed in ${scopeLabel(skill.scope)} scope`,
      timestamp: formatDateTime(skill.installedAt),
    });
  }

  if (skill.updatedAt) {
    events.push({
      label: 'Last updated',
      timestamp: formatDateTime(skill.updatedAt),
    });
  }

  events.push({
    label: 'Last dashboard refresh',
    timestamp: formatDateTime(loadedAt),
  });

  return events;
};

export const buildUpdateStatusMessage = (input: {
  totalCount: number;
  successCount: number;
  failureCount: number;
}): string => {
  if (input.failureCount === 0) {
    return `Update completed for ${input.successCount} operation${input.successCount === 1 ? '' : 's'}.`;
  }

  if (input.successCount === 0) {
    return `Update failed for ${input.failureCount} operation${input.failureCount === 1 ? '' : 's'}.`;
  }

  return [
    `Update completed with ${input.successCount} successful`,
    `and ${input.failureCount} failed`,
    `operation${input.totalCount === 1 ? '' : 's'}.`,
  ].join(' ');
};

export const parseCommaSeparatedValues = (value: string): string[] => {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export const createCommandFailureMessage = (command: SkillsCommandResult): string => {
  const exitCode = command.exitCode === null ? 'unknown' : String(command.exitCode);
  const commandLine = command.command.join(' ');
  const stderr = command.stderr.trim();
  const stdout = command.stdout.trim();

  if (stderr.length > 0) {
    return `Command "${commandLine}" failed (exit code ${exitCode}): ${stderr}`;
  }

  if (stdout.length > 0) {
    return `Command "${commandLine}" failed (exit code ${exitCode}): ${stdout}`;
  }

  return `Command "${commandLine}" failed (exit code ${exitCode}).`;
};

export const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

export const scopeLabel = (scope: SkillScope): string => {
  return scope === 'project' ? 'Project' : 'Global';
};

export const formatNullableDate = (value: string | undefined): string => {
  if (!value) {
    return 'Unknown';
  }

  return formatDateTime(value);
};

export const formatDateTime = (value: string): string => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
};
