import { describe, expect, it } from 'vitest';
import { loadConfig } from '../server/config.ts';
import { REPO_URL, versionUrl } from '../shared/version.ts';

describe('version', () => {
  it('links releases to their tag and previews to their pull request', () => {
    expect(versionUrl('v0.2.0')).toBe(`${REPO_URL}/releases/tag/v0.2.0`);
    expect(versionUrl('pr-3')).toBe(`${REPO_URL}/pull/3`);
    expect(versionUrl('dev')).toBeNull();
  });

  it('reads the running version from APP_VERSION, defaulting to dev', () => {
    expect(loadConfig({ APP_VERSION: 'v0.2.0' }).version).toBe('v0.2.0');
    expect(loadConfig({}).version).toBe('dev');
  });
});
