#!/usr/bin/env bun

import { createServer as createNetServer } from 'node:net';
import * as p from '@clack/prompts';

import index from './web/index.html';
import { honoApp } from './server/hono-app';

type ParsedOptions = {
  autoOpen: boolean;
  host: string;
  port: number;
};

const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 1996;

type StartEnvironment = {
  [key: string]: string | undefined;
  HOST?: string;
  PORT?: string;
};

export async function main() {
  const { version } = await import('../package.json', {
    with: { type: 'json' },
  });

  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp(version);
    return;
  }

  const [command, ...commandArgs] = args;
  if (command !== 'start') {
    throw new Error(`Unknown command "${command}". Use "start".`);
  }

  const options = parseStartOptions(commandArgs);
  await assertPortAvailable(options.host, options.port);

  const launchCwd = process.cwd();
  process.env.SKILLS_BROWSER_LAUNCH_CWD = launchCwd;

  const server = Bun.serve({
    hostname: options.host,
    port: options.port,
    routes: {
      '/api/*': honoApp.fetch,
      '/*': index,
    },
    development: process.env.NODE_ENV === 'development',
  });

  const url = buildServerUrl(options.host, options.port);

  p.intro(`Skills Browser CLI v${version}`);
  p.log.info(`Launch directory: ${launchCwd}`);
  p.log.success(`Skills Browser is running at ${url}`);

  if (options.autoOpen) {
    await openBrowser(url);
  }

  const shutdown = createShutdownPromise(server);
  await shutdown;
}

function printHelp(version: string) {
  p.intro(`Skills Browser CLI v${version}`);
  p.note(
    [
      'Usage:',
      '  skills-browser start [--host <host>] [--port <number>] [--auto]',
      '',
      'Defaults:',
      `  --host ${DEFAULT_HOST}`,
      `  --port ${DEFAULT_PORT}`,
      '',
      'Environment:',
      '  HOST sets the default host',
      '  PORT sets the default port',
    ].join('\n'),
    'skills-browser'
  );
}

export function parseStartOptions(
  args: string[],
  environment: StartEnvironment = process.env
): ParsedOptions {
  let host = getEnvironmentValue(environment.HOST) ?? DEFAULT_HOST;
  let rawPort = getEnvironmentValue(environment.PORT) ?? String(DEFAULT_PORT);
  let autoOpen = false;

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === '--auto') {
      autoOpen = true;
      continue;
    }

    if (token === '--host') {
      const value = args[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Invalid host. Pass --host <host>.');
      }

      host = value.trim();
      i += 1;
      continue;
    }

    if (token === '--port') {
      const value = args[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Invalid port. Pass --port <number>.');
      }

      rawPort = value;
      i += 1;
      continue;
    }

    throw new Error(`Unknown option "${token}".`);
  }

  validateHost(host);
  const port = parsePort(rawPort);
  return { autoOpen, host, port };
}

function getEnvironmentValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parsePort(rawPort: string): number {
  const parsed = Number(rawPort);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`Invalid port "${rawPort}". Port must be between 1 and 65535.`);
  }

  return parsed;
}

function validateHost(host: string) {
  if (!host || /\s/.test(host)) {
    throw new Error(`Invalid host "${host}".`);
  }

  const hostForUrl = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  try {
    const url = new URL(`http://${hostForUrl}`);
    if (!url.hostname) {
      throw new Error('Missing hostname');
    }
  } catch {
    throw new Error(`Invalid host "${host}".`);
  }
}

async function assertPortAvailable(host: string, port: number): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const server = createNetServer();
    server.unref();

    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        rejectPromise(new Error(`Port ${port} on host "${host}" is already in use.`));
        return;
      }

      rejectPromise(
        new Error(`Failed to validate port ${port} on host "${host}": ${error.message}`)
      );
    });

    server.listen(port, host, () => {
      server.close((closeError) => {
        if (closeError) {
          rejectPromise(closeError);
          return;
        }

        resolvePromise();
      });
    });
  });
}

function createShutdownPromise(server: ReturnType<typeof Bun.serve>): Promise<void> {
  return new Promise((resolvePromise) => {
    let settled = false;

    const stop = () => {
      if (settled) {
        return;
      }

      settled = true;
      server.stop(true);
      resolvePromise();
    };

    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
}

async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const result = Bun.spawn([command, ...args], { stdout: 'ignore', stderr: 'ignore' });
  await result.exited;
}

function buildServerUrl(host: string, port: number) {
  const formattedHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  return `http://${formattedHost}:${port}`;
}

if (import.meta.main) {
  main().catch((error) => {
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
