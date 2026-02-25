'use client';

import { useState, useEffect } from 'react';
import { Crown, ChevronDown, ChevronRight, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import type { HeraMessage, HeraRun } from '@/app/api/hera/sessions/route';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDuration(startMs: number, endMs: number): string {
  const secs = Math.round((endMs - startMs) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.round(secs / 60)}m`;
}

function MessageBubble({ msg }: { msg: HeraMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
          isUser
            ? 'bg-mc-accent/20 border border-mc-accent/30 text-mc-text'
            : msg.isDecision
            ? 'bg-mc-accent-green/10 border border-mc-accent-green/40 text-mc-text'
            : 'bg-mc-bg-secondary border border-mc-border text-mc-text'
        }`}
      >
        {msg.isDecision && (
          <div className="text-xs text-mc-accent-green font-semibold mb-1 flex items-center gap-1">
            <Crown className="w-3 h-3" />
            Decision
          </div>
        )}
        <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">{msg.content}</pre>
        <div className="text-[10px] text-mc-text-secondary mt-1.5 text-right">
          {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </div>
      </div>
    </div>
  );
}

function RunCard({ run }: { run: HeraRun }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-mc-bg-secondary border border-mc-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-mc-bg-tertiary transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-mc-text-secondary flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-mc-text-secondary flex-shrink-0" />
        )}

        <Crown className="w-4 h-4 text-mc-accent-yellow flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-mc-text">{formatTime(run.startTime)}</span>
            <span className="text-xs text-mc-text-secondary">
              {formatDuration(run.startTime, run.endTime)} · {run.messages.length} messages
            </span>
            {run.decisions.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-mc-accent-green/20 text-mc-accent-green font-medium">
                {run.decisions.length} decision{run.decisions.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Decision previews */}
          {run.decisions.length > 0 && !expanded && (
            <div className="mt-1 text-xs text-mc-text-secondary truncate">
              {run.decisions[0].replace('[Hera decision]', '').trim().slice(0, 120)}
            </div>
          )}
        </div>
      </button>

      {/* Expanded conversation */}
      {expanded && (
        <div className="border-t border-mc-border px-4 py-4 max-h-[70vh] overflow-y-auto">
          {run.messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HeraPage() {
  const [runs, setRuns] = useState<HeraRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/hera/sessions');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRuns(data.runs || []);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-mc-bg text-mc-text font-mono">
      {/* Header */}
      <div className="border-b border-mc-border bg-mc-bg-secondary">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-mc-text-secondary hover:text-mc-text transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="w-px h-4 bg-mc-border" />
          <Crown className="w-5 h-5 text-mc-accent-yellow" />
          <h1 className="text-lg font-semibold">Hera Logs</h1>
          <span className="text-xs text-mc-text-secondary">Decision-maker triage sessions</span>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-mc-border text-mc-text-secondary hover:text-mc-text hover:border-mc-text-secondary transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {loading && (
          <div className="text-center text-mc-text-secondary py-12">
            Loading Hera sessions...
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && runs.length === 0 && (
          <div className="text-center text-mc-text-secondary py-12">
            No Hera triage sessions found.
          </div>
        )}

        {!loading && runs.length > 0 && (
          <>
            <div className="text-xs text-mc-text-secondary mb-4">
              {runs.length} triage run{runs.length !== 1 ? 's' : ''} · most recent first
            </div>
            <div className="space-y-3">
              {runs.map((run) => (
                <RunCard key={run.id} run={run} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
