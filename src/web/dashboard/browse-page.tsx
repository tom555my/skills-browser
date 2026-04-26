import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import {
  Check,
  CheckCircle2,
  Copy,
  Eye,
  ExternalLink,
  Package,
  PackagePlus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import type { InstallSkillsResponse, SearchResultSkill } from '../../features/skills/state';
import type { SkillScope } from '../../features/skills/types';
import { installDashboardSkills, searchSkills } from '../api';
import { Badge } from '../components/ui/badge';
import { Button, buttonVariants } from '../components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';
import { INSTALL_DIALOG_EVENT } from './constants';
import { InstallOperationCard, PageLoadingState, StatusBanner } from './components';
import { useDashboardData } from './data';
import type { BrowserSkill, InstallOutcome, ScopeFilter, SearchStatus } from './types';
import {
  createCommandFailureMessage,
  getErrorMessage,
  parseCommaSeparatedValues,
  scopeLabel,
} from './utils';

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
