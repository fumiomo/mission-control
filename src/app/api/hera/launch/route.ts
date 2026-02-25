import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { openSync } from 'fs';

const LOG_PATH = '/home/vincent/storage/data/watchtower/logs/hera-triage.log';

export async function POST() {
  try {
    const logFd = openSync(LOG_PATH, 'a');
    const child = spawn('bash', [
      '/home/vincent/storage/sandbox/watchtower/scripts/hera-triage.sh'
    ], {
      detached: true,
      stdio: ['ignore', logFd, logFd],
    });
    child.unref();

    return NextResponse.json({ ok: true, message: 'Hera triage pipeline launched' });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
