'use client';

import { useState, useEffect } from 'react';
import { ListTodo, Clock, ArrowRight, CheckCircle, Circle, Loader2, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  workspace_id: string;
  assigned_agent_name?: string;
  assigned_agent_emoji?: string;
  created_at: string;
  updated_at: string;
}

interface Workspace {
  id: string;
  name: string;
  emoji?: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Circle; color: string; bg: string }> = {
  inbox: { label: 'Inbox', icon: Circle, color: 'text-mc-text-secondary', bg: 'bg-mc-text-secondary/20' },
  planning: { label: 'Planning', icon: Circle, color: 'text-mc-accent-cyan', bg: 'bg-mc-accent-cyan/20' },
  assigned: { label: 'Assigned', icon: ArrowRight, color: 'text-mc-accent-purple', bg: 'bg-mc-accent-purple/20' },
  in_progress: { label: 'Working', icon: Loader2, color: 'text-mc-accent-green', bg: 'bg-mc-accent-green/20' },
  testing: { label: 'Testing', icon: Eye, color: 'text-yellow-500', bg: 'bg-yellow-500/20' },
  review: { label: 'Review', icon: Eye, color: 'text-mc-accent', bg: 'bg-mc-accent/20' },
  done: { label: 'Done', icon: CheckCircle, color: 'text-mc-accent-green', bg: 'bg-mc-accent-green/20' },
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-red-400',
  high: 'text-orange-400',
  normal: 'text-mc-text-secondary',
  low: 'text-mc-text-secondary/60',
};

type FilterType = 'active' | 'all' | 'done';

export function TaskQueue() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaces, setWorkspaces] = useState<Record<string, Workspace>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('active');

  useEffect(() => {
    const load = async () => {
      try {
        const [tasksRes, wsRes] = await Promise.all([
          fetch('/api/tasks'),
          fetch('/api/workspaces'),
        ]);
        if (tasksRes.ok) {
          const data = await tasksRes.json();
          setTasks(data.sort((a: Task, b: Task) => {
            // Sort: in_progress first, then review, then assigned, then by updated_at
            const order: Record<string, number> = { in_progress: 0, review: 1, assigned: 2, testing: 3, planning: 4, inbox: 5, done: 6 };
            const diff = (order[a.status] ?? 9) - (order[b.status] ?? 9);
            if (diff !== 0) return diff;
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          }));
        }
        if (wsRes.ok) {
          const wsData = await wsRes.json();
          const map: Record<string, Workspace> = {};
          for (const w of wsData) map[w.id] = w;
          setWorkspaces(map);
        }
      } catch (e) {
        console.error('Failed to load tasks:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const activeTasks = tasks.filter((t) => !['done', 'inbox'].includes(t.status));
  const filtered = filter === 'active'
    ? tasks.filter((t) => !['done'].includes(t.status))
    : filter === 'done'
    ? tasks.filter((t) => t.status === 'done')
    : tasks;

  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const inReview = tasks.filter((t) => t.status === 'review').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-mc-accent" />
          <h2 className="text-lg font-semibold">Mission Queue</h2>
          {inProgress > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-mc-accent-green/20 text-mc-accent-green font-medium">
              {inProgress} working
            </span>
          )}
          {inReview > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-mc-accent/20 text-mc-accent font-medium">
              {inReview} review
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {(['active', 'all', 'done'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-mc-accent text-mc-bg'
                  : 'bg-mc-bg border border-mc-border text-mc-text-secondary hover:text-mc-text'
              }`}
            >
              {f === 'active' ? `Active (${activeTasks.length})` : f === 'done' ? `Done (${tasks.filter(t => t.status === 'done').length})` : `All (${tasks.length})`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-6 text-mc-text-secondary">Loading tasks...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-6 text-mc-text-secondary">No tasks found.</div>
      ) : (
        <div className="bg-mc-bg border border-mc-border rounded-lg overflow-hidden">
          <div className="max-h-80 overflow-y-auto">
            {filtered.map((task) => {
              const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.inbox;
              const StatusIcon = statusCfg.icon;
              const ws = workspaces[task.workspace_id];

              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between px-4 py-3 border-b border-mc-border last:border-b-0 hover:bg-mc-bg-secondary transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusIcon
                      className={`w-4 h-4 flex-shrink-0 ${statusCfg.color} ${
                        task.status === 'in_progress' ? 'animate-spin' : ''
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        <span className={PRIORITY_COLORS[task.priority] || ''}>
                          {task.priority === 'urgent' ? '🔴 ' : task.priority === 'high' ? '🟠 ' : ''}
                        </span>
                        {task.title}
                      </div>
                      <div className="text-xs text-mc-text-secondary flex items-center gap-2">
                        {ws && (
                          <span>{ws.emoji || '📁'} {ws.name}</span>
                        )}
                        {task.assigned_agent_name && (
                          <>
                            <span>·</span>
                            <span>{task.assigned_agent_emoji || '🤖'} {task.assigned_agent_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                    <span className="text-xs text-mc-text-secondary w-16 text-right">
                      {formatDistanceToNow(new Date(task.updated_at), { addSuffix: false })}
                    </span>
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
