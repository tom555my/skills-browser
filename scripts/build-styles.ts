import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const watch = process.argv.includes('--watch');

await copyFontAssets();

const tailwindArguments = [
  'tailwindcss',
  '-i',
  './src/web/styles/globals.css',
  '-o',
  './src/web/.generated/globals.css',
  ...(watch ? ['--watch=always', '--map'] : ['--minify']),
];

const tailwind = Bun.spawn(['bun', ...tailwindArguments], {
  cwd: rootDirectory,
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
});

process.exitCode = await tailwind.exited;

async function copyFontAssets() {
  const fontFileName = 'inter-latin-wght-normal.woff2';
  const sourceFile = join(
    rootDirectory,
    'node_modules/@fontsource-variable/inter/files',
    fontFileName
  );
  const targetDirectory = join(rootDirectory, 'src/web/assets');

  await mkdir(targetDirectory, { recursive: true });
  await cp(sourceFile, join(targetDirectory, fontFileName), { force: true });
}
