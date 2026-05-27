import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SKILLS_BUNDLE_DATA, SKILLS_BUNDLE_VERSION } from './.generated/skills-bundle';

const MARKER = '.skills-browser-extracted';

let cachedCliPath: string | null = null;

export const getEmbeddedSkillsVersion = (): string => SKILLS_BUNDLE_VERSION;

export const getSkillsCliPath = async (): Promise<string> => {
  if (cachedCliPath) return cachedCliPath;

  const extractDir = join(tmpdir(), `skills-browser-${SKILLS_BUNDLE_VERSION}`);
  const cliPath = join(extractDir, 'node_modules/skills/bin/cli.mjs');
  const markerPath = join(extractDir, MARKER);

  try {
    await Bun.file(markerPath).stat();
    cachedCliPath = cliPath;
    return cliPath;
  } catch {
    // needs extraction
  }

  const stagingDir = `${extractDir}-${process.pid}-${Date.now()}`;
  await mkdir(stagingDir, { recursive: true });

  try {
    const json = Buffer.from(SKILLS_BUNDLE_DATA, 'base64').toString('utf-8');
    const manifest = JSON.parse(json) as Record<string, string>;

    for (const [relPath, base64Content] of Object.entries(manifest)) {
      const filePath = join(stagingDir, relPath);
      await mkdir(join(filePath, '..'), { recursive: true });
      await writeFile(filePath, Buffer.from(base64Content, 'base64'));
    }

    await writeFile(join(stagingDir, MARKER), '');

    try {
      await rm(extractDir, { recursive: true, force: true });
    } catch {
      // ok if missing
    }
    await rename(stagingDir, extractDir);
  } catch (error) {
    try {
      await rm(stagingDir, { recursive: true, force: true });
    } catch {
      // cleanup best-effort
    }
    throw error;
  }

  cachedCliPath = cliPath;
  return cliPath;
};
