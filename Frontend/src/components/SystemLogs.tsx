import React, { useState, useEffect, useCallback } from 'react';
import {
  Terminal, RefreshCw, Download, Filter, ChevronLeft, ChevronRight,
  Shield, User, Server, AlertTriangle, CreditCard, Settings, Search,
  X, Activity, BarChart3, Clock, ShieldCheck, Plus, Trash2, Edit, Key, Wifi
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Theme } from '../types';
import { AuditLogsApi, type AuditLogEntry } from '../services/api';
import { formatDateOnlyVi, formatDateTime, formatTimestampRelativeAbsolute } from '../utils/dateUtils';

const PAGE_SIZE = 25;

const ACTION_CATEGORIES: { label: string; actions: string[] }[] = [
  {
    label: 'Xác thực',
    actions: ['LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_CHANGED', 'PASSWORD_RESET'],
  },
  {
    label: 'Người dùng',
    actions: ['USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_ROLE_CHANGED'],
  },
  {
    label: 'Server',
    actions: ['SERVER_ADDED', 'SERVER_UPDATED', 'SERVER_DELETED', 'API_KEY_CREATED', 'API_KEY_REVOKED', 'API_KEY_REGENERATED'],
  },
  {
    label: 'Cảnh báo',
    actions: ['ALERT_TRIGGERED', 'ALERT_ACKNOWLEDGED', 'ALERT_RESOLVED', 'ALERT_DELETED'],
  },
  {
    label: 'Block IP',
    actions: ['AUTO_BLOCKED', 'MANUAL_BLOCK', 'IP_UNBLOCKED'],
  },
  {
    label: 'Whitelist',
    actions: ['WHITELIST_ADDED', 'WHITELIST_REMOVED'],
  },
  {
    label: 'Thanh toán',
    actions: ['PAYMENT_INITIATED', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED'],
  },
  {
    label: 'Gói cước',
    actions: ['TRIAL_SUBSCRIPTION_CREATED', 'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_UPDATED'],
  },
  {
    label: 'Khác',
    actions: ['SETTINGS_UPDATED', 'DEFENSE_TRIGGERED'],
  },
];

function getActionCategory(action: string): string {
  for (const cat of ACTION_CATEGORIES) {
    if (cat.actions.some(a => action.toUpperCase().includes(a))) return cat.label;
  }
  return 'Khác';
}

function getActionColor(action: string): { bg: string; text: string; border: string; dot: string } {
  const a = action.toUpperCase();
  if (a.includes('FAILED') || a.includes('DELETED') || a.includes('ERROR'))
    return { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', dot: 'bg-rose-500' };
  if (a.includes('CREATED') || a.includes('ADDED') || a.includes('LOGIN') || a.includes('TRIGGERED'))
    return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-500' };
  if (a.includes('UPDATED') || a.includes('CHANGED'))
    return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-500' };
  if (a.includes('BLOCKED'))
    return { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', dot: 'bg-orange-500' };
  if (a.includes('ACKNOWLEDGED') || a.includes('RESOLVED'))
    return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-500' };
  return { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20', dot: 'bg-slate-500' };
}

function getActionIcon(action: string): React.ReactNode {
  const a = action.toUpperCase();
  if (a.includes('LOGIN')) return <Wifi size={11} />;
  if (a.includes('USER')) return <User size={11} />;
  if (a.includes('SERVER') || a.includes('API_KEY')) return <Server size={11} />;
  if (a.includes('ALERT') || a.includes('BLOCKED')) return <Shield size={11} />;
  if (a.includes('WHITELIST')) return <ShieldCheck size={11} />;
  if (a.includes('PAYMENT') || a.includes('SUBSCRIPTION')) return <CreditCard size={11} />;
  if (a.includes('TICKET')) return <Plus size={11} />;
  if (a.includes('DELETED')) return <Trash2 size={11} />;
  if (a.includes('UPDATED') || a.includes('CHANGED')) return <Edit size={11} />;
  return <Activity size={11} />;
}

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  User: <User size={12} />,
  Server: <Server size={12} />,
  Alert: <AlertTriangle size={12} />,
  BlockedIP: <Shield size={12} />,
  Payment: <CreditCard size={12} />,
  Subscription: <CreditCard size={12} />,
  Settings: <Settings size={12} />,
  Ticket: <Plus size={12} />,
  Whitelist: <ShieldCheck size={12} />,
};

interface SystemLogsProps {
  theme: Theme;
  t: any;
}

interface AuditStat {
  action: string;
  count: number;
}

export const SystemLogs = ({ theme, t }: SystemLogsProps) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<AuditStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [daysRange, setDaysRange] = useState(7);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await AuditLogsApi.getStats(daysRange);
      if (res?.success && res.data) {
        setStats(res.data as AuditStat[]);
      }
    } catch { /* silent */ } finally {
      setStatsLoading(false);
    }
  }, [daysRange]);

  const loadLogs = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    try {
      const filters: Parameters<typeof AuditLogsApi.getAll>[2] = {};
      if (selectedAction) filters.action = selectedAction;
      if (selectedEntity) filters.entityType = selectedEntity;
      if (dateFrom) filters.fromDate = dateFrom;
      if (dateTo) filters.toDate = dateTo;

      const data = await AuditLogsApi.getAll(pageNum, PAGE_SIZE, filters);
      if (!data) {
        setError('Không tải được nhật ký. Đăng nhập lại nếu cần.');
        return;
      }
      setLogs(data.items);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
    } catch {
      setError('Lỗi kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  }, [selectedAction, selectedEntity, dateFrom, dateTo]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadLogs(1);
  }, [loadLogs]);

  const displayLogs = searchQuery.trim()
    ? logs.filter(log =>
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.details ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.userName ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.ipAddress ?? '').includes(searchQuery)
      )
    : logs;

  const handleExport = () => {
    if (displayLogs.length === 0) return;
    const headers = ['ID', 'Hành động', 'Đối tượng', 'Chi tiết', 'Người dùng', 'IP', 'Thời gian'];
    const rows = displayLogs.map(l => [
      l.id,
      l.action,
      l.entityType ?? '',
      (l.details ?? '').replace(/"/g, '""'),
      l.userName ?? '',
      l.ipAddress ?? '',
      formatDateTime(l.timestamp),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Stats cards
  const topActions = stats.slice(0, 8);
  const totalActivity = stats.reduce((sum, s) => sum + s.count, 0);
  const maxCount = topActions.length > 0 ? topActions[0].count : 1;

  // Recent timeline (last 5 logs from current page)
  const recentLogs = logs.slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h2 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-slate-900')}>
            Nhật ký hệ thống
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">
            {totalCount > 0
              ? `${totalCount.toLocaleString('vi-VN')} hoạt động — {page}/{totalPages}`
              : 'Theo dõi mọi hoạt động trong hệ thống'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadLogs(page); loadStats(); }}
            className={cn(
              'p-2.5 rounded-lg border transition-all',
              theme === 'dark'
                ? 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white'
                : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )}
            title="Làm mới"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleExport}
            disabled={displayLogs.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold transition-all shadow"
          >
            <Download size={15} />
            Xuất CSV
          </button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className={cn(
        'rounded-2xl border p-5',
        theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm',
      )}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-400" />
            <h3 className={cn('text-sm font-semibold', theme === 'dark' ? 'text-white' : 'text-slate-800')}>
              Thống kê hoạt động
            </h3>
          </div>
          <div className="flex gap-1">
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setDaysRange(d)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all',
                  daysRange === d
                    ? 'bg-blue-600 text-white'
                    : theme === 'dark'
                      ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                )}
              >
                {d} ngày
              </button>
            ))}
          </div>
        </div>

        {statsLoading ? (
          <div className="flex items-center justify-center h-24 text-slate-500">
            <RefreshCw size={16} className="animate-spin mr-2" /> Đang tải thống kê…
          </div>
        ) : stats.length === 0 ? (
          <div className="text-center text-slate-500 text-sm py-4">
            Chưa có dữ liệu hoạt động trong {daysRange} ngày qua
          </div>
        ) : (
          <div className="space-y-2">
            {/* Top stat card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className={cn(
                'rounded-xl p-3 text-center',
                theme === 'dark' ? 'bg-blue-600/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'
              )}>
                <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-blue-400' : 'text-blue-600')}>
                  {totalActivity.toLocaleString('vi-VN')}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">Tổng hoạt động</p>
              </div>
              <div className={cn(
                'rounded-xl p-3 text-center',
                theme === 'dark' ? 'bg-emerald-600/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-100'
              )}>
                <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')}>
                  {stats.filter(s => s.action.includes('CREATED') || s.action.includes('ADDED') || s.action.includes('LOGIN')).reduce((sum, s) => sum + s.count, 0)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">Tạo mới / Đăng nhập</p>
              </div>
              <div className={cn(
                'rounded-xl p-3 text-center',
                theme === 'dark' ? 'bg-amber-600/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-100'
              )}>
                <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-amber-400' : 'text-amber-600')}>
                  {stats.filter(s => s.action.includes('UPDATED') || s.action.includes('CHANGED')).reduce((sum, s) => sum + s.count, 0)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">Cập nhật</p>
              </div>
              <div className={cn(
                'rounded-xl p-3 text-center',
                theme === 'dark' ? 'bg-rose-600/10 border border-rose-500/20' : 'bg-rose-50 border border-rose-100'
              )}>
                <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-rose-400' : 'text-rose-600')}>
                  {stats.filter(s => s.action.includes('FAILED') || s.action.includes('DELETED')).reduce((sum, s) => sum + s.count, 0)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">Lỗi / Xóa</p>
              </div>
            </div>

            {/* Bar chart */}
            <div className="space-y-1.5">
              {topActions.map((stat, idx) => {
                const color = getActionColor(stat.action);
                const pct = (stat.count / maxCount) * 100;
                return (
                  <button
                    key={stat.action}
                    onClick={() => {
                      setSelectedAction(stat.action);
                      setPage(1);
                      loadLogs(1);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all group hover:opacity-90',
                      theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-slate-50 hover:bg-slate-100'
                    )}
                  >
                    <span className={cn('text-[10px] font-mono font-medium min-w-[180px] text-left shrink-0', color.text)}>
                      {stat.action}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-slate-700/30 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', color.dot)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={cn('text-[10px] font-mono text-slate-500 min-w-[32px] text-right')}>
                      {stat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity Timeline */}
      {!loading && recentLogs.length > 0 && (
        <div className={cn(
          'rounded-2xl border p-5',
          theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm',
        )}>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-blue-400" />
            <h3 className={cn('text-sm font-semibold', theme === 'dark' ? 'text-white' : 'text-slate-800')}>
              Hoạt động gần đây
            </h3>
          </div>
          <div className="relative">
            <div className={cn('absolute left-[15px] top-0 bottom-0 w-px', theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200')} />
            <div className="space-y-3">
              {recentLogs.map((log, idx) => {
                const { bg, text, dot } = getActionColor(log.action);
                const ts = formatTimestampRelativeAbsolute(log.timestamp);
                return (
                  <button
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={cn(
                      'w-full flex items-start gap-3 pl-0.5 pr-2 py-1.5 rounded-lg transition-all hover:opacity-80 text-left'
                    )}
                  >
                    <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10', bg, 'border', border)}>
                      <span className={text}>{getActionIcon(log.action)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-xs font-semibold', text)}>{log.action}</span>
                        <span className="text-[10px] text-slate-500">{getActionCategory(log.action)}</span>
                        {log.entityType && (
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded font-medium',
                            theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                          )}>
                            {log.entityType}
                          </span>
                        )}
                      </div>
                      <p className={cn(
                        'text-[11px] truncate mt-0.5',
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                      )}>
                        {log.details ?? '—'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] text-slate-500">{ts.relative}</p>
                      {log.userName && (
                        <p className="text-[10px] text-blue-400 mt-0.5">{log.userName}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Search + Filter bar */}
      <div className={cn(
        'rounded-xl border p-4 transition-all',
        theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm',
      )}>
        <div className="flex gap-3 items-center mb-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Tìm theo hành động, chi tiết, người dùng, IP…"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              className={cn(
                'w-full pl-9 pr-4 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all',
                theme === 'dark'
                  ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600'
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400',
              )}
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all shrink-0',
              showFilters
                ? 'bg-blue-600 border-blue-600 text-white'
                : theme === 'dark'
                  ? 'border-slate-700 text-slate-400 hover:bg-slate-800'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-100',
            )}
          >
            <Filter size={14} />
            Bộ lọc
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-700/30">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Hành động</label>
              <select
                value={selectedAction}
                onChange={e => { setSelectedAction(e.target.value); setPage(1); }}
                className={cn(
                  'w-full px-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50',
                  theme === 'dark'
                    ? 'bg-slate-950 border-slate-800 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-900',
                )}
              >
                <option value="">Tất cả hành động</option>
                {ACTION_CATEGORIES.flatMap(cat =>
                  cat.actions.map(a => (
                    <option key={a} value={a}>{cat.label}: {a.replace(/_/g, ' ')}</option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Đối tượng</label>
              <select
                value={selectedEntity}
                onChange={e => { setSelectedEntity(e.target.value); setPage(1); }}
                className={cn(
                  'w-full px-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50',
                  theme === 'dark'
                    ? 'bg-slate-950 border-slate-800 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-900',
                )}
              >
                <option value="">Tất cả đối tượng</option>
                {['User', 'Server', 'Alert', 'Ticket', 'BlockedIP', 'Whitelist', 'Payment', 'Subscription'].map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Từ ngày</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                  className={cn(
                    'w-full px-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50',
                    theme === 'dark'
                      ? 'bg-slate-950 border-slate-800 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-900',
                  )}
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Đến ngày</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setPage(1); }}
                  className={cn(
                    'w-full px-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50',
                    theme === 'dark'
                      ? 'bg-slate-950 border-slate-800 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-900',
                  )}
                />
              </div>
            </div>
            {(selectedAction || selectedEntity || dateFrom || dateTo) && (
              <div className="sm:col-span-3 flex justify-end">
                <button
                  onClick={() => {
                    setSelectedAction('');
                    setSelectedEntity('');
                    setDateFrom('');
                    setDateTo('');
                    setPage(1);
                  }}
                  className="text-xs text-slate-500 hover:text-rose-500 transition-colors"
                >
                  ✕ Xóa bộ lọc
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-rose-500 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className={cn(
        'rounded-xl border overflow-hidden',
        theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm',
      )}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={cn(
                'text-[10px] uppercase tracking-wider',
                theme === 'dark' ? 'bg-slate-950/80 text-slate-500' : 'bg-slate-50 text-slate-400',
              )}>
                <th className="px-5 py-3.5 font-medium">Hành động</th>
                <th className="px-5 py-3.5 font-medium">Đối tượng</th>
                <th className="px-5 py-3.5 font-medium hidden md:table-cell">Chi tiết</th>
                <th className="px-5 py-3.5 font-medium">Người dùng</th>
                <th className="px-5 py-3.5 font-medium hidden lg:table-cell">IP</th>
                <th className="px-5 py-3.5 font-medium">Thời gian</th>
              </tr>
            </thead>
            <tbody className={cn('divide-y', theme === 'dark' ? 'divide-slate-800' : 'divide-slate-100')}>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-slate-500">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
                    Đang tải nhật ký…
                  </td>
                </tr>
              ) : displayLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <Terminal size={28} className="mx-auto mb-2 text-slate-600" />
                    <p className={cn('font-medium', theme === 'dark' ? 'text-slate-400' : 'text-slate-500')}>
                      {searchQuery || selectedAction || selectedEntity ? 'Không có kết quả phù hợp' : 'Chưa có nhật ký hoạt động'}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      {searchQuery || selectedAction || selectedEntity
                        ? 'Thử thay đổi bộ lọc'
                        : 'Các hoạt động sẽ xuất hiện khi có thao tác trên hệ thống'}
                    </p>
                  </td>
                </tr>
              ) : (
                displayLogs.map(log => {
                  const { bg, text, border } = getActionColor(log.action);
                  const ts = formatTimestampRelativeAbsolute(log.timestamp);
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={cn(
                        'transition-colors cursor-pointer',
                        theme === 'dark'
                          ? 'hover:bg-slate-800/30'
                          : 'hover:bg-slate-50',
                      )}
                    >
                      {/* Action badge */}
                      <td className="px-5 py-3.5 align-top">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            'text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap',
                            bg, text, border,
                          )}>
                            {log.action}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-600 mt-0.5">{getActionCategory(log.action)}</p>
                      </td>

                      {/* Entity type */}
                      <td className="px-5 py-3.5 align-top">
                        {log.entityType ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className={cn(
                              'p-1 rounded',
                              theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                            )}>
                              {ENTITY_ICONS[log.entityType] ?? <Terminal size={12} />}
                            </span>
                            <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>
                              {log.entityType}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                        {log.entityId && (
                          <p className="text-[10px] font-mono text-slate-600 mt-0.5 truncate max-w-[120px]" title={log.entityId}>
                            {log.entityId.slice(0, 8)}…
                          </p>
                        )}
                      </td>

                      {/* Details */}
                      <td className="px-5 py-3.5 align-top hidden md:table-cell">
                        <p className={cn(
                          'text-xs leading-relaxed max-w-xs',
                          theme === 'dark' ? 'text-slate-400' : 'text-slate-600',
                        )} title={log.details ?? undefined}>
                          {log.details
                            ? log.details.length > 100
                              ? log.details.slice(0, 100) + '…'
                              : log.details
                            : <span className="text-slate-600">—</span>}
                        </p>
                      </td>

                      {/* User */}
                      <td className="px-5 py-3.5 align-top">
                        {log.userName ? (
                          <span className="text-xs font-semibold text-blue-400">{log.userName}</span>
                        ) : (
                          <span className="text-xs text-slate-600">Hệ thống</span>
                        )}
                      </td>

                      {/* IP */}
                      <td className="px-5 py-3.5 align-top hidden lg:table-cell">
                        {log.ipAddress ? (
                          <span className="text-xs font-mono text-slate-400">{log.ipAddress}</span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>

                      {/* Time */}
                      <td className="px-5 py-3.5 align-top">
                        <div title={ts.absolute} className="text-xs text-slate-500 whitespace-nowrap">
                          {ts.relative}
                        </div>
                        <div className="text-[10px] text-slate-600 mt-0.5 hidden xl:block">
                          {formatDateOnlyVi(log.timestamp)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className={cn(
            'flex items-center justify-between px-5 py-3 border-t',
            theme === 'dark' ? 'border-slate-800' : 'border-slate-100',
          )}>
            <p className="text-xs text-slate-500">
              Hiển thị {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, totalCount)} / {totalCount.toLocaleString('vi-VN')} bản ghi
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setPage(p => Math.max(1, p - 1)); loadLogs(page - 1); }}
                disabled={page <= 1}
                className={cn(
                  'p-1.5 rounded-lg border transition-all disabled:opacity-30',
                  theme === 'dark' ? 'border-slate-700 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-600',
                )}
              >
                <ChevronLeft size={15} />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let p: number;
                if (totalPages <= 7) {
                  p = i + 1;
                } else if (page <= 4) {
                  p = i + 1;
                  if (i === 6) p = totalPages;
                } else if (page >= totalPages - 3) {
                  p = i === 0 ? 1 : totalPages - 6 + i;
                } else {
                  p = i === 0 ? 1 : i === 6 ? totalPages : page - 3 + i;
                }
                return (
                  <button
                    key={p}
                    onClick={() => { setPage(p); loadLogs(p); }}
                    className={cn(
                      'w-8 h-8 text-xs rounded-lg border transition-all',
                      page === p
                        ? 'bg-blue-600 border-blue-600 text-white font-bold'
                        : theme === 'dark'
                          ? 'border-slate-700 hover:bg-slate-800 text-slate-400'
                          : 'border-slate-200 hover:bg-slate-100 text-slate-600',
                    )}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => { setPage(p => Math.min(totalPages, p + 1)); loadLogs(page + 1); }}
                disabled={page >= totalPages}
                className={cn(
                  'p-1.5 rounded-lg border transition-all disabled:opacity-30',
                  theme === 'dark' ? 'border-slate-700 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-600',
                )}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={cn(
            'w-full max-w-lg rounded-2xl border shadow-2xl',
            theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
          )}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center',
                  getActionColor(selectedLog.action).bg
                )}>
                  <Terminal size={16} className={getActionColor(selectedLog.action).text} />
                </div>
                <div>
                  <h3 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-slate-900')}>
                    Chi tiết hoạt động
                  </h3>
                  <p className="text-[11px] text-slate-500">#{selectedLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                )}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-5 space-y-4">
              {/* Action badge */}
              <div className="flex items-center gap-3">
                <span className={cn(
                  'text-sm font-bold px-3 py-1.5 rounded-lg border',
                  getActionColor(selectedLog.action).bg,
                  getActionColor(selectedLog.action).text,
                  getActionColor(selectedLog.action).border,
                )}>
                  {selectedLog.action}
                </span>
                <span className={cn(
                  'text-xs px-2 py-1 rounded-lg',
                  theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                )}>
                  {getActionCategory(selectedLog.action)}
                </span>
              </div>

              {/* Detail fields */}
              <div className={cn(
                'rounded-xl p-4 space-y-3',
                theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'
              )}>
                {[
                  { label: 'Chi tiết', value: selectedLog.details ?? '—', mono: false },
                  { label: 'Đối tượng', value: selectedLog.entityType ?? '—', mono: false },
                  { label: 'Entity ID', value: selectedLog.entityId ?? '—', mono: true },
                  { label: 'Người thực hiện', value: selectedLog.userName ?? 'Hệ thống', mono: false },
                  { label: 'Địa chỉ IP', value: selectedLog.ipAddress ?? '—', mono: true },
                  { label: 'Thời gian', value: formatDateTime(selectedLog.timestamp), mono: false },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex gap-3">
                    <span className={cn('text-xs font-medium min-w-[110px] shrink-0 pt-0.5', theme === 'dark' ? 'text-slate-500' : 'text-slate-400')}>
                      {label}
                    </span>
                    <span className={cn(
                      'text-sm flex-1 break-all',
                      mono ? 'font-mono' : '',
                      theme === 'dark' ? 'text-slate-200' : 'text-slate-700',
                      label === 'Người thực hiện' && selectedLog.userName ? 'text-blue-400 font-semibold' : '',
                    )}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end px-5 py-4 border-t border-slate-700/50">
              <button
                onClick={() => setSelectedLog(null)}
                className={cn(
                  'px-5 py-2 rounded-lg font-medium text-sm transition-all',
                  theme === 'dark'
                    ? 'bg-slate-800 hover:bg-slate-700 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                )}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
