'use client';

import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Terminal, MessageCircleQuestion, Cpu, RotateCcw } from 'lucide-react';

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

interface RunningAgent {
  pid: string;
  type: string;
  uptime: string;
  cpu: string;
  memory: string;
  command: string;
}

interface HealthData {
  healthy: boolean;
  timestamp: number;
  totalSessions: number;
  activeSessions: number;
  tmuxSessions?: TmuxSession[];
  runningAgents?: RunningAgent[];
  blocked?: BlockedSession[];
  issues: HealthIssue[];
}

export function HealthStatus() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) setHealth(await res.json());
      } catch (e) {
        console.error('Health check failed:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return null;
  if (!health) return null;

  const criticalCount = health.issues.filter((i) => i.severity === 'critical').length;
  const warningCount = health.issues.filter((i) => i.severity === 'warning').length;
  const tmux = health.tmuxSessions || [];
  const agents = health.runningAgents || [];
  const blocked = health.blocked || [];
  const hasProblems = criticalCount > 0 || warningCount > 0;
  const allClear = !hasProblems && blocked.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-mc-accent-green" />
        <h2 className="text-lg font-semibold">Agent Health</h2>
        <button
          onClick={async () => {
            if (!confirm('Restart OpenClaw gateway? All active sessions will be interrupted.')) return;
            setRestarting(true);
            try {
              await fetch('/api/gateway/restart', { method: 'POST' });
            } catch {}
            setTimeout(() => setRestarting(false), 5000);
          }}
          className="ml-auto px-2 py-1 text-xs rounded border border-mc-border text-mc-text-secondary hover:text-red-400 hover:border-red-400/50 transition-colors flex items-center gap-1"
          disabled={restarting}
        >
          <RotateCcw className={`w-3 h-3 ${restarting ? 'animate-spin' : ''}`} />
          {restarting ? 'Restarting...' : 'Restart'}
        </button>
        <div
          className={`ml-2 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
            allClear
              ? 'bg-mc-accent-green/20 text-mc-accent-green'
              : hasProblems
              ? 'bg-red-500/20 text-red-400'
              : 'bg-yellow-500/20 text-yellow-500'
          }`}
        >
          {allClear ? (
            <>
              <CheckCircle className="w-3 h-3" />
              All Clear
            </>
          ) : hasProblems ? (
            <>
              <XCircle className="w-3 h-3" />
              {criticalCount} Critical{warningCount > 0 ? `, ${warningCount} Warning` : ''}
            </>
          ) : (
            <>
              <MessageCircleQuestion className="w-3 h-3" />
              {blocked.length} Waiting
            </>
          )}
        </div>
      </div>

      {/* Issues */}
      {health.issues.length > 0 && (
        <div className="bg-mc-bg border border-mc-border rounded-lg overflow-hidden">
          {health.issues.map((issue, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 px-4 py-3 border-b border-mc-border last:border-b-0 ${
                issue.severity === 'critical' ? 'bg-red-500/5' : 'bg-yellow-500/5'
              }`}
            >
              <AlertTriangle
                className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  issue.severity === 'critical' ? 'text-red-400' : 'text-yellow-500'
                }`}
              />
              <div className="min-w-0">
                <div className="font-medium text-sm">
                  {issue.session}{' '}
                  <span className="text-mc-text-secondary font-normal">({issue.channel})</span>
                </div>
                <div className="text-xs text-mc-text-secondary mt-0.5">{issue.issue}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Running Agents */}
      {agents.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-4 h-4 text-mc-accent-green" />
            <span className="text-sm font-medium text-mc-accent-green">
              Running ({agents.length})
            </span>
          </div>
          <div className="bg-mc-bg border border-mc-border rounded-lg overflow-hidden">
            {agents.map((a) => (
              <div
                key={a.pid}
                className="px-4 py-2.5 border-b border-mc-border last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-mc-accent-green animate-pulse flex-shrink-0" />
                    <span className="text-sm font-medium">{a.type}</span>
                    <span className="text-xs text-mc-text-secondary">PID {a.pid}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-mc-text-secondary">
                    <span>{a.cpu} CPU</span>
                    <span>{a.memory} MEM</span>
                    <span>{a.uptime}</span>
                  </div>
                </div>
                {a.command && (
                  <div className="text-xs text-mc-text-secondary mt-1 truncate ml-4">
                    {a.command}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blocked — Waiting for Input */}
      {blocked.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MessageCircleQuestion className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium text-yellow-500">
              Waiting for Input ({blocked.length})
            </span>
          </div>
          <div className="bg-mc-bg border border-yellow-500/30 rounded-lg overflow-hidden">
            {blocked.map((b, i) => (
              <div
                key={i}
                className="px-4 py-2.5 border-b border-mc-border last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{b.name}</span>
                  <span className="text-xs text-yellow-500">{b.minutesWaiting}m waiting</span>
                </div>
                <div className="text-xs text-mc-text-secondary mt-1 italic truncate">
                  &ldquo;{b.lastQuestion}&rdquo;
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tmux Sessions */}
      {tmux.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="w-4 h-4 text-mc-text-secondary" />
            <span className="text-sm font-medium text-mc-text-secondary">
              Coding Agents ({tmux.length})
            </span>
          </div>
          <div className="bg-mc-bg border border-mc-border rounded-lg overflow-hidden">
            {tmux.map((t) => (
              <div
                key={t.name}
                className="flex items-center justify-between px-4 py-2.5 border-b border-mc-border last:border-b-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      t.logStale
                        ? 'bg-yellow-500'
                        : 'bg-mc-accent-green animate-pulse'
                    }`}
                  />
                  <span className="text-sm font-mono truncate">{t.name}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 text-xs text-mc-text-secondary">
                  <span>{t.minutesRunning}m running</span>
                  {t.minutesSinceLogUpdate !== undefined && (
                    <span className={t.logStale ? 'text-yellow-500' : ''}>
                      {t.logStale ? `stale ${t.minutesSinceLogUpdate}m` : 'active'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
