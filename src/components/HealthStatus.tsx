'use client';

import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface HealthIssue {
  session: string;
  channel: string;
  issue: string;
  severity: 'warning' | 'critical';
  lastActive: number;
  minutesAgo: number;
}

interface HealthData {
  healthy: boolean;
  timestamp: number;
  totalSessions: number;
  activeSessions: number;
  issues: HealthIssue[];
  error?: string;
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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-mc-accent-green" />
        <h2 className="text-lg font-semibold">Agent Health</h2>
        <div
          className={`ml-2 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
            health.healthy
              ? 'bg-mc-accent-green/20 text-mc-accent-green'
              : 'bg-mc-accent-red/20 text-mc-accent-red'
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
                  issue.severity === 'critical' ? 'text-mc-accent-red' : 'text-yellow-500'
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
    </div>
  );
}
