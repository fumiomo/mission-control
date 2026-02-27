import { NextResponse } from 'next/server';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const SESSIONS_DIR = '/home/openclaw-vm-user/.openclaw/agents/hera/sessions';
const GAP_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export interface HeraMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isDecision: boolean;
}

export interface HeraRun {
  id: string;
  startTime: number;
  endTime: number;
  messages: HeraMessage[];
  decisions: string[];
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text || '')
      .join('\n')
      .trim();
  }
  return '';
}

function parseSessionFile(filePath: string): HeraMessage[] {
  try {
    const lines = readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
    const messages: HeraMessage[] = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type !== 'message') continue;

        const msg = entry.message;
        if (!msg || !['user', 'assistant'].includes(msg.role)) continue;

        const text = extractText(msg.content);
        if (!text) continue;

        const ts = new Date(entry.timestamp).getTime();
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: text,
          timestamp: ts,
          isDecision: text.includes('[Hera decision]'),
        });
      } catch {
        // skip malformed lines
      }
    }

    return messages;
  } catch {
    return [];
  }
}

function makeRun(messages: HeraMessage[]): HeraRun {
  const decisions = messages
    .filter((m) => m.isDecision)
    .map((m) => m.content);

  return {
    id: `run-${messages[0].timestamp}`,
    startTime: messages[0].timestamp,
    endTime: messages[messages.length - 1].timestamp,
    messages,
    decisions,
  };
}

function groupIntoRuns(messages: HeraMessage[]): HeraRun[] {
  if (messages.length === 0) return [];

  const runs: HeraRun[] = [];
  let current: HeraMessage[] = [messages[0]];

  for (let i = 1; i < messages.length; i++) {
    const gap = messages[i].timestamp - messages[i - 1].timestamp;
    // Split on: 30min gap OR new user message (= new task prompt from pipeline)
    const isNewPrompt = messages[i].role === 'user';
    if (gap > GAP_THRESHOLD_MS || isNewPrompt) {
      runs.push(makeRun(current));
      current = [];
    }
    current.push(messages[i]);
  }

  if (current.length > 0) {
    runs.push(makeRun(current));
  }

  return runs.reverse(); // Most recent first
}

export async function GET() {
  try {
    let files: string[] = [];
    try {
      files = readdirSync(SESSIONS_DIR)
        .filter((f) => f.endsWith('.jsonl'))
        .map((f) => join(SESSIONS_DIR, f));
    } catch {
      return NextResponse.json({ runs: [] });
    }

    const allMessages: HeraMessage[] = [];
    for (const file of files) {
      allMessages.push(...parseSessionFile(file));
    }

    allMessages.sort((a, b) => a.timestamp - b.timestamp);

    const runs = groupIntoRuns(allMessages);

    return NextResponse.json({ runs });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
