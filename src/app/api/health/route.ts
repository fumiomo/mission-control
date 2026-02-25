import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

function run(cmd: string): string {
  try {
    return execSync(cmd, { timeout: 5000, encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

interface HealthIssue {
  session: string;
  channel: string;
  issue: string;
  severity: 'warning' | 'critical';
  lastActive: number;
  minutesAgo: number;
}

interface TmuxSession {
  name: string;
  created: number;
  logFile?: string;
  logLastModified?: number;
  logStale: boolean;
  minutesRunning: number;
  minutesSinceLogUpdate?: number;
}

function getTmuxSessions(): TmuxSession[] {
  const raw = run('tmux list-sessions -F "#{session_name}|#{session_created}" 2>/dev/null');
  if (!raw) return [];

  const now = Date.now();
  return raw.split('\n').filter(Boolean).map((line) => {
    const [name, createdStr] = line.split('|');
    const created = parseInt(createdStr) * 1000;
    const minutesRunning = Math.round((now - created) / 60000);

    // Look for transcript logs in common locations
    const logLocations = [
      `/home/vincent/storage/sandbox/watchtower/tasks/${name}-transcript.log`,
      `/home/vincent/storage/sandbox/watchtower/tasks/${name}.log`,
    ];

    let logFile: string | undefined;
    let logLastModified: number | undefined;
    let logStale = false;
    let minutesSinceLogUpdate: number | undefined;

    for (const path of logLocations) {
      const mtime = run(`stat -c %Y "${path}" 2>/dev/null`);
      if (mtime) {
        logFile = path;
        logLastModified = parseInt(mtime) * 1000;
        minutesSinceLogUpdate = Math.round((now - logLastModified) / 60000);
        logStale = minutesSinceLogUpdate > 10;
        break;
      }
    }

    // Also check pane activity — last output time
    if (!logFile) {
      const activity = run(`tmux display-message -t "${name}" -p "#{session_activity}" 2>/dev/null`);
      if (activity) {
        const activityMs = parseInt(activity) * 1000;
        minutesSinceLogUpdate = Math.round((now - activityMs) / 60000);
        logStale = minutesSinceLogUpdate > 10;
      }
    }

    return { name, created, logFile, logLastModified, logStale, minutesRunning, minutesSinceLogUpdate };
  });
}

export async function GET(req: NextRequest) {
  try {
    const baseUrl = req.nextUrl.origin;
    const res = await fetch(`${baseUrl}/api/openclaw/sessions`);

    if (!res.ok) {
      return NextResponse.json({ healthy: false, error: 'Cannot reach OpenClaw via MC proxy' }, { status: 502 });
    }

    const data = await res.json();
    const sessions = data.sessions?.sessions || [];
    const now = Date.now();
    const issues: HealthIssue[] = [];

    // OpenClaw session checks
    for (const s of sessions) {
      const minutesAgo = (now - s.updatedAt) / 60000;
      const name = s.groupChannel || s.subject || s.displayName || s.key;
      const channel = s.channel || 'system';

      if (s.abortedLastRun) {
        issues.push({
          session: name,
          channel,
          issue: 'Last run was aborted — agent may be stuck',
          severity: 'critical',
          lastActive: s.updatedAt,
          minutesAgo: Math.round(minutesAgo),
        });
      }

      if (s.totalTokens > 500000) {
        issues.push({
          session: name,
          channel,
          issue: `High token usage: ${(s.totalTokens / 1000).toFixed(0)}K tokens`,
          severity: 'warning',
          lastActive: s.updatedAt,
          minutesAgo: Math.round(minutesAgo),
        });
      }
    }

    // Tmux session checks
    const tmuxSessions = getTmuxSessions();
    for (const t of tmuxSessions) {
      if (t.logStale && t.minutesRunning > 10) {
        issues.push({
          session: t.name,
          channel: 'tmux',
          issue: `No output for ${t.minutesSinceLogUpdate}min — agent may be stuck (running ${t.minutesRunning}min)`,
          severity: t.minutesSinceLogUpdate && t.minutesSinceLogUpdate > 30 ? 'critical' : 'warning',
          lastActive: t.logLastModified || t.created,
          minutesAgo: t.minutesSinceLogUpdate || t.minutesRunning,
        });
      }
    }

    const healthy = issues.filter(i => i.severity === 'critical').length === 0;

    return NextResponse.json({
      healthy,
      timestamp: now,
      totalSessions: sessions.length,
      activeSessions: sessions.filter((s: any) => (now - s.updatedAt) / 60000 < 30).length,
      tmuxSessions,
      issues,
    });
  } catch (error) {
    return NextResponse.json({ healthy: false, error: String(error) }, { status: 500 });
  }
}
