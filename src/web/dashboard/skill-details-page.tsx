import { useEffect, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, Check, Copy } from 'lucide-react';

import { Badge } from '../components/ui/badge';
import { Button, buttonVariants } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { CommandOutputCard, MetadataRow, PageLoadingState } from './components';
import { useDashboardData } from './data';
import type { SkillDetailsTab } from './types';
import { buildSkillActivity, formatDateTime, formatNullableDate, scopeLabel } from './utils';

export function SkillDetailsPage() {
  const { skillId } = useParams({ from: '/skill/$skillId' });
  const { payload, isInitialLoading, skills, getSkillById } = useDashboardData();
  const [activeTab, setActiveTab] = useState<SkillDetailsTab>('overview');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setActiveTab('overview');
    setCopied(false);
  }, [skillId]);

  const skill = getSkillById(skillId);

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

  const scopeState = payload.installedState[skill.scope];

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(skill.installCommand);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Browse
      </Link>

      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-2xl font-semibold">{skill.name}</h1>
              <Badge variant="secondary">{scopeLabel(skill.scope)}</Badge>
              {skill.sourceType ? <Badge variant="outline">{skill.sourceType}</Badge> : null}
              {skill.ref ? <Badge variant="outline">ref: {skill.ref}</Badge> : null}
            </div>
            <p className="text-muted-foreground">{skill.description}</p>
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

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void handleCopyCommand()}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              <span>{copied ? 'Copied' : 'Copy install'}</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm">
          <span className="text-muted-foreground">$</span>
          <code className="min-w-0 flex-1 break-all">{skill.installCommand}</code>
        </div>

        {skill.agents.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {skill.agents.map((agent) => (
              <Badge key={`${skill.id}:${agent}`} variant="outline">
                {agent}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={activeTab === 'overview' ? 'default' : 'outline'}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'activity' ? 'default' : 'outline'}
            onClick={() => setActiveTab('activity')}
          >
            Activity
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'output' ? 'default' : 'outline'}
            onClick={() => setActiveTab('output')}
          >
            Command Output
          </Button>
        </div>

        {activeTab === 'overview' ? (
          <Card className="border shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Skill Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <MetadataRow label="Name" value={skill.name} mono />
                <MetadataRow label="Scope" value={scopeLabel(skill.scope)} />
                <MetadataRow label="Source" value={skill.primarySource} mono />
                <MetadataRow label="Source Type" value={skill.sourceType ?? 'Unknown'} />
                <MetadataRow label="Installed At" value={formatNullableDate(skill.installedAt)} />
                <MetadataRow label="Updated At" value={formatNullableDate(skill.updatedAt)} />
              </dl>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === 'activity' ? (
          <Card className="border shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {buildSkillActivity(skill, payload.loadedAt).map((item) => (
                  <div
                    key={`${skill.id}:${item.label}:${item.timestamp}`}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span>{item.label}</span>
                    <span className="text-muted-foreground">{item.timestamp}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === 'output' ? (
          <CommandOutputCard scope={skill.scope} scopeState={scopeState} />
        ) : null}
      </div>
    </div>
  );
}
