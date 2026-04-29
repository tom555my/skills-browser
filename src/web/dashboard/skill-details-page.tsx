import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, BookOpenText } from 'lucide-react';

import { fetchSkillReadme } from '../api';
import { Badge } from '../components/ui/badge';
import { buttonVariants } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';
import { AgentBadge } from './agent-badge';
import { PageLoadingState } from './components';
import { useDashboardData } from './data';
import { formatDateTime, getErrorMessage, scopeLabel } from './utils';

export function SkillDetailsPage() {
  const { skillId } = useParams({ from: '/skill/$skillId' });
  const { isInitialLoading, payload, skills, getSkillById } = useDashboardData();
  const skill = getSkillById(skillId);
  const {
    data: skillReadmePayload,
    error: skillReadmeError,
    isPending: isSkillReadmePending,
  } = useQuery({
    queryKey: ['installed-skill-readme', skill?.id],
    queryFn: async () => fetchSkillReadme(skill?.id ?? ''),
    enabled: Boolean(skill),
  });

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

  return (
    <section className="flex flex-col gap-3">
      <div className="border-b pb-3 font-mono text-xs font-medium uppercase text-muted-foreground">
        SKILL.md
      </div>
      <pre className="min-w-0 overflow-x-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-5 font-mono text-sm leading-6 text-foreground">
        {markdown}
      </pre>
    </section>
  );
}
