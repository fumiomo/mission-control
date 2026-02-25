'use client';

import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Terminal, MessageCircleQuestion } from 'lucide-react';

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

interface HealthData {
  healthy: boolean;
  timestamp: number;
  totalSessions: number;
  activeSessions: number;
  tmuxSessions?: TmuxSession[];
  blocked?: BlockedSession[];
  issues: HealthIssue[];
}

export function HealthStatus() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

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
  const blocked = health.blocked || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-mc-accent-green" />
        <h2 className="text-lg font-semibold">Agent Health</h2>
        <div
          className={`ml-2 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
            health.healthy
              ? 'bg-mc-accent-green/20 text-mc-accent-green'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          {health.healthy ? (
            <>
              <CheckCircle className="w-3 h-3" />
              All Clear
            </>
          ) : (
            <>
              <XCircle className="w-3 h-3" />
              {criticalCount} Critical{warningCount > 0 ? `, ${warningCount} Warning` : ''}
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
