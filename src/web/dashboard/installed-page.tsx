import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CheckCircle2, ExternalLink, FolderCode, Globe, RefreshCw, X } from 'lucide-react';

import type { UpdateSkillsRequest, UpdateSkillsResponse } from '../../features/skills/state';
import type { SkillScope } from '../../features/skills/types';
import { removeInstalledSkills, updateDashboardSkills } from '../api';
import { Badge } from '../components/ui/badge';
import { Button, buttonVariants } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  CommandOutputCard,
  LoadingGlyph,
  PageLoadingState,
  RemoveOperationCard,
  StatusBanner,
  SummaryCard,
  UpdateOperationCard,
} from './components';
import { useDashboardData } from './data';
import type { InstalledTab, RemoveOutcome, UpdateStatus } from './types';
import {
  buildUpdateStatusMessage,
  createCommandFailureMessage,
  getErrorMessage,
  parseCommaSeparatedValues,
  scopeLabel,
} from './utils';

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
            {isUpdating ? (
              <LoadingGlyph label="Updating project skills" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            <span>{isUpdating ? 'Updating' : 'Update project'}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isUpdating || isRemoving || globalSkills.length === 0}
            onClick={handleUpdateGlobal}
          >
            {isUpdating ? (
              <LoadingGlyph label="Updating global skills" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            <span>{isUpdating ? 'Updating' : 'Update global'}</span>
          </Button>
        </div>
      </div>

      {selectedSkills.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 duration-200 ease-[var(--ease-out)] animate-in fade-in-0 slide-in-from-top-1">
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
            {isUpdating ? (
              <LoadingGlyph label="Updating selected skills" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            <span>{isUpdating ? 'Updating...' : 'Update selected'}</span>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={openRemoveConfirmation}
            disabled={isRemoving || isUpdating}
          >
            {isRemoving ? <LoadingGlyph label="Removing selected skills" /> : null}
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
        <Card className="border shadow-none duration-200 ease-[var(--ease-out)] animate-in fade-in-0 slide-in-from-top-1">
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
                {isRemoving ? <LoadingGlyph label="Removing selected skills" /> : null}
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
              {visibleSkills.map((skill, index) => (
                <li
                  key={skill.id}
                  className="skill-list-item rounded-lg border p-3 transition-[background-color,border-color,box-shadow,transform] duration-150 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:shadow-xs has-[[data-slot=checkbox][data-checked]]:bg-muted/40"
                  style={
                    { '--skill-list-item-delay': `${Math.min(index, 8) * 28}ms` } as CSSProperties
                  }
                >
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
