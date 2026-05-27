import {
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import {
  Check,
  CircleAlert,
  ExternalLink,
  Package,
  PackagePlus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import { Badge } from '../components/ui/badge';
import { Button, buttonVariants } from '../components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '../components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { AgentBadgeRow } from './agent-badge-row';
import { INSTALL_DIALOG_EVENT } from './constants';
import { Spinner, PageLoadingState, StatusBanner } from './components';
import { useDashboardActions, useDashboardData } from './data';
import { InstallSkillDialog } from './install-skill-dialog';
import { useSkillActions } from './skill-actions';
import type { BrowserSkill, ScopeFilter } from './types';
import { createCommandFailureMessage, getErrorMessage, scopeLabel } from './utils';

export function BrowsePage() {
  const { payload, skills, isInitialLoading, errorMessage } = useDashboardData();
  const { reload, refresh } = useDashboardActions();
  const { removeSkill, updateSkill } = useSkillActions();
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''));
  const [scopeFilter] = useQueryState(
    'scope',
    parseAsStringEnum<ScopeFilter>(['all', 'project', 'global']).withDefault('all')
  );
  const [installParam, setInstallParam] = useQueryState(
    'install',
    parseAsString.withOptions({ history: 'push' })
  );
  const [, setPreviewId] = useQueryState('preview');
  const deferredSearch = useDeferredValue(search);
  const visibleSkills = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return skills.filter((skill) => {
      if (scopeFilter !== 'all' && skill.scope !== scopeFilter) {
        return false;
      }

      return normalizedSearch.length === 0 || skill.searchableText.includes(normalizedSearch);
    });
  }, [deferredSearch, scopeFilter, skills]);

  const totalInstalled = payload
    ? payload.installedState.project.skills.length + payload.installedState.global.skills.length
    : 0;
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

  const handleRemoveSkill = async (skill: BrowserSkill) => {
    try {
      const outcome = await removeSkill(skill, { applyPayloadDelayMs: 500 });

      if (outcome.command.ok) {
        return { ok: true };
      }

      const message = createCommandFailureMessage(outcome.command);
      return { ok: false, errorMessage: message };
    } catch (error) {
      const message = getErrorMessage(error);
      return { ok: false, errorMessage: message };
    }
  };

  const handleUpdateSkill = async (skill: BrowserSkill) => {
    try {
      const outcome = await updateSkill(skill);

      if (outcome.command.ok) {
        return { ok: true };
      }

      const message = createCommandFailureMessage(outcome.command);
      return { ok: false, errorMessage: message };
    } catch (error) {
      const message = getErrorMessage(error);
      return { ok: false, errorMessage: message };
    }
  };

  if (isInitialLoading && !payload) {
    return (
      <div className="space-y-6">
        <PageLoadingState />
        <InstallSkillDialog
          open={isInstallDialogOpen}
          onOpenChange={handleInstallDialogOpenChange}
          payload={payload}
          onInstalled={refresh}
        />
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
            <motion.div
              key={skill.id}
              className="h-full"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.22,
                delay: Math.min(index, 8) * 0.028,
                ease: [0.23, 1, 0.32, 1],
              }}
            >
              <Card
                size="sm"
                className="h-full min-h-44 min-w-0 rounded-lg transition-[background-color,box-shadow,transform] duration-150 ease-out [contain-intrinsic-size:12rem] [content-visibility:auto] hover:-translate-y-0.5 hover:bg-accent/40 hover:shadow-sm"
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
                      <SkillCardActionButton
                        actionKey={`update:${skill.id}`}
                        ariaLabel={`Update ${skill.name}`}
                        disabled={pendingActionKey !== null || !skill.managed}
                        errorTitle="Update failed"
                        idleIcon={<RefreshCw className="size-4" />}
                        loadingLabel={`Updating ${skill.name}`}
                        onPendingChange={setPendingActionKey}
                        onAction={() => handleUpdateSkill(skill)}
                        tooltip={skill.managed ? 'Update' : 'Local skills cannot be updated'}
                      />
                      <SkillCardActionButton
                        actionKey={`remove:${skill.id}`}
                        ariaLabel={`Remove ${skill.name}`}
                        disabled={pendingActionKey !== null}
                        errorTitle="Remove failed"
                        idleIcon={<Trash2 className="size-4" />}
                        loadingLabel={`Removing ${skill.name}`}
                        onPendingChange={setPendingActionKey}
                        confirmation={{
                          title: 'Remove skill?',
                          description: `Remove "${skill.name}" from ${scopeLabel(skill.scope)}?`,
                          actionLabel: 'Remove',
                        }}
                        onAction={() => handleRemoveSkill(skill)}
                        tooltip="Remove"
                        variant="ghost"
                      />
                      <Tooltip>
                        <TooltipTrigger>
                          <Link
                            to="/skill/$skillId"
                            params={{ skillId: skill.id }}
                            aria-label={`Open ${skill.name} details`}
                            className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                          >
                            <ExternalLink className="size-4" />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent>Details</TooltipContent>
                      </Tooltip>
                    </CardAction>
                  </div>
                </CardHeader>

                <CardContent className="mt-auto flex flex-col gap-2">
                  <p className="line-clamp-2 text-sm text-muted-foreground">{skill.description}</p>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Agents</p>
                    {skill.agents.length > 0 ? (
                      <AgentBadgeRow agents={skill.agents} skillId={skill.id} />
                    ) : (
                      <div className="flex min-h-8 items-center rounded-md border border-dashed px-2 text-xs text-muted-foreground">
                        No agents declared
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <InstallSkillDialog
        open={isInstallDialogOpen}
        onOpenChange={handleInstallDialogOpenChange}
        payload={payload}
        onInstalled={refresh}
      />
    </div>
  );
}

type SkillCardActionStatus = 'idle' | 'loading' | 'success' | 'error';

type SkillCardActionResult = {
  ok: boolean;
  errorMessage?: string;
};

type SkillCardActionConfirmation = {
  title: string;
  description: string;
  actionLabel: string;
};

function SkillCardActionButton({
  actionKey,
  ariaLabel,
  confirmation,
  disabled,
  errorTitle,
  idleIcon,
  loadingLabel,
  onAction,
  onPendingChange,
  tooltip,
  variant = 'ghost',
}: {
  actionKey: string;
  ariaLabel: string;
  confirmation?: SkillCardActionConfirmation;
  disabled: boolean;
  errorTitle: string;
  idleIcon: ReactNode;
  loadingLabel: string;
  onAction: () => Promise<SkillCardActionResult>;
  onPendingChange: (actionKey: string | null) => void;
  tooltip: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
}) {
  const [status, setStatus] = useState<SkillCardActionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [popoverMode, setPopoverMode] = useState<'confirmation' | 'error' | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const scheduleReset = (delay: number) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      setStatus('idle');
      setErrorMessage(null);
      setIsPopoverOpen(false);
      setPopoverMode(null);
      timerRef.current = null;
    }, delay);
  };

  const runAction = async () => {
    if (disabled || status === 'loading') {
      return;
    }

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setStatus('loading');
    setErrorMessage(null);
    setIsPopoverOpen(false);
    setPopoverMode(null);
    onPendingChange(actionKey);

    try {
      const result = await onAction();

      if (result.ok) {
        setStatus('success');
        scheduleReset(500);
        return;
      }

      setStatus('error');
      setErrorMessage(result.errorMessage ?? errorTitle);
      setPopoverMode('error');
      setIsPopoverOpen(true);
      scheduleReset(3000);
    } finally {
      onPendingChange(null);
    }
  };

  const handleClick = () => {
    if (disabled || status === 'loading') {
      return;
    }

    if (!confirmation) {
      void runAction();
      return;
    }

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setStatus('idle');
    setErrorMessage(null);
    setPopoverMode('confirmation');
    setIsPopoverOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    if (status === 'loading') {
      return;
    }

    if (open) {
      if (status === 'error') {
        setPopoverMode('error');
        setIsPopoverOpen(true);
        return;
      }

      if (confirmation) {
        setStatus('idle');
        setErrorMessage(null);
        setPopoverMode('confirmation');
        setIsPopoverOpen(true);
      }
      return;
    }

    setIsPopoverOpen(false);
    setPopoverMode(null);
  };

  const icon = (() => {
    if (status === 'loading') {
      return <Spinner label={loadingLabel} />;
    }

    if (status === 'success') {
      return <Check className="size-4 text-emerald-600 dark:text-emerald-400" />;
    }

    if (status === 'error') {
      return <CircleAlert className="size-4 text-destructive" />;
    }

    return idleIcon;
  })();

  return (
    <Tooltip>
      <Popover open={isPopoverOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            <TooltipTrigger
              render={
                <Button
                  size="icon-sm"
                  variant={variant}
                  disabled={disabled || status === 'loading'}
                  aria-label={ariaLabel}
                  aria-invalid={status === 'error' || undefined}
                  onClick={handleClick}
                >
                  {icon}
                </Button>
              }
            />
          }
        />
        <PopoverContent side="bottom" align="end" className="w-80">
          {popoverMode === 'confirmation' && confirmation ? (
            <>
              <PopoverHeader>
                <PopoverTitle>{confirmation.title}</PopoverTitle>
                <PopoverDescription className="break-words">
                  {confirmation.description}
                </PopoverDescription>
              </PopoverHeader>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button size="sm" variant="destructive" onClick={() => void runAction()}>
                  {confirmation.actionLabel}
                </Button>
              </div>
            </>
          ) : (
            <PopoverHeader>
              <PopoverTitle className="flex items-center gap-2 text-destructive">
                <CircleAlert className="size-4" />
                {errorTitle}
              </PopoverTitle>
              <PopoverDescription className="break-words">{errorMessage}</PopoverDescription>
            </PopoverHeader>
          )}
        </PopoverContent>
      </Popover>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
