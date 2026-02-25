import { NextResponse } from 'next/server';
import { spawn } from 'child_process';

export async function POST() {
  try {
    const child = spawn('bash', [
      '/home/vincent/storage/sandbox/watchtower/scripts/hera-triage.sh'
    ], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    return NextResponse.json({ ok: true, message: 'Hera triage pipeline launched' });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
