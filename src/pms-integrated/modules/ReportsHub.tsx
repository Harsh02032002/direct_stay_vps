import React, { useMemo, useState } from 'react';
import {
  Search,
  Star,
  CalendarCheck,
  LogIn,
  LogOut,
  UserX,
  BarChart3,
  BedDouble,
  Ban,
  Sparkles,
  Droplets,
  ShieldAlert,
  Users,
  IndianRupee,
  Receipt,
  Building2,
  Percent,
  Wallet,
  Banknote,
  AlertCircle,
  Moon,
  Landmark,
  FileSpreadsheet,
  TrendingUp,
  Clock,
  Hotel,
} from 'lucide-react';
import {
  REPORTS_CATALOG,
  REPORT_CATEGORIES,
  ReportCatalogEntry,
  ReportCategoryFilter,
  filterReportCatalog,
  groupReportsByCategory,
} from '../../utils/reportsCatalog';

interface ReportsHubProps {
  favouriteIds: string[];
  onToggleFavourite: (id: string) => void;
  onOpenReport: (entry: ReportCatalogEntry) => void;
}

function renderReportIcon(iconKey: string): React.ReactNode {
  const cls = 'w-4 h-4';
  switch (iconKey) {
    case 'arrivals':
      return <LogIn className={cls} />;
    case 'reservations':
      return <CalendarCheck className={cls} />;
    case 'noshow':
      return <UserX className={cls} />;
    case 'checkout':
      return <LogOut className={cls} />;
    case 'dueout':
      return <Clock className={cls} />;
    case 'forecast':
      return <TrendingUp className={cls} />;
    case 'inhouse':
      return <Hotel className={cls} />;
    case 'roomStatus':
      return <BedDouble className={cls} />;
    case 'blocked':
      return <Ban className={cls} />;
    case 'housekeeping':
      return <Sparkles className={cls} />;
    case 'water':
      return <Droplets className={cls} />;
    case 'police':
      return <ShieldAlert className={cls} />;
    case 'guests':
      return <Users className={cls} />;
    case 'sales':
      return <BarChart3 className={cls} />;
    case 'revenue':
      return <IndianRupee className={cls} />;
    case 'ota':
      return <Building2 className={cls} />;
    case 'gst':
      return <Percent className={cls} />;
    case 'cash':
      return <Banknote className={cls} />;
    case 'advance':
      return <Wallet className={cls} />;
    case 'dues':
      return <AlertCircle className={cls} />;
    case 'night':
      return <Moon className={cls} />;
    case 'finance':
      return <Landmark className={cls} />;
    case 'pl':
      return <FileSpreadsheet className={cls} />;
    case 'income':
      return <TrendingUp className={cls} />;
    case 'expense':
      return <Receipt className={cls} />;
    case 'bank':
      return <Landmark className={cls} />;
    default:
      return <FileSpreadsheet className={cls} />;
  }
}

const ICON_TONES = [
  'bg-amber-50 text-amber-700',
  'bg-sky-50 text-sky-700',
  'bg-emerald-50 text-emerald-700',
  'bg-violet-50 text-violet-700',
  'bg-rose-50 text-rose-700',
  'bg-orange-50 text-orange-700',
];

export const ReportsHub: React.FC<ReportsHubProps> = ({ favouriteIds, onToggleFavourite, onOpenReport }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ReportCategoryFilter>('All');

  const visible = useMemo(
    () => filterReportCatalog(REPORTS_CATALOG, { query, category, favouriteIds }),
    [query, category, favouriteIds]
  );
  const groups = useMemo(() => groupReportsByCategory(visible), [visible]);

  const pillBase =
    'px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer whitespace-nowrap shrink-0';
  const pillOn = 'bg-slate-900 text-amber-400 border-slate-900 shadow-xs';
  const pillOff = 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300';

  return (
    <div className="space-y-4" data-testid="reports-hub">
      {/* Search + category filters */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="min-w-0 sm:w-56 shrink-0">
            <h1 className="text-lg font-bold text-slate-900 leading-snug">Reports & Graphs</h1>
            <p className="text-[11px] text-slate-500">
              {REPORTS_CATALOG.length} reports • live data from your property
            </p>
          </div>
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reports (e.g. arrivals, GST, cash book, night audit...)"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
              aria-label="Search reports"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Report categories">
          <button
            type="button"
            onClick={() => setCategory('All')}
            className={`${pillBase} ${category === 'All' ? pillOn : pillOff}`}
          >
            All reports
          </button>
          {REPORT_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`${pillBase} ${category === c ? pillOn : pillOff}`}
            >
              {c}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCategory('Favourites')}
            className={`${pillBase} inline-flex items-center gap-1 ${category === 'Favourites' ? pillOn : pillOff}`}
          >
            <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
            Favourites ({favouriteIds.length})
          </button>
        </div>
      </div>

      {/* Report cards grouped by category */}
      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center text-sm text-slate-500">
          {category === 'Favourites' && !query
            ? 'No favourite reports yet. Tap the ☆ star on any report card to pin it here.'
            : 'No reports match your search.'}
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.category} className="space-y-2.5">
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              {/reports$/i.test(g.category) ? g.category : `${g.category} reports`}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {g.reports.map((r, idx) => {
                const isFav = favouriteIds.includes(r.id);
                return (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenReport(r)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenReport(r);
                      }
                    }}
                    className="group relative bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs hover:shadow-md hover:border-amber-400 transition cursor-pointer text-left min-h-[104px]"
                    data-testid={`report-card-${r.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          ICON_TONES[(idx + g.category.length) % ICON_TONES.length]
                        }`}
                      >
                        {renderReportIcon(r.iconKey)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavourite(r.id);
                        }}
                        className="p-1 rounded-md hover:bg-amber-50 cursor-pointer"
                        title={isFav ? 'Remove from favourites' : 'Add to favourites'}
                        aria-label={isFav ? `Remove ${r.title} from favourites` : `Add ${r.title} to favourites`}
                        aria-pressed={isFav}
                      >
                        <Star
                          className={`w-4 h-4 ${
                            isFav ? 'fill-amber-400 text-amber-500' : 'text-slate-300 group-hover:text-slate-400'
                          }`}
                        />
                      </button>
                    </div>
                    <h3 className="mt-2 text-[13px] font-bold text-slate-900 leading-snug">{r.title}</h3>
                    <p className="mt-0.5 text-[11px] text-slate-500 leading-snug line-clamp-3">{r.description}</p>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
};

export default ReportsHub;
