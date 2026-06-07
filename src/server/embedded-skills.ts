import { createHash } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { SKILLS_BUNDLE_DATA, SKILLS_BUNDLE_VERSION } from './.generated/skills-bundle';

const MARKER = '.skills-browser-extracted';
const BUNDLE_HASH = createHash('sha256').update(SKILLS_BUNDLE_DATA).digest('hex');
const MARKER_CONTENT = `skills@${SKILLS_BUNDLE_VERSION}\nsha256:${BUNDLE_HASH}\n`;

let cachedCliPath: string | null = null;
let extractionPromise: Promise<string> | null = null;

export const getEmbeddedSkillsVersion = (): string => SKILLS_BUNDLE_VERSION;

export const getSkillsCliPath = async (): Promise<string> => {
  if (cachedCliPath) return cachedCliPath;

  extractionPromise ??= extractSkillsBundle();

  try {
    cachedCliPath = await extractionPromise;
    return cachedCliPath;
  } finally {
    extractionPromise = null;
  }
};

const extractSkillsBundle = async (): Promise<string> => {
  const extractDir = join(
    tmpdir(),
    `skills-browser-${SKILLS_BUNDLE_VERSION}-${BUNDLE_HASH.slice(0, 12)}`
  );
  const cliPath = join(extractDir, 'node_modules/skills/bin/cli.mjs');
  const markerPath = join(extractDir, MARKER);

  if (await isValidExtraction(markerPath, cliPath)) {
    cachedCliPath = cliPath;
    return cliPath;
  }

  const stagingDir = `${extractDir}-${process.pid}-${Date.now()}`;
  await mkdir(stagingDir, { recursive: true });

  try {
    const json = Buffer.from(SKILLS_BUNDLE_DATA, 'base64').toString('utf-8');
    const manifest = JSON.parse(json) as Record<string, string>;

    for (const [relPath, base64Content] of Object.entries(manifest)) {
      const filePath = join(stagingDir, relPath);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, Buffer.from(base64Content, 'base64'));
    }

    await writeFile(join(stagingDir, MARKER), MARKER_CONTENT);

    if (await isValidExtraction(markerPath, cliPath)) {
      await rm(stagingDir, { recursive: true, force: true });
      cachedCliPath = cliPath;
      return cliPath;
    }

    await rm(extractDir, { recursive: true, force: true });

    try {
      await rename(stagingDir, extractDir);
    } catch (error) {
      if (await isValidExtraction(markerPath, cliPath)) {
        await rm(stagingDir, { recursive: true, force: true });
        cachedCliPath = cliPath;
        return cliPath;
      }

      throw error;
    }
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

const isValidExtraction = async (markerPath: string, cliPath: string): Promise<boolean> => {
  try {
    const [marker] = await Promise.all([Bun.file(markerPath).text(), Bun.file(cliPath).stat()]);
    return marker === MARKER_CONTENT;
  } catch {
    return false;
  }
};
