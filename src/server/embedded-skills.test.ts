import { describe, expect, it } from 'bun:test';

import { getEmbeddedSkillsVersion, getSkillsCliPath } from './embedded-skills';

describe('embedded skills CLI', () => {
  it('extracts a runnable skills CLI from the bundled package', async () => {
    const cliPath = await getSkillsCliPath();

    expect(await Bun.file(cliPath).exists()).toBe(true);

    const process = Bun.spawn(['bun', cliPath, '--version'], {
      stderr: 'pipe',
      stdout: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ]);

    expect(stderr).toBe('');
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe(getEmbeddedSkillsVersion());
  });
});
