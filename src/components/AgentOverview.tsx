'use client';

import { useState, useEffect } from 'react';
import { Users, MessageSquare, Zap, Clock, Hash, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Session {
  key: string;
  kind: string;
  displayName?: string;
  channel?: string;
  groupChannel?: string;
  subject?: string;
  chatType?: string;
  updatedAt: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  abortedLastRun?: boolean;
}

type FilterTab = 'all' | 'active' | 'idle';

function getSessionName(s: Session): string {
  if (s.groupChannel) return s.groupChannel;
  if (s.subject) return s.subject;
  if (s.displayName) {
    const parts = s.displayName.split('#');
    if (parts.length > 1) return '#' + parts[parts.length - 1];
    return s.displayName.split(':').pop() || s.displayName;
  }
  return s.key.split(':').pop() || s.key;
}

function getChannelIcon(channel?: string) {
  switch (channel) {
    case 'discord': return '💬';
    case 'telegram': return '📱';
    default: return '🤖';
  }
}

function getActivityStatus(updatedAt: number): { label: string; color: string; dotClass: string } {
  const minutesAgo = (Date.now() - updatedAt) / 60000;
  if (minutesAgo < 5) return { label: 'Active', color: 'text-mc-accent-green', dotClass: 'bg-mc-accent-green animate-pulse' };
  if (minutesAgo < 30) return { label: 'Recent', color: 'text-mc-accent-cyan', dotClass: 'bg-mc-accent-cyan' };
  if (minutesAgo < 120) return { label: 'Idle', color: 'text-mc-accent-yellow', dotClass: 'bg-yellow-500' };
  return { label: 'Dormant', color: 'text-mc-text-secondary', dotClass: 'bg-mc-text-secondary' };
}

function formatTokens(n?: number): string {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

export function AgentOverview() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/openclaw/sessions');
        if (res.ok) {
          const data = await res.json();
          const list = data.sessions?.sessions || data.sessions || [];
          setSessions(list.sort((a: Session, b: Session) => b.updatedAt - a.updatedAt));
        }
      } catch (e) {
        console.error('Failed to load sessions:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredSessions = sessions.filter((s) => {
    if (filter === 'all') return true;
    const minutesAgo = (Date.now() - s.updatedAt) / 60000;
    if (filter === 'active') return minutesAgo < 30;
    if (filter === 'idle') return minutesAgo >= 30;
    return true;
  });

  const activeSessions = sessions.filter((s) => (Date.now() - s.updatedAt) / 60000 < 30);
  const totalTokens = sessions.reduce((sum, s) => sum + (s.totalTokens || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-mc-accent-purple" />
          <h2 className="text-lg font-semibold">Agent Sessions</h2>
          <span className="text-xs text-mc-text-secondary ml-1">
            {activeSessions.length} active / {sessions.length} total
          </span>
        </div>
        <div className="flex gap-1">
          {(['all', 'active', 'idle'] as FilterTab[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-mc-accent text-mc-bg'
                  : 'bg-mc-bg border border-mc-border text-mc-text-secondary hover:text-mc-text'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-mc-bg border border-mc-border rounded-lg p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/20">
            <Zap className="w-4 h-4 text-mc-accent-green" />
          </div>
          <div>
            <div className="text-xs text-mc-text-secondary">Active Now</div>
            <div className="text-xl font-bold text-mc-accent-green">{activeSessions.length}</div>
          </div>
        </div>
        <div className="bg-mc-bg border border-mc-border rounded-lg p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <MessageSquare className="w-4 h-4 text-mc-accent-purple" />
          </div>
          <div>
            <div className="text-xs text-mc-text-secondary">Total Sessions</div>
            <div className="text-xl font-bold text-mc-accent-purple">{sessions.length}</div>
          </div>
        </div>
        <div className="bg-mc-bg border border-mc-border rounded-lg p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/20">
            <Hash className="w-4 h-4 text-mc-accent-cyan" />
          </div>
          <div>
            <div className="text-xs text-mc-text-secondary">Total Tokens</div>
            <div className="text-xl font-bold text-mc-accent-cyan">{formatTokens(totalTokens)}</div>
          </div>
        </div>
      </div>

      {/* Session list */}
      {loading ? (
        <div className="text-center py-6 text-mc-text-secondary">Loading sessions...</div>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-6 text-mc-text-secondary">No sessions found.</div>
      ) : (
        <div className="bg-mc-bg border border-mc-border rounded-lg overflow-hidden">
          <div className="max-h-80 overflow-y-auto">
            {filteredSessions.map((s) => {
              const status = getActivityStatus(s.updatedAt);
              return (
                <div
                  key={s.key}
                  className="flex items-center justify-between px-4 py-3 border-b border-mc-border last:border-b-0 hover:bg-mc-bg-secondary transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dotClass}`} />
                    <span className="text-lg flex-shrink-0">{getChannelIcon(s.channel)}</span>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{getSessionName(s)}</div>
                      <div className="text-xs text-mc-text-secondary">
                        {s.channel || 'system'} · {s.kind}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 text-right">
                    <div className="text-xs text-mc-text-secondary">
                      {formatTokens(s.totalTokens)} tokens
                    </div>
                    <div className={`text-xs ${status.color} w-16 text-right`}>
                      {formatDistanceToNow(s.updatedAt, { addSuffix: false })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
