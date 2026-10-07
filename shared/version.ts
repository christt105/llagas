export const REPO_URL = 'https://github.com/christt105/llagas';

/** Where a version string points on GitHub: a release tag, a preview image's PR, or nowhere for local builds. */
export function versionUrl(version: string): string | null {
  if (/^v\d+\.\d+\.\d+/.test(version)) return `${REPO_URL}/releases/tag/${version}`;
  const pr = /^pr-(\d+)$/.exec(version);
  return pr ? `${REPO_URL}/pull/${pr[1]}` : null;
}
