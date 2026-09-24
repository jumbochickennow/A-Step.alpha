import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LineElement,
  LinearScale, PointElement, Tooltip,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { BookOpen, ClipboardList, LogOut } from 'lucide-react';
import { getAdminSession, signOutAdmin } from '../../services/admin.service';
import { fetchAdminMetrics, fetchChartData, fetchReviewDue, type AdminMetrics, type ChartData, type ReviewDuePage } from '../../services/admin-metrics.service';
import { Brand } from '../../components/layout/Brand';
import { GuideManager } from '../../components/admin/GuideManager';
import { OpportunityManager } from '../../components/admin/OpportunityManager';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Filler, Tooltip, Legend);

const NAVY = '#1A2B4A';
const BLUE = '#1565C0';
const ACCESS = '#1E88E5';
const CORAL = '#E53935';

type Section = 'guides' | 'opportunities' | 'resources' | 'review';
const REVIEW_LABELS = { contact: 'Contact message', lead: 'Guide download', newsletter: 'Newsletter subscriber' };

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
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>('guides');
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [reviewPage, setReviewPage] = useState<ReviewDuePage | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState(false);

  useEffect(() => {
    let active = true;
    fetchAdminMetrics().then((m) => { if (active) setMetrics(m); }).catch(() => { if (active) setMetrics(null); });
    fetchChartData().then((c) => { if (active) setCharts(c); }).catch(() => { if (active) setCharts(null); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (section !== 'review') return;
    let active = true;
    setReviewPage(null);
    setReviewLoading(true);
    setReviewError(false);
    fetchReviewDue()
      .then((page) => { if (active) setReviewPage(page); })
      .catch(() => { if (active) setReviewError(true); })
      .finally(() => { if (active) setReviewLoading(false); });
    return () => { active = false; };
  }, [section]);

  const loadMoreReview = async () => {
    if (!reviewPage?.hasMore || reviewLoading) return;
    setReviewLoading(true);
    setReviewError(false);
    try {
      const next = await fetchReviewDue(reviewPage.items.length);
      setReviewPage({ items: [...reviewPage.items, ...next.items], hasMore: next.hasMore });
    } catch {
      setReviewError(true);
    } finally {
      setReviewLoading(false);
    }
  };

  const logout = async () => {
    try { window.location.assign(await signOutAdmin()); } catch { navigate('/admin', { replace: true }); }
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
          <button type="button" onClick={() => setSection('resources')} className={`rounded-xl px-3 py-2.5 text-start text-sm font-semibold ${section === 'resources' ? 'bg-brand-blue/10 text-brand-blue' : 'text-ink-muted'}`}>Resources</button>
          <button type="button" onClick={() => setSection('review')} className={`rounded-xl px-3 py-2.5 text-start text-sm font-semibold ${section === 'review' ? 'bg-brand-blue/10 text-brand-blue' : 'text-ink-muted hover:bg-surface-2'}`}>Data Review{metrics?.reviewDue ? ` (${metrics.reviewDue})` : ''}</button>
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
            <button type="button" onClick={() => setSection('review')} className={`rounded-full px-4 py-1.5 text-xs font-bold ${section === 'review' ? 'bg-brand-blue text-white' : 'bg-surface-2 text-ink-muted'}`}>Data Review{metrics?.reviewDue ? ` (${metrics.reviewDue})` : ''}</button>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => void logout()} className="rounded-lg p-2 text-ink-muted hover:text-brand-coral md:hidden" aria-label="Logout"><LogOut size={18} /></button>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-blue text-sm font-bold text-white" aria-hidden="true">B</span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Welcome Belabbes</h1>

          <nav className="my-4 flex flex-wrap gap-3 md:hidden" aria-label="Content sections">{(['guides', 'opportunities', 'resources', 'review'] as const).map(item => <button key={item} onClick={() => setSection(item)} className={`rounded-lg px-3 py-2 capitalize ${section === item ? 'bg-brand-blue text-white' : 'bg-surface-2'}`}>{item}{item === 'review' && metrics?.reviewDue ? ` (${metrics.reviewDue})` : ''}</button>)}</nav>
          {section === 'review' ? (
            <section className="card mt-6 p-6" aria-labelledby="review-title">
              <h2 id="review-title" className="text-xl font-bold text-ink">Records due for review</h2>
              <p className="mt-2 text-sm text-ink-muted">Records at least 24 months old are flagged here. Nothing is deleted automatically.</p>
              <p className="mt-3 text-sm font-semibold text-ink">{metrics ? `${metrics.reviewDue} records due` : 'Review count unavailable'}</p>
              {reviewError ? <p role="alert" className="mt-4 text-sm text-brand-coral">Could not load all review records. Please try again.</p> : null}
              {reviewLoading && !reviewPage ? <p role="status" className="mt-4 text-sm text-ink-muted">Loading records…</p> : null}
              {reviewPage && reviewPage.items.length === 0 ? <p className="mt-4 text-sm text-ink-muted">No records are due for review.</p> : null}
              {reviewPage && reviewPage.items.length > 0 ? (
                <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
                  {reviewPage.items.map((item) => (
                    <li key={item.id} className="p-3 text-sm">
                      <details>
                        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0 break-all text-ink">{item.email}</span>
                          <span className="text-ink-muted">{REVIEW_LABELS[item.recordType]} · {new Date(item.submittedAt).toLocaleDateString()}</span>
                        </summary>
                        <div className="mt-3 whitespace-pre-wrap break-words text-ink-muted">
                          {item.recordType === 'contact' ? item.message : item.recordType === 'lead'
                            ? `Downloaded guide: ${item.guideSlug}`
                            : item.unsubscribedAt ? `Unsubscribed: ${new Date(item.unsubscribedAt).toLocaleDateString()}` : 'Subscription is active'}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              ) : null}
              {reviewPage?.hasMore ? <button type="button" disabled={reviewLoading} onClick={() => void loadMoreReview()} className="mt-4 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{reviewLoading ? 'Loading…' : 'Load more'}</button> : null}
            </section>
          ) : section === 'resources' ? <OpportunityManager key="resources" resourceMode /> : section === 'guides' ? (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard icon="💰" label="Number of Downloads" value={String(metrics?.downloads ?? 0)} />
                <MetricCard icon="📧" label="Emails Collected" value={String(metrics?.emails ?? 0)} />
                <MetricCard icon="🔄" label="Prospect Ratio" value={`${metrics?.prospectRatio ?? 0}%`} />
                <MetricCard icon="🕒" label="Due for Review" value={metrics ? String(metrics.reviewDue) : '—'} />
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
                <OpportunityManager key="opportunities" />
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
  return authorized ? <AdminDashboard /> : <Navigate to="/admin" replace />;
}
