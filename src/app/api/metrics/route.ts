import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const METRICS_DB = path.resolve(process.cwd(), '..', 'metrics.db');

export async function GET(req: NextRequest) {
  const hours = parseInt(req.nextUrl.searchParams.get('hours') || '168');
  const since = Math.floor(Date.now() / 1000) - hours * 3600;

  try {
    const db = new Database(METRICS_DB, { readonly: true });
    const rows = db.prepare('SELECT * FROM metrics WHERE ts >= ? ORDER BY ts').all(since);
    db.close();
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to read metrics:', error);
    return NextResponse.json([], { status: 200 });
  }
}
