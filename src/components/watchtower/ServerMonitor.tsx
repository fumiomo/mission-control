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
import { Activity } from 'lucide-react';

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
];

function sparklineData(metrics: Metric[], key: keyof Metric, color: string) {
  return {
    datasets: [
      {
        data: metrics.map((m) => ({ x: m.ts * 1000, y: m[key] as number })),
        borderColor: color,
        backgroundColor: color + '15',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 1.5,
      },
    ],
  };
}

const sparklineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { enabled: false } },
  scales: {
    x: { display: false, type: 'time' as const },
    y: { display: false, min: 0, max: 100 },
  },
  interaction: { intersect: false },
};

function StatCard({
  label,
  value,
  sub,
  color,
  metrics,
  metricKey,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  metrics: Metric[];
  metricKey: keyof Metric;
}) {
  return (
    <div className="bg-mc-bg border border-mc-border rounded-lg p-3 flex items-center gap-3 min-w-0">
      <div className="flex-shrink-0">
        <div className="text-xs text-mc-text-secondary">{label}</div>
        <div className="text-xl font-bold" style={{ color }}>{value}</div>
        {sub && <div className="text-[10px] text-mc-text-secondary">{sub}</div>}
      </div>
      <div className="flex-1 h-10 min-w-0">
        <Line data={sparklineData(metrics, metricKey, color)} options={sparklineOptions} />
      </div>
    </div>
  );
}

export function ServerMonitor() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [hours, setHours] = useState(24);
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
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-mc-accent-cyan" />
        <h2 className="text-lg font-semibold">Server</h2>
        <div className="flex gap-1 ml-auto">
          {RANGES.map((r) => (
            <button
              key={r.hours}
              onClick={() => setHours(r.hours)}
              className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
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

      {loading || !latest ? (
        <div className="text-center py-4 text-mc-text-secondary text-sm">Loading...</div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            label="CPU"
            value={`${latest.cpu_percent.toFixed(1)}%`}
            color="#4fc3f7"
            metrics={metrics}
            metricKey="cpu_percent"
          />
          <StatCard
            label="Memory"
            value={`${latest.mem_percent.toFixed(0)}%`}
            sub={`${latest.mem_used_gb}/${latest.mem_total_gb}GB`}
            color="#81c784"
            metrics={metrics}
            metricKey="mem_percent"
          />
          <StatCard
            label="Disk"
            value={`${latest.disk_percent.toFixed(0)}%`}
            sub={`${latest.disk_used_gb}/${latest.disk_total_gb}GB`}
            color="#ffb74d"
            metrics={metrics}
            metricKey="disk_percent"
          />
        </div>
      )}
    </div>
  );
}
