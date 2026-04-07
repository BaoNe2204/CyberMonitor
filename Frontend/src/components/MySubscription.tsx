import React, { useEffect, useState } from 'react';
import { Crown, RefreshCw, ArrowUpCircle, Calendar, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { Theme } from '../types';
import { SubscriptionsApi, PaymentApi } from '../services/api';

interface MySubscriptionProps {
  theme: Theme;
  onUpgrade: () => void;
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

const statusColor = (status: string, theme: Theme) => {
  switch (status?.toLowerCase()) {
    case 'active': return theme === 'dark' ? 'text-green-400 bg-green-400/10' : 'text-green-700 bg-green-100';
    case 'expired': return theme === 'dark' ? 'text-red-400 bg-red-400/10' : 'text-red-700 bg-red-100';
    case 'pending': return theme === 'dark' ? 'text-yellow-400 bg-yellow-400/10' : 'text-yellow-700 bg-yellow-100';
    default: return theme === 'dark' ? 'text-slate-400 bg-slate-400/10' : 'text-slate-600 bg-slate-100';
  }
};

const statusLabel = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'active': return 'Đang hoạt động';
    case 'expired': return 'Hết hạn';
    case 'pending': return 'Chờ xử lý';
    case 'cancelled': return 'Đã hủy';
    default: return status;
  }
};

const paymentStatusLabel = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'success': case 'paid': return 'Thành công';
    case 'pending': return 'Chờ xử lý';
    case 'failed': case 'cancelled': return 'Thất bại';
    default: return status;
  }
};

export const MySubscription = ({ theme, onUpgrade }: MySubscriptionProps) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [history, setHistory] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    SubscriptionsApi.get().then(res => {
      if (res.success && res.data) setSubscription(res.data as Subscription);
    }).finally(() => setLoading(false));

    PaymentApi.getHistory().then((res: any) => {
      if (res.success && res.data) setHistory(res.data as PaymentOrder[]);
    }).finally(() => setHistoryLoading(false));
  }, []);

  const card = cn(
    'rounded-2xl border p-6',
    theme === 'dark' ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200 shadow-sm'
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className={cn('text-xl font-black', theme === 'dark' ? 'text-white' : 'text-slate-900')}>
        Quản lý gói cước
      </h2>

      {/* Current Plan */}
      <div className={card}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center',
              theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'
            )}>
              <Crown size={28} className="text-blue-400" />
            </div>
            <div>
              {loading ? (
                <div className="space-y-2">
                  <div className={cn('h-5 w-32 rounded animate-pulse', theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200')} />
                  <div className={cn('h-4 w-24 rounded animate-pulse', theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200')} />
                </div>
              ) : subscription ? (
                <>
                  <p className={cn('text-lg font-black', theme === 'dark' ? 'text-white' : 'text-slate-900')}>
                    Gói {subscription.planName}
                  </p>
                  <span className={cn('inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mt-1', statusColor(subscription.status, theme))}>
                    <CheckCircle2 size={11} /> {statusLabel(subscription.status)}
                  </span>
                </>
              ) : (
                <p className="text-slate-400 text-sm">Chưa có gói đăng ký</p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onUpgrade}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all"
            >
              <ArrowUpCircle size={16} /> Nâng cấp
            </button>
            <button
              onClick={onUpgrade}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all',
                theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              )}
            >
              <RefreshCw size={16} /> Gia hạn
            </button>
          </div>
        </div>

        {/* Details */}
        {!loading && subscription && (
          <div className={cn('mt-6 pt-5 border-t grid grid-cols-2 sm:grid-cols-4 gap-4', theme === 'dark' ? 'border-slate-700' : 'border-slate-100')}>
            <div>
              <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Calendar size={11} /> Ngày bắt đầu</p>
              <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                {new Date(subscription.startDate).toLocaleDateString('vi-VN')}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Calendar size={11} /> Ngày hết hạn</p>
              <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                {new Date(subscription.endDate).toLocaleDateString('vi-VN')}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Clock size={11} /> Còn lại</p>
              <p className={cn(
                'text-sm font-bold',
                subscription.daysRemaining <= 7 ? 'text-red-400' : subscription.daysRemaining <= 30 ? 'text-yellow-400' : 'text-green-400'
              )}>
                {subscription.daysRemaining} ngày
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Servers</p>
              <p className={cn('text-sm font-semibold', theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                {subscription.usedServers}/{subscription.maxServers}
              </p>
            </div>
          </div>
        )}

        {/* Expiry warning */}
        {!loading && subscription && subscription.daysRemaining <= 7 && subscription.daysRemaining > 0 && (
          <div className="mt-4 flex items-center gap-2 text-xs text-yellow-400 bg-yellow-400/10 rounded-xl px-4 py-2">
            <AlertTriangle size={14} /> Gói của bạn sắp hết hạn. Hãy gia hạn để không bị gián đoạn dịch vụ.
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className={card}>
        <h3 className={cn('text-sm font-bold uppercase tracking-wider mb-4', theme === 'dark' ? 'text-slate-400' : 'text-slate-500')}>
          Lịch sử thanh toán
        </h3>

        {historyLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className={cn('h-12 rounded-xl animate-pulse', theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100')} />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Chưa có lịch sử thanh toán.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={cn('text-xs uppercase tracking-wider', theme === 'dark' ? 'text-slate-500' : 'text-slate-400')}>
                  <th className="text-left pb-3 pr-4">Mã GD</th>
                  <th className="text-left pb-3 pr-4">Gói</th>
                  <th className="text-left pb-3 pr-4">Ngày mua</th>
                  <th className="text-right pb-3 pr-4">Số tiền</th>
                  <th className="text-left pb-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {history.map(order => (
                  <tr key={order.id} className={cn('transition-colors', theme === 'dark' ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50')}>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-400">
                      {(order.orderId || order.id).slice(0, 12)}...
                    </td>
                    <td className={cn('py-3 pr-4 font-medium', theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                      {order.planName}
                    </td>
                    <td className="py-3 pr-4 text-slate-400">
                      {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className={cn('py-3 pr-4 text-right font-bold', theme === 'dark' ? 'text-white' : 'text-slate-900')}>
                      {order.amount.toLocaleString('vi-VN')}đ
                    </td>
                    <td className="py-3">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold',
                        statusColor(order.status, theme)
                      )}>
                        {paymentStatusLabel(order.status)}
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
  );
};

export default MySubscription;
