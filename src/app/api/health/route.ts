import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { readFileSync, statSync, readdirSync } from 'fs';
import { join } from 'path';

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

interface BlockedSession {
  name: string;
  channel: string;
  lastQuestion: string;
  minutesWaiting: number;
}

const SESSIONS_DIR = '/home/openclaw-vm-user/.openclaw/agents/main/sessions';

interface RunningAgent {
  pid: string;
  type: string;
  uptime: string;
  cpu: string;
  memory: string;
  command: string;
  spawnedBy: 'openclaw' | 'user';
}

function buildParentMap(): Map<string, string> {
  // Returns pid -> ppid map for all processes
  const raw = run('ps -eo pid,ppid 2>/dev/null');
  const map = new Map<string, string>();
  for (const line of raw.split('\n').slice(1)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2) {
      map.set(parts[0], parts[1]);
    }
  }
  return map;
}

function hasAncestor(pid: string, targetPid: string, parentMap: Map<string, string>): boolean {
  // Walk up the process tree; stop at PID 1 or if we run out of entries
  let current = parentMap.get(pid);
  const visited = new Set<string>();
  while (current && current !== '0' && current !== '1' && !visited.has(current)) {
    if (current === targetPid) return true;
    visited.add(current);
    current = parentMap.get(current);
  }
  return false;
}

function getRunningAgents(): RunningAgent[] {
  // Get gateway PID for matching
  const gatewayPid = run('pgrep -f openclaw-gateway 2>/dev/null').split('\n')[0]?.trim() || '';

  // Build parent map once for efficient ancestor lookups
  const parentMap = gatewayPid ? buildParentMap() : new Map<string, string>();

  // Find claude/codex agent processes with parent PID info
  const raw = run('ps -eo pid,ppid,%cpu,%mem,etime,args --sort=-%cpu 2>/dev/null');
  if (!raw) return [];

  const agents: RunningAgent[] = [];
  for (const line of raw.split('\n').slice(1)) {
    if (!(/(claude|codex)/.test(line)) || line.includes('grep') || line.includes('health')) continue;

    const parts = line.trim().split(/\s+/);
    if (parts.length < 6) continue;
    const pid = parts[0];
    const cpu = parts[2] + '%';
    const mem = parts[3] + '%';
    const elapsed = parts[4];
    const cmd = parts.slice(5).join(' ');

    // Skip shell wrappers and non-agent processes
    if (cmd.includes('/bin/bash -c') || cmd.includes('snapshot')) continue;

    let type = 'unknown';
    if (cmd.includes('claude')) type = 'claude-code';
    if (cmd.includes('codex')) type = 'codex';

    // Walk parent tree to detect if any ancestor is the OpenClaw gateway
    const spawnedByOpenClaw =
      gatewayPid ? hasAncestor(pid, gatewayPid, parentMap) : false;

    // Extract task hint from command
    let taskHint = '';
    if (cmd.includes('--dangerously-skip-permissions')) {
      const afterFlag = cmd.split('--dangerously-skip-permissions')[1]?.trim();
      if (afterFlag) taskHint = afterFlag.substring(0, 120);
    }

    agents.push({
      pid,
      type,
      uptime: elapsed,
      cpu,
      memory: mem,
      command: taskHint || cmd.substring(0, 80),
      spawnedBy: spawnedByOpenClaw ? 'openclaw' : 'user',
    });
  }
  return agents;
}

function getLastAssistantMessage(sessionId: string): { text: string; timestamp: number } | null {
  const filePath = join(SESSIONS_DIR, `${sessionId}.jsonl`);
  try {
    statSync(filePath);
  } catch {
    return null;
  }

  // Read last 30 lines
  const lines = run(`tail -30 "${filePath}"`).split('\n').filter(Boolean);

  // Parse all recent messages in order
  const messages: { role: string; text: string; timestamp: number; isHera: boolean }[] = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const msg = entry.message || entry;
      if (!msg.role || !['user', 'assistant'].includes(msg.role)) continue;

      const content = msg.content;
      let text = '';
      if (typeof content === 'string') {
        text = content;
      } else if (Array.isArray(content)) {
        text = content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join(' ');
      }
      if (!text.trim()) continue;

      const timestamp = msg.timestamp || (entry.timestamp ? new Date(entry.timestamp).getTime() : 0);
      const isHera = msg.role === 'user' && (
        text.includes('[System: Hera') || 
        text.includes('Hera just triaged') || 
        text.includes('Hera (decision-maker')
      );
      messages.push({ role: msg.role, text: text.trim(), timestamp, isHera });
    } catch { continue; }
  }

  // Walk backwards to find the last assistant message
  // But skip it if a non-Hera user message came AFTER it (meaning human replied)
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'assistant') {
      return { text: m.text, timestamp: m.timestamp };
    }
    // If we hit a user message that's NOT from Hera before finding an assistant msg,
    // it means the last exchange was human→agent (not blocked)
    if (m.role === 'user' && !m.isHera) {
      return null;
    }
    // If it's a Hera message, skip it and keep looking for the assistant message
  }
  return null;
}

function isQuestion(text: string): boolean {
  // Get the last meaningful line
  const lines = text.split('\n').filter((l) => l.trim()).reverse();
  for (const line of lines.slice(0, 3)) {
    const trimmed = line.replace(/[*_`#>]/g, '').trim();
    if (!trimmed) continue;
    if (trimmed.endsWith('?')) return true;
    // Common patterns
    if (/\b(want me to|want to review|should [iI]|shall [iI]|would you like|let me know|thoughts\??|your call|up to you|ready to|want to proceed|how.*proceed|what.*prefer|which.*option|happy to help)/i.test(trimmed)) return true;
    // Check if line contains a ? anywhere (not just at end)
    if (trimmed.includes('?')) return true;
    break;
  }
  return false;
}

function getTmuxSessions(): TmuxSession[] {
  const raw = run('tmux list-sessions -F "#{session_name}|#{session_created}" 2>/dev/null');
  if (!raw) return [];

  const now = Date.now();
  return raw.split('\n').filter(Boolean).map((line) => {
    const [name, createdStr] = line.split('|');
    const created = parseInt(createdStr) * 1000;
    const minutesRunning = Math.round((now - created) / 60000);

    const logLocations = [
      `/home/openclaw-vm-user/src/watchtower/tasks/${name}-transcript.log`,
      `/home/openclaw-vm-user/src/watchtower/tasks/${name}.log`,
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
    const blocked: BlockedSession[] = [];

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

      // Check for blocked sessions (last assistant message ends with a question)
      if (s.sessionId && minutesAgo < 1440) {
        const lastMsg = getLastAssistantMessage(s.sessionId);
        if (lastMsg && isQuestion(lastMsg.text)) {
          const waitMinutes = Math.round((now - lastMsg.timestamp) / 60000);
          const questionPreview = lastMsg.text.split('\n').filter((l: string) => l.trim()).pop()?.substring(0, 100) || '';
          blocked.push({
            name,
            channel,
            lastQuestion: questionPreview,
            minutesWaiting: waitMinutes,
          });
        }
      }
    }

    // Running agent processes
    const runningAgents = getRunningAgents();

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
      runningAgents,
      blocked,
      issues,
    });
  } catch (error) {
    return NextResponse.json({ healthy: false, error: String(error) }, { status: 500 });
  }
}
