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
  // Parse crontab
  const crontabRaw = run('crontab -l 2>/dev/null');
  const crons: CronJob[] = crontabRaw
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      const schedule = parts.slice(0, 5).join(' ');
      const command = parts.slice(5).join(' ');
      return { schedule, command };
    });

  // Parse systemd user services
  const servicesRaw = run(
    'systemctl --user list-units --type=service --all --no-pager --no-legend 2>/dev/null'
  );
  const services: Service[] = servicesRaw
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      const name = (parts[0] || '').replace('.service', '');
      const active = parts[2] === 'active';
      const status = parts[3] || 'unknown';

      // Get details for active services
      let pid, memory, cpu, description;
      if (active) {
        const details = run(`systemctl --user show ${name}.service --property=MainPID,MemoryCurrent,Description --no-pager 2>/dev/null`);
        for (const line of details.split('\n')) {
          if (line.startsWith('MainPID=')) pid = line.split('=')[1];
          if (line.startsWith('MemoryCurrent=')) {
            const bytes = parseInt(line.split('=')[1]);
            if (!isNaN(bytes) && bytes > 0) memory = (bytes / 1024 / 1024).toFixed(1) + ' MB';
          }
          if (line.startsWith('Description=')) description = line.split('=').slice(1).join('=');
        }
      }

      return { name, status, active, pid, memory, cpu, description };
    })
    .filter((s) => {
      // Only show our services + relevant ones
      const dominated = [
        'at-spi', 'dbus', 'dconf', 'dirmngr', 'evolution', 'gcr-', 'gnome',
        'gpg', 'gvfs', 'keyboxd', 'launchpadlib', 'pipewire', 'pk',
        'pulseaudio', 'snap', 'ssh-agent', 'systemd', 'tracker',
        'wireplumber', 'xdg', 'plasma', 'xfce',
      ];
      // Filter out junk names and bullet chars from bad parsing
      if (!s.name || s.name.startsWith('●') || s.name.length < 2) return false;
      return !dominated.some((prefix) => s.name.startsWith(prefix));
    });

  // System timers
  const timersRaw = run('systemctl --user list-timers --no-pager --no-legend 2>/dev/null');
  const timers = timersRaw
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.trim());

  return NextResponse.json({
    crons,
    services,
    timers,
    timestamp: Date.now(),
  });
}
