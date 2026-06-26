import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Sparkles, Network, Star, UserCog, Wand2, Loader2, AlertCircle,
  ChevronLeft, ChevronRight, Boxes, Users, Layers, Activity,
} from 'lucide-react';
import {
  adminRecommendationInsightsService as svc,
  type SimilarityAlgorithm,
} from '../../api/services/adminRecommendationInsightsService';

type TabKey = 'overview' | 'similarity' | 'ratings' | 'profiles' | 'cb' | 'events';

const TABS: { key: TabKey; label: string; icon: typeof Sparkles }[] = [
  { key: 'overview', label: 'Tổng quan', icon: Sparkles },
  { key: 'events', label: 'Tương tác User', icon: Activity },
  { key: 'similarity', label: 'Độ tương đồng', icon: Network },
  { key: 'ratings', label: 'Rating implicit', icon: Star },
  { key: 'profiles', label: 'Hồ sơ sở thích', icon: UserCog },
  { key: 'cb', label: 'Gợi ý theo profile', icon: Wand2 },
];

// màu theo độ tương đồng (0 → 1): nhạt → xanh đậm
function simColor(v: number): string {
  const t = Math.max(0, Math.min(1, v));
  const light = 96 - Math.round(t * 56); // 96% → 40%
  return `hsl(146 64% ${light}%)`;
}

function fmtInt(n: number | undefined): string {
  return (n ?? 0).toLocaleString('vi-VN');
}

export default function AdminRecommendationInsightsPage() {
  const [tab, setTab] = useState<TabKey>('overview');

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
          <Sparkles className="h-6 w-6 text-emerald-600" />
          Phân tích hệ thống gợi ý
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Kết quả pipeline recommend: độ tương đồng sản phẩm, rating ngầm định (implicit),
          hồ sơ sở thích và gợi ý theo từng người dùng.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? 'border-b-2 border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'events' && <EventsTab />}
        {tab === 'similarity' && <SimilarityTab />}
        {tab === 'ratings' && <RatingsTab />}
        {tab === 'profiles' && <ProfilesTab />}
        {tab === 'cb' && <CbTab />}
      </div>
    </div>
  );
}

// ─── Shared UI ──────────────────────────────────────────────────────────────

function StateBlock({ loading, error, empty }: { loading: boolean; error: unknown; empty: boolean }) {
  if (loading)
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Đang tải dữ liệu...
      </div>
    );
  if (error)
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-rose-500">
        <AlertCircle className="h-5 w-5" /> Lỗi tải dữ liệu. Kiểm tra đã build pipeline & đăng nhập.
      </div>
    );
  if (empty)
    return (
      <div className="py-16 text-center text-slate-400">
        Chưa có dữ liệu. Hãy chạy pipeline build (main.py) trước.
      </div>
    );
  return null;
}

function Pager({
  page, totalPages, total, onPage,
}: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
      <span>{fmtInt(total)} dòng · trang {page + 1}/{Math.max(totalPages, 1)}</span>
      <div className="flex gap-1">
        <button
          disabled={page <= 0}
          onClick={() => onPage(page - 1)}
          className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40 dark:border-slate-700"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          disabled={page >= totalPages - 1}
          onClick={() => onPage(page + 1)}
          className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40 dark:border-slate-700"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

const thCls = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const tdCls = 'px-3 py-2 text-sm text-slate-700 dark:text-slate-200';
const tableWrap = 'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/50';

// ─── Overview ───────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['rec-insights', 'summary'],
    queryFn: svc.getSummary,
  });

  const block = <StateBlock loading={isLoading} error={error} empty={false} />;
  if (isLoading || error) return block;
  const s = data!;

  const cards = [
    { label: 'Cặp tương đồng (CF)', value: s.cfCosinePairs, icon: Network, tint: 'text-emerald-600' },
    { label: 'Cặp tương đồng (Content)', value: s.contentTfidfPairs, icon: Layers, tint: 'text-sky-600' },
    { label: 'Rating implicit', value: s.implicitRatings, icon: Star, tint: 'text-amber-600' },
    { label: 'User có rating', value: s.implicitUsers, icon: Users, tint: 'text-violet-600' },
    { label: 'Sản phẩm có rating', value: s.implicitProducts, icon: Boxes, tint: 'text-rose-600' },
    { label: 'Hồ sơ sở thích', value: s.userProfiles, icon: UserCog, tint: 'text-cyan-600' },
    { label: 'Gợi ý theo profile', value: s.cbRecommendations, icon: Wand2, tint: 'text-fuchsia-600' },
    { label: 'Sản phẩm đang bán', value: s.activeProducts, icon: Boxes, tint: 'text-slate-600' },
  ];

  const chartData = [
    { name: 'Sim CF', value: s.cfCosinePairs },
    { name: 'Sim Content', value: s.contentTfidfPairs },
    { name: 'Rating implicit', value: s.implicitRatings },
    { name: 'Hồ sơ user', value: s.userProfiles },
    { name: 'Gợi ý CB', value: s.cbRecommendations },
  ];
  const barColors = ['#059669', '#0284c7', '#d97706', '#06b6d4', '#c026d3'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">{c.label}</span>
              <c.icon className={`h-4 w-4 ${c.tint}`} />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
              {fmtInt(c.value)}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Quy mô dữ liệu các bảng
        </h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => fmtInt(v)} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={barColors[i % barColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Tương tác User (collector_log) ──────────────────────────────────────────

const EVENT_COLORS = [
  '#059669', '#0284c7', '#d97706', '#06b6d4', '#c026d3',
  '#e11d48', '#7c3aed', '#16a34a', '#f59e0b', '#0ea5e9',
];

// Các event ẩn khỏi biểu đồ tương tác.
const HIDDEN_EVENTS = new Set(['genreView', 'addToList']);

function EventsTab() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useQuery({
    queryKey: ['rec-insights', 'event-stats', days],
    queryFn: () => svc.getEventStats(days),
    placeholderData: keepPreviousData,
  });

  const rows = (data ?? []).filter((r) => !HIDDEN_EVENTS.has(r.event));
  const empty = !isLoading && !error && rows.length === 0;
  const chartData = rows.map((r) => ({ name: r.event, value: r.count }));
  const total = rows.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Biểu đồ tương tác người dùng (collector_log)
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Mỗi cột là một loại sự kiện (event) · tổng {fmtInt(total)} lượt · {rows.length} loại
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value={7}>7 ngày qua</option>
          <option value={30}>30 ngày qua</option>
          <option value={90}>90 ngày qua</option>
          <option value={0}>Tất cả</option>
        </select>
      </div>

      {isLoading || error || empty ? (
        <StateBlock loading={isLoading} error={error} empty={empty} />
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 40, left: 8 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => fmtInt(v)} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={EVENT_COLORS[i % EVENT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={tableWrap}>
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
              <thead>
                <tr>
                  <th className={thCls}>Sự kiện</th>
                  <th className={thCls}>Số lượt</th>
                  <th className={thCls}>Tỷ lệ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {rows.map((r, i) => (
                  <tr key={r.event}>
                    <td className={tdCls}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: EVENT_COLORS[i % EVENT_COLORS.length] }}
                        />
                        {r.event}
                      </span>
                    </td>
                    <td className={`${tdCls} tabular-nums`}>{fmtInt(r.count)}</td>
                    <td className={`${tdCls} tabular-nums`}>
                      {total > 0 ? ((r.count / total) * 100).toFixed(1) : '0'}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Similarity ─────────────────────────────────────────────────────────────

function SimilarityTab() {
  const [algorithm, setAlgorithm] = useState<SimilarityAlgorithm>('cf_cosine');
  const [sourceInput, setSourceInput] = useState('');
  const [source, setSource] = useState<number | null>(null);
  const [page, setPage] = useState(0);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['rec-insights', 'sim', algorithm, source, page],
    queryFn: () => svc.getSimilarities({ algorithm, source, page, size: 50 }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.content ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
          {(['cf_cosine', 'content_tfidf'] as SimilarityAlgorithm[]).map((a) => (
            <button
              key={a}
              onClick={() => { setAlgorithm(a); setPage(0); }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                algorithm === a
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {a === 'cf_cosine' ? 'Collaborative (CF)' : 'Content (TF-IDF)'}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); setSource(sourceInput ? Number(sourceInput) : null); setPage(0); }}
          className="flex items-center gap-2"
        >
          <input
            value={sourceInput}
            onChange={(e) => setSourceInput(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="Lọc theo product ID gốc"
            className="w-44 rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
          <button type="submit" className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white dark:bg-slate-700">
            Lọc
          </button>
          {source != null && (
            <button
              type="button"
              onClick={() => { setSource(null); setSourceInput(''); setPage(0); }}
              className="text-sm text-slate-500 underline"
            >
              Xóa lọc
            </button>
          )}
        </form>
        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      <StateBlock loading={isLoading} error={error} empty={rows.length === 0} />

      {rows.length > 0 && (
        <>
          <div className={tableWrap}>
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className={thCls}>SP gốc</th>
                  <th className={thCls}>SP tương đồng</th>
                  <th className={thCls}>Hạng</th>
                  <th className={thCls}>Độ tương đồng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className={tdCls}>
                      <span className="font-mono text-xs text-slate-400">#{r.sourceId}</span>{' '}
                      {r.sourceName ?? '—'}
                    </td>
                    <td className={tdCls}>
                      <span className="font-mono text-xs text-slate-400">#{r.targetId}</span>{' '}
                      {r.targetName ?? '—'}
                    </td>
                    <td className={tdCls}>{r.rankPos}</td>
                    <td className={tdCls}>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.round(r.similarity * 100)}%`, background: simColor(r.similarity) }}
                          />
                        </div>
                        <span className="tabular-nums">{r.similarity.toFixed(4)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={data!.meta.page} totalPages={data!.meta.totalPages} total={data!.meta.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}

// ─── Implicit ratings ───────────────────────────────────────────────────────

function RatingsTab() {
  const [userInput, setUserInput] = useState('');
  const [productInput, setProductInput] = useState('');
  const [filters, setFilters] = useState<{ userId: number | null; productId: number | null }>({
    userId: null, productId: null,
  });
  const [page, setPage] = useState(0);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['rec-insights', 'ratings', filters, page],
    queryFn: () => svc.getImplicitRatings({ ...filters, page, size: 50 }),
    placeholderData: keepPreviousData,
  });
  const rows = data?.content ?? [];
  const maxRating = Math.max(1, ...rows.map((r) => r.rating));

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setFilters({ userId: userInput ? Number(userInput) : null, productId: productInput ? Number(productInput) : null });
          setPage(0);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          value={userInput}
          onChange={(e) => setUserInput(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="User ID"
          className="w-32 rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <input
          value={productInput}
          onChange={(e) => setProductInput(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="Product ID"
          className="w-32 rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <button type="submit" className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white dark:bg-slate-700">
          Lọc
        </button>
        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        <span className="text-xs text-slate-400">
          Rating implicit (type=1) sinh từ hành vi: details / moreDetails / buy.
        </span>
      </form>

      <StateBlock loading={isLoading} error={error} empty={rows.length === 0} />

      {rows.length > 0 && (
        <>
          <div className={tableWrap}>
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className={thCls}>User</th>
                  <th className={thCls}>Sản phẩm</th>
                  <th className={thCls}>Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className={tdCls}>
                      <span className="font-mono text-xs text-slate-400">#{r.userId}</span> {r.userName ?? '—'}
                    </td>
                    <td className={tdCls}>
                      <span className="font-mono text-xs text-slate-400">#{r.productId}</span> {r.productName ?? '—'}
                    </td>
                    <td className={tdCls}>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                          <div
                            className="h-full rounded-full bg-amber-500"
                            style={{ width: `${Math.round((r.rating / maxRating) * 100)}%` }}
                          />
                        </div>
                        <span className="tabular-nums">{r.rating.toFixed(2)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={data!.meta.page} totalPages={data!.meta.totalPages} total={data!.meta.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}

// ─── User profiles ──────────────────────────────────────────────────────────

const TYPE_TINT: Record<string, string> = {
  category: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  sub_category: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  brand: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  tag: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  price: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

function ProfilesTab() {
  const [userInput, setUserInput] = useState('');
  const [userId, setUserId] = useState<number | null>(null);
  const [page, setPage] = useState(0);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['rec-insights', 'profiles', userId, page],
    queryFn: () => svc.getProfiles({ userId, page, size: 12 }),
    placeholderData: keepPreviousData,
  });
  const rows = data?.content ?? [];

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => { e.preventDefault(); setUserId(userInput ? Number(userInput) : null); setPage(0); }}
        className="flex items-center gap-2"
      >
        <input
          value={userInput}
          onChange={(e) => setUserInput(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="Lọc theo User ID"
          className="w-40 rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <button type="submit" className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white dark:bg-slate-700">
          Lọc
        </button>
        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </form>

      <StateBlock loading={isLoading} error={error} empty={rows.length === 0} />

      {rows.length > 0 && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((p) => (
              <div
                key={p.userId}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    <span className="font-mono text-xs text-slate-400">#{p.userId}</span> {p.userName ?? 'User'}
                  </span>
                  <span className="text-xs text-slate-400">{p.updatedAt?.slice(0, 19)?.replace('T', ' ')}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.signals.length === 0 && <span className="text-xs text-slate-400">(trống)</span>}
                  {p.signals
                    .slice()
                    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                    .slice(0, 18)
                    .map((sg, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                          TYPE_TINT[sg.type] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                        title={`${sg.type}`}
                      >
                        {sg.key}
                        {sg.score != null && (
                          <span className="font-mono opacity-70">{sg.score.toFixed(2)}</span>
                        )}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
          <Pager page={data!.meta.page} totalPages={data!.meta.totalPages} total={data!.meta.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}

// ─── CB recommendations ─────────────────────────────────────────────────────

function CbTab() {
  const [userInput, setUserInput] = useState('');
  const [userId, setUserId] = useState<number | null>(null);
  const [page, setPage] = useState(0);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['rec-insights', 'cb', userId, page],
    queryFn: () => svc.getCbRecommendations({ userId, page, size: 8 }),
    placeholderData: keepPreviousData,
  });
  const rows = data?.content ?? [];

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => { e.preventDefault(); setUserId(userInput ? Number(userInput) : null); setPage(0); }}
        className="flex items-center gap-2"
      >
        <input
          value={userInput}
          onChange={(e) => setUserInput(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="Lọc theo User ID"
          className="w-40 rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <button type="submit" className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white dark:bg-slate-700">
          Lọc
        </button>
        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </form>

      <StateBlock loading={isLoading} error={error} empty={rows.length === 0} />

      {rows.length > 0 && (
        <>
          <div className="space-y-3">
            {rows.map((c) => (
              <div
                key={c.userId}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    <span className="font-mono text-xs text-slate-400">#{c.userId}</span> {c.userName ?? 'User'}
                  </span>
                  <span className="text-xs text-slate-400">
                    top-{c.topK} · {c.computedAt?.slice(0, 19)?.replace('T', ' ')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.items.map((it) => (
                    <div
                      key={it.rank}
                      className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                        {it.rank}
                      </span>
                      <span className="max-w-[180px] truncate text-sm text-slate-700 dark:text-slate-200" title={it.productName ?? ''}>
                        {it.productName ?? `#${it.productId}`}
                      </span>
                      {it.similarity != null && (
                        <span className="font-mono text-xs text-slate-400">{it.similarity.toFixed(3)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Pager page={data!.meta.page} totalPages={data!.meta.totalPages} total={data!.meta.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
