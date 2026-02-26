import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { slugToAbsPath } from '@/lib/docs-config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
  }

  const absPath = slugToAbsPath(slug);
  if (!absPath) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  if (!absPath.endsWith('.md')) {
    return NextResponse.json({ error: 'Only .md files are served' }, { status: 400 });
  }

  try {
    const content = fs.readFileSync(absPath, 'utf-8');
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
