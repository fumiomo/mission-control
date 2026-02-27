/**
 * Media root — redirects to the first directory listing.
 * GET /api/media → lists /data/
 */

import { NextResponse } from 'next/server';
import { readdirSync, statSync } from 'fs';
import path from 'path';

const MEDIA_ROOT = '/data';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getFileIcon(name: string): string {
  const ext = path.extname(name).toLowerCase();
  if (['.mp4', '.webm', '.mkv', '.avi', '.mov'].includes(ext)) return '🎬';
  if (['.mp3', '.wav', '.ogg', '.flac', '.m4a'].includes(ext)) return '🎵';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) return '🖼️';
  return '📁';
}

export async function GET() {
  try {
    const entries = readdirSync(MEDIA_ROOT, { withFileTypes: true })
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

    const rows = entries.map((entry) => {
      const fullPath = path.join(MEDIA_ROOT, entry.name);
      const href = `/api/media/${entry.name}${entry.isDirectory() ? '/' : ''}`;
      const icon = entry.isDirectory() ? '📁' : getFileIcon(entry.name);
      let size = '';
      let modified = '';
      try {
        const stat = statSync(fullPath);
        size = entry.isDirectory() ? '-' : formatSize(stat.size);
        modified = stat.mtime.toISOString().replace('T', ' ').slice(0, 19);
      } catch {
        size = '-';
        modified = '-';
      }
      return `<tr>
        <td>${icon} <a href="${href}">${entry.name}${entry.isDirectory() ? '/' : ''}</a></td>
        <td>${size}</td>
        <td>${modified}</td>
      </tr>`;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>📂 /data/</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 20px; background: #0d1117; color: #c9d1d9; }
    h1 { font-size: 1.2em; color: #58a6ff; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 8px 12px; border-bottom: 1px solid #30363d; color: #8b949e; font-weight: 500; font-size: 0.85em; }
    td { padding: 6px 12px; border-bottom: 1px solid #21262d; }
    a { color: #58a6ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    td:nth-child(2), td:nth-child(3) { color: #8b949e; font-size: 0.9em; white-space: nowrap; }
  </style>
</head>
<body>
  <h1>📂 /data/</h1>
  <table>
    <thead><tr><th>Name</th><th>Size</th><th>Modified</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('[MEDIA]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
