import { describe, expect, it } from 'bun:test';

import { parseStartOptions } from './cli';

describe('start option parsing', () => {
  it('uses HOST and PORT environment values as defaults', () => {
    expect(parseStartOptions([], { HOST: '0.0.0.0', PORT: '3000' })).toEqual({
      autoOpen: false,
      host: '0.0.0.0',
      port: 3000,
    });
  });

  it('lets command-line options override environment values', () => {
    expect(
      parseStartOptions(['--host', 'localhost', '--port', '1997', '--auto'], {
        HOST: '0.0.0.0',
        PORT: '3000',
      })
    ).toEqual({
      autoOpen: true,
      host: 'localhost',
      port: 1997,
    });
  });

  it('validates the resolved environment port', () => {
    expect(() => parseStartOptions([], { PORT: '70000' })).toThrow(
      'Invalid port "70000". Port must be between 1 and 65535.'
    );
  });
});
