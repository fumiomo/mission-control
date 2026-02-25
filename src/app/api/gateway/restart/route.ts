import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function POST() {
  try {
    execSync('systemctl --user restart openclaw-gateway', { timeout: 10000 });
    return NextResponse.json({ ok: true, message: 'Gateway restarting...' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
