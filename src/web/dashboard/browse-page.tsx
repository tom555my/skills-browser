import {
  type CSSProperties,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link } from '@tanstack/react-router';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import {
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
import { AgentBadge } from './agent-badge';
import { INSTALL_DIALOG_EVENT } from './constants';
import { LoadingGlyph, PageLoadingState, StatusBanner } from './components';
import { useDashboardActions, useDashboardData } from './data';
import { InstallSkillDialog } from './install-skill-dialog';
import { useSkillActions } from './skill-actions';
import { showErrorToast, showSuccessToast } from './toasts';
import { confirm } from './confirm';
import type { BrowserSkill, ScopeFilter } from './types';
import { createCommandFailureMessage, getErrorMessage, scopeLabel } from './utils';

export function BrowsePage() {
  const { payload, skills, isInitialLoading, errorMessage } = useDashboardData();
  const { reload, refresh } = useDashboardActions();
  const { removeSkill, updateSkill } = useSkillActions();
  const [removingSkillId, setRemovingSkillId] = useState<string | null>(null);
  const [updatingSkillId, setUpdatingSkillId] = useState<string | null>(null);
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
    if (removingSkillId || updatingSkillId) {
      return;
    }

    const confirmed = await confirm(`Remove "${skill.name}" from ${scopeLabel(skill.scope)}?`);
    if (!confirmed) {
      return;
    }

    setRemovingSkillId(skill.id);

    try {
      const outcome = await removeSkill(skill);

      if (outcome.command.ok) {
        showSuccessToast(
          'Skill removed',
          `${skill.name} was removed from ${scopeLabel(skill.scope)}.`
        );
        return;
      }

      showErrorToast('Remove failed', createCommandFailureMessage(outcome.command));
    } catch (error) {
      showErrorToast('Remove request failed', getErrorMessage(error));
    } finally {
      setRemovingSkillId(null);
    }
  };

  const handleUpdateSkill = async (skill: BrowserSkill) => {
    if (removingSkillId || updatingSkillId) {
      return;
    }

    setUpdatingSkillId(skill.id);

    try {
      const outcome = await updateSkill(skill);

      if (outcome.command.ok) {
        showSuccessToast(
          'Skill updated',
          `${skill.name} was updated in ${scopeLabel(skill.scope)}.`
        );
        return;
      }

      showErrorToast('Update failed', createCommandFailureMessage(outcome.command));
    } catch (error) {
      showErrorToast('Update request failed', getErrorMessage(error));
    } finally {
      setUpdatingSkillId(null);
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
            <Card
              key={skill.id}
              size="sm"
              className="skill-list-item min-h-44 min-w-0 rounded-lg transition-[background-color,box-shadow,transform] duration-150 ease-out [contain-intrinsic-size:12rem] [content-visibility:auto] hover:-translate-y-0.5 hover:bg-accent/40 hover:shadow-sm"
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
                    <Tooltip>
                      <TooltipTrigger>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={removingSkillId === skill.id || updatingSkillId === skill.id}
                          aria-label={`Update ${skill.name}`}
                          onClick={() => void handleUpdateSkill(skill)}
                        >
                          {updatingSkillId === skill.id ? (
                            <LoadingGlyph label={`Updating ${skill.name}`} />
                          ) : (
                            <RefreshCw className="size-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Update</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={removingSkillId === skill.id || updatingSkillId === skill.id}
                          aria-label={`Remove ${skill.name}`}
                          onClick={() => void handleRemoveSkill(skill)}
                        >
                          {removingSkillId === skill.id ? (
                            <LoadingGlyph label={`Removing ${skill.name}`} />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remove</TooltipContent>
                    </Tooltip>
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

      <InstallSkillDialog
        open={isInstallDialogOpen}
        onOpenChange={handleInstallDialogOpenChange}
        payload={payload}
        onInstalled={refresh}
      />
    </div>
  );
}
