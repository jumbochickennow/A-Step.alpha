import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LineElement,
  LinearScale, PointElement, Tooltip,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { BookOpen, ClipboardList, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAdminSession, signOutAdmin } from '../../services/admin.service';
import { fetchAdminMetrics, fetchChartData, type AdminMetrics, type ChartData } from '../../services/admin-metrics.service';
import { Brand } from '../../components/layout/Brand';
import { GuideManager } from '../../components/admin/GuideManager';
import { OpportunityManager } from '../../components/admin/OpportunityManager';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Filler, Tooltip, Legend);

const NAVY = '#1A2B4A';
const BLUE = '#1565C0';
const ACCESS = '#1E88E5';
const CORAL = '#E53935';

type Section = 'guides' | 'opportunities';

function MetricCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-blue/10 text-lg" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
        <p className="text-2xl font-extrabold text-ink">{value}</p>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>('guides');
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);

  useEffect(() => {
    let active = true;
    fetchAdminMetrics().then((m) => { if (active) setMetrics(m); }).catch(() => { if (active) setMetrics({ downloads: 0, emails: 0, prospectRatio: 0 }); });
    fetchChartData().then((c) => { if (active) setCharts(c); }).catch(() => { if (active) setCharts(null); });
    return () => { active = false; };
  }, []);

  const logout = async () => {
    try { window.location.assign(await signOutAdmin()); } catch { navigate('/astep-control-vault', { replace: true }); }
  };

  const barOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  } as const;

  const pieData = {
    labels: charts?.visitShare.map((s) => s.label) ?? [],
    datasets: [{ data: charts?.visitShare.map((s) => s.value) ?? [], backgroundColor: [NAVY, BLUE, ACCESS, CORAL, '#7E9CC9', '#F2A5A2'], borderWidth: 0 }],
  };

  const waveData = {
    labels: charts?.history.map((h) => h.date.slice(5)) ?? [],
    datasets: [{
      data: charts?.history.map((h) => h.value) ?? [],
      borderColor: BLUE,
      backgroundColor: 'rgba(21, 101, 192, 0.14)',
      fill: true,
      tension: 0.45,
      pointRadius: 0,
      borderWidth: 2,
    }],
  };

  const waveOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  } as const;

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-e border-border bg-surface-1 p-5 md:flex">
        <Brand />
        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Admin">
          <button
            type="button"
            onClick={() => setSection('guides')}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${section === 'guides' ? 'bg-brand-blue/10 text-brand-blue' : 'text-ink-muted hover:bg-surface-2'}`}
          >
            <BookOpen size={17} aria-hidden="true" /> Student Guides
          </button>
          <button
            type="button"
            onClick={() => setSection('opportunities')}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${section === 'opportunities' ? 'bg-brand-blue/10 text-brand-blue' : 'text-ink-muted hover:bg-surface-2'}`}
          >
            <ClipboardList size={17} aria-hidden="true" /> Opportunity Card
          </button>
          <button type="button" onClick={() => void logout()} className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-muted transition hover:bg-surface-2 hover:text-brand-coral">
            <LogOut size={17} aria-hidden="true" /> Logout
          </button>
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-surface-1 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3 md:hidden">
            <Brand />
          </div>
          <div className="hidden gap-2 md:flex">
            <button type="button" onClick={() => setSection('guides')} className={`rounded-full px-4 py-1.5 text-xs font-bold ${section === 'guides' ? 'bg-brand-blue text-white' : 'bg-surface-2 text-ink-muted'}`}>Guides</button>
            <button type="button" onClick={() => setSection('opportunities')} className={`rounded-full px-4 py-1.5 text-xs font-bold ${section === 'opportunities' ? 'bg-brand-blue text-white' : 'bg-surface-2 text-ink-muted'}`}>Opportunities</button>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => void logout()} className="rounded-lg p-2 text-ink-muted hover:text-brand-coral md:hidden" aria-label="Logout"><LogOut size={18} /></button>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-blue text-sm font-bold text-white" aria-hidden="true">B</span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Welcome Belabbes</h1>

          {section === 'guides' ? (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <MetricCard icon="💰" label="Number of Downloads" value={String(metrics?.downloads ?? 0)} />
                <MetricCard icon="📧" label="Emails Collected" value={String(metrics?.emails ?? 0)} />
                <MetricCard icon="🔄" label="Prospect Ratio" value={`${metrics?.prospectRatio ?? 0}%`} />
              </div>
              <div className="mt-8">
                <GuideManager />
              </div>
            </>
          ) : (
            <>
              <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <div className="card p-5">
                  <h2 className="text-sm font-bold text-ink">Most Visited Cards</h2>
                  {charts && charts.mostVisited.length > 0
                    ? <div className="mt-4 h-56"><Bar options={barOptions} data={{ labels: charts.mostVisited.map((m) => m.label), datasets: [{ data: charts.mostVisited.map((m) => m.value), backgroundColor: ACCESS, borderRadius: 6, maxBarThickness: 34 }] }} /></div>
                    : <p className="mt-4 text-sm text-ink-muted">No visit data recorded yet.</p>}
                </div>
                <div className="card p-5">
                  <h2 className="text-sm font-bold text-ink">Visit Statistics</h2>
                  {charts && charts.visitShare.length > 0
                    ? <div className="mt-4 h-56"><Pie data={pieData} options={{ plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } } }} /></div>
                    : <p className="mt-4 text-sm text-ink-muted">No distribution data yet.</p>}
                </div>
              </div>
              <div className="card mt-4 p-5">
                <h2 className="text-sm font-bold text-ink">View History</h2>
                {charts
                  ? <div className="mt-4 h-56"><Line options={waveOptions} data={waveData} /></div>
                  : <p className="mt-4 text-sm text-ink-muted">No history data yet.</p>}
              </div>
              <div className="mt-8">
                <OpportunityManager />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export function AdminDashboardRoute() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    getAdminSession()
      .then((valid) => { if (active) setAuthorized(valid); })
      .catch(() => { if (active) setAuthorized(false); });
    return () => { active = false; };
  }, []);

  if (authorized === null) return null;
  return authorized ? <AdminDashboard /> : <Navigate to="/astep-control-vault" replace />;
}

export function AdminRedirect() {
  return <Navigate to="/astep-control-vault" replace />;
}
