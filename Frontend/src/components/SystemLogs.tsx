import React, { useState, useEffect, useCallback } from 'react';
import {
  Terminal, RefreshCw, Download, Filter, ChevronLeft, ChevronRight,
  Shield, User, Server, AlertTriangle, CreditCard, Settings, Search
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Theme } from '../types';
import { AuditLogsApi, type AuditLogEntry } from '../services/api';

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
    actions: ['SERVER_ADDED', 'SERVER_UPDATED', 'SERVER_DELETED', 'API_KEY_CREATED', 'API_KEY_REVOKED'],
  },
  {
    label: 'Cảnh báo',
    actions: ['ALERT_CREATED', 'ALERT_ACKNOWLEDGED', 'ALERT_RESOLVED'],
  },
  {
    label: 'Block IP',
    actions: ['AUTO_BLOCKED', 'MANUAL_BLOCK', 'IP_UNBLOCKED', 'WHITELIST_ADDED', 'WHITELIST_REMOVED'],
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

function getActionColor(action: string): { bg: string; text: string; border: string } {
  const a = action.toUpperCase();
  if (a.includes('FAILED') || a.includes('DELETED') || a.includes('ERROR'))
    return { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/20' };
  if (a.includes('CREATED') || a.includes('ADDED') || a.includes('LOGIN'))
    return { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' };
  if (a.includes('UPDATED') || a.includes('CHANGED'))
    return { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' };
  if (a.includes('BLOCKED') || a.includes('TRIGGERED') || a.includes('DELETED'))
    return { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/20' };
  if (a.includes('ACKNOWLEDGED') || a.includes('RESOLVED'))
    return { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' };
  return { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' };
}

function formatTimestamp(ts: string): { relative: string; absolute: string } {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return { relative: 'Vừa xong', absolute: d.toLocaleString('vi-VN') };
  if (diff < 3600000) return { relative: `${Math.floor(diff / 60000)} phút trước`, absolute: d.toLocaleString('vi-VN') };
  if (diff < 86400000) return { relative: `${Math.floor(diff / 3600000)} giờ trước`, absolute: d.toLocaleString('vi-VN') };
  return { relative: `${Math.floor(diff / 86400000)} ngày trước`, absolute: d.toLocaleString('vi-VN') };
}

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  User: <User size={12} />,
  Server: <Server size={12} />,
  Alert: <AlertTriangle size={12} />,
  BlockedIP: <Shield size={12} />,
  Payment: <CreditCard size={12} />,
  Subscription: <CreditCard size={12} />,
  Settings: <Settings size={12} />,
};

interface SystemLogsProps {
  theme: Theme;
  t: any;
}

export const SystemLogs = ({ theme, t }: SystemLogsProps) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
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
    } catch (e) {
      setError('Lỗi kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  }, [selectedAction, selectedEntity, dateFrom, dateTo]);

  useEffect(() => {
    loadLogs(1);
  }, [loadLogs]);

  // Client-side search filter
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
      new Date(l.timestamp).toLocaleString('vi-VN'),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

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
              ? `${totalCount.toLocaleString('vi-VN')} bản ghi — trang ${page}/${totalPages}`
              : 'Theo dõi mọi hoạt động trong hệ thống'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadLogs(page)}
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
                {['User', 'Server', 'Alert', 'Ticket', 'BlockedIP', 'Whitelist', 'Payment', 'Subscription', 'AuditLog'].map(e => (
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
                  const ts = formatTimestamp(log.timestamp);
                  return (
                    <tr
                      key={log.id}
                      className={cn(
                        'transition-colors',
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
                          {new Date(log.timestamp).toLocaleDateString('vi-VN')}
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
    </div>
  );
};
