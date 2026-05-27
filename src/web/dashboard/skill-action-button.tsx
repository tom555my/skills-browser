import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Check, CircleAlert } from 'lucide-react';

import { Button } from '../components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '../components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { Spinner } from './components';

type SkillActionStatus = 'idle' | 'loading' | 'success' | 'error';

export type SkillActionResult = {
  ok: boolean;
  errorMessage?: string;
};

type SkillActionConfirmation = {
  title: string;
  description: string;
  actionLabel: string;
};

export function SkillActionButton({
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
  confirmation?: SkillActionConfirmation;
  disabled: boolean;
  errorTitle: string;
  idleIcon: ReactNode;
  loadingLabel: string;
  onAction: () => Promise<SkillActionResult>;
  onPendingChange: (actionKey: string | null) => void;
  tooltip: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
}) {
  const [status, setStatus] = useState<SkillActionStatus>('idle');
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
