import { NextRequest, NextResponse } from 'next/server';

interface HealthIssue {
  session: string;
  channel: string;
  issue: string;
  severity: 'warning' | 'critical';
  lastActive: number;
  minutesAgo: number;
}

export async function GET(req: NextRequest) {
  try {
    // Use MC's own openclaw sessions proxy
    const baseUrl = req.nextUrl.origin;
    const res = await fetch(`${baseUrl}/api/openclaw/sessions`);

    if (!res.ok) {
      return NextResponse.json({ healthy: false, error: 'Cannot reach OpenClaw via MC proxy' }, { status: 502 });
    }

    const data = await res.json();
    const sessions = data.sessions?.sessions || [];
    const now = Date.now();
    const issues: HealthIssue[] = [];

    for (const s of sessions) {
      const minutesAgo = (now - s.updatedAt) / 60000;
      const name = s.groupChannel || s.subject || s.displayName || s.key;
      const channel = s.channel || 'system';

      // Aborted last run — agent crashed or got stuck
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

      // Active session with very high token usage (possible loop)
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

    const healthy = issues.filter(i => i.severity === 'critical').length === 0;

    return NextResponse.json({
      healthy,
      timestamp: now,
      totalSessions: sessions.length,
      activeSessions: sessions.filter((s: any) => (now - s.updatedAt) / 60000 < 30).length,
      issues,
    });
  } catch (error) {
    return NextResponse.json({ healthy: false, error: String(error) }, { status: 500 });
  }
}
