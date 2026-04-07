import React, { useEffect, useState } from 'react';
import {
  Crown, RefreshCw, ArrowUpCircle, Calendar, CheckCircle2,
  Clock, AlertTriangle, TrendingUp, Shield, Server, Zap,
  BookOpen, MessageCircle, FileText, ChevronRight, CreditCard,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Theme } from '../types';
import { SubscriptionsApi, PaymentApi } from '../services/api';

interface MySubscriptionProps {
  theme: Theme;
  onUpgrade: () => void;
  refreshKey?: number;
}

interface Subscription {
  id: string;
  planName: string;
  planPrice: number;
  status: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  maxServers: number;
  usedServers: number;
}

interface PaymentOrder {
  id: string;
  orderId?: string;
  planName: string;
  amount: number;
  status: string;
  createdAt: string;
}

const statusColor = (status: string, dark: boolean) => {
  switch (status?.toLowerCase()) {
    case 'active':   return dark ? 'text-green-400 bg-green-400/10'  : 'text-green-700 bg-green-100';
    case 'expired':  return dark ? 'text-red-400 bg-red-400/10'      : 'text-red-700 bg-red-100';
    case 'pending':  return dark ? 'text-yellow-400 bg-yellow-400/10': 'text-yellow-700 bg-yellow-100';
    default:         return dark ? 'text-slate-400 bg-slate-400/10'  : 'text-slate-600 bg-slate-100';
  }
};

const subStatusLabel = (s: string) => {
  switch (s?.toLowerCase()) {
    case 'active':    return 'Đang hoạt động';
    case 'expired':   return 'Hết hạn';
    case 'pending':   return 'Chờ xử lý';
    case 'cancelled': return 'Đã hủy';
    case 'trial':     return 'Dùng thử';
    default:          return s;
  }
};

const payLabel = (s: string) => {
  switch (s?.toLowerCase()) {
    case 'success': case 'paid': return 'Thành công';
    case 'pending':              return 'Chờ xử lý';
    case 'failed': case 'cancelled': return 'Thất bại';
    default: return s;
  }
};

export const MySubscription = ({ theme, onUpgrade, refreshKey = 0 }: MySubscriptionProps) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [history, setHistory]           = useState<PaymentOrder[]>([]);
  const [loading, setLoading]           = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    setLoading(true); setHistoryLoading(true);
    setSubscription(null); setHistory([]);
    SubscriptionsApi.get().then(r => { if (r.success && r.data) setSubscription(r.data as Subscription); }).finally(() => setLoading(false));
    PaymentApi.getHistory().then((r: any) => { if (r.success && r.data) setHistory(r.data as PaymentOrder[]); }).finally(() => setHistoryLoading(false));
  }, [refreshKey]);

  const dark = theme === 'dark';
  const card = cn('rounded-2xl border p-5', dark ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200 shadow-sm');

  const totalSpent   = history.filter(o => ['paid','success'].includes(o.status?.toLowerCase())).reduce((s, o) => s + o.amount, 0);
  const successCount = history.filter(o => ['paid','success'].includes(o.status?.toLowerCase())).length;

  return (
    <div className="space-y-5">
      <h2 className={cn('text-xl font-black', dark ? 'text-white' : 'text-slate-900')}>Quản lý gói cước</h2>

      {/* ── Main 2-column layout ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT — 2/3 width */}
        <div className="lg:col-span-2 space-y-5">

          {/* Current Plan card */}
          <div className={card}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center shrink-0', dark ? 'bg-blue-500/20' : 'bg-blue-100')}>
                  <Crown size={28} className="text-blue-400" />
                </div>
                <div>
                  {loading ? (
                    <div className="space-y-2">
                      <div className={cn('h-5 w-32 rounded animate-pulse', dark ? 'bg-slate-700' : 'bg-slate-200')} />
                      <div className={cn('h-4 w-24 rounded animate-pulse', dark ? 'bg-slate-700' : 'bg-slate-200')} />
                    </div>
                  ) : subscription ? (
                    <>
                      <p className={cn('text-lg font-black', dark ? 'text-white' : 'text-slate-900')}>Gói {subscription.planName}</p>
                      <span className={cn('inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mt-1', statusColor(subscription.status, dark))}>
                        <CheckCircle2 size={11} /> {subStatusLabel(subscription.status)}
                      </span>
                    </>
                  ) : (
                    <p className="text-slate-400 text-sm">Chưa có gói đăng ký</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={onUpgrade} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all">
                  <ArrowUpCircle size={15} /> Nâng cấp
                </button>
                <button onClick={onUpgrade} className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all', dark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700')}>
                  <RefreshCw size={15} /> Gia hạn
                </button>
              </div>
            </div>

            {!loading && subscription && (
              <div className={cn('mt-5 pt-4 border-t grid grid-cols-2 sm:grid-cols-4 gap-4', dark ? 'border-slate-700' : 'border-slate-100')}>
                {[
                  { label: 'Ngày bắt đầu', value: new Date(subscription.startDate).toLocaleDateString('vi-VN'), icon: Calendar },
                  { label: 'Ngày hết hạn', value: new Date(subscription.endDate).toLocaleDateString('vi-VN'),   icon: Calendar },
                  { label: 'Còn lại',      value: `${subscription.daysRemaining} ngày`,
                    valueClass: subscription.daysRemaining <= 7 ? 'text-red-400' : subscription.daysRemaining <= 30 ? 'text-yellow-400' : 'text-green-400',
                    icon: Clock },
                  { label: 'Servers',      value: `${subscription.usedServers}/${subscription.maxServers}`, icon: Server },
                ].map((item, i) => (
                  <div key={i}>
                    <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                      <item.icon size={11} /> {item.label}
                    </p>
                    <p className={cn('text-sm font-semibold', (item as any).valueClass || (dark ? 'text-slate-200' : 'text-slate-700'))}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {!loading && subscription && subscription.daysRemaining <= 7 && subscription.daysRemaining > 0 && (
              <div className="mt-4 flex items-center gap-2 text-xs text-yellow-400 bg-yellow-400/10 rounded-xl px-4 py-2">
                <AlertTriangle size={13} /> Gói sắp hết hạn — gia hạn ngay để không bị gián đoạn.
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: TrendingUp,   label: 'Tổng chi tiêu',         value: `${totalSpent.toLocaleString('vi-VN')}đ`, color: 'text-blue-400',   bg: dark ? 'bg-blue-500/10'   : 'bg-blue-50'   },
              { icon: CheckCircle2, label: 'GD thành công',          value: `${successCount} lần`,                   color: 'text-green-400',  bg: dark ? 'bg-green-500/10'  : 'bg-green-50'  },
              { icon: CreditCard,   label: 'Tổng giao dịch',         value: `${history.length} lần`,                 color: 'text-purple-400', bg: dark ? 'bg-purple-500/10' : 'bg-purple-50' },
            ].map((s, i) => (
              <div key={i} className={cn('rounded-2xl border p-4 flex items-center gap-3', dark ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200 shadow-sm')}>
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', s.bg)}>
                  <s.icon size={18} className={s.color} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-400 truncate">{s.label}</p>
                  <p className={cn('text-sm font-bold truncate', dark ? 'text-white' : 'text-slate-900')}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Payment History */}
          <div className={card}>
            <h3 className={cn('text-xs font-bold uppercase tracking-wider mb-4', dark ? 'text-slate-400' : 'text-slate-500')}>
              Lịch sử thanh toán
            </h3>
            {historyLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className={cn('h-11 rounded-xl animate-pulse', dark ? 'bg-slate-800' : 'bg-slate-100')} />)}</div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <div className={cn('w-11 h-11 rounded-full flex items-center justify-center mx-auto', dark ? 'bg-slate-800' : 'bg-slate-100')}>
                  <FileText size={20} className="text-slate-400" />
                </div>
                <p className="text-sm text-slate-400">Chưa có lịch sử thanh toán.</p>
                <button onClick={onUpgrade} className="text-xs text-blue-400 hover:text-blue-300 font-medium">Mua gói ngay →</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={cn('text-xs uppercase tracking-wider', dark ? 'text-slate-500' : 'text-slate-400')}>
                      <th className="text-left pb-3 pr-3">Mã GD</th>
                      <th className="text-left pb-3 pr-3">Gói</th>
                      <th className="text-left pb-3 pr-3">Ngày mua</th>
                      <th className="text-right pb-3 pr-3">Số tiền</th>
                      <th className="text-left pb-3">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className={cn('divide-y', dark ? 'divide-slate-700/40' : 'divide-slate-100')}>
                    {history.map(o => (
                      <tr key={o.id} className={cn('transition-colors', dark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50')}>
                        <td className="py-2.5 pr-3 font-mono text-xs text-slate-400">{(o.orderId || o.id).slice(0, 10)}…</td>
                        <td className={cn('py-2.5 pr-3 font-medium', dark ? 'text-slate-200' : 'text-slate-700')}>{o.planName}</td>
                        <td className="py-2.5 pr-3 text-slate-400 text-xs">{new Date(o.createdAt).toLocaleDateString('vi-VN')}</td>
                        <td className={cn('py-2.5 pr-3 text-right font-bold', dark ? 'text-white' : 'text-slate-900')}>{o.amount.toLocaleString('vi-VN')}đ</td>
                        <td className="py-2.5">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold', statusColor(o.status, dark))}>
                            {payLabel(o.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — 1/3 width */}
        <div className="space-y-5">

          {/* Quick Actions */}
          <div className={card}>
            <h3 className={cn('text-xs font-bold uppercase tracking-wider mb-4', dark ? 'text-slate-400' : 'text-slate-500')}>Thao tác nhanh</h3>
            <div className="space-y-1.5">
              {[
                { icon: ArrowUpCircle, label: 'Nâng cấp gói',  desc: 'Mở khóa thêm tính năng',       color: 'text-blue-400'   },
                { icon: RefreshCw,     label: 'Gia hạn gói',   desc: 'Tiếp tục sử dụng dịch vụ',     color: 'text-green-400'  },
                { icon: Shield,        label: 'So sánh gói',   desc: 'Xem chi tiết các gói dịch vụ', color: 'text-purple-400' },
                { icon: CreditCard,    label: 'Thanh toán',    desc: 'Chọn phương thức thanh toán',   color: 'text-yellow-400' },
              ].map((item, i) => (
                <button key={i} onClick={onUpgrade}
                  className={cn('w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group', dark ? 'hover:bg-slate-800' : 'hover:bg-slate-50')}>
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', dark ? 'bg-slate-800 group-hover:bg-slate-700' : 'bg-slate-100 group-hover:bg-slate-200')}>
                    <item.icon size={15} className={item.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-semibold', dark ? 'text-slate-200' : 'text-slate-800')}>{item.label}</p>
                    <p className="text-xs text-slate-400 truncate">{item.desc}</p>
                  </div>
                  <ChevronRight size={13} className="text-slate-500 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className={card}>
            <h3 className={cn('text-xs font-bold uppercase tracking-wider mb-4', dark ? 'text-slate-400' : 'text-slate-500')}>Mẹo & Hỗ trợ</h3>
            <div className="space-y-4">
              {[
                { icon: Zap,           color: 'text-yellow-400', bg: dark ? 'bg-yellow-400/10' : 'bg-yellow-50',
                  title: 'Tiết kiệm 20%', desc: 'Chọn gói hàng năm để tiết kiệm 20% so với hàng tháng.' },
                { icon: BookOpen,      color: 'text-blue-400',   bg: dark ? 'bg-blue-400/10'   : 'bg-blue-50',
                  title: 'Tài liệu API',  desc: 'Tích hợp CyberGuard vào hệ thống qua REST API.' },
                { icon: MessageCircle, color: 'text-green-400',  bg: dark ? 'bg-green-400/10'  : 'bg-green-50',
                  title: 'Hỗ trợ 24/7',  desc: 'Liên hệ qua email hoặc Telegram bất kỳ lúc nào.' },
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', tip.bg)}>
                    <tip.icon size={14} className={tip.color} />
                  </div>
                  <div>
                    <p className={cn('text-sm font-semibold', dark ? 'text-slate-200' : 'text-slate-800')}>{tip.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Plan features summary */}
          {!loading && subscription && (
            <div className={cn('rounded-2xl border p-5', dark ? 'bg-gradient-to-br from-blue-600/10 to-purple-600/10 border-blue-500/20' : 'bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200')}>
              <p className={cn('text-xs font-bold uppercase tracking-wider mb-3', dark ? 'text-blue-300' : 'text-blue-600')}>Gói hiện tại</p>
              <p className={cn('text-2xl font-black mb-1', dark ? 'text-white' : 'text-slate-900')}>{subscription.planName}</p>
              <p className="text-xs text-slate-400 mb-4">{subscription.daysRemaining} ngày còn lại</p>
              <div className="space-y-2">
                {[
                  `Tối đa ${subscription.maxServers} server`,
                  'Giám sát real-time 24/7',
                  'Cảnh báo qua Email & Telegram',
                  'Phân tích AI Engine',
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                    <CheckCircle2 size={12} className="text-green-400 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <button onClick={onUpgrade} className="mt-4 w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all">
                Nâng cấp để có thêm →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MySubscription;
