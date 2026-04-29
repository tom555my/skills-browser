import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, BookOpenText, RefreshCw, Trash2 } from 'lucide-react';

import { Badge } from '../components/ui/badge';
import { Button, buttonVariants } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';
import { fetchSkillReadme } from '../api';
import { AgentBadge } from './agent-badge';
import { AnimatedText, LoadingGlyph, PageLoadingState } from './components';
import { useDashboardData } from './data';
import { useSkillActions } from './skill-actions';
import {
  SkillMarkdown,
  type SkillFrontmatterValue,
  parseSkillFrontmatterAttributes,
  parseSkillMarkdownDocument,
} from './skill-markdown';
import { showErrorToast, showSuccessToast } from './toasts';
import { confirm } from './confirm';
import { createCommandFailureMessage, formatDateTime, getErrorMessage, scopeLabel } from './utils';

export function SkillDetailsPage() {
  const { skillId } = useParams({ from: '/skill/$skillId' });
  const navigate = useNavigate();
  const { isInitialLoading, payload, skills, getSkillById } = useDashboardData();
  const { removeSkill, updateSkill } = useSkillActions();
  const skill = getSkillById(skillId);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const {
    data: skillReadmePayload,
    error: skillReadmeError,
    isPending: isSkillReadmePending,
  } = useQuery({
    queryKey: ['installed-skill-readme', skill?.id],
    queryFn: async () => {
      if (!skill) {
        throw new Error('Skill id is required.');
      }

      return fetchSkillReadme(skill.id);
    },
    enabled: Boolean(skill),
  });

    const handleRemoveSkill = async () => {
     if (!skill || isRemoving || isUpdating) {
       return;
     }
 
     const confirmed = await confirm(`Remove "${skill.name}" from ${scopeLabel(skill.scope)}?`);
     if (!confirmed) {
       return;
     }

    setIsRemoving(true);

    try {
      const outcome = await removeSkill(skill);

      if (outcome.command.ok) {
        showSuccessToast(
          'Skill removed',
          `${skill.name} was removed from ${scopeLabel(skill.scope)}.`
        );
        await navigate({ to: '/' });
        return;
      }

      showErrorToast('Remove failed', createCommandFailureMessage(outcome.command));
    } catch (error) {
      showErrorToast('Remove request failed', getErrorMessage(error));
    } finally {
      setIsRemoving(false);
    }
  };

  const handleUpdateSkill = async () => {
    if (!skill || isRemoving || isUpdating) {
      return;
    }

    setIsUpdating(true);

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
      setIsUpdating(false);
    }
  };

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

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Browse
      </Link>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-2xl font-semibold">{skill.name}</h1>
              <Badge variant="secondary">{scopeLabel(skill.scope)}</Badge>
              {skill.sourceType ? <Badge variant="outline">{skill.sourceType}</Badge> : null}
              {skill.ref ? <Badge variant="outline">ref: {skill.ref}</Badge> : null}
            </div>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{skill.description}</p>
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

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isUpdating || isRemoving}
              onClick={() => void handleUpdateSkill()}
            >
              {isUpdating ? (
                <LoadingGlyph label={`Updating ${skill.name}`} />
              ) : (
                <RefreshCw className="size-4" />
              )}
              <AnimatedText className="text-left">
                {isUpdating ? 'Updating' : 'Update'}
              </AnimatedText>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isUpdating || isRemoving}
              onClick={() => void handleRemoveSkill()}
            >
              {isRemoving ? (
                <LoadingGlyph label={`Removing ${skill.name}`} />
              ) : (
                <Trash2 className="size-4" />
              )}
              <AnimatedText className="text-left">
                {isRemoving ? 'Removing' : 'Remove'}
              </AnimatedText>
            </Button>
          </div>
        </div>

        {skill.agents.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {skill.agents.map((agent) => (
              <AgentBadge key={`${skill.id}:${agent}`} agent={agent} />
            ))}
          </div>
        ) : null}
      </div>

      <Separator />

      <SkillReadmeBody
        errorMessage={skillReadmeError ? getErrorMessage(skillReadmeError) : null}
        isLoading={isSkillReadmePending}
        markdown={skillReadmePayload?.readme.markdown ?? null}
      />
    </div>
  );
}

function SkillReadmeBody({
  errorMessage,
  isLoading,
  markdown,
}: {
  errorMessage: string | null;
  isLoading: boolean;
  markdown: string | null;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (markdown === null) {
    return (
      <Card className="border shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpenText className="size-4" />
            SKILL.md unavailable
          </CardTitle>
          <CardDescription>
            {errorMessage ?? 'The installed skill does not expose a readable SKILL.md file.'}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const document = parseSkillMarkdownDocument(markdown);

  return (
    <div className="flex flex-col gap-6">
      {document.frontmatter !== null ? (
        <SkillFrontmatter frontmatter={document.frontmatter} />
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="pb-3 font-mono text-xs font-medium uppercase text-muted-foreground">
          Instructions
        </div>
        <SkillMarkdown markdown={document.markdown} />
      </section>
    </div>
  );
}

function SkillFrontmatter({ frontmatter }: { frontmatter: string }) {
  const attributes = parseSkillFrontmatterAttributes(frontmatter);

  return (
    <section className="flex flex-col gap-3">
      <div className="pb-3 font-mono text-xs font-medium uppercase text-muted-foreground">
        YAML frontmatter
      </div>
      <div className="overflow-hidden rounded-lg border bg-muted/20">
        {attributes.map((attribute) => (
          <div
            key={attribute.name}
            className="grid gap-2 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[10rem_1fr]"
          >
            <div className="min-w-0 font-mono text-xs font-medium text-muted-foreground">
              {attribute.name}
            </div>
            <div className="min-w-0 text-sm leading-6 text-foreground">
              <SkillFrontmatterValueView value={attribute.value} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SkillFrontmatterValueView({ value }: { value: SkillFrontmatterValue }) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground">Empty array</span>;
    }

    if (value.every(isFrontmatterRecord)) {
      return <SkillFrontmatterObjectArrayTable values={value} />;
    }

    return (
      <div className="flex flex-wrap gap-1.5">
        {value.map((item, index) => (
          <span
            key={index}
            className="rounded-md border bg-background px-2 py-0.5 font-mono text-xs text-foreground"
          >
            {frontmatterValueToText(item)}
          </span>
        ))}
      </div>
    );
  }

  if (isFrontmatterRecord(value)) {
    return <SkillFrontmatterKeyValueTable value={value} />;
  }

  return <span className="whitespace-pre-wrap break-words">{frontmatterValueToText(value)}</span>;
}

function SkillFrontmatterKeyValueTable({
  value,
}: {
  value: Record<string, SkillFrontmatterValue>;
}) {
  const entries = Object.entries(value);

  if (entries.length === 0) {
    return <span className="text-muted-foreground">Empty object</span>;
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full border-collapse text-left text-sm">
        <tbody>
          {entries.map(([key, item]) => (
            <tr key={key} className="border-b last:border-b-0">
              <th className="w-40 bg-muted/40 px-3 py-2 align-top font-mono text-xs font-medium text-muted-foreground">
                {key}
              </th>
              <td className="px-3 py-2 align-top">
                <SkillFrontmatterValueView value={item} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SkillFrontmatterObjectArrayTable({
  values,
}: {
  values: Record<string, SkillFrontmatterValue>[];
}) {
  const columns = Array.from(new Set(values.flatMap((item) => Object.keys(item))));

  if (columns.length === 0) {
    return <span className="text-muted-foreground">Empty objects</span>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-max border-collapse text-left text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            {columns.map((column) => (
              <th
                key={column}
                className="px-3 py-2 align-top font-mono text-xs font-medium text-muted-foreground"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {values.map((item, index) => (
            <tr key={index} className="border-b last:border-b-0">
              {columns.map((column) => (
                <td key={column} className="px-3 py-2 align-top">
                  {column in item ? (
                    <SkillFrontmatterValueView value={item[column]} />
                  ) : (
                    <span className="text-muted-foreground">Empty</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function isFrontmatterRecord(
  value: SkillFrontmatterValue
): value is Record<string, SkillFrontmatterValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function frontmatterValueToText(value: SkillFrontmatterValue): string {
  if (value === null || value === '') {
    return 'Empty';
  }

  if (Array.isArray(value)) {
    return value.map(frontmatterValueToText).join(', ');
  }

  if (isFrontmatterRecord(value)) {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${frontmatterValueToText(item)}`)
      .join(', ');
  }

  return String(value);
}
