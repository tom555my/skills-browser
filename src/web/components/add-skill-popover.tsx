import { PackagePlus, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';

import type { DashboardPayload } from '../../features/skills/state';
import type { SkillScope } from '../../features/skills/types';
import { installDashboardSkills } from '../api';
import { AnimatedText, Spinner } from '../dashboard/components';
import { showErrorToast, showSuccessToast } from '../dashboard/toasts';
import { createCommandFailureMessage, getErrorMessage } from '../dashboard/utils';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
  ComboboxList,
} from './ui/combobox';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from './ui/popover';

type AddSkillPopoverProps = {
  installSource: string;
  launchDirectory: string | undefined;
  previousState: DashboardPayload['installedState'] | undefined;
  isInstalling: boolean;
  onInstallingChange: (isInstalling: boolean) => void;
  onInstalled: () => Promise<void>;
  onDialogOpenChange: (open: boolean) => void;
};

export function AddSkillPopover({
  installSource,
  launchDirectory,
  previousState,
  isInstalling,
  onInstallingChange,
  onInstalled,
  onDialogOpenChange,
}: AddSkillPopoverProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'scope' | 'agents'>('scope');
  const [scope, setScope] = useState<SkillScope>('project');
  const [agents, setAgents] = useState<string[]>([]);

  const handleOpenInstallForm = useCallback(() => {
    setStep('scope');
    setScope('project');
    setAgents(['universal']);
    setOpen(true);
  }, []);

  const handleValueChange = useCallback((value: string | string[]) => {
    setAgents(Array.isArray(value) ? value : [value]);
  }, []);

  const handleInstall = async () => {
    if (!installSource) {
      return;
    }

    setOpen(false);
    onInstallingChange(true);

    try {
      const outcome = await installDashboardSkills({
        source: installSource,
        scope,
        agents: [...new Set([...agents, 'universal'])],
        previousState,
      });

      if (outcome.command.ok) {
        showSuccessToast('Skill installed', `${installSource} was installed in ${scope} scope.`);
        void onInstalled();
        onDialogOpenChange(false);
        return;
      }

      showErrorToast('Install failed', createCommandFailureMessage(outcome.command));
    } catch (error) {
      showErrorToast('Install request failed', getErrorMessage(error));
    } finally {
      onInstallingChange(false);
    }
  };

  if (isInstalling) {
    return (
      <Button size="sm" disabled>
        <Spinner label="Adding skill" />
        <AnimatedText className="text-left">Adding</AnimatedText>
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger onClick={handleOpenInstallForm}>
        <Button size="sm">
          <PackagePlus className="size-4" />
          <AnimatedText className="text-left">Add</AnimatedText>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-80">
        {step === 'scope' ? (
          <ScopeStep
            launchDirectory={launchDirectory}
            selectedScope={scope}
            onSelectScope={setScope}
            onContinue={() => setStep('agents')}
          />
        ) : (
          <AgentsStep
            selectedAgents={agents}
            onValueChange={handleValueChange}
            onBack={() => setStep('scope')}
            onInstall={handleInstall}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function ScopeStep({
  launchDirectory,
  selectedScope,
  onSelectScope,
  onContinue,
}: {
  launchDirectory: string | undefined;
  selectedScope: SkillScope;
  onSelectScope: (scope: SkillScope) => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-3">
      <PopoverHeader>
        <PopoverTitle className="text-xs text-muted-foreground uppercase">Step 1 of 2</PopoverTitle>
        <p className="text-sm font-medium">Where to install?</p>
      </PopoverHeader>

      <div className="space-y-1.5">
        <button
          type="button"
          data-selected={selectedScope === 'project'}
          className={cn(
            'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
            selectedScope === 'project'
              ? 'border-accent bg-accent/50'
              : 'border-border hover:bg-muted'
          )}
          onClick={() => onSelectScope('project')}
        >
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border">
            {selectedScope === 'project' ? (
              <span className="size-2 rounded-full bg-foreground" />
            ) : null}
          </span>
          <span className="min-w-0 space-y-0.5">
            <span className="block text-sm font-medium">Project</span>
            <span className="block truncate font-mono text-xs text-muted-foreground">
              {launchDirectory ?? 'Current directory'}
            </span>
          </span>
        </button>

        <button
          type="button"
          data-selected={selectedScope === 'global'}
          className={cn(
            'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
            selectedScope === 'global'
              ? 'border-accent bg-accent/50'
              : 'border-border hover:bg-muted'
          )}
          onClick={() => onSelectScope('global')}
        >
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border">
            {selectedScope === 'global' ? (
              <span className="size-2 rounded-full bg-foreground" />
            ) : null}
          </span>
          <span className="min-w-0 space-y-0.5">
            <span className="block text-sm font-medium">Global</span>
            <span className="block text-xs text-muted-foreground">Available for all projects</span>
          </span>
        </button>
      </div>

      <Button size="sm" className="w-full" onClick={onContinue}>
        Continue
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}

const COMMON_AGENTS = [
  'universal',
  'aider-desk',
  'amp',
  'antigravity',
  'augment',
  'bob',
  'claude',
  'claude-code',
  'cline',
  'codeartsdoer',
  'codebuddy',
  'codemaker',
  'codex',
  'copilot',
  'cursor',
  'deep-agents',
  'dexto',
  'firebender',
  'gemini',
  'kimi-code-cli',
  'openclaw',
  'opencode',
  'warp',
];

function AgentsStep({
  selectedAgents,
  onValueChange,
  onBack,
  onInstall,
}: {
  selectedAgents: string[];
  onValueChange: (value: string | string[]) => void;
  onBack: () => void;
  onInstall: () => void;
}) {
  return (
    <div className="space-y-3">
      <PopoverHeader>
        <PopoverTitle className="text-xs text-muted-foreground uppercase">Step 2 of 2</PopoverTitle>
        <p className="text-sm font-medium">Assign to agents</p>
      </PopoverHeader>

      <Combobox multiple value={selectedAgents} onValueChange={onValueChange}>
        <ComboboxChips>
          {selectedAgents.map((agent) => (
            <ComboboxChip key={agent}>{agent}</ComboboxChip>
          ))}
          <ComboboxChipsInput placeholder="Search agents..." className="text-xs" />
        </ComboboxChips>
        <ComboboxContent>
          <ComboboxList>
            <ComboboxGroup>
              {COMMON_AGENTS.map((agent) => (
                <ComboboxItem key={agent} value={agent}>
                  {agent}
                </ComboboxItem>
              ))}
            </ComboboxGroup>
            <ComboboxEmpty>No matching agents.</ComboboxEmpty>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      <p className="text-xs text-muted-foreground">
        Universal (.agents/skills) is always included.
      </p>

      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button size="sm" className="flex-1" onClick={onInstall}>
          <PackagePlus className="size-3.5" />
          Install
        </Button>
      </div>
    </div>
  );
}
