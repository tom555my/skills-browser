import type { ReactNode } from 'react';
import { RefreshCw, TerminalSquare } from 'lucide-react';
import { TextMorph } from 'torph/react';

import type { InstalledSkillsScopeState, UpdateSkillsResponse } from '../../features/skills/state';
import type { SkillScope } from '../../features/skills/types';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { DotmSquare3 } from '../components/ui/dotm-square-3';
import { cn } from '../lib/utils';
import type { InstallOutcome, RemoveOutcome } from './types';
import { scopeLabel } from './utils';

export function SummaryCard(props: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  count: number;
}) {
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

export function StatusBanner(props: { icon: ReactNode; className: string; message: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-xl border px-3 py-2 text-sm duration-200 ease-[var(--ease-out)] animate-in fade-in-0 slide-in-from-top-1',
        props.className
      )}
    >
      <span className="mt-0.5 shrink-0">{props.icon}</span>
      <p>{props.message}</p>
    </div>
  );
}

export function RemoveOperationCard(props: { outcome: RemoveOutcome }) {
  const { command, names, scope, status } = props.outcome;

  return (
    <Card className="border shadow-none duration-200 ease-[var(--ease-out)] animate-in fade-in-0 slide-in-from-top-1">
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

export function InstallOperationCard(props: { outcome: InstallOutcome }) {
  const { command, source, scope, status } = props.outcome;

  return (
    <Card className="border shadow-none duration-200 ease-[var(--ease-out)] animate-in fade-in-0 slide-in-from-top-1">
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

export function UpdateOperationCard(props: { results: UpdateSkillsResponse[] }) {
  return (
    <Card className="border shadow-none duration-200 ease-[var(--ease-out)] animate-in fade-in-0 slide-in-from-top-1">
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

export function CommandOutputCard(props: {
  scope: SkillScope;
  scopeState: InstalledSkillsScopeState;
}) {
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

export function OutputBlock(props: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{props.label}</p>
      <pre className="max-h-56 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">
        {props.value.trim()}
      </pre>
    </div>
  );
}

export function AnimatedText(props: { children: string; className?: string; as?: 'span' | 'p' }) {
  return (
    <TextMorph
      as={props.as ?? 'span'}
      className={cn('inline-block', props.className)}
      duration={280}
      ease="cubic-bezier(0.16, 1, 0.3, 1)"
    >
      {props.children}
    </TextMorph>
  );
}

export function LoadingGlyph(props: {
  label?: string;
  className?: string;
  size?: number;
  dotSize?: number;
}) {
  return (
    <DotmSquare3
      ariaLabel={props.label ?? 'Loading'}
      className={cn('shrink-0', props.className)}
      color="currentColor"
      dotSize={props.dotSize ?? 3}
      size={props.size ?? 18}
    />
  );
}

export function LoadingIndicator(props: { label: string; className?: string }) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 text-sm font-medium text-muted-foreground',
        props.className
      )}
    >
      <LoadingGlyph label={props.label} />
      <AnimatedText>{props.label}</AnimatedText>
    </div>
  );
}

export function PageLoadingState() {
  return (
    <div className="flex flex-1 w-full h-full items-center justify-center">
      <LoadingIndicator label="Loading skills" />
    </div>
  );
}

export function MetadataRow(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1 rounded-lg border p-3">
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{props.label}</dt>
      <dd className={cn('text-sm', props.mono ? 'font-mono break-all' : undefined)}>
        {props.value}
      </dd>
    </div>
  );
}
