#!/usr/bin/env bun

import * as p from '@clack/prompts';

import { main } from '../src/cli';

main().catch((error) => {
  p.log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
