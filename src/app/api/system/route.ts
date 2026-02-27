import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

function run(cmd: string): string {
  try {
    return execSync(cmd, { timeout: 5000, encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

interface CronJob {
  schedule: string;
  command: string;
}

interface Service {
  name: string;
  status: string;
  active: boolean;
  pid?: string;
  memory?: string;
  cpu?: string;
  description?: string;
}

export async function GET() {
  // Parse /etc/cron.d/openclaw (container uses system cron, not user crontab)
  const crontabRaw = run('cat /etc/cron.d/openclaw 2>/dev/null') || run('crontab -l 2>/dev/null');
  const crons: CronJob[] = crontabRaw
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      // /etc/cron.d format has user field after schedule (6th field)
      const schedule = parts.slice(0, 5).join(' ');
      const command = parts.slice(6).join(' '); // skip user field
      return { schedule, command };
    })
    .filter((c) => c.command);

  // Parse supervisord services (container uses supervisord, not systemd)
  const supervisorRaw = run('/usr/bin/supervisorctl status 2>/dev/null');
  const services = supervisorRaw
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      // Format: "name                      STATUS   pid NNN, uptime H:MM:SS"
      const match = line.match(/^(\S+)\s+(RUNNING|STOPPED|STARTING|FATAL|BACKOFF|EXITED)\s*(.*)/);
      if (!match) return null;
      const name = match[1];
      const status = match[2].toLowerCase();
      const active = match[2] === 'RUNNING';
      const pidMatch = match[3]?.match(/pid\s+(\d+)/);
      const pid = pidMatch ? pidMatch[1] : undefined;
      const uptimeMatch = match[3]?.match(/uptime\s+(\S+)/);
      const description = uptimeMatch ? `uptime ${uptimeMatch[1]}` : undefined;

      // Get memory for running processes
      let memory;
      if (active && pid) {
        const rss = run(`ps -p ${pid} -o rss= 2>/dev/null`);
        if (rss) memory = (parseInt(rss) / 1024).toFixed(1) + ' MB';
      }

      return { name, status, active, pid, memory, description };
    })
    .filter((s) => s !== null) as Service[];

  return NextResponse.json({
    crons,
    services,
    timers: [],
    timestamp: Date.now(),
  });
}
