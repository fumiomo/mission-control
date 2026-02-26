import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { DOCS_FOLDERS } from '@/lib/docs-config';

export const dynamic = 'force-dynamic';

export interface TreeNode {
  name: string;
  type: 'file' | 'folder';
  slugPath: string;
  children?: TreeNode[];
}

export interface RootFolder {
  displayName: string;
  key: string;
  children: TreeNode[];
}

function readTree(
  dirPath: string,
  rootKey: string,
  relativePath: string,
  depth: number
): TreeNode[] {
  if (depth > 3) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: TreeNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const entryRel = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    const slugPath = `${rootKey}/${entryRel}`;

    if (entry.isDirectory()) {
      const children = readTree(
        path.join(dirPath, entry.name),
        rootKey,
        entryRel,
        depth + 1
      );
      if (children.length > 0) {
        nodes.push({ name: entry.name, type: 'folder', slugPath, children });
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      nodes.push({
        name: entry.name.replace(/\.md$/, ''),
        type: 'file',
        slugPath,
      });
    }
  }

  // Folders first, then files; each group alphabetically
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

export async function GET() {
  const roots: RootFolder[] = DOCS_FOLDERS.map((folder) => ({
    displayName: folder.displayName,
    key: folder.key,
    children: readTree(folder.absPath, folder.key, '', 1),
  }));

  return NextResponse.json(roots);
}
