import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, ArrowRight, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';
import { Theme } from '../types';
import { PaymentApi } from '../services/api';

interface PaymentResultPageProps {
  theme: Theme;
  onGoToDashboard: () => void;
  onRetry: () => void;
}

type ResultState = 'loading' | 'success' | 'failed';

export const PaymentResultPage = ({ theme, onGoToDashboard, onRetry }: PaymentResultPageProps) => {
  const [state, setState] = useState<ResultState>('loading');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const verify = async () => {
      // Lấy toàn bộ query string từ URL hiện tại
      const queryString = window.location.search;

      try {
        const res = await PaymentApi.vnpayReturn(queryString);
        if (res.success) {
          setState('success');
          setTransactionId(res.data?.transactionId || res.data?.orderId || null);
          setMessage(res.message || 'Thanh toán thành công!');
        } else {
          setState('failed');
          setMessage(res.message || 'Giao dịch bị hủy hoặc thất bại.');
        }
      } catch {
        setState('failed');
        setMessage('Không thể xác minh giao dịch. Vui lòng liên hệ hỗ trợ.');
      }
    };

    verify();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className={cn(
        'w-full max-w-md rounded-3xl border p-10 text-center space-y-6',
        theme === 'dark' ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-slate-200 shadow-xl'
      )}>
        {/* Loading */}
        {state === 'loading' && (
          <>
            <div className="flex justify-center">
              <Loader2 size={64} className="text-blue-500 animate-spin" />
            </div>
            <h2 className={cn('text-xl font-bold', theme === 'dark' ? 'text-white' : 'text-slate-900')}>
              Đang xác minh giao dịch...
            </h2>
            <p className="text-sm text-slate-400">Vui lòng không đóng trang này.</p>
          </>
        )}

        {/* Success */}
        {state === 'success' && (
          <>
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-full bg-green-500/15 flex items-center justify-center">
                <CheckCircle2 size={56} className="text-green-400" />
              </div>
            </div>
            <div>
              <h2 className={cn('text-2xl font-black', theme === 'dark' ? 'text-white' : 'text-slate-900')}>
                Thanh toán thành công
              </h2>
              <p className="text-slate-400 mt-2 text-sm">{message}</p>
            </div>
            {transactionId && (
              <div className={cn(
                'rounded-xl px-4 py-3 text-sm',
                theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600'
              )}>
                <span className="text-slate-400">Mã giao dịch: </span>
                <span className="font-mono font-bold">{transactionId}</span>
              </div>
            )}
            <button
              onClick={onGoToDashboard}
              className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold flex items-center justify-center gap-2 transition-all"
            >
              Vào trang quản lý <ArrowRight size={18} />
            </button>
          </>
        )}

        {/* Failed */}
        {state === 'failed' && (
          <>
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-full bg-red-500/15 flex items-center justify-center">
                <XCircle size={56} className="text-red-400" />
              </div>
            </div>
            <div>
              <h2 className={cn('text-2xl font-black', theme === 'dark' ? 'text-white' : 'text-slate-900')}>
                Giao dịch thất bại
              </h2>
              <p className="text-slate-400 mt-2 text-sm">{message}</p>
            </div>
            <button
              onClick={onRetry}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold flex items-center justify-center gap-2 transition-all"
            >
              <RotateCcw size={18} /> Thử lại
            </button>
            <button
              onClick={onGoToDashboard}
              className={cn(
                'w-full py-3 rounded-xl font-medium text-sm transition-all',
                theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
              )}
            >
              Về trang chủ
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentResultPage;
