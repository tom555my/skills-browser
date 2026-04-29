import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from '@tanstack/react-router';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import {
  BookOpenText,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  ExternalLink,
  Package,
  PackagePlus,
  Search,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import type {
  InstallSkillsResponse,
  SearchResultSkill,
  SkillDetailsState,
} from '../../features/skills/state';
import type { SkillScope } from '../../features/skills/types';
import { fetchSkillDetails, installDashboardSkills, searchSkills } from '../api';
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
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '../components/ui/command';
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
import { AgentBadge } from './agent-badge';
import { INSTALL_DIALOG_EVENT } from './constants';
import {
  AnimatedText,
  InstallOperationCard,
  LoadingGlyph,
  LoadingIndicator,
  PageLoadingState,
  StatusBanner,
} from './components';
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
  const [scopeFilter] = useQueryState(
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
  const {
    data: selectedPreviewDetailsPayload,
    error: selectedPreviewDetailsError,
    isPending: isSelectedPreviewDetailsPending,
  } = useQuery({
    queryKey: ['skill-details', selectedPreviewUrl],
    queryFn: async () => fetchSkillDetails(selectedPreviewUrl ?? ''),
    enabled: isInstallDialogOpen && Boolean(selectedPreviewUrl),
  });

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

  const handleSearch = async () => {
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

  const handleInstallSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    void handleSearch();
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
            <Command className="rounded-xl border shadow-lg">
              <CommandInput
                ref={installSearchInputRef}
                placeholder="Type here to search new skills"
                value={searchQuery}
                onValueChange={(value) => void setSearchQuery(value)}
                onKeyDown={handleInstallSearchKeyDown}
              />
              <CommandList>
                <CommandGroup>
                  <CommandItem
                    value={`search ${searchQuery}`}
                    disabled={searchStatus === 'pending'}
                    onSelect={() => void handleSearch()}
                  >
                    {searchStatus === 'pending' ? (
                      <LoadingGlyph label="Searching skills.sh" />
                    ) : (
                      <Search />
                    )}
                    <span className="inline-flex items-center gap-1">
                      <AnimatedText className="min-w-14">
                        {searchStatus === 'pending' ? 'Searching' : 'Search'}
                      </AnimatedText>
                      <span>skills.sh</span>
                    </span>
                    <CommandShortcut>return</CommandShortcut>
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
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
          <Button size="sm" className="w-fit" onClick={openInstallDialog}>
            <PackagePlus className="size-4" />
            <span>Install skill</span>
          </Button>
        </div>

      </section>

      <div className="sticky top-16 z-40 mx-auto w-full max-w-4xl">
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
      </div>

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
          {visibleSkills.map((skill, index) => (
            <Card
              key={skill.id}
              size="sm"
              className="skill-list-item min-h-44 min-w-0 rounded-lg transition-[background-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:bg-accent/40 hover:shadow-sm"
              style={{ '--skill-list-item-delay': `${Math.min(index, 8) * 28}ms` } as CSSProperties}
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
                        <AgentBadge key={`${skill.id}:${agent}`} agent={agent} />
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
              'min-h-0',
              selectedPreview
                ? 'min-h-0 overflow-hidden rounded-xl border bg-popover p-3 shadow-lg'
                : undefined
            )}
          >
            <Command
              className={cn(
                'border shadow-lg',
                selectedPreview ? 'h-full rounded-lg shadow-none' : 'rounded-xl'
              )}
              shouldFilter={false}
            >
              <CommandInput
                ref={installSearchInputRef}
                placeholder="Type here to search new skills"
                value={searchQuery}
                onValueChange={(value) => void setSearchQuery(value)}
                onKeyDown={handleInstallSearchKeyDown}
              />
              <CommandList
                className={cn(
                  selectedPreview ? 'max-h-none flex-1 overflow-auto' : 'max-h-[28rem]',
                  !hasSearchResultContainer && 'max-h-24'
                )}
              >
                {hasSearchResultContainer ? (
                  <>
                    {searchStatus === 'pending' ? (
                      <CommandGroup>
                        <LoadingIndicator
                          label={`Searching for "${lastSearchQuery}"`}
                          className="px-1"
                        />
                        {[0, 1, 2].map((item) => (
                          <Skeleton key={item} className="h-16 rounded-lg border" />
                        ))}
                      </CommandGroup>
                    ) : null}

                    {searchStatus === 'error' && searchErrorMessage ? (
                      <CommandGroup>
                        <StatusBanner
                          className="border-destructive/40 bg-destructive/5"
                          icon={<X className="size-4 text-destructive" />}
                          message={searchErrorMessage}
                        />
                      </CommandGroup>
                    ) : null}

                    {searchStatus === 'empty' ? (
                      <CommandGroup>
                        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          No skills found for "{lastSearchQuery}".
                        </p>
                      </CommandGroup>
                    ) : null}

                    {searchStatus === 'success' ? (
                      <>
                        <CommandGroup heading="Skills">
                          {searchResults.map((result, index) => {
                            const isViewing = selectedPreview?.id === result.id;

                            return (
                              <CommandItem
                                key={result.id}
                                value={`${result.source} ${result.owner} ${result.repository}`}
                                data-checked={isViewing}
                                className={cn(
                                  'skill-list-item items-start gap-3 px-3 py-3',
                                  isViewing && 'bg-accent text-accent-foreground'
                                )}
                                style={
                                  {
                                    '--skill-list-item-delay': `${Math.min(index, 8) * 24}ms`,
                                  } as CSSProperties
                                }
                                onSelect={() => handlePreviewSearchResult(result)}
                              >
                                <Eye className="mt-0.5 text-muted-foreground" />
                                <span className="min-w-0 flex-1 space-y-1">
                                  <span className="block truncate font-mono text-sm font-medium">
                                    {result.source}
                                  </span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {result.owner}/{result.repository}
                                    {result.installs ? ` · ${result.installs} installs` : ''}
                                  </span>
                                </span>
                                {isViewing ? <Badge variant="secondary">Viewing</Badge> : null}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>

                        {selectedPreview ? (
                          <form
                            className="mt-3 space-y-3 rounded-lg border bg-background p-3 duration-200 ease-[var(--ease-out)] animate-in fade-in-0 slide-in-from-top-1"
                            onSubmit={handleInstall}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-mono text-sm font-medium">
                                  {selectedPreview.source}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  Ready to add
                                </p>
                              </div>
                              <Button size="sm" disabled={isInstalling} type="submit">
                                {isInstalling ? (
                                  <LoadingGlyph label="Adding skill" />
                                ) : (
                                  <PackagePlus className="size-4" />
                                )}
                                <AnimatedText className="min-w-10 text-left">
                                  {isInstalling ? 'Adding' : 'Add'}
                                </AnimatedText>
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
                  </>
                ) : null}
              </CommandList>
            </Command>
          </div>

          {selectedPreview ? (
            <section className="hidden min-h-0 overflow-hidden rounded-xl border bg-card shadow-lg duration-200 ease-[var(--ease-out)] animate-in fade-in-0 slide-in-from-right-2 lg:block">
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

              <SkillSearchPreview
                result={selectedPreview}
                details={selectedPreviewDetailsPayload?.details ?? null}
                isLoading={Boolean(selectedPreviewUrl) && isSelectedPreviewDetailsPending}
                errorMessage={
                  selectedPreviewDetailsError
                    ? getErrorMessage(selectedPreviewDetailsError)
                    : selectedPreviewUrl
                      ? null
                      : 'Preview URL unavailable for this result.'
                }
              />
            </section>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SkillSearchPreview({
  result,
  details,
  isLoading,
  errorMessage,
}: {
  result: SearchResultSkill;
  details: SkillDetailsState | null;
  isLoading: boolean;
  errorMessage: string | null;
}) {
  if (isLoading) {
    return (
      <div className="h-[calc(100%-3rem)] overflow-y-auto bg-background p-6">
        <div className="space-y-6">
          <LoadingIndicator label="Loading skill details" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-44" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="flex h-[calc(100%-3rem)] items-center justify-center bg-background p-6">
        <div className="max-w-sm space-y-2 text-center">
          <BookOpenText className="mx-auto size-6 text-muted-foreground" />
          <p className="text-sm font-medium">Details unavailable</p>
          <p className="text-sm text-muted-foreground">
            {errorMessage ?? 'This result does not expose a skills.sh detail page.'}
          </p>
        </div>
      </div>
    );
  }

  const installCommand = details.installCommand ?? `npx skills add ${result.source}`;

  return (
    <div className="h-[calc(100%-3rem)] overflow-y-auto bg-background">
      <div className="grid gap-8 p-6 xl:grid-cols-[minmax(0,1fr)_13rem]">
        <main className="min-w-0 space-y-8">
          <section className="space-y-3">
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <span className="truncate">skills</span>
              <span>/</span>
              <span className="truncate">{result.owner}</span>
              <span>/</span>
              <span className="truncate">{result.repository}</span>
              <span>/</span>
              <span className="truncate text-foreground">{details.title}</span>
            </div>
            <h2 className="truncate font-mono text-3xl font-semibold tracking-tight">
              {details.title}
            </h2>
            {details.description ? (
              <p className="text-sm leading-6 text-muted-foreground">{details.description}</p>
            ) : null}
          </section>

          <section className="space-y-3">
            <SectionLabel>Installation</SectionLabel>
            <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 font-mono text-sm">
              <span className="text-muted-foreground">$</span>
              <code className="min-w-0 flex-1 truncate">{installCommand}</code>
            </div>
          </section>

          {details.summaryHtml ? (
            <section className="space-y-3">
              <SectionLabel>Summary</SectionLabel>
              <div className="rounded-lg border bg-muted/50 px-5 py-4">
                <SkillHtmlContent html={details.summaryHtml} compact />
              </div>
            </section>
          ) : null}

          {details.readmeHtml ? (
            <section className="space-y-3">
              <SectionLabel>SKILL.md</SectionLabel>
              <SkillHtmlContent html={details.readmeHtml} />
            </section>
          ) : null}
        </main>

        <aside className="space-y-5 xl:border-l xl:pl-6">
          <PreviewStat label="Weekly Installs" value={details.weeklyInstalls ?? result.installs} />
          <PreviewStat
            label="Repository"
            value={details.repository}
            href={details.repositoryUrl ?? undefined}
          />
          <PreviewStat label="GitHub Stars" value={details.githubStars} />
          <PreviewStat label="First Seen" value={details.firstSeen} />

          {details.audits.length > 0 ? (
            <section className="space-y-3">
              <SectionLabel>Security Audits</SectionLabel>
              <div className="divide-y rounded-md border">
                {details.audits.map((audit) => (
                  <a
                    key={audit.url}
                    href={audit.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted/60"
                  >
                    <span className="truncate">{audit.name}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        audit.status.toLowerCase() === 'pass' &&
                          'border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
                        audit.status.toLowerCase() === 'warn' &&
                          'border-amber-500/30 text-amber-600 dark:text-amber-400'
                      )}
                    >
                      {audit.status}
                    </Badge>
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="border-b pb-3 font-mono text-xs font-medium uppercase text-muted-foreground">
      {children}
    </div>
  );
}

function PreviewStat({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null;
  href?: string;
}) {
  if (!value) {
    return null;
  }

  return (
    <section className="space-y-1.5">
      <SectionLabel>{label}</SectionLabel>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="block break-all font-mono text-sm hover:underline"
        >
          {value}
        </a>
      ) : (
        <p className="font-mono text-sm">{value}</p>
      )}
    </section>
  );
}

function SkillHtmlContent({ html, compact = false }: { html: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        'min-w-0 space-y-3 text-sm leading-6 text-muted-foreground',
        '[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4',
        '[&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-foreground',
        '[&_h1]:font-mono [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-foreground',
        '[&_h2]:pt-3 [&_h2]:font-mono [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground',
        '[&_h3]:pt-2 [&_h3]:font-mono [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground',
        '[&_li]:ml-5 [&_li]:pl-1 [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:bg-muted/60 [&_pre]:p-3 [&_pre]:text-foreground [&_ul]:list-disc',
        '[&_strong]:font-medium [&_strong]:text-foreground [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2 [&_th]:text-left [&_th]:text-foreground',
        compact && '[&_p:first-child]:font-medium [&_p:first-child]:text-foreground'
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
