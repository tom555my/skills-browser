import { existsSync } from 'node:fs';
import { createServer as createNetServer, Socket } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import * as p from '@clack/prompts';

type ParsedOptions = {
  autoOpen: boolean;
  host: string;
  port: number;
};

const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 1996;
const STARTUP_TIMEOUT_MS = 15_000;

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
  const serverEntry = resolveWebServerEntry();
  const url = buildServerUrl(options.host, options.port);

  p.intro(`Skills Browser CLI v${version}`);
  p.log.info(`Launch directory: ${launchCwd}`);

  const child = spawn(getBunExecutable(), [serverEntry], {
    cwd: launchCwd,
    env: {
      ...process.env,
      NITRO_HOST: options.host,
      NITRO_PORT: String(options.port),
      PORT: String(options.port),
      HOST: options.host,
      SKILLS_BROWSER_LAUNCH_CWD: launchCwd,
    },
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));

  bindShutdownSignals(child);

  await waitForStartup({
    child,
    host: options.host,
    port: options.port,
    timeoutMs: STARTUP_TIMEOUT_MS,
  });

  p.log.success(`Skills Browser is running at ${url}`);

  if (options.autoOpen) {
    await openBrowser(url);
  }

  await waitForExit(child);
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
    ].join('\n'),
    'skills-browser'
  );
}

function parseStartOptions(args: string[]): ParsedOptions {
  let host = DEFAULT_HOST;
  let port = DEFAULT_PORT;
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

      port = parsePort(value);
      i += 1;
      continue;
    }

    throw new Error(`Unknown option "${token}".`);
  }

  validateHost(host);
  return { autoOpen, host, port };
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

function resolveWebServerEntry(): string {
  const cliFilePath = fileURLToPath(import.meta.url);
  const cliRoot = resolve(cliFilePath, '..', '..');
  const serverEntry = resolve(cliRoot, '..', 'web', '.output', 'server', 'index.mjs');

  if (!existsSync(serverEntry)) {
    throw new Error(
      `Cannot find built web server at "${serverEntry}". Run "bun --filter=web run build" first.`
    );
  }

  return serverEntry;
}

function getBunExecutable() {
  if (process.versions.bun) {
    return process.execPath;
  }

  return 'bun';
}

function bindShutdownSignals(child: ReturnType<typeof spawn>) {
  const forward = (signal: NodeJS.Signals) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', () => forward('SIGINT'));
  process.on('SIGTERM', () => forward('SIGTERM'));
}

async function waitForStartup(input: {
  child: ReturnType<typeof spawn>;
  host: string;
  port: number;
  timeoutMs: number;
}) {
  const { child, host, port, timeoutMs } = input;
  const startedAt = Date.now();
  const probeHost = host === '0.0.0.0' ? '127.0.0.1' : host;

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Web server exited before startup (exit code ${child.exitCode}).`);
    }

    const connected = await canConnect(probeHost, port);
    if (connected) {
      return;
    }

    await sleep(200);
  }

  child.kill('SIGTERM');
  throw new Error(`Timed out waiting for web server startup on ${buildServerUrl(host, port)}.`);
}

async function canConnect(host: string, port: number) {
  return new Promise<boolean>((resolvePromise) => {
    const socket = new Socket();
    let settled = false;

    const finish = (value: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolvePromise(value);
    };

    socket.setTimeout(250);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const result = spawn(command, args, { stdio: 'ignore', detached: true });
  result.unref();
}

function buildServerUrl(host: string, port: number) {
  const formattedHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  return `http://${formattedHost}:${port}`;
}

function sleep(ms: number) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function waitForExit(child: ReturnType<typeof spawn>): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    child.once('error', rejectPromise);
    child.once('exit', (code, signal) => {
      if (code === 0 || signal === 'SIGINT' || signal === 'SIGTERM') {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`Web server exited with code ${code ?? 'unknown'}.`));
    });
  });
}

main().catch((error) => {
  p.log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
