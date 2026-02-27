/**
 * Media File Server API
 * Serves files from /data/ with directory browsing.
 * GET /api/media/youtube-swarm/output/video.mp4 → streams the file
 * GET /api/media/youtube-swarm/ → HTML directory listing
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync, statSync, readdirSync, createReadStream, realpathSync } from 'fs';
import path from 'path';

const MEDIA_ROOT = '/data';

const MIME_TYPES: Record<string, string> = {
  // Video
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  // Documents
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.md': 'text/plain',
  '.csv': 'text/csv',
  '.html': 'text/html',
  // Data
  '.db': 'application/octet-stream',
  '.sqlite': 'application/octet-stream',
};

function getMime(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function renderDirectory(dirPath: string, urlPath: string): string {
  const entries = readdirSync(dirPath, { withFileTypes: true })
    .sort((a, b) => {
      // Directories first, then alphabetical
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  const rows = entries.map((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    const href = `/api/media/${urlPath ? urlPath + '/' : ''}${entry.name}${entry.isDirectory() ? '/' : ''}`;
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

  const parentLink = urlPath
    ? `<a href="/api/media/${urlPath.split('/').slice(0, -1).join('/')}${urlPath.includes('/') ? '/' : ''}">⬆️ Parent Directory</a>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>📂 /data/${urlPath}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 20px; background: #0d1117; color: #c9d1d9; }
    h1 { font-size: 1.2em; color: #58a6ff; margin-bottom: 4px; }
    .parent { margin-bottom: 16px; }
    .parent a { color: #8b949e; text-decoration: none; }
    .parent a:hover { color: #58a6ff; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 8px 12px; border-bottom: 1px solid #30363d; color: #8b949e; font-weight: 500; font-size: 0.85em; }
    td { padding: 6px 12px; border-bottom: 1px solid #21262d; }
    a { color: #58a6ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    td:nth-child(2), td:nth-child(3) { color: #8b949e; font-size: 0.9em; white-space: nowrap; }
  </style>
</head>
<body>
  <h1>📂 /data/${urlPath || ''}</h1>
  <div class="parent">${parentLink}</div>
  <table>
    <thead><tr><th>Name</th><th>Size</th><th>Modified</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function getFileIcon(name: string): string {
  const ext = path.extname(name).toLowerCase();
  if (['.mp4', '.webm', '.mkv', '.avi', '.mov'].includes(ext)) return '🎬';
  if (['.mp3', '.wav', '.ogg', '.flac', '.m4a'].includes(ext)) return '🎵';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) return '🖼️';
  if (['.pdf'].includes(ext)) return '📄';
  if (['.json', '.txt', '.md', '.csv'].includes(ext)) return '📝';
  if (['.db', '.sqlite'].includes(ext)) return '🗃️';
  return '📎';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;
    const relativePath = segments.join('/');
    const fullPath = path.join(MEDIA_ROOT, relativePath);

    // Security: resolve real path and ensure it's under MEDIA_ROOT
    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const realPath = realpathSync(fullPath);
    const realRoot = realpathSync(MEDIA_ROOT);
    if (!realPath.startsWith(realRoot + '/') && realPath !== realRoot) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const stat = statSync(realPath);

    // Directory → HTML listing
    if (stat.isDirectory()) {
      const html = renderDirectory(realPath, relativePath);
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // File → stream it with range support
    const mime = getMime(realPath);
    const rangeHeader = request.headers.get('range');

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        const stream = createReadStream(realPath, { start, end });
        const readable = new ReadableStream({
          start(controller) {
            stream.on('data', ( chunk) => controller.enqueue(chunk));
            stream.on('end', () => controller.close());
            stream.on('error', (err) => controller.error(err));
          },
        });

        return new NextResponse(readable as unknown as BodyInit, {
          status: 206,
          headers: {
            'Content-Type': mime,
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Content-Length': String(chunkSize),
            'Accept-Ranges': 'bytes',
          },
        });
      }
    }

    // Full file
    const stream = createReadStream(realPath);
    const readable = new ReadableStream({
      start(controller) {
        stream.on('data', ( chunk) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      },
    });

    return new NextResponse(readable as unknown as BodyInit, {
      headers: {
        'Content-Type': mime,
        'Content-Length': String(stat.size),
        'Accept-Ranges': 'bytes',
        'Content-Disposition': mime.startsWith('video/') || mime.startsWith('audio/') || mime.startsWith('image/')
          ? 'inline'
          : `attachment; filename="${path.basename(realPath)}"`,
      },
    });
  } catch (error) {
    console.error('[MEDIA]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
