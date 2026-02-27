import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';

export const dynamic = 'force-dynamic';

const LOG_PATH = '/data/watchtower/logs/hera-triage.log';

export interface PipelineRun {
  timestamp: string;
  skipped: boolean;
  summary: string;
}

export async function GET() {
  try {
    const raw = readFileSync(LOG_PATH, 'utf-8');
    const lines = raw.split('\n');
    const runs: PipelineRun[] = [];
    let current: { timestamp: string; lines: string[] } | null = null;

    for (const line of lines) {
      const startMatch = line.match(/^\[(.+?)\] === Hera triage pipeline ===/);
      if (startMatch) {
        current = { timestamp: startMatch[1], lines: [] };
        continue;
      }
      const doneMatch = line.match(/=== Done/);
      if (doneMatch && current) {
        const skipped = current.lines.some(l => l.includes('Skipping Hera') || l.includes('no LLM call'));
        const synced = current.lines.find(l => l.includes('Synced:'));
        const triggered = current.lines.find(l => l.includes('Triggering Hera'));
        const dispatched = current.lines.find(l => l.includes('Dispatched'));
        
        let summary = skipped ? 'No action needed' : 'Hera invoked';
        if (synced) summary = synced.trim();
        if (triggered) summary += ' → ' + triggered.trim();
        if (dispatched) summary += ' → ' + dispatched.trim();

        // Convert UTC timestamp to JST
        const utcDate = new Date(current.timestamp);
        const jstTimestamp = isNaN(utcDate.getTime()) 
          ? current.timestamp 
          : utcDate.toLocaleString('en-US', { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
        runs.push({ timestamp: jstTimestamp, skipped, summary });
        current = null;
        continue;
      }
      if (current) {
        current.lines.push(line);
      }
    }

    return NextResponse.json({ runs: runs.reverse() });
  } catch {
    return NextResponse.json({ runs: [] });
  }
}
