'use client';

import { useState, useEffect } from 'react';
import { Crown, ChevronDown, ChevronRight, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import type { HeraMessage, HeraRun } from '@/app/api/hera/sessions/route';
import type { PipelineRun } from '@/app/api/hera/pipeline/route';

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
  const label = isUser ? '⚡ Pipeline' : '👑 Hera';
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
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold text-mc-text-secondary">{label}</span>
          {msg.isDecision && (
            <span className="text-xs text-mc-accent-green font-semibold flex items-center gap-1">
              <Crown className="w-3 h-3" />
              Decision
            </span>
          )}
        </div>
        <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">{msg.content}</pre>
        <div className="text-[10px] text-mc-text-secondary mt-1.5 text-right">
          {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </div>
      </div>
    </div>
  );
}

function extractTaskInfo(run: HeraRun): string | null {
  // Try to find task/project name from first user message
  const firstUser = run.messages.find(m => m.role === 'user');
  if (!firstUser) return null;
  // Look for task title patterns like "[high] Task Name (id: abc123)"
  const match = firstUser.content.match(/\[(?:high|normal|low|urgent)\]\s+(.+?)\s+\(id:/);
  if (match) return match[1];
  // Look for "Task:" or "task" mentions
  const taskMatch = firstUser.content.match(/(?:Task|task)[:\s]+(.+?)(?:\n|$)/);
  if (taskMatch) return taskMatch[1].trim().slice(0, 80);
  return null;
}

function RunCard({ run }: { run: HeraRun }) {
  const [expanded, setExpanded] = useState(false);
  const taskInfo = extractTaskInfo(run);

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

          {/* Task/project context */}
          {taskInfo && (
            <div className="mt-1 text-xs text-mc-accent font-medium truncate">
              📋 {taskInfo}
            </div>
          )}

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
  const [pipelineRuns, setPipelineRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [launching, setLaunching] = useState(false);

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [sessRes, pipeRes] = await Promise.all([
        fetch('/api/hera/sessions'),
        fetch('/api/hera/pipeline'),
      ]);
      if (!sessRes.ok) throw new Error(`HTTP ${sessRes.status}`);
      const sessData = await sessRes.json();
      const pipeData = await pipeRes.json();
      setRuns(sessData.runs || []);
      setPipelineRuns(pipeData.runs || []);
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
          <h1 className="text-lg font-semibold">Hera</h1>
          <span className="text-xs text-mc-text-secondary">Decision-maker triage sessions</span>
          <button
            onClick={async () => {
              setLaunching(true);
              try {
                await fetch('/api/hera/launch', { method: 'POST' });
                // Wait a bit then refresh data
                setTimeout(() => { load(true); setLaunching(false); }, 5000);
              } catch {
                setLaunching(false);
              }
            }}
            disabled={launching}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-mc-accent-yellow/20 border border-mc-accent-yellow/40 text-mc-accent-yellow font-medium hover:bg-mc-accent-yellow/30 transition-colors"
          >
            <Crown className={`w-3 h-3 ${launching ? 'animate-spin' : ''}`} />
            {launching ? 'Launching...' : 'Launch'}
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

        {/* Pipeline runs (cron log) */}
        {!loading && pipelineRuns.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-mc-text-secondary mb-3">Pipeline Runs</h2>
            <div className="bg-mc-bg-secondary border border-mc-border rounded-lg divide-y divide-mc-border">
              {pipelineRuns.map((run, i) => (
                <div key={i} className="px-4 py-2.5 flex items-center gap-3 text-xs">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${run.skipped ? 'bg-mc-text-secondary' : 'bg-mc-accent-green'}`} />
                  <span className="text-mc-text-secondary w-36 flex-shrink-0">{run.timestamp}</span>
                  <span className={run.skipped ? 'text-mc-text-secondary' : 'text-mc-text'}>{run.summary}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
