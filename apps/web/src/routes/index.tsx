import { useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn, useServerFn } from '@tanstack/react-start';
import { Badge } from '@skills-browser/ui/components/badge';
import { Button } from '@skills-browser/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@skills-browser/ui/components/card';
import { Separator } from '@skills-browser/ui/components/separator';
import {
  AlertTriangle,
  CheckCircle2,
  FolderCode,
  Globe,
  Moon,
  RefreshCw,
  Sun,
  TerminalSquare,
  XCircle,
} from 'lucide-react';

import type { InstalledSkill, SkillScope } from '../features/skills/types';
import {
  loadInstalledSkillsState,
  type InstalledSkillsScopeState,
  type InstalledSkillsState,
} from '../server/installed-skills-state.server';

type ScopeFilter = 'all' | SkillScope;

type DashboardPayload = {
  launchDirectory: string;
  loadedAt: string;
  installedState: InstalledSkillsState;
};

const THEME_STORAGE_KEY = 'skills-browser-theme';

const getLaunchDirectory = () => {
  const fromEnv = process.env.SKILLS_BROWSER_LAUNCH_CWD?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }

  return process.cwd();
};

const loadDashboardStateServerFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DashboardPayload> => {
    return {
      launchDirectory: getLaunchDirectory(),
      loadedAt: new Date().toISOString(),
      installedState: await loadInstalledSkillsState(),
    };
  }
);

const refreshDashboardStateServerFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown): { previousState?: InstalledSkillsState } => {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return {};
    }

    const payload = input as { previousState?: InstalledSkillsState };
    return {
      previousState: payload.previousState,
    };
  })
  .handler(async ({ data }): Promise<DashboardPayload> => {
    return {
      launchDirectory: getLaunchDirectory(),
      loadedAt: new Date().toISOString(),
      installedState: await loadInstalledSkillsState({ previousState: data.previousState }),
    };
  });

export const Route = createFileRoute('/')({
  loader: async () => loadDashboardStateServerFn(),
  pendingComponent: DashboardLoading,
  component: DashboardPage,
});

function DashboardPage() {
  const initialPayload = Route.useLoaderData();
  const refreshDashboard = useServerFn(refreshDashboardStateServerFn);

  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [dashboardPayload, setDashboardPayload] = useState<DashboardPayload>(initialPayload);
  const [unexpectedRefreshError, setUnexpectedRefreshError] = useState<string | null>(null);

  useEffect(() => {
    setDashboardPayload(initialPayload);
  }, [initialPayload]);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  const visibleScopes = useMemo((): readonly SkillScope[] => {
    if (scopeFilter === 'all') {
      return ['project', 'global'];
    }

    return [scopeFilter];
  }, [scopeFilter]);

  const totalInstalledSkills =
    dashboardPayload.installedState.project.skills.length +
    dashboardPayload.installedState.global.skills.length;

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setTheme(nextTheme);
  };

  const handleRefresh = async () => {
    if (isRefreshing) {
      return;
    }

    setUnexpectedRefreshError(null);
    setIsRefreshing(true);

    try {
      const refreshed = await refreshDashboard({
        data: {
          previousState: dashboardPayload.installedState,
        },
      });
      setDashboardPayload(refreshed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setUnexpectedRefreshError(`Refresh request failed: ${message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const hasScopeErrors = Boolean(
    dashboardPayload.installedState.project.error || dashboardPayload.installedState.global.error
  );

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
        <header className="flex flex-col gap-4 rounded-3xl border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Skills Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Installed skills from the local `npx skills list` command.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={toggleTheme}
                variant="outline"
                size="sm"
                aria-label="Toggle light and dark theme"
              >
                {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
                <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
              </Button>
              <Button
                onClick={() => void handleRefresh()}
                variant="default"
                size="sm"
                disabled={isRefreshing}
              >
                <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Refreshing' : 'Refresh'}</span>
              </Button>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl border bg-muted/50 px-3 py-2 text-xs sm:text-sm">
            <FolderCode className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="break-all">
              <span className="font-medium">Launch directory:</span>{' '}
              {dashboardPayload.launchDirectory}
            </p>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            title="Project"
            subtitle="Project scope"
            icon={<FolderCode className="size-4" />}
            count={dashboardPayload.installedState.project.skills.length}
          />
          <SummaryCard
            title="Global"
            subtitle="Global scope"
            icon={<Globe className="size-4" />}
            count={dashboardPayload.installedState.global.skills.length}
          />
          <SummaryCard
            title="Total"
            subtitle={`Last loaded ${formatDateTime(dashboardPayload.loadedAt)}`}
            icon={<CheckCircle2 className="size-4" />}
            count={totalInstalledSkills}
          />
        </section>

        {unexpectedRefreshError ? (
          <StatusCallout
            icon={<XCircle className="size-4 text-destructive" />}
            className="border-destructive/40 bg-destructive/5"
            message={unexpectedRefreshError}
          />
        ) : null}

        {isRefreshing ? (
          <StatusCallout
            icon={<RefreshCw className="size-4 animate-spin text-muted-foreground" />}
            className="border-border bg-muted/40"
            message="Refreshing installed skills..."
          />
        ) : null}

        {hasScopeErrors ? (
          <StatusCallout
            icon={<AlertTriangle className="size-4 text-amber-500" />}
            className="border-amber-500/40 bg-amber-500/5"
            message="One or more scope refreshes failed. Command output is available in the panel."
          />
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <ScopeFilterButton
                active={scopeFilter === 'all'}
                label={`All (${totalInstalledSkills})`}
                onClick={() => setScopeFilter('all')}
              />
              <ScopeFilterButton
                active={scopeFilter === 'project'}
                label={`Project (${dashboardPayload.installedState.project.skills.length})`}
                onClick={() => setScopeFilter('project')}
              />
              <ScopeFilterButton
                active={scopeFilter === 'global'}
                label={`Global (${dashboardPayload.installedState.global.skills.length})`}
                onClick={() => setScopeFilter('global')}
              />
            </div>

            {totalInstalledSkills === 0 && !hasScopeErrors ? (
              <Card className="border shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">No installed skills</CardTitle>
                  <CardDescription>
                    Run a skill install command, then refresh this dashboard to see installed
                    entries.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : null}

            {visibleScopes.map((scope) => {
              const scopeState = dashboardPayload.installedState[scope];
              return <ScopeSkillsCard key={scope} scope={scope} scopeState={scopeState} />;
            })}
          </section>

          <aside className="space-y-4">
            <Card className="border shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TerminalSquare className="size-4" />
                  Command Output
                </CardTitle>
                <CardDescription>Latest `npx skills list` output for each scope.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CommandOutputSection
                  scope="project"
                  scopeState={dashboardPayload.installedState.project}
                />
                <Separator />
                <CommandOutputSection
                  scope="global"
                  scopeState={dashboardPayload.installedState.global}
                />
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}

function ScopeSkillsCard(props: { scope: SkillScope; scopeState: InstalledSkillsScopeState }) {
  const { scope, scopeState } = props;

  return (
    <Card className="border shadow-none">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{scopeLabel(scope)} Skills</CardTitle>
          <Badge variant="secondary">{scopeState.skills.length}</Badge>
        </div>
        <CardDescription>
          Last successful load: {formatLastSuccess(scopeState.lastSuccessfulAt)}
        </CardDescription>
        {scopeState.error ? (
          <StatusCallout
            icon={<AlertTriangle className="size-4 text-amber-500" />}
            className="border-amber-500/40 bg-amber-500/5"
            message={scopeState.error}
          />
        ) : null}
        {scopeState.stale ? (
          <StatusCallout
            icon={<AlertTriangle className="size-4 text-amber-500" />}
            className="border-amber-500/40 bg-amber-500/5"
            message="Showing the previous successful result because refresh failed."
          />
        ) : null}
      </CardHeader>
      <CardContent>
        {scopeState.skills.length === 0 ? (
          <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
            No skills installed in the {scope} scope.
          </p>
        ) : (
          <ul className="space-y-2">
            {scopeState.skills.map((skill) => (
              <SkillRow key={skill.id} skill={skill} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SkillRow({ skill }: { skill: InstalledSkill }) {
  const sourceText = skill.source ?? skill.path ?? 'Unknown source';
  const activityValue = skill.updatedAt ?? skill.installedAt;

  return (
    <li className="rounded-xl border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-sm font-medium">{skill.name}</p>
        {skill.sourceType ? <Badge variant="outline">{skill.sourceType}</Badge> : null}
        {skill.ref ? <Badge variant="outline">ref: {skill.ref}</Badge> : null}
      </div>
      <p className="mt-1 text-xs break-all text-muted-foreground">{sourceText}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <Badge variant="secondary">{scopeLabel(skill.scope)}</Badge>
        <Badge variant="outline">
          {activityValue ? `Updated ${formatDateTime(activityValue)}` : 'No timestamp'}
        </Badge>
      </div>
      {skill.agents.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {skill.agents.map((agent) => (
            <Badge key={agent} variant="outline">
              {agent}
            </Badge>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function CommandOutputSection(props: { scope: SkillScope; scopeState: InstalledSkillsScopeState }) {
  const { scope, scopeState } = props;
  const command = scopeState.command;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{scopeLabel(scope)}</h3>
        {command ? (
          <Badge variant={command.ok ? 'secondary' : 'destructive'}>
            {command.ok ? 'Succeeded' : 'Failed'}
          </Badge>
        ) : (
          <Badge variant="outline">Not run</Badge>
        )}
      </div>

      {command ? (
        <div className="space-y-2 text-xs">
          <p className="rounded-md border bg-muted/40 px-2 py-1 font-mono break-all">
            {command.command.join(' ')}
          </p>
          {command.stdout.trim() ? <OutputBlock label="stdout" value={command.stdout} /> : null}
          {command.stderr.trim() ? <OutputBlock label="stderr" value={command.stderr} /> : null}
          {command.exitCode === null ? null : (
            <p className="text-muted-foreground">Exit code: {command.exitCode}</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No command output available yet.</p>
      )}
    </section>
  );
}

function OutputBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="font-medium text-muted-foreground">{label}</p>
      <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">
        {value.trim()}
      </pre>
    </div>
  );
}

function ScopeFilterButton(props: { active: boolean; label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant={props.active ? 'default' : 'outline'} onClick={props.onClick}>
      {props.label}
    </Button>
  );
}

function SummaryCard(props: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  count: number;
}) {
  return (
    <Card className="border shadow-none">
      <CardHeader>
        <CardDescription className="flex items-center gap-2 text-xs tracking-wide uppercase">
          {props.icon}
          {props.title}
        </CardDescription>
        <CardTitle className="text-2xl">{props.count}</CardTitle>
        <CardDescription>{props.subtitle}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function StatusCallout(props: { icon: React.ReactNode; className: string; message: string }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${props.className}`}
    >
      <span className="mt-0.5 shrink-0">{props.icon}</span>
      <p>{props.message}</p>
    </div>
  );
}

function DashboardLoading() {
  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6">
        <div className="h-32 animate-pulse rounded-3xl border bg-muted/40" />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="h-28 animate-pulse rounded-3xl border bg-muted/40" />
          <div className="h-28 animate-pulse rounded-3xl border bg-muted/40" />
          <div className="h-28 animate-pulse rounded-3xl border bg-muted/40" />
        </div>
        <div className="h-80 animate-pulse rounded-3xl border bg-muted/40" />
      </div>
    </main>
  );
}

const scopeLabel = (scope: SkillScope): string => {
  return scope === 'project' ? 'Project' : 'Global';
};

const formatLastSuccess = (value: string | null): string => {
  if (!value) {
    return 'Never';
  }

  return formatDateTime(value);
};

const formatDateTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
};
