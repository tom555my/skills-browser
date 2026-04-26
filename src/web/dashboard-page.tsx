import {
  type FormEvent,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  ExternalLink,
  FolderCode,
  Globe,
  Menu,
  Moon,
  Package,
  PackagePlus,
  RefreshCw,
  Search,
  Settings,
  Sun,
  TerminalSquare,
  Trash2,
  X,
} from 'lucide-react';
import { Link, Outlet, useParams, useRouterState } from '@tanstack/react-router';

import type {
  DashboardPayload,
  InstallSkillsResponse,
  InstalledSkillsScopeState,
  InstalledSkillsState,
  SearchResultSkill,
  SkillsCommandResult,
  UpdateSkillsRequest,
  UpdateSkillsResponse,
} from '../features/skills/state';
import type { InstalledSkill, SkillScope } from '../features/skills/types';
import {
  fetchDashboardState,
  installDashboardSkills,
  refreshDashboardState,
  removeInstalledSkills,
  searchSkills,
  updateDashboardSkills,
} from './api';
import { Badge } from './components/ui/badge';
import { Button, buttonVariants } from './components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './components/ui/card';
import { Checkbox } from './components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog';
import { Input } from './components/ui/input';
import { Separator } from './components/ui/separator';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select';
import { Skeleton } from './components/ui/skeleton';
import { cn } from './lib/utils';

type Theme = 'light' | 'dark';
type ScopeFilter = 'all' | SkillScope;
type InstalledTab = 'all' | SkillScope;
type SkillDetailsTab = 'overview' | 'activity' | 'output';
type SearchStatus = 'idle' | 'pending' | 'success' | 'empty' | 'error';

type BrowserSkill = InstalledSkill & {
  description: string;
  primarySource: string;
  activityAt: string | null;
  installCommand: string;
};

type RemoveOutcome = {
  status: 'success' | 'failure';
  scope: SkillScope;
  names: string[];
  command: SkillsCommandResult;
};

type InstallOutcome = {
  status: 'success' | 'failure';
  source: string;
  scope: SkillScope;
  command: SkillsCommandResult;
};

type UpdateStatus = {
  tone: 'success' | 'error';
  message: string;
} | null;

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
const INSTALL_DIALOG_EVENT = 'skills-browser:open-install-dialog';

const DashboardDataContext = createContext<DashboardDataValue | null>(null);

export function RootLayout() {
  return (
    <DashboardDataProvider>
      <div className="min-h-svh bg-background">
        <TopBar />
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <NuqsAdapter>
            <Outlet />
          </NuqsAdapter>
        </main>
      </div>
    </DashboardDataProvider>
  );
}

export function BrowsePage() {
  const { payload, skills, isInitialLoading, errorMessage, reload, refresh } = useDashboardData();
  const [copiedSkillId, setCopiedSkillId] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const [searchResults, setSearchResults] = useState<SearchResultSkill[]>([]);
  const [searchErrorMessage, setSearchErrorMessage] = useState<string | null>(null);
  const [searchParseWarning, setSearchParseWarning] = useState<string | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState<string | null>(null);
  const [installSource, setInstallSource] = useState('');
  const [installScope, setInstallScope] = useState<SkillScope>('project');
  const [installAgentsInput, setInstallAgentsInput] = useState('');
  const [installSkillsInput, setInstallSkillsInput] = useState('');
  const [installCopy, setInstallCopy] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [installOutcome, setInstallOutcome] = useState<InstallOutcome | null>(null);
  const installSearchInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''));
  const [scopeFilter, setScopeFilter] = useQueryState(
    'scope',
    parseAsStringEnum<ScopeFilter>(['all', 'project', 'global']).withDefault('all')
  );
  const [installParam, setInstallParam] = useQueryState(
    'install',
    parseAsString.withOptions({ history: 'push' })
  );
  const [searchQuery, setSearchQuery] = useQueryState('q', parseAsString.withDefault(''));
  const [previewId, setPreviewId] = useQueryState('preview');

  const visibleSkills = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    let next = [...skills];

    if (scopeFilter !== 'all') {
      next = next.filter((skill) => skill.scope === scopeFilter);
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

    next.sort((left, right) => {
      const leftValue = left.activityAt ? Date.parse(left.activityAt) : 0;
      const rightValue = right.activityAt ? Date.parse(right.activityAt) : 0;

      if (leftValue !== rightValue) {
        return rightValue - leftValue;
      }

      return left.name.localeCompare(right.name);
    });

    return next;
  }, [scopeFilter, search, skills]);

  const totalInstalled = payload
    ? payload.installedState.project.skills.length + payload.installedState.global.skills.length
    : 0;
  const hasSearchResultContainer = searchStatus !== 'idle';
  const selectedPreview = useMemo(() => {
    if (!previewId) {
      return null;
    }

    return searchResults.find((result) => result.id === previewId) ?? null;
  }, [previewId, searchResults]);
  const selectedPreviewUrl = selectedPreview?.url;
  const isInstallDialogOpen = installParam === '1';

  const openInstallDialog = useCallback(() => {
    void setInstallParam('1');
  }, [setInstallParam]);

  const closeInstallDialog = useCallback(() => {
    void setInstallParam(null);
    void setPreviewId(null);
  }, [setInstallParam, setPreviewId]);

  const handleInstallDialogOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        openInstallDialog();
        return;
      }

      closeInstallDialog();
    },
    [closeInstallDialog, openInstallDialog]
  );

  useEffect(() => {
    const handleOpenInstallDialog = () => openInstallDialog();

    window.addEventListener(INSTALL_DIALOG_EVENT, handleOpenInstallDialog);

    return () => {
      window.removeEventListener(INSTALL_DIALOG_EVENT, handleOpenInstallDialog);
    };
  }, [openInstallDialog]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openInstallDialog();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openInstallDialog]);

  useEffect(() => {
    if (!isInstallDialogOpen) {
      return;
    }

    window.setTimeout(() => installSearchInputRef.current?.focus(), 40);
  }, [isInstallDialogOpen, selectedPreview]);

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
    void setPreviewId(null);

    try {
      const response = await searchSkills(query);
      const nextSearchState = response.searchState;
      setSearchResults(nextSearchState.results);
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

  const applySearchResultSource = (source: string) => {
    setInstallSource(source);
    setInstallStatus(null);
  };

  const handlePreviewSearchResult = (result: SearchResultSkill) => {
    void setPreviewId(result.id);
    applySearchResultSource(result.source);
  };

  const handleInstall = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!payload) {
      return;
    }

    const source = installSource.trim();
    if (source.length === 0 || isInstalling) {
      setInstallStatus({
        tone: 'error',
        message: 'Skill source is required.',
      });
      return;
    }

    setIsInstalling(true);
    setInstallStatus(null);

    let response: InstallSkillsResponse;
    try {
      response = await installDashboardSkills({
        source,
        scope: installScope,
        agents: parseCommaSeparatedValues(installAgentsInput),
        skills: parseCommaSeparatedValues(installSkillsInput),
        copy: installCopy,
        previousState: payload.installedState,
      });
    } catch (error) {
      setInstallStatus({
        tone: 'error',
        message: `Install request failed: ${getErrorMessage(error)}`,
      });
      setIsInstalling(false);
      return;
    }

    const status = response.command.ok ? 'success' : 'failure';
    setInstallOutcome({
      status,
      source,
      scope: installScope,
      command: response.command,
    });

    if (!response.command.ok) {
      setInstallStatus({
        tone: 'error',
        message: createCommandFailureMessage(response.command),
      });
      setIsInstalling(false);
      return;
    }

    setInstallStatus({
      tone: 'success',
      message: `Installed "${source}" in ${scopeLabel(installScope)} scope.`,
    });

    try {
      await refresh();
    } catch (error) {
      setInstallStatus({
        tone: 'error',
        message: `Install succeeded but refresh failed: ${getErrorMessage(error)}`,
      });
    } finally {
      setIsInstalling(false);
    }
  };

  if (isInitialLoading && !payload) {
    return (
      <div className="space-y-6">
        <PageLoadingState />

        <Dialog open={isInstallDialogOpen} onOpenChange={handleInstallDialogOpenChange}>
          <DialogContent
            className="max-w-3xl border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-3xl"
            showCloseButton={false}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>Install skill</DialogTitle>
              <DialogDescription>Search for a skill to install.</DialogDescription>
            </DialogHeader>
            <div>
              <form
                className="relative flex h-14 items-center rounded-lg border bg-popover shadow-lg"
                onSubmit={(event) => void handleSearch(event)}
              >
                <Package className="pointer-events-none absolute left-4 size-5 text-foreground" />
                <Input
                  ref={installSearchInputRef}
                  type="search"
                  placeholder="Type here to search new skills"
                  value={searchQuery}
                  onChange={(event) => void setSearchQuery(event.target.value)}
                  className="h-full border-0 bg-transparent px-12 text-center text-base shadow-none focus-visible:ring-0 sm:text-lg"
                  aria-label="Search new skills"
                />
                <Button
                  type="submit"
                  size="icon-sm"
                  variant="ghost"
                  className="absolute right-3"
                  disabled={searchStatus === 'pending'}
                  aria-label="Search skills"
                >
                  <Search className={cn('size-4', searchStatus === 'pending' && 'animate-pulse')} />
                </Button>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
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
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="size-4" />
            <span>
              {totalInstalled} installed skill{totalInstalled === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'project', 'global'] as ScopeFilter[]).map((scope) => (
              <Button
                key={scope}
                size="sm"
                variant={scopeFilter === scope ? 'secondary' : 'outline'}
                onClick={() => void setScopeFilter(scope)}
              >
                {scope === 'all' ? 'All' : scopeLabel(scope)}
              </Button>
            ))}
            <Button size="sm" onClick={openInstallDialog}>
              <PackagePlus className="size-4" />
              <span>Install skill</span>
            </Button>
          </div>
        </div>

        <label className="relative flex h-12 items-center rounded-lg border bg-background shadow-xs">
          <Search className="pointer-events-none absolute left-4 size-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Type here to search"
            value={search}
            onChange={(event) => void setSearch(event.target.value)}
            className="h-full border-0 bg-transparent px-4 pl-11 shadow-none focus-visible:ring-0"
          />
          <span className="pointer-events-none absolute right-4 hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground sm:block">
            return
          </span>
        </label>
      </section>

      {errorMessage ? (
        <StatusBanner
          className="border-destructive/40 bg-destructive/5"
          icon={<X className="size-4 text-destructive" />}
          message={errorMessage}
        />
      ) : null}

      {visibleSkills.length === 0 ? (
        <Card className="mx-auto max-w-4xl border shadow-none">
          <CardHeader>
            <CardTitle className="text-base">No matching skills</CardTitle>
            <CardDescription>Adjust your filters or clear the search query.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-2">
          {visibleSkills.map((skill) => (
            <Card
              key={skill.id}
              size="sm"
              className="min-h-44 min-w-0 rounded-lg border shadow-none transition-colors hover:bg-accent/40"
            >
              <CardHeader>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <Link
                      to="/skill/$skillId"
                      params={{ skillId: skill.id }}
                      className="block truncate font-mono text-base font-medium hover:underline"
                    >
                      {skill.name}
                    </Link>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {skill.primarySource}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">{scopeLabel(skill.scope)}</Badge>
                      {skill.sourceType ? (
                        <Badge variant="outline">{skill.sourceType}</Badge>
                      ) : null}
                      {skill.ref ? <Badge variant="outline">ref: {skill.ref}</Badge> : null}
                    </div>
                  </div>

                  <CardAction className="static col-auto row-auto flex shrink-0 items-center gap-1 self-auto justify-self-auto">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Copy install command for ${skill.name}`}
                      onClick={() => void handleCopyCommand(skill)}
                    >
                      {copiedSkillId === skill.id ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                    <Link
                      to="/installed"
                      aria-label={`Manage ${skill.name}`}
                      className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                    >
                      <Trash2 className="size-4" />
                    </Link>
                    <Link
                      to="/skill/$skillId"
                      params={{ skillId: skill.id }}
                      aria-label={`Open ${skill.name} details`}
                      className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                    >
                      <ExternalLink className="size-4" />
                    </Link>
                  </CardAction>
                </div>
              </CardHeader>

              <CardContent className="mt-auto flex flex-col gap-2">
                <p className="line-clamp-2 text-sm text-muted-foreground">{skill.description}</p>
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Agents</p>
                  {skill.agents.length > 0 ? (
                    <div className="flex min-h-8 flex-wrap gap-1.5 rounded-md border border-dashed p-1.5">
                      {skill.agents.map((agent) => (
                        <Badge key={`${skill.id}:${agent}`} variant="outline">
                          {agent}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-8 items-center rounded-md border border-dashed px-2 text-xs text-muted-foreground">
                      No agents declared
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {installOutcome ? <InstallOperationCard outcome={installOutcome} /> : null}

      <Dialog open={isInstallDialogOpen} onOpenChange={handleInstallDialogOpenChange}>
        <DialogContent
          className={cn(
            'border-0 bg-transparent p-0 shadow-none ring-0',
            selectedPreview
              ? 'grid h-[calc(100svh-3rem)] max-w-[calc(100%-2rem)] gap-4 sm:max-w-[calc(100%-3rem)] lg:max-w-7xl lg:grid-cols-[22rem_minmax(0,1fr)]'
              : 'max-w-3xl sm:max-w-3xl'
          )}
          showCloseButton={Boolean(selectedPreview)}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Install skill</DialogTitle>
            <DialogDescription>Search for a skill, preview it, and install it.</DialogDescription>
          </DialogHeader>

          <div
            className={cn(
              'space-y-3',
              selectedPreview
                ? 'min-h-0 overflow-hidden rounded-xl border bg-popover p-3 shadow-lg'
                : undefined
            )}
          >
            <form
              className="relative flex h-14 items-center rounded-lg border bg-popover shadow-lg"
              onSubmit={(event) => void handleSearch(event)}
            >
              <Package className="pointer-events-none absolute left-4 size-5 text-foreground" />
              <Input
                ref={installSearchInputRef}
                type="search"
                placeholder="Type here to search new skills"
                value={searchQuery}
                onChange={(event) => void setSearchQuery(event.target.value)}
                className="h-full border-0 bg-transparent px-12 text-center text-base shadow-none focus-visible:ring-0 sm:text-lg"
                aria-label="Search new skills"
              />
              <Button
                type="submit"
                size="icon-sm"
                variant="ghost"
                className="absolute right-3"
                disabled={searchStatus === 'pending'}
                aria-label="Search skills"
              >
                <Search className={cn('size-4', searchStatus === 'pending' && 'animate-pulse')} />
              </Button>
            </form>

            {hasSearchResultContainer ? (
              <div
                className={cn(
                  'animate-in fade-in slide-in-from-top-2 rounded-xl border bg-popover p-3 shadow-lg duration-200',
                  selectedPreview ? 'max-h-[calc(100svh-8rem)] overflow-auto' : 'min-h-80'
                )}
              >
                {searchStatus === 'pending' ? (
                  <div className="space-y-2">
                    <p className="px-1 text-sm text-muted-foreground">
                      Searching for "{lastSearchQuery}"...
                    </p>
                    {[0, 1, 2].map((item) => (
                      <Skeleton key={item} className="h-16 rounded-lg border" />
                    ))}
                  </div>
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
                  <>
                    <ul className="space-y-2">
                      {searchResults.map((result) => {
                        const isViewing = selectedPreview?.id === result.id;

                        return (
                          <li key={result.id}>
                            <button
                              type="button"
                              className={cn(
                                'flex w-full items-center justify-between gap-3 rounded-lg border bg-background p-3 text-left transition hover:bg-accent/60',
                                isViewing && 'border-foreground bg-accent'
                              )}
                              onClick={() => handlePreviewSearchResult(result)}
                            >
                              <span className="min-w-0 space-y-1">
                                <span className="block truncate font-mono text-sm font-medium">
                                  {result.source}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {result.owner}/{result.repository}
                                  {result.installs ? ` · ${result.installs} installs` : ''}
                                </span>
                              </span>
                              {isViewing ? (
                                <Badge variant="secondary">Viewing</Badge>
                              ) : (
                                <Eye className="size-4 text-muted-foreground" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>

                    {selectedPreview ? (
                      <form
                        className="mt-3 space-y-3 rounded-lg border bg-background p-3"
                        onSubmit={handleInstall}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-mono text-sm font-medium">
                              {selectedPreview.source}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">Ready to add</p>
                          </div>
                          <Button size="sm" disabled={isInstalling} type="submit">
                            <PackagePlus className="size-4" />
                            <span>{isInstalling ? 'Adding' : 'Add'}</span>
                          </Button>
                        </div>

                        <Input
                          value={installSource}
                          onChange={(event) => setInstallSource(event.target.value)}
                          className="h-8 font-mono text-xs"
                          aria-label="Install source"
                          disabled={isInstalling}
                        />

                        <div className="grid gap-2 sm:grid-cols-2">
                          <Select
                            value={installScope}
                            disabled={isInstalling}
                            onValueChange={(value) =>
                              setInstallScope(value === 'global' ? 'global' : 'project')
                            }
                          >
                            <SelectTrigger
                              className="h-8 w-full text-xs"
                              aria-label="Install scope"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="project">Project</SelectItem>
                                <SelectItem value="global">Global</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <label className="flex h-8 items-center gap-2 rounded-md border px-2 text-xs">
                            <Checkbox
                              checked={installCopy}
                              disabled={isInstalling}
                              onCheckedChange={(checked) => setInstallCopy(checked === true)}
                              className="size-3.5"
                            />
                            <span>Copy files</span>
                          </label>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            value={installAgentsInput}
                            onChange={(event) => setInstallAgentsInput(event.target.value)}
                            placeholder="Agents"
                            disabled={isInstalling}
                            className="h-8 text-xs"
                          />
                          <Input
                            value={installSkillsInput}
                            onChange={(event) => setInstallSkillsInput(event.target.value)}
                            placeholder="Skill filters"
                            disabled={isInstalling}
                            className="h-8 text-xs"
                          />
                        </div>

                        {installStatus ? (
                          <StatusBanner
                            className={
                              installStatus.tone === 'error'
                                ? 'border-destructive/40 bg-destructive/5'
                                : 'border-emerald-500/40 bg-emerald-500/5'
                            }
                            icon={
                              installStatus.tone === 'error' ? (
                                <X className="size-4 text-destructive" />
                              ) : (
                                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                              )
                            }
                            message={installStatus.message}
                          />
                        ) : null}
                      </form>
                    ) : null}
                  </>
                ) : null}

                {searchParseWarning ? (
                  <p className="mt-3 text-xs text-muted-foreground">{searchParseWarning}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {selectedPreview ? (
            <section className="hidden min-h-0 overflow-hidden rounded-xl border bg-card shadow-lg lg:block">
              <div className="flex h-12 items-center justify-between gap-3 border-b px-4">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-medium">{selectedPreview.source}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedPreviewUrl ?? 'No preview URL available'}
                  </p>
                </div>
                {selectedPreviewUrl ? (
                  <a
                    href={selectedPreviewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    <ExternalLink className="size-4" />
                    <span>Open</span>
                  </a>
                ) : null}
              </div>

              {selectedPreviewUrl ? (
                <iframe
                  src={selectedPreviewUrl}
                  title={`${selectedPreview.source} preview`}
                  className="h-[calc(100%-3rem)] w-full border-0 bg-background"
                />
              ) : (
                <div className="flex h-[calc(100%-3rem)] items-center justify-center text-sm text-muted-foreground">
                  Preview URL unavailable for this result.
                </div>
              )}
            </section>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function InstalledPage() {
  const { payload, skills, isInitialLoading, errorMessage, reload, refresh } = useDashboardData();
  const [activeTab, setActiveTab] = useState<InstalledTab>('all');
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
  const [removeScope, setRemoveScope] = useState<SkillScope>('project');
  const [removeAgentsInput, setRemoveAgentsInput] = useState('');
  const [removeConfirmed, setRemoveConfirmed] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeStatus, setRemoveStatus] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [removeOutcome, setRemoveOutcome] = useState<RemoveOutcome | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>(null);
  const [updateResults, setUpdateResults] = useState<UpdateSkillsResponse[]>([]);

  useEffect(() => {
    const validIds = new Set(skills.map((skill) => skill.id));
    setSelectedSkills((current) => {
      const next = new Set(Array.from(current).filter((id) => validIds.has(id)));
      return next;
    });
  }, [skills]);

  const selectedSkillDetails = useMemo(() => {
    return skills.filter((skill) => selectedSkills.has(skill.id));
  }, [selectedSkills, skills]);

  const selectedNamesForScope = useMemo(() => {
    const names = new Set<string>();

    for (const skill of selectedSkillDetails) {
      if (skill.scope === removeScope) {
        names.add(skill.name);
      }
    }

    return Array.from(names).sort((left, right) => left.localeCompare(right));
  }, [removeScope, selectedSkillDetails]);

  const selectedUpdateOperations = useMemo(() => {
    const groupedNames: Record<SkillScope, Set<string>> = {
      project: new Set(),
      global: new Set(),
    };

    for (const skill of selectedSkillDetails) {
      groupedNames[skill.scope].add(skill.name);
    }

    const operations: UpdateSkillsRequest[] = [];
    if (groupedNames.project.size > 0) {
      operations.push({
        scope: 'project',
        names: Array.from(groupedNames.project),
      });
    }
    if (groupedNames.global.size > 0) {
      operations.push({
        scope: 'global',
        names: Array.from(groupedNames.global),
      });
    }

    return operations;
  }, [selectedSkillDetails]);

  useEffect(() => {
    if (!isRemoveConfirmOpen || selectedNamesForScope.length > 0) {
      return;
    }

    const nextScope = selectedSkillDetails.some((skill) => skill.scope === 'project')
      ? 'project'
      : 'global';

    if (nextScope !== removeScope) {
      setRemoveScope(nextScope);
    }
  }, [isRemoveConfirmOpen, removeScope, selectedNamesForScope, selectedSkillDetails]);

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

  const openRemoveConfirmation = () => {
    if (isUpdating) {
      return;
    }

    const scopes = new Set(selectedSkillDetails.map((skill) => skill.scope));
    const nextScope =
      scopes.size === 1
        ? (selectedSkillDetails[0]?.scope ?? 'project')
        : activeTab === 'project' || activeTab === 'global'
          ? activeTab
          : 'project';

    setRemoveScope(nextScope);
    setRemoveAgentsInput('');
    setRemoveConfirmed(false);
    setRemoveStatus(null);
    setIsRemoveConfirmOpen(true);
  };

  const closeRemoveConfirmation = () => {
    if (isRemoving || isUpdating) {
      return;
    }

    setIsRemoveConfirmOpen(false);
    setRemoveConfirmed(false);
  };

  const handleRemoveSelected = async () => {
    if (!payload || isRemoving || isUpdating) {
      return;
    }

    const names = selectedNamesForScope;
    if (names.length === 0) {
      setRemoveStatus({
        tone: 'error',
        message: `No selected skills in ${scopeLabel(removeScope)} scope.`,
      });
      return;
    }

    setIsRemoving(true);
    setRemoveStatus(null);

    const namesSet = new Set(names);

    try {
      const response = await removeInstalledSkills({
        names,
        scope: removeScope,
        agents: parseCommaSeparatedValues(removeAgentsInput),
        previousState: payload.installedState,
      });

      const status = response.command.ok ? 'success' : 'failure';
      setRemoveOutcome({
        status,
        scope: removeScope,
        names,
        command: response.command,
      });

      if (!response.command.ok) {
        setRemoveStatus({
          tone: 'error',
          message: createCommandFailureMessage(response.command),
        });
        return;
      }

      setSelectedSkills((current) => {
        const next = new Set(current);

        for (const skill of skills) {
          if (!next.has(skill.id)) {
            continue;
          }

          if (skill.scope === removeScope && namesSet.has(skill.name)) {
            next.delete(skill.id);
          }
        }

        return next;
      });

      setIsRemoveConfirmOpen(false);
      setRemoveConfirmed(false);
      setRemoveStatus({
        tone: 'success',
        message: `Removed ${names.length} skill${names.length === 1 ? '' : 's'} from ${scopeLabel(removeScope)} scope.`,
      });

      try {
        await refresh();
      } catch (error) {
        setRemoveStatus({
          tone: 'error',
          message: `Removal succeeded but refresh failed: ${getErrorMessage(error)}`,
        });
      }
    } catch (error) {
      setRemoveStatus({
        tone: 'error',
        message: `Remove request failed: ${getErrorMessage(error)}`,
      });
    } finally {
      setIsRemoving(false);
    }
  };

  const runUpdates = useCallback(
    async (operations: UpdateSkillsRequest[]) => {
      if (isUpdating || isRemoving || operations.length === 0) {
        return;
      }

      setIsUpdating(true);
      setUpdateStatus(null);
      setUpdateResults([]);

      try {
        const results: UpdateSkillsResponse[] = [];
        for (const operation of operations) {
          results.push(await updateDashboardSkills(operation));
        }

        setUpdateResults(results);

        const successCount = results.filter((item) => item.command.ok).length;
        const failureCount = results.length - successCount;

        setUpdateStatus({
          tone: failureCount === 0 ? 'success' : 'error',
          message: buildUpdateStatusMessage({
            totalCount: results.length,
            successCount,
            failureCount,
          }),
        });

        if (successCount > 0) {
          try {
            await refresh();
          } catch (error) {
            setUpdateStatus({
              tone: 'error',
              message: `Update succeeded but refresh failed: ${getErrorMessage(error)}`,
            });
          }
        }
      } catch (error) {
        setUpdateStatus({
          tone: 'error',
          message: `Update request failed: ${getErrorMessage(error)}`,
        });
      } finally {
        setIsUpdating(false);
      }
    },
    [isRemoving, isUpdating, refresh]
  );

  const handleUpdateProject = () => {
    void runUpdates([{ scope: 'project' }]);
  };

  const handleUpdateGlobal = () => {
    void runUpdates([{ scope: 'global' }]);
  };

  const handleUpdateSelected = () => {
    void runUpdates(selectedUpdateOperations);
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

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isUpdating || isRemoving || projectSkills.length === 0}
            onClick={handleUpdateProject}
          >
            <RefreshCw className={cn('size-4', isUpdating ? 'animate-spin' : undefined)} />
            <span>{isUpdating ? 'Updating' : 'Update project'}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isUpdating || isRemoving || globalSkills.length === 0}
            onClick={handleUpdateGlobal}
          >
            <RefreshCw className={cn('size-4', isUpdating ? 'animate-spin' : undefined)} />
            <span>{isUpdating ? 'Updating' : 'Update global'}</span>
          </Button>
        </div>
      </div>

      {selectedSkills.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{selectedSkills.size} selected</span>
          <Button
            variant="outline"
            size="sm"
            onClick={clearSelection}
            disabled={isRemoving || isUpdating}
          >
            Clear
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUpdateSelected}
            disabled={isUpdating || isRemoving || selectedUpdateOperations.length === 0}
          >
            <RefreshCw className={cn('size-4', isUpdating ? 'animate-spin' : undefined)} />
            <span>{isUpdating ? 'Updating...' : 'Update selected'}</span>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={openRemoveConfirmation}
            disabled={isRemoving || isUpdating}
          >
            {isRemoving ? 'Removing...' : 'Remove'}
          </Button>
        </div>
      ) : null}

      {errorMessage ? (
        <StatusBanner
          className="border-destructive/40 bg-destructive/5"
          icon={<X className="size-4 text-destructive" />}
          message={errorMessage}
        />
      ) : null}

      {removeStatus ? (
        <StatusBanner
          className={
            removeStatus.tone === 'error'
              ? 'border-destructive/40 bg-destructive/5'
              : 'border-emerald-500/40 bg-emerald-500/5'
          }
          icon={
            removeStatus.tone === 'error' ? (
              <X className="size-4 text-destructive" />
            ) : (
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            )
          }
          message={removeStatus.message}
        />
      ) : null}

      {updateStatus ? (
        <StatusBanner
          className={
            updateStatus.tone === 'error'
              ? 'border-destructive/40 bg-destructive/5'
              : 'border-emerald-500/40 bg-emerald-500/5'
          }
          icon={
            updateStatus.tone === 'error' ? (
              <X className="size-4 text-destructive" />
            ) : (
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            )
          }
          message={updateStatus.message}
        />
      ) : null}

      {isRemoveConfirmOpen ? (
        <Card className="border shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Confirm removal</CardTitle>
            <CardDescription>
              Review scope and selected skills before running `npx skills remove`.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="remove-scope" className="text-sm font-medium">
                  Scope
                </label>
                <Select
                  value={removeScope}
                  disabled={isRemoving || isUpdating}
                  onValueChange={(value) => {
                    setRemoveScope(value === 'global' ? 'global' : 'project');
                    setRemoveConfirmed(false);
                  }}
                >
                  <SelectTrigger id="remove-scope" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="global">Global</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="remove-agents" className="text-sm font-medium">
                  Target agents
                </label>
                <Input
                  id="remove-agents"
                  value={removeAgentsInput}
                  disabled={isRemoving || isUpdating}
                  onChange={(event) => setRemoveAgentsInput(event.target.value)}
                  placeholder="codex, claude"
                />
                <p className="text-xs text-muted-foreground">
                  Optional comma-separated values for `--agent`.
                </p>
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                Affected skills ({selectedNamesForScope.length})
              </p>
              {selectedNamesForScope.length > 0 ? (
                <p className="mt-1 font-mono text-sm break-all">
                  {selectedNamesForScope.join(', ')}
                </p>
              ) : (
                <p className="mt-1 text-sm text-destructive">
                  No selected skills in {scopeLabel(removeScope)} scope.
                </p>
              )}
            </div>

            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={removeConfirmed}
                disabled={isRemoving || isUpdating}
                onCheckedChange={(checked) => setRemoveConfirmed(checked === true)}
                className="mt-0.5"
              />
              <span>
                I confirm removing {selectedNamesForScope.length} selected skill
                {selectedNamesForScope.length === 1 ? '' : 's'} from {scopeLabel(removeScope)}{' '}
                scope.
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={closeRemoveConfirmation}
                disabled={isRemoving || isUpdating}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void handleRemoveSelected()}
                disabled={
                  !removeConfirmed || selectedNamesForScope.length === 0 || isRemoving || isUpdating
                }
              >
                {isRemoving ? 'Removing...' : 'Confirm remove'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {removeOutcome ? <RemoveOperationCard outcome={removeOutcome} /> : null}
      {updateResults.length > 0 ? <UpdateOperationCard results={updateResults} /> : null}

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
              disabled={isRemoving || isUpdating}
              onClick={() => setActiveTab('all')}
            >
              All ({skills.length})
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'project' ? 'default' : 'outline'}
              disabled={isRemoving || isUpdating}
              onClick={() => setActiveTab('project')}
            >
              Project ({projectSkills.length})
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'global' ? 'default' : 'outline'}
              disabled={isRemoving || isUpdating}
              onClick={() => setActiveTab('global')}
            >
              Global ({globalSkills.length})
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={selectAllVisible}
                disabled={isRemoving || isUpdating}
              >
                Select visible
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={clearSelection}
                disabled={isRemoving || isUpdating}
              >
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
                      <Checkbox
                        checked={selectedSkills.has(skill.id)}
                        disabled={isRemoving || isUpdating}
                        onCheckedChange={() => toggleSkill(skill.id)}
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
            <Input
              id="registry-url"
              defaultValue="https://registry.skills.sh"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              The skills registry to fetch packages from
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cache-dir" className="text-sm font-medium">
              Cache Directory
            </label>
            <Input id="cache-dir" defaultValue="~/.skills/cache" className="font-mono" />
            <p className="text-xs text-muted-foreground">
              Local directory for caching skill packages
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="default-shell" className="text-sm font-medium">
              Default Shell
            </label>
            <Select defaultValue="zsh">
              <SelectTrigger id="default-shell" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="bash">Bash</SelectItem>
                  <SelectItem value="zsh">Zsh</SelectItem>
                  <SelectItem value="fish">Fish</SelectItem>
                  <SelectItem value="powershell">PowerShell</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
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

  const openInstallDialog = () => {
    if (pathname !== '/') {
      window.location.assign('/?install=1');
      return;
    }

    window.dispatchEvent(new Event(INSTALL_DIALOG_EVENT));
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
            onClick={openInstallDialog}
            aria-label="Install a skill"
          >
            <PackagePlus className="size-4" />
            <span className="hidden sm:inline">Install</span>
          </Button>

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

function RemoveOperationCard(props: { outcome: RemoveOutcome }) {
  const { command, names, scope, status } = props.outcome;

  return (
    <Card className="border shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TerminalSquare className="size-4" />
          Remove Command Output
        </CardTitle>
        <CardDescription>
          Removed {names.length} skill{names.length === 1 ? '' : 's'} from {scopeLabel(scope)} scope
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <code className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs break-all">
            {command.command.join(' ')}
          </code>
          <Badge variant={status === 'success' ? 'secondary' : 'destructive'}>
            {status === 'success' ? 'Succeeded' : 'Failed'}
          </Badge>
        </div>

        {command.stdout.trim() ? (
          <OutputBlock label="stdout" value={command.stdout} />
        ) : (
          <p className="text-xs text-muted-foreground">No stdout output.</p>
        )}

        {command.stderr.trim() ? <OutputBlock label="stderr" value={command.stderr} /> : null}
      </CardContent>
    </Card>
  );
}

function InstallOperationCard(props: { outcome: InstallOutcome }) {
  const { command, source, scope, status } = props.outcome;

  return (
    <Card className="border shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TerminalSquare className="size-4" />
          Install Command Output
        </CardTitle>
        <CardDescription>
          Installed {source} in {scopeLabel(scope)} scope
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <code className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs break-all">
            {command.command.join(' ')}
          </code>
          <Badge variant={status === 'success' ? 'secondary' : 'destructive'}>
            {status === 'success' ? 'Succeeded' : 'Failed'}
          </Badge>
        </div>

        {command.stdout.trim() ? (
          <OutputBlock label="stdout" value={command.stdout} />
        ) : (
          <p className="text-xs text-muted-foreground">No stdout output.</p>
        )}

        {command.stderr.trim() ? <OutputBlock label="stderr" value={command.stderr} /> : null}
      </CardContent>
    </Card>
  );
}

function UpdateOperationCard(props: { results: UpdateSkillsResponse[] }) {
  return (
    <Card className="border shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RefreshCw className="size-4" />
          Update Command Output
        </CardTitle>
        <CardDescription>Latest `npx skills update` output</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.results.map((result, index) => (
          <div
            key={`${result.scope}:${index}:${result.command.command.join(' ')}`}
            className="space-y-2 rounded-lg border p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{scopeLabel(result.scope)}</Badge>
                <code className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs break-all">
                  {result.command.command.join(' ')}
                </code>
              </div>
              <Badge variant={result.command.ok ? 'secondary' : 'destructive'}>
                {result.command.ok ? 'Succeeded' : 'Failed'}
              </Badge>
            </div>

            {result.command.stdout.trim() ? (
              <OutputBlock label="stdout" value={result.command.stdout} />
            ) : (
              <p className="text-xs text-muted-foreground">No stdout output.</p>
            )}

            {result.command.stderr.trim() ? (
              <OutputBlock label="stderr" value={result.command.stderr} />
            ) : null}
          </div>
        ))}
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
        <CardDescription>Latest `npx skills` output for this scope</CardDescription>
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
      <Skeleton className="h-16 rounded-lg border" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-lg border" />
        <Skeleton className="h-24 rounded-lg border" />
        <Skeleton className="h-24 rounded-lg border" />
      </div>
      <Skeleton className="h-72 rounded-lg border" />
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
      <Checkbox id={props.id} defaultChecked={props.defaultChecked} />
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

const buildUpdateStatusMessage = (input: {
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

const parseCommaSeparatedValues = (value: string): string[] => {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const createCommandFailureMessage = (command: SkillsCommandResult): string => {
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
