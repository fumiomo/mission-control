'use client';

import { useState, useEffect } from 'react';
import { Server, Clock, Play, Pause, AlertCircle } from 'lucide-react';

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
  description?: string;
}

interface SystemData {
  crons: CronJob[];
  services: Service[];
  timers: string[];
}

function cronToHuman(schedule: string): string {
  const parts = schedule.split(' ');
  if (parts[0] === '*/10' && parts.slice(1).join(' ') === '* * * *') return 'Every 10 min';
  if (parts[0] === '*/5' && parts.slice(1).join(' ') === '* * * *') return 'Every 5 min';
  if (parts[0] === '*/30' && parts.slice(1).join(' ') === '* * * *') return 'Every 30 min';
  if (parts[0] === '0' && parts[1] === '*') return 'Every hour';
  if (parts[0] === '0' && parts[1] === '0') return 'Daily at midnight';
  return schedule;
}

function shortCommand(cmd: string): string {
  // Show just the script name
  const parts = cmd.split('/');
  const script = parts[parts.length - 1]?.split(' ')[0] || cmd;
  return script.replace(/>>.*/g, '').trim();
}

export function SystemServices() {
  const [data, setData] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'services' | 'crons'>('services');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/system');
        if (res.ok) setData(await res.json());
      } catch (e) {
        console.error('Failed to load system info:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading || !data) return null;

  const activeServices = data.services.filter((s) => s.active);
  const inactiveServices = data.services.filter((s) => !s.active);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-mc-accent flex-shrink-0" />
          <h2 className="text-lg font-semibold whitespace-nowrap">System</h2>
          <span className="text-xs text-mc-text-secondary whitespace-nowrap">
            {activeServices.length} services · {data.crons.length} crons
          </span>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {(['services', 'crons'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 text-xs rounded font-medium capitalize transition-colors ${
                tab === t
                  ? 'bg-mc-accent text-mc-bg'
                  : 'bg-mc-bg border border-mc-border text-mc-text-secondary hover:text-mc-text'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'services' && (
        <div className="bg-mc-bg border border-mc-border rounded-lg overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {activeServices.map((s) => (
              <div
                key={s.name}
                className="flex items-center justify-between px-4 py-2.5 border-b border-mc-border last:border-b-0 hover:bg-mc-bg-secondary transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Play className="w-3.5 h-3.5 text-mc-accent-green flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{s.name}</div>
                    {s.description && (
                      <div className="text-xs text-mc-text-secondary truncate">
                        {s.description}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 text-xs text-mc-text-secondary">
                  {s.memory && <span>{s.memory}</span>}
                  {s.pid && s.pid !== '0' && <span>PID {s.pid}</span>}
                  <span className="text-mc-accent-green font-medium">{s.status}</span>
                </div>
              </div>
            ))}
            {inactiveServices.map((s) => (
              <div
                key={s.name}
                className="flex items-center justify-between px-4 py-2.5 border-b border-mc-border last:border-b-0 opacity-50"
              >
                <div className="flex items-center gap-3">
                  <Pause className="w-3.5 h-3.5 text-mc-text-secondary" />
                  <span className="text-sm">{s.name}</span>
                </div>
                <span className="text-xs text-mc-text-secondary">{s.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'crons' && (
        <div className="bg-mc-bg border border-mc-border rounded-lg overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {data.crons.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-2.5 border-b border-mc-border last:border-b-0 hover:bg-mc-bg-secondary transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Clock className="w-3.5 h-3.5 text-mc-accent-cyan flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{shortCommand(c.command)}</div>
                    <div className="text-xs text-mc-text-secondary truncate max-w-md">
                      {c.command}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-mc-accent-cyan font-mono flex-shrink-0 ml-4">
                  {cronToHuman(c.schedule)}
                </span>
              </div>
            ))}
            {data.crons.length === 0 && (
              <div className="text-center py-4 text-mc-text-secondary text-sm">No cron jobs</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
