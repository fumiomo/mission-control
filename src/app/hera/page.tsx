'use client';

import { useState, useEffect } from 'react';
import { Crown, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { HeraMessage, HeraRun } from '@/app/api/hera/sessions/route';
import type { PipelineRun } from '@/app/api/hera/pipeline/route';

const JST = 'Asia/Tokyo';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    timeZone: JST,
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

function extractTaskInfo(run: HeraRun): string | null {
  const firstUser = run.messages.find(m => m.role === 'user');
  if (!firstUser) return null;
  const match = firstUser.content.match(/\[(?:high|normal|low|urgent)\]\s+(.+?)\s+\(id:/);
  if (match) return match[1];
  const dashMatch = firstUser.content.match(/- \[(?:high|normal|low|urgent)\]\s+(.+?)\s+\(id:/);
  if (dashMatch) return dashMatch[1];
  const taskMatch = firstUser.content.match(/(?:Task|task)[:\s]+(.+?)(?:\n|$)/);
  if (taskMatch) return taskMatch[1].trim().slice(0, 80);
  return null;
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
          {new Date(msg.timestamp).toLocaleTimeString('en-US', { timeZone: JST, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </div>
      </div>
    </div>
  );
}

// A single task conversation (collapsible)
function TaskCard({ run }: { run: HeraRun }) {
  const [expanded, setExpanded] = useState(false);
  const taskInfo = extractTaskInfo(run);

  return (
    <div className="border border-mc-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-mc-bg-tertiary transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-mc-text-secondary flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-mc-text-secondary flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-mc-text">
              {taskInfo || 'Triage'}
            </span>
            <span className="text-xs text-mc-text-secondary">
              {run.messages.length} messages · {formatDuration(run.startTime, run.endTime)}
            </span>
            {run.decisions.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-mc-accent-green/20 text-mc-accent-green font-medium">
                {run.decisions.length} decision{run.decisions.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {/* Preview of last Hera message when collapsed */}
          {!expanded && run.messages.length > 0 && (
            <div className="mt-1 text-xs text-mc-text-secondary truncate">
              {run.messages.filter(m => m.role === 'assistant').pop()?.content.slice(0, 120) || ''}
            </div>
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-mc-border px-4 py-4 max-h-[70vh] overflow-y-auto bg-mc-bg">
          {run.messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}
        </div>
      )}
    </div>
  );
}

// Group of task conversations under a time heading
interface TriageBatch {
  time: string;
  startTime: number;
  runs: HeraRun[];
  totalMessages: number;
  totalDecisions: number;
}

function groupRunsIntoBatches(runs: HeraRun[]): TriageBatch[] {
  // Group runs that are within 5 minutes of each other (same cron batch)
  const BATCH_GAP_MS = 5 * 60 * 1000;
  const batches: TriageBatch[] = [];
  
  // Runs are already sorted most-recent-first, reverse for chronological grouping
  const sorted = [...runs].reverse();
  
  let currentBatch: HeraRun[] = [];
  let batchStart = 0;

  for (const run of sorted) {
    if (currentBatch.length === 0) {
      currentBatch = [run];
      batchStart = run.startTime;
    } else if (run.startTime - batchStart < BATCH_GAP_MS) {
      currentBatch.push(run);
    } else {
      batches.push(makeBatch(currentBatch));
      currentBatch = [run];
      batchStart = run.startTime;
    }
  }
  if (currentBatch.length > 0) {
    batches.push(makeBatch(currentBatch));
  }
  
  return batches.reverse(); // Most recent first
}

function makeBatch(runs: HeraRun[]): TriageBatch {
  const startTime = runs[0].startTime;
  return {
    time: formatTime(startTime),
    startTime,
    runs,
    totalMessages: runs.reduce((sum, r) => sum + r.messages.length, 0),
    totalDecisions: runs.reduce((sum, r) => sum + r.decisions.length, 0),
  };
}

function BatchSection({ batch }: { batch: TriageBatch }) {
  return (
    <div className="mb-6">
      {/* Time heading */}
      <div className="flex items-center gap-3 mb-3">
        <Crown className="w-4 h-4 text-mc-accent-yellow" />
        <h3 className="text-sm font-semibold text-mc-text">{batch.time}</h3>
        <span className="text-xs text-mc-text-secondary">
          {batch.runs.length} task{batch.runs.length !== 1 ? 's' : ''} · {batch.totalMessages} messages
        </span>
        {batch.totalDecisions > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-mc-accent-green/20 text-mc-accent-green font-medium">
            {batch.totalDecisions} decision{batch.totalDecisions !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {/* Task conversations */}
      <div className="space-y-2 ml-7">
        {batch.runs.map((run) => (
          <TaskCard key={run.id} run={run} />
        ))}
      </div>
    </div>
  );
}

export default function HeraPage() {
  const [runs, setRuns] = useState<HeraRun[]>([]);
  const [pipelineRuns, setPipelineRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  const load = async (showRefresh = false) => {
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
    }
  };

  useEffect(() => { load(); }, []);

  const batches = groupRunsIntoBatches(runs);

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
                setTimeout(() => { load(); setLaunching(false); }, 5000);
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

        {!loading && !error && batches.length === 0 && (
          <div className="text-center text-mc-text-secondary py-12">
            No Hera triage sessions found.
          </div>
        )}

        {/* Triage batches grouped by time */}
        {batches.map((batch, i) => (
          <BatchSection key={i} batch={batch} />
        ))}

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
