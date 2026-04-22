import {
  type FormEvent,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FolderCode,
  Globe,
  Menu,
  Moon,
  Package,
  RefreshCw,
  Search,
  Settings,
  Sun,
  TerminalSquare,
  X,
} from 'lucide-react';
import { Link, Outlet, useParams, useRouterState } from '@tanstack/react-router';

import type {
  DashboardPayload,
  InstalledSkillsScopeState,
  InstalledSkillsState,
  SearchResultSkill,
  SkillsCommandResult,
} from '../features/skills/state';
import type { InstalledSkill, SkillScope } from '../features/skills/types';
import { fetchDashboardState, refreshDashboardState, searchSkills } from './api';
import { Badge } from './components/ui/badge';
import { Button, buttonVariants } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Separator } from './components/ui/separator';
import { cn } from './lib/utils';

type Theme = 'light' | 'dark';
type ScopeFilter = 'all' | SkillScope;
type SortOption = 'relevance' | 'name' | 'updated' | 'scope';
type InstalledTab = 'all' | SkillScope;
type SkillDetailsTab = 'overview' | 'activity' | 'output';
type SearchStatus = 'idle' | 'pending' | 'success' | 'empty' | 'error';

type BrowserSkill = InstalledSkill & {
  description: string;
  primarySource: string;
  activityAt: string | null;
  installCommand: string;
};

type DashboardDataValue = {
  payload: DashboardPayload | null;
  skills: BrowserSkill[];
  isInitialLoading: boolean;
  isRefreshing: boolean;
  errorMessage: string | null;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
  getSkillById: (skillId: string) => BrowserSkill | undefined;
};

const THEME_STORAGE_KEY = 'skills-browser-theme';

const DashboardDataContext = createContext<DashboardDataValue | null>(null);

export function RootLayout() {
  return (
    <DashboardDataProvider>
      <div className="min-h-svh bg-background">
        <TopBar />
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </DashboardDataProvider>
  );
}

export function BrowsePage() {
  const { payload, skills, isInitialLoading, errorMessage, reload } = useDashboardData();
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sort, setSort] = useState<SortOption>('relevance');
  const [copiedSkillId, setCopiedSkillId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const [searchResults, setSearchResults] = useState<SearchResultSkill[]>([]);
  const [searchCommand, setSearchCommand] = useState<SkillsCommandResult | null>(null);
  const [searchErrorMessage, setSearchErrorMessage] = useState<string | null>(null);
  const [searchParseWarning, setSearchParseWarning] = useState<string | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState<string | null>(null);

  const sourceOptions = useMemo(() => {
    const values = new Set<string>();

    for (const skill of skills) {
      values.add(skill.sourceType ?? 'unknown');
    }

    return ['all', ...Array.from(values).sort((left, right) => left.localeCompare(right))];
  }, [skills]);

  const visibleSkills = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    let next = [...skills];

    if (scopeFilter !== 'all') {
      next = next.filter((skill) => skill.scope === scopeFilter);
    }

    if (sourceFilter !== 'all') {
      next = next.filter((skill) => (skill.sourceType ?? 'unknown') === sourceFilter);
    }

    if (normalizedSearch.length > 0) {
      next = next.filter((skill) => {
        const haystack = [
          skill.name,
          skill.description,
          skill.primarySource,
          skill.scope,
          skill.sourceType ?? '',
          skill.ref ?? '',
          ...skill.agents,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      });
    }

    switch (sort) {
      case 'name':
        next.sort((left, right) => left.name.localeCompare(right.name));
        break;
      case 'updated':
        next.sort((left, right) => {
          const leftValue = left.activityAt ? Date.parse(left.activityAt) : 0;
          const rightValue = right.activityAt ? Date.parse(right.activityAt) : 0;
          return rightValue - leftValue;
        });
        break;
      case 'scope':
        next.sort((left, right) => {
          const byScope = left.scope.localeCompare(right.scope);
          if (byScope !== 0) {
            return byScope;
          }

          return left.name.localeCompare(right.name);
        });
        break;
      default:
        next.sort((left, right) => {
          const leftValue = left.activityAt ? Date.parse(left.activityAt) : 0;
          const rightValue = right.activityAt ? Date.parse(right.activityAt) : 0;

          if (leftValue !== rightValue) {
            return rightValue - leftValue;
          }

          return left.name.localeCompare(right.name);
        });
    }

    return next;
  }, [scopeFilter, search, skills, sort, sourceFilter]);

  const totalInstalled = payload
    ? payload.installedState.project.skills.length + payload.installedState.global.skills.length
    : 0;

  const handleCopyCommand = async (skill: BrowserSkill) => {
    try {
      await navigator.clipboard.writeText(skill.installCommand);
      setCopiedSkillId(skill.id);
      window.setTimeout(() => {
        setCopiedSkillId((current) => (current === skill.id ? null : current));
      }, 1200);
    } catch {
      setCopiedSkillId(null);
    }
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query.length === 0) {
      setSearchStatus('error');
      setSearchResults([]);
      setSearchErrorMessage('Search query is required.');
      setSearchParseWarning(null);
      return;
    }

    setSearchStatus('pending');
    setSearchErrorMessage(null);
    setSearchParseWarning(null);
    setLastSearchQuery(query);

    try {
      const response = await searchSkills(query);
      const nextSearchState = response.searchState;
      setSearchResults(nextSearchState.results);
      setSearchCommand(nextSearchState.command);
      setSearchParseWarning(nextSearchState.parseWarning);

      if (nextSearchState.error) {
        setSearchStatus('error');
        setSearchErrorMessage(nextSearchState.error);
        return;
      }

      if (nextSearchState.results.length === 0) {
        setSearchStatus('empty');
        return;
      }

      setSearchStatus('success');
    } catch (error) {
      setSearchStatus('error');
      setSearchResults([]);
      setSearchParseWarning(null);
      setSearchErrorMessage(`Search request failed: ${getErrorMessage(error)}`);
    }
  };

  if (isInitialLoading && !payload) {
    return <PageLoadingState />;
  }

  if (!payload) {
    return (
      <Card className="border shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Unable to load skills</CardTitle>
          <CardDescription>{errorMessage ?? 'No data is available yet.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" onClick={() => void reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Browse Skills</h1>
        <p className="text-sm text-muted-foreground">
          Discover and inspect installed AI agent skills from local command output.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          title="Project"
          subtitle="Project scope"
          icon={<FolderCode className="size-4" />}
          count={payload.installedState.project.skills.length}
        />
        <SummaryCard
          title="Global"
          subtitle="Global scope"
          icon={<Globe className="size-4" />}
          count={payload.installedState.global.skills.length}
        />
        <SummaryCard
          title="Total"
          subtitle={`Last loaded ${formatDateTime(payload.loadedAt)}`}
          icon={<CheckCircle2 className="size-4" />}
          count={totalInstalled}
        />
      </section>

      {errorMessage ? (
        <StatusBanner
          className="border-destructive/40 bg-destructive/5"
          icon={<X className="size-4 text-destructive" />}
          message={errorMessage}
        />
      ) : null}

      <Card className="border shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Discover Skills</CardTitle>
          <CardDescription>
            Search registry packages via `npx skills find &lt;query&gt;`
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={(event) => void handleSearch(event)}
          >
            <label className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search skills to install"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 pl-9 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                aria-label="Search skills query"
              />
            </label>
            <Button type="submit" disabled={searchStatus === 'pending'}>
              {searchStatus === 'pending' ? 'Searching' : 'Search'}
            </Button>
          </form>

          {searchStatus === 'idle' ? (
            <p className="text-sm text-muted-foreground">
              Run a search to find installable skills from the upstream CLI.
            </p>
          ) : null}

          {searchStatus === 'pending' ? (
            <p className="text-sm text-muted-foreground">Searching for "{lastSearchQuery}"...</p>
          ) : null}

          {searchStatus === 'error' && searchErrorMessage ? (
            <StatusBanner
              className="border-destructive/40 bg-destructive/5"
              icon={<X className="size-4 text-destructive" />}
              message={searchErrorMessage}
            />
          ) : null}

          {searchStatus === 'empty' ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No skills found for "{lastSearchQuery}".
            </p>
          ) : null}

          {searchStatus === 'success' ? (
            <ul className="space-y-2">
              {searchResults.map((result) => (
                <li key={result.id} className="rounded-lg border p-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-medium">{result.source}</p>
                      {result.installs ? (
                        <Badge variant="outline">{result.installs} installs</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {result.owner}/{result.repository}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <code className="rounded-md border bg-muted/40 px-2 py-1 font-mono">
                        npx skills add {result.source}
                      </code>
                      {result.url ? (
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noreferrer"
                          className={buttonVariants({ variant: 'outline', size: 'sm' })}
                        >
                          <ExternalLink className="size-4" />
                          <span>Open</span>
                        </a>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {searchParseWarning ? (
            <p className="text-xs text-muted-foreground">{searchParseWarning}</p>
          ) : null}
        </CardContent>
      </Card>

      <SearchCommandOutputCard command={searchCommand} />

      <Card className="border shadow-none">
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <label className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search skills"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 pl-9 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              />
            </label>

            <select
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value as ScopeFilter)}
              className="h-9 min-w-30 rounded-md border bg-background px-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              aria-label="Filter by scope"
            >
              <option value="all">All scopes</option>
              <option value="project">Project</option>
              <option value="global">Global</option>
            </select>

            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              className="h-9 min-w-32 rounded-md border bg-background px-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              aria-label="Filter by source"
            >
              {sourceOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All sources' : option}
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOption)}
              className="h-9 min-w-32 rounded-md border bg-background px-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              aria-label="Sort skills"
            >
              <option value="relevance">Relevance</option>
              <option value="updated">Recently updated</option>
              <option value="name">Name</option>
              <option value="scope">Scope</option>
            </select>
          </div>

          <p className="text-sm text-muted-foreground">
            {visibleSkills.length} skill{visibleSkills.length === 1 ? '' : 's'}
          </p>
        </CardContent>
      </Card>

      {visibleSkills.length === 0 ? (
        <Card className="border shadow-none">
          <CardHeader>
            <CardTitle className="text-base">No matching skills</CardTitle>
            <CardDescription>Adjust your filters or clear the search query.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleSkills.map((skill) => (
            <article
              key={skill.id}
              className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/skill/$skillId"
                      params={{ skillId: skill.id }}
                      className="font-mono text-sm font-medium hover:underline"
                    >
                      {skill.name}
                    </Link>
                    <Badge variant="secondary">{scopeLabel(skill.scope)}</Badge>
                    {skill.sourceType ? <Badge variant="outline">{skill.sourceType}</Badge> : null}
                    {skill.ref ? <Badge variant="outline">ref: {skill.ref}</Badge> : null}
                  </div>

                  <p className="text-sm text-muted-foreground">{skill.description}</p>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{skill.primarySource}</span>
                    <span className="text-border">•</span>
                    <span>
                      {skill.activityAt
                        ? `Updated ${formatDateTime(skill.activityAt)}`
                        : 'No update timestamp'}
                    </span>
                  </div>

                  {skill.agents.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {skill.agents.map((agent) => (
                        <Badge key={`${skill.id}:${agent}`} variant="outline">
                          {agent}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => void handleCopyCommand(skill)}>
                    {copiedSkillId === skill.id ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    <span>{copiedSkillId === skill.id ? 'Copied' : 'Copy install'}</span>
                  </Button>
                  <Link
                    to="/skill/$skillId"
                    params={{ skillId: skill.id }}
                    className={buttonVariants({ variant: 'default', size: 'sm' })}
                  >
                    <ExternalLink className="size-4" />
                    <span>Details</span>
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function InstalledPage() {
  const { payload, skills, isInitialLoading, errorMessage, reload } = useDashboardData();
  const [activeTab, setActiveTab] = useState<InstalledTab>('all');
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());

  useEffect(() => {
    const validIds = new Set(skills.map((skill) => skill.id));
    setSelectedSkills((current) => {
      const next = new Set(Array.from(current).filter((id) => validIds.has(id)));
      return next;
    });
  }, [skills]);

  const visibleSkills = useMemo(() => {
    if (activeTab === 'all') {
      return skills;
    }

    return skills.filter((skill) => skill.scope === activeTab);
  }, [activeTab, skills]);

  const selectAllVisible = () => {
    setSelectedSkills(new Set(visibleSkills.map((skill) => skill.id)));
  };

  const clearSelection = () => {
    setSelectedSkills(new Set());
  };

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((current) => {
      const next = new Set(current);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }

      return next;
    });
  };

  if (isInitialLoading && !payload) {
    return <PageLoadingState />;
  }

  if (!payload) {
    return (
      <Card className="border shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Unable to load installed skills</CardTitle>
          <CardDescription>{errorMessage ?? 'No data is available yet.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" onClick={() => void reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const projectSkills = skills.filter((skill) => skill.scope === 'project');
  const globalSkills = skills.filter((skill) => skill.scope === 'global');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Installed Skills</h1>
          <p className="text-sm text-muted-foreground">
            {skills.length} skill{skills.length === 1 ? '' : 's'} installed
          </p>
        </div>

        {selectedSkills.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{selectedSkills.size} selected</span>
            <Button variant="outline" size="sm" onClick={clearSelection}>
              Clear
            </Button>
            <Button variant="outline" size="sm">
              Update selected
            </Button>
            <Button variant="destructive" size="sm">
              Remove
            </Button>
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <StatusBanner
          className="border-destructive/40 bg-destructive/5"
          icon={<X className="size-4 text-destructive" />}
          message={errorMessage}
        />
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          title="Project"
          subtitle="Project scope"
          icon={<FolderCode className="size-4" />}
          count={projectSkills.length}
        />
        <SummaryCard
          title="Global"
          subtitle="Global scope"
          icon={<Globe className="size-4" />}
          count={globalSkills.length}
        />
        <SummaryCard
          title="Selected"
          subtitle="Current selection"
          icon={<CheckCircle2 className="size-4" />}
          count={selectedSkills.size}
        />
      </section>

      <Card className="border shadow-none">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={activeTab === 'all' ? 'default' : 'outline'}
              onClick={() => setActiveTab('all')}
            >
              All ({skills.length})
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'project' ? 'default' : 'outline'}
              onClick={() => setActiveTab('project')}
            >
              Project ({projectSkills.length})
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'global' ? 'default' : 'outline'}
              onClick={() => setActiveTab('global')}
            >
              Global ({globalSkills.length})
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={selectAllVisible}>
                Select visible
              </Button>
              <Button size="sm" variant="outline" onClick={clearSelection}>
                Clear
              </Button>
            </div>
          </div>

          {visibleSkills.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No skills available for this scope.
            </p>
          ) : (
            <ul className="space-y-2">
              {visibleSkills.map((skill) => (
                <li key={skill.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <label className="flex h-8 items-center">
                      <input
                        type="checkbox"
                        checked={selectedSkills.has(skill.id)}
                        onChange={() => toggleSkill(skill.id)}
                        className="size-4 rounded border-input text-primary focus-visible:ring-3 focus-visible:ring-ring/30"
                        aria-label={`Select ${skill.name}`}
                      />
                    </label>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/skill/$skillId"
                          params={{ skillId: skill.id }}
                          className="font-mono text-sm font-medium hover:underline"
                        >
                          {skill.name}
                        </Link>
                        <Badge variant="secondary">{scopeLabel(skill.scope)}</Badge>
                        {skill.sourceType ? (
                          <Badge variant="outline">{skill.sourceType}</Badge>
                        ) : null}
                      </div>

                      <p className="text-sm text-muted-foreground">{skill.description}</p>
                      <p className="text-xs break-all text-muted-foreground">
                        {skill.primarySource}
                      </p>
                    </div>
                    <Link
                      to="/skill/$skillId"
                      params={{ skillId: skill.id }}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      <ExternalLink className="size-4" />
                      <span>Open</span>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <CommandOutputCard scope="project" scopeState={payload.installedState.project} />
        <CommandOutputCard scope="global" scopeState={payload.installedState.global} />
      </div>
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Browse
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure Skills Browser preferences</p>
      </div>

      <Separator />

      <Card className="border shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Registry</CardTitle>
          <CardDescription>Core fetch and execution settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="registry-url" className="text-sm font-medium">
              Registry URL
            </label>
            <input
              id="registry-url"
              defaultValue="https://registry.skills.sh"
              className="h-9 w-full rounded-md border bg-background px-3 font-mono text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            <p className="text-xs text-muted-foreground">
              The skills registry to fetch packages from
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cache-dir" className="text-sm font-medium">
              Cache Directory
            </label>
            <input
              id="cache-dir"
              defaultValue="~/.skills/cache"
              className="h-9 w-full rounded-md border bg-background px-3 font-mono text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            <p className="text-xs text-muted-foreground">
              Local directory for caching skill packages
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="default-shell" className="text-sm font-medium">
              Default Shell
            </label>
            <select
              id="default-shell"
              defaultValue="zsh"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <option value="bash">Bash</option>
              <option value="zsh">Zsh</option>
              <option value="fish">Fish</option>
              <option value="powershell">PowerShell</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="border shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Behavior</CardTitle>
          <CardDescription>Client-side preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingsSwitch
            id="auto-update"
            title="Auto-update skills"
            description="Automatically update skills when new versions are available"
          />
          <SettingsSwitch
            id="telemetry"
            title="Usage analytics"
            description="Send anonymous usage data to help improve skills.sh"
            defaultChecked
          />
          <SettingsSwitch
            id="prerelease"
            title="Show pre-release versions"
            description="Include alpha and beta releases in search results"
          />
          <SettingsSwitch
            id="offline"
            title="Offline mode"
            description="Use cached data when network is unavailable"
            defaultChecked
          />
        </CardContent>
      </Card>

      <Card className="border shadow-none">
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
          <CardDescription>Project and CLI metadata</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Skills Browser v0.0.1</p>
            <p>CLI: skills (detected at runtime)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="https://skills.sh/docs"
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ExternalLink className="size-4" />
              <span>Documentation</span>
            </a>
            <a
              href="https://github.com/skills-sh/skills"
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ExternalLink className="size-4" />
              <span>GitHub</span>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function SkillDetailsPage() {
  const { skillId } = useParams({ from: '/skill/$skillId' });
  const { payload, isInitialLoading, skills, getSkillById } = useDashboardData();
  const [activeTab, setActiveTab] = useState<SkillDetailsTab>('overview');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setActiveTab('overview');
    setCopied(false);
  }, [skillId]);

  const skill = getSkillById(skillId);

  if (isInitialLoading && skills.length === 0) {
    return <PageLoadingState />;
  }

  if (!skill || !payload) {
    return (
      <Card className="border shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Skill not found</CardTitle>
          <CardDescription>
            The skill identifier does not exist in the current dashboard payload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Back to Browse
          </Link>
        </CardContent>
      </Card>
    );
  }

  const scopeState = payload.installedState[skill.scope];

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(skill.installCommand);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Browse
      </Link>

      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-2xl font-semibold">{skill.name}</h1>
              <Badge variant="secondary">{scopeLabel(skill.scope)}</Badge>
              {skill.sourceType ? <Badge variant="outline">{skill.sourceType}</Badge> : null}
              {skill.ref ? <Badge variant="outline">ref: {skill.ref}</Badge> : null}
            </div>
            <p className="text-muted-foreground">{skill.description}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{skill.primarySource}</span>
              <span className="text-border">•</span>
              <span>
                {skill.activityAt
                  ? `Updated ${formatDateTime(skill.activityAt)}`
                  : 'No update timestamp available'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void handleCopyCommand()}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              <span>{copied ? 'Copied' : 'Copy install'}</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm">
          <span className="text-muted-foreground">$</span>
          <code className="min-w-0 flex-1 break-all">{skill.installCommand}</code>
        </div>

        {skill.agents.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {skill.agents.map((agent) => (
              <Badge key={`${skill.id}:${agent}`} variant="outline">
                {agent}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={activeTab === 'overview' ? 'default' : 'outline'}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'activity' ? 'default' : 'outline'}
            onClick={() => setActiveTab('activity')}
          >
            Activity
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'output' ? 'default' : 'outline'}
            onClick={() => setActiveTab('output')}
          >
            Command Output
          </Button>
        </div>

        {activeTab === 'overview' ? (
          <Card className="border shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Skill Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <MetadataRow label="Name" value={skill.name} mono />
                <MetadataRow label="Scope" value={scopeLabel(skill.scope)} />
                <MetadataRow label="Source" value={skill.primarySource} mono />
                <MetadataRow label="Source Type" value={skill.sourceType ?? 'Unknown'} />
                <MetadataRow label="Installed At" value={formatNullableDate(skill.installedAt)} />
                <MetadataRow label="Updated At" value={formatNullableDate(skill.updatedAt)} />
              </dl>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === 'activity' ? (
          <Card className="border shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {buildSkillActivity(skill, payload.loadedAt).map((item) => (
                  <div
                    key={`${skill.id}:${item.label}:${item.timestamp}`}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span>{item.label}</span>
                    <span className="text-muted-foreground">{item.timestamp}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === 'output' ? (
          <CommandOutputCard scope={skill.scope} scopeState={scopeState} />
        ) : null}
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[50svh] w-full max-w-xl flex-col justify-center gap-3 p-6 text-sm">
      <h1 className="text-lg font-medium">Page not found</h1>
      <p className="text-muted-foreground">The page you requested does not exist.</p>
      <Link className="underline underline-offset-4" to="/">
        Go back home
      </Link>
    </main>
  );
}

function TopBar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(getThemeFromDom);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { isRefreshing, refresh } = useDashboardData();

  useEffect(() => {
    setTheme(getThemeFromDom());
  }, []);

  const isBrowseActive = pathname === '/' || pathname.startsWith('/skill/');

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';

    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setTheme(nextTheme);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Package className="size-5" />
            <span className="hidden sm:inline">Skills Browser</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link
              to="/"
              className={buttonVariants({
                variant: isBrowseActive ? 'secondary' : 'ghost',
                size: 'sm',
              })}
            >
              Browse
            </Link>
            <Link
              to="/installed"
              className={buttonVariants({
                variant: pathname === '/installed' ? 'secondary' : 'ghost',
                size: 'sm',
              })}
            >
              Installed
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isRefreshing}
            onClick={() => void refresh()}
            aria-label="Refresh installed skills"
          >
            <RefreshCw className={cn('size-4', isRefreshing ? 'animate-spin' : undefined)} />
            <span>{isRefreshing ? 'Refreshing' : 'Refresh'}</span>
          </Button>

          <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          <Link
            to="/settings"
            aria-label="Settings"
            className={buttonVariants({
              variant: pathname === '/settings' ? 'secondary' : 'ghost',
              size: 'icon-sm',
            })}
          >
            <Settings className="size-4" />
          </Link>

          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <nav className="border-t px-4 py-2 md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            <Link
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className={buttonVariants({
                variant: isBrowseActive ? 'secondary' : 'ghost',
                size: 'sm',
              })}
            >
              Browse
            </Link>
            <Link
              to="/installed"
              onClick={() => setIsMobileMenuOpen(false)}
              className={buttonVariants({
                variant: pathname === '/installed' ? 'secondary' : 'ghost',
                size: 'sm',
              })}
            >
              Installed
            </Link>
            <Link
              to="/settings"
              onClick={() => setIsMobileMenuOpen(false)}
              className={buttonVariants({
                variant: pathname === '/settings' ? 'secondary' : 'ghost',
                size: 'sm',
              })}
            >
              Settings
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}

function DashboardDataProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMessage(null);
    setIsInitialLoading(true);

    try {
      const next = await fetchDashboardState();
      setPayload(next);
    } catch (error) {
      setErrorMessage(`Dashboard load failed: ${getErrorMessage(error)}`);
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    if (isRefreshing) {
      return;
    }

    setErrorMessage(null);
    setIsRefreshing(true);

    try {
      const next = payload
        ? await refreshDashboardState(payload.installedState)
        : await fetchDashboardState();
      setPayload(next);
    } catch (error) {
      setErrorMessage(`Refresh request failed: ${getErrorMessage(error)}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, payload]);

  const skills = useMemo(() => {
    if (!payload) {
      return [];
    }

    return buildSkills(payload.installedState);
  }, [payload]);

  const getSkillById = (skillId: string): BrowserSkill | undefined => {
    return skills.find((skill) => skill.id === skillId);
  };

  const contextValue: DashboardDataValue = {
    payload,
    skills,
    isInitialLoading,
    isRefreshing,
    errorMessage,
    reload: load,
    refresh,
    getSkillById,
  };

  return (
    <DashboardDataContext.Provider value={contextValue}>{children}</DashboardDataContext.Provider>
  );
}

function useDashboardData(): DashboardDataValue {
  const context = useContext(DashboardDataContext);

  if (!context) {
    throw new Error('useDashboardData must be used within DashboardDataProvider.');
  }

  return context;
}

function SummaryCard(props: { title: string; subtitle: string; icon: ReactNode; count: number }) {
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

function StatusBanner(props: { icon: ReactNode; className: string; message: string }) {
  return (
    <div
      className={cn('flex items-start gap-2 rounded-xl border px-3 py-2 text-sm', props.className)}
    >
      <span className="mt-0.5 shrink-0">{props.icon}</span>
      <p>{props.message}</p>
    </div>
  );
}

function SearchCommandOutputCard(props: { command: SkillsCommandResult | null }) {
  const { command } = props;

  return (
    <Card className="border shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TerminalSquare className="size-4" />
          Search Command Output
        </CardTitle>
        <CardDescription>Latest `npx skills find` output</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {command ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <code className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs break-all">
                {command.command.join(' ')}
              </code>
              <Badge variant={command.ok ? 'secondary' : 'destructive'}>
                {command.ok ? 'Succeeded' : 'Failed'}
              </Badge>
            </div>

            {command.stdout.trim() ? (
              <OutputBlock label="stdout" value={command.stdout} />
            ) : (
              <p className="text-xs text-muted-foreground">No stdout output.</p>
            )}

            {command.stderr.trim() ? <OutputBlock label="stderr" value={command.stderr} /> : null}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No search command output available yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function CommandOutputCard(props: { scope: SkillScope; scopeState: InstalledSkillsScopeState }) {
  const { scope, scopeState } = props;
  const command = scopeState.command;

  return (
    <Card className="border shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TerminalSquare className="size-4" />
          {scopeLabel(scope)} Command Output
        </CardTitle>
        <CardDescription>Latest `npx skills list` output</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {command ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <code className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs break-all">
                {command.command.join(' ')}
              </code>
              <Badge variant={command.ok ? 'secondary' : 'destructive'}>
                {command.ok ? 'Succeeded' : 'Failed'}
              </Badge>
            </div>

            {command.stdout.trim() ? (
              <OutputBlock label="stdout" value={command.stdout} />
            ) : (
              <p className="text-xs text-muted-foreground">No stdout output.</p>
            )}

            {command.stderr.trim() ? <OutputBlock label="stderr" value={command.stderr} /> : null}

            {scopeState.error ? (
              <p className="text-xs text-destructive">{scopeState.error}</p>
            ) : null}

            {scopeState.stale ? (
              <p className="text-xs text-amber-500">
                Showing stale data from previous successful load.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No command output available yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function OutputBlock(props: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{props.label}</p>
      <pre className="max-h-56 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">
        {props.value.trim()}
      </pre>
    </div>
  );
}

function PageLoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-16 animate-pulse rounded-lg border bg-muted/40" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-24 animate-pulse rounded-lg border bg-muted/40" />
        <div className="h-24 animate-pulse rounded-lg border bg-muted/40" />
        <div className="h-24 animate-pulse rounded-lg border bg-muted/40" />
      </div>
      <div className="h-72 animate-pulse rounded-lg border bg-muted/40" />
    </div>
  );
}

function SettingsSwitch(props: {
  id: string;
  title: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <label
      htmlFor={props.id}
      className="flex items-center justify-between gap-3 rounded-lg border p-3"
    >
      <div className="space-y-0.5">
        <span className="text-sm font-medium">{props.title}</span>
        <p className="text-sm text-muted-foreground">{props.description}</p>
      </div>
      <input
        id={props.id}
        type="checkbox"
        defaultChecked={props.defaultChecked}
        className="size-4 rounded border-input text-primary focus-visible:ring-3 focus-visible:ring-ring/30"
      />
    </label>
  );
}

function MetadataRow(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1 rounded-lg border p-3">
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{props.label}</dt>
      <dd className={cn('text-sm', props.mono ? 'font-mono break-all' : undefined)}>
        {props.value}
      </dd>
    </div>
  );
}

const getThemeFromDom = (): Theme => {
  if (typeof document === 'undefined') {
    return 'light';
  }

  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
};

const buildSkills = (installedState: InstalledSkillsState): BrowserSkill[] => {
  const merged = [...installedState.project.skills, ...installedState.global.skills];

  return merged
    .map((skill) => {
      return {
        ...skill,
        description: buildSkillDescription(skill),
        primarySource: skill.source ?? skill.path ?? 'Unknown source',
        activityAt: skill.updatedAt ?? skill.installedAt ?? null,
        installCommand: buildInstallCommand(skill),
      };
    })
    .sort((left, right) => {
      const leftValue = left.activityAt ? Date.parse(left.activityAt) : 0;
      const rightValue = right.activityAt ? Date.parse(right.activityAt) : 0;

      if (leftValue !== rightValue) {
        return rightValue - leftValue;
      }

      return left.name.localeCompare(right.name);
    });
};

const buildSkillDescription = (skill: InstalledSkill): string => {
  const fragments: string[] = [];

  if (skill.sourceType) {
    fragments.push(`Source type: ${skill.sourceType}`);
  }

  if (skill.path) {
    fragments.push('Installed from local path');
  } else if (skill.source) {
    fragments.push('Installed from remote source');
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

const buildSkillActivity = (skill: BrowserSkill, loadedAt: string) => {
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

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const scopeLabel = (scope: SkillScope): string => {
  return scope === 'project' ? 'Project' : 'Global';
};

const formatNullableDate = (value: string | undefined): string => {
  if (!value) {
    return 'Unknown';
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
