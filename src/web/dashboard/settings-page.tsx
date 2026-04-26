import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { buttonVariants } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { SettingsSwitch } from './components';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Browse
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure Skills Browser preferences</p>
      </div>

      <Separator />

      <Card className="border shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Registry</CardTitle>
          <CardDescription>Core fetch and execution settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="registry-url" className="text-sm font-medium">
              Registry URL
            </label>
            <Input
              id="registry-url"
              defaultValue="https://registry.skills.sh"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              The skills registry to fetch packages from
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cache-dir" className="text-sm font-medium">
              Cache Directory
            </label>
            <Input id="cache-dir" defaultValue="~/.skills/cache" className="font-mono" />
            <p className="text-xs text-muted-foreground">
              Local directory for caching skill packages
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="default-shell" className="text-sm font-medium">
              Default Shell
            </label>
            <Select defaultValue="zsh">
              <SelectTrigger id="default-shell" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="bash">Bash</SelectItem>
                  <SelectItem value="zsh">Zsh</SelectItem>
                  <SelectItem value="fish">Fish</SelectItem>
                  <SelectItem value="powershell">PowerShell</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Behavior</CardTitle>
          <CardDescription>Client-side preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingsSwitch
            id="auto-update"
            title="Auto-update skills"
            description="Automatically update skills when new versions are available"
          />
          <SettingsSwitch
            id="telemetry"
            title="Usage analytics"
            description="Send anonymous usage data to help improve skills.sh"
            defaultChecked
          />
          <SettingsSwitch
            id="prerelease"
            title="Show pre-release versions"
            description="Include alpha and beta releases in search results"
          />
          <SettingsSwitch
            id="offline"
            title="Offline mode"
            description="Use cached data when network is unavailable"
            defaultChecked
          />
        </CardContent>
      </Card>

      <Card className="border shadow-none">
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
          <CardDescription>Project and CLI metadata</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Skills Browser v0.0.1</p>
            <p>CLI: skills (detected at runtime)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="https://skills.sh/docs"
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ExternalLink className="size-4" />
              <span>Documentation</span>
            </a>
            <a
              href="https://github.com/skills-sh/skills"
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ExternalLink className="size-4" />
              <span>GitHub</span>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
