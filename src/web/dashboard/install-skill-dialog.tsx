import { useQuery } from '@tanstack/react-query';
import { BookOpenText, Eye, PackagePlus, X, XIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useQueryState } from 'nuqs';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  DashboardPayload,
  SearchResultSkill,
  SkillDetailsState,
} from '../../features/skills/state';
import { fetchSkillDetails, searchSkills } from '../api';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../components/ui/command';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';
import { AnimatedText, LoadingGlyph, LoadingIndicator, StatusBanner } from './components';
import type { SearchStatus } from './types';
import { getErrorMessage } from './utils';

type InstallSkillDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: DashboardPayload | null;
  onInstalled: () => Promise<void>;
};

export function InstallSkillDialog({ open, onOpenChange }: InstallSkillDialogProps) {
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const [searchResults, setSearchResults] = useState<SearchResultSkill[]>([]);
  const [searchErrorMessage, setSearchErrorMessage] = useState<string | null>(null);
  const [searchParseWarning, setSearchParseWarning] = useState<string | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState<string | null>(null);
  const [installSource, setInstallSource] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const installSearchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useQueryState('q');
  const [previewId, setPreviewId] = useQueryState('preview');

  const hasSearchResultContainer = searchStatus !== 'idle';
  const selectedPreview = useMemo(() => {
    if (!previewId) {
      return null;
    }

    return searchResults.find((result) => result.id === previewId) ?? null;
  }, [previewId, searchResults]);
  const selectedPreviewUrl = selectedPreview?.url;
  const {
    data: selectedPreviewDetailsPayload,
    error: selectedPreviewDetailsError,
    isPending: isSelectedPreviewDetailsPending,
  } = useQuery({
    queryKey: ['skill-details', selectedPreviewUrl],
    queryFn: async () => {
      if (!selectedPreviewUrl) {
        throw new Error('Skill details URL is required.');
      }

      return fetchSkillDetails(selectedPreviewUrl);
    },
    enabled: open && Boolean(selectedPreviewUrl),
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    const focusTimeout = window.setTimeout(() => installSearchInputRef.current?.focus(), 40);

    return () => {
      window.clearTimeout(focusTimeout);
    };
  }, [open, selectedPreview]);

  const handleSearch = async () => {
    const query = (searchQuery ?? '').trim();
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

  const handlePreviewSearchResult = (result: SearchResultSkill) => {
    void setPreviewId(result.id);
    setInstallSource(result.source);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'border-0 bg-transparent p-0 shadow-none ring-0',
          selectedPreview
            ? 'grid h-[calc(100svh-3rem)] max-w-[calc(100%-2rem)] gap-4 sm:max-w-[calc(100%-3rem)] lg:max-w-7xl lg:grid-cols-[22rem_minmax(0,1fr)]'
            : 'max-w-3xl sm:max-w-3xl'
        )}
        showCloseButton={false}
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
              'border p-1 shadow-lg',
              selectedPreview ? 'h-full rounded-lg shadow-none' : 'rounded-xl'
            )}
            shouldFilter={false}
          >
            <CommandInput
              ref={installSearchInputRef}
              className="placeholder:text-muted-foreground"
              placeholder="Type here to search new skills"
              value={searchQuery ?? ''}
              onValueChange={(value) => void setSearchQuery(value)}
              onKeyDown={handleInstallSearchKeyDown}
            />
            <CommandList
              className={cn(
                selectedPreview ? 'max-h-none flex-1 overflow-auto' : 'max-h-112',
                !hasSearchResultContainer && 'max-h-24'
              )}
            >
              {hasSearchResultContainer ? (
                <>
                  {searchStatus === 'pending' ? (
                    <CommandGroup>
                      <LoadingIndicator
                        label={`Searching for "${lastSearchQuery}"`}
                        className="w-full px-1 text-center"
                      />
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
                            <motion.div
                              key={result.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                duration: 0.22,
                                delay: Math.min(index, 8) * 0.024,
                                ease: [0.23, 1, 0.32, 1],
                              }}
                            >
                            <CommandItem
                              value={`${result.source} ${result.owner} ${result.repository}`}
                              data-checked={isViewing}
                              className={cn(
                                'items-start gap-3 px-3 py-3',
                                isViewing && 'bg-accent text-accent-foreground'
                              )}
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
                            </motion.div>
                          );
                        })}
                      </CommandGroup>
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
          <motion.section
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="hidden min-h-0 overflow-hidden rounded-xl border bg-card shadow-lg lg:block"
          >
            <div className="flex h-12 items-center justify-between gap-3 border-b px-4">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-medium">{selectedPreview.source}</p>
                <a
                  href={selectedPreviewUrl ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-xs text-muted-foreground"
                >
                  {selectedPreviewUrl ?? 'No preview URL available'}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={isInstalling}>
                  {isInstalling ? (
                    <LoadingGlyph label="Adding skill" />
                  ) : (
                    <PackagePlus className="size-4" />
                  )}
                  <AnimatedText className="text-left">
                    {isInstalling ? 'Adding' : 'Add'}
                  </AnimatedText>
                </Button>
                <DialogClose>
                  <Button size="icon-sm" variant="ghost" disabled={isInstalling}>
                    {isInstalling ? (
                      <LoadingGlyph label="Adding skill" />
                    ) : (
                      <XIcon className="size-4" />
                    )}
                  </Button>
                </DialogClose>
              </div>
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
          </motion.section>
        ) : null}
      </DialogContent>
    </Dialog>
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
    <div className="border-b pb-3 font-mono text-xs font-medium text-muted-foreground uppercase">
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
          className="block font-mono text-sm break-all hover:underline"
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
