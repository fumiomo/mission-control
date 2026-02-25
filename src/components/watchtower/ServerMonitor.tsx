'use client';

import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Filler,
  Tooltip,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { Cpu, HardDrive, MemoryStick, Activity } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, TimeScale, Filler, Tooltip);

interface Metric {
  ts: number;
  cpu_percent: number;
  mem_total_gb: number;
  mem_used_gb: number;
  mem_percent: number;
  disk_total_gb: number;
  disk_used_gb: number;
  disk_percent: number;
}

const RANGES = [
  { label: '1H', hours: 1 },
  { label: '6H', hours: 6 },
  { label: '24H', hours: 24 },
  { label: '7D', hours: 168 },
  { label: '30D', hours: 720 },
];

function makeChartData(metrics: Metric[], key: keyof Metric, color: string) {
  return {
    datasets: [
      {
        data: metrics.map((m) => ({ x: m.ts * 1000, y: m[key] as number })),
        borderColor: color,
        backgroundColor: color + '20',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  };
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { mode: 'index' as const, intersect: false } },
  scales: {
    x: {
      type: 'time' as const,
      time: { tooltipFormat: 'MMM d, HH:mm' },
      grid: { color: '#1a1a2a' },
      ticks: { color: '#666', maxTicksLimit: 6 },
    },
    y: {
      min: 0,
      max: 100,
      grid: { color: '#1a1a2a' },
      ticks: { color: '#666', callback: (v: number | string) => v + '%' },
    },
  },
  interaction: { intersect: false, mode: 'index' as const },
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-mc-bg border border-mc-border rounded-lg p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg`} style={{ backgroundColor: color + '20' }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <div className="text-xs text-mc-text-secondary uppercase tracking-wider">{label}</div>
        <div className="text-xl font-bold" style={{ color }}>
          {value}
        </div>
        {sub && <div className="text-xs text-mc-text-secondary">{sub}</div>}
      </div>
    </div>
  );
}

export function ServerMonitor() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [hours, setHours] = useState(168);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/metrics?hours=${hours}`);
        if (res.ok) setMetrics(await res.json());
      } catch (e) {
        console.error('Failed to load metrics:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [hours]);

  const latest = metrics.length > 0 ? metrics[metrics.length - 1] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-mc-accent-cyan" />
          <h2 className="text-lg font-semibold">Server Monitor</h2>
          {latest && (
            <span className="text-xs text-mc-text-secondary ml-2">
              Last update: {new Date(latest.ts * 1000).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.hours}
              onClick={() => setHours(r.hours)}
              className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                hours === r.hours
                  ? 'bg-mc-accent text-mc-bg'
                  : 'bg-mc-bg border border-mc-border text-mc-text-secondary hover:text-mc-text'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      {latest && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={Cpu}
            label="CPU"
            value={`${latest.cpu_percent.toFixed(1)}%`}
            color="#4fc3f7"
          />
          <StatCard
            icon={MemoryStick}
            label="Memory"
            value={`${latest.mem_percent.toFixed(1)}%`}
            sub={`${latest.mem_used_gb} / ${latest.mem_total_gb} GB`}
            color="#81c784"
          />
          <StatCard
            icon={HardDrive}
            label="Disk"
            value={`${latest.disk_percent.toFixed(1)}%`}
            sub={`${latest.disk_used_gb} / ${latest.disk_total_gb} GB`}
            color="#ffb74d"
          />
        </div>
      )}

      {/* Charts */}
      {loading ? (
        <div className="text-center py-8 text-mc-text-secondary">Loading metrics...</div>
      ) : metrics.length === 0 ? (
        <div className="text-center py-8 text-mc-text-secondary">
          No metrics data yet. Collector runs every 10 minutes.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="bg-mc-bg border border-mc-border rounded-lg p-4">
            <div className="text-xs text-mc-text-secondary uppercase tracking-wider mb-2">
              CPU %
            </div>
            <div className="h-32">
              <Line data={makeChartData(metrics, 'cpu_percent', '#4fc3f7')} options={chartOptions} />
            </div>
          </div>
          <div className="bg-mc-bg border border-mc-border rounded-lg p-4">
            <div className="text-xs text-mc-text-secondary uppercase tracking-wider mb-2">
              Memory %
            </div>
            <div className="h-32">
              <Line data={makeChartData(metrics, 'mem_percent', '#81c784')} options={chartOptions} />
            </div>
          </div>
          <div className="bg-mc-bg border border-mc-border rounded-lg p-4">
            <div className="text-xs text-mc-text-secondary uppercase tracking-wider mb-2">
              Disk %
            </div>
            <div className="h-32">
              <Line
                data={makeChartData(metrics, 'disk_percent', '#ffb74d')}
                options={chartOptions}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
