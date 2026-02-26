import path from 'path';

export interface DocsFolder {
  displayName: string;
  key: string;
  absPath: string;
}

export const DOCS_FOLDERS: DocsFolder[] = [
  {
    displayName: 'YouTube Swarm / Research',
    key: 'youtube-swarm-research',
    absPath: '/home/vincent/storage/sandbox/youtube-swarm/research',
  },
  {
    displayName: 'YouTube Swarm / Docs',
    key: 'youtube-swarm-docs',
    absPath: '/home/vincent/storage/sandbox/youtube-swarm/docs',
  },
  {
    displayName: 'Articles',
    key: 'articles',
    absPath: '/home/vincent/storage/sandbox/articles',
  },
  {
    displayName: 'OpenClaw',
    key: 'openclaw',
    absPath: '/home/vincent/storage/sandbox/openclaw',
  },
  {
    displayName: 'Taikyohi',
    key: 'taikyohi',
    absPath: '/home/vincent/storage/sandbox/taikyohi',
  },
  {
    displayName: 'Transcripts',
    key: 'transcripts',
    absPath: '/home/vincent/storage/sandbox/transcripts',
  },
];

/**
 * Convert a URL slug (rootKey/relative/path.md) to an absolute filesystem path.
 * Returns null if the slug is invalid or would escape the root directory.
 */
export function slugToAbsPath(slug: string): string | null {
  const parts = slug.split('/');
  const rootKey = parts[0];
  const rest = parts.slice(1);

  const root = DOCS_FOLDERS.find((f) => f.key === rootKey);
  if (!root || rest.length === 0) return null;

  const relPath = rest.join(path.sep);
  const absPath = path.normalize(path.join(root.absPath, relPath));
  const normalizedRoot = path.normalize(root.absPath);

  // Path traversal protection: resolved path must stay within the root
  if (!absPath.startsWith(normalizedRoot + path.sep)) {
    return null;
  }

  return absPath;
}
