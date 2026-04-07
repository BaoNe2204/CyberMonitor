import React, { useState } from 'react';
import { ArrowLeft, ShieldCheck, CreditCard, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Theme } from '../types';
import { PaymentApi } from '../services/api';

interface Plan {
  id: string;
  name: string;
  price: string;
  billingPeriod: string;
  description?: string;
}

interface CheckoutPageProps {
  theme: Theme;
  plan: Plan;
  onBack: () => void;
}

export const CheckoutPage = ({ theme, plan, onBack }: CheckoutPageProps) => {
  const [paymentMethod, setPaymentMethod] = useState<'vnpay'>('vnpay');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = typeof plan.price === 'string'
    ? parseInt(plan.price.replace(/\D/g, ''), 10) || 0
    : Number(plan.price) || 0;

  const handlePayment = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await PaymentApi.createPaymentUrl(plan.id, plan.name, price);
      if (res.success && res.data?.paymentUrl) {
        window.location.href = res.data.paymentUrl;
      } else {
        setError(res.message || 'Không thể tạo link thanh toán. Vui lòng thử lại.');
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
      {/* Back */}
      <button
        onClick={onBack}
        className={cn(
          'flex items-center gap-2 text-sm font-medium transition-colors',
          theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
        )}
      >
        <ArrowLeft size={16} /> Quay lại
      </button>

      <h1 className={cn('text-2xl font-black', theme === 'dark' ? 'text-white' : 'text-slate-900')}>
        Xác nhận đơn hàng
      </h1>

      {/* Order Summary */}
      <div className={cn(
        'rounded-2xl border p-6 space-y-4',
        theme === 'dark' ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200 shadow-sm'
      )}>
        <h2 className={cn('text-sm font-bold uppercase tracking-wider', theme === 'dark' ? 'text-slate-400' : 'text-slate-500')}>
          Chi tiết đơn hàng
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-slate-900')}>
              Gói {plan.name}
            </p>
            {plan.description && (
              <p className="text-sm text-slate-400 mt-0.5">{plan.description}</p>
            )}
          </div>
          <span className={cn(
            'px-3 py-1 rounded-full text-xs font-bold',
            theme === 'dark' ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
          )}>
            {plan.billingPeriod || 'Hàng tháng'}
          </span>
        </div>

        <div className={cn('border-t pt-4', theme === 'dark' ? 'border-slate-700' : 'border-slate-100')}>
          <div className="flex justify-between items-center">
            <span className={cn('text-sm', theme === 'dark' ? 'text-slate-400' : 'text-slate-500')}>Thời hạn</span>
            <span className={cn('font-medium', theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
              {plan.billingPeriod === 'yearly' ? '12 tháng' : '1 tháng'}
            </span>
          </div>
          <div className="flex justify-between items-center mt-3">
            <span className={cn('text-base font-bold', theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
              Tổng thanh toán
            </span>
            <span className="text-2xl font-black text-blue-500">
              {price.toLocaleString('vi-VN')} <span className="text-sm font-normal text-slate-400">VND</span>
            </span>
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className={cn(
        'rounded-2xl border p-6 space-y-4',
        theme === 'dark' ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200 shadow-sm'
      )}>
        <h2 className={cn('text-sm font-bold uppercase tracking-wider', theme === 'dark' ? 'text-slate-400' : 'text-slate-500')}>
          Phương thức thanh toán
        </h2>

        <label className={cn(
          'flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all',
          paymentMethod === 'vnpay'
            ? 'border-blue-500 bg-blue-500/10'
            : theme === 'dark' ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300'
        )}>
          <input
            type="radio"
            name="payment"
            value="vnpay"
            checked={paymentMethod === 'vnpay'}
            onChange={() => setPaymentMethod('vnpay')}
            className="accent-blue-500 w-4 h-4"
          />
          {/* VNPay Logo placeholder */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-800 rounded-md flex items-center justify-center">
              <span className="text-white text-[10px] font-black">VNPay</span>
            </div>
            <div>
              <p className={cn('font-semibold text-sm', theme === 'dark' ? 'text-white' : 'text-slate-900')}>VNPay</p>
              <p className="text-xs text-slate-400">Thanh toán qua cổng VNPay</p>
            </div>
          </div>
          {paymentMethod === 'vnpay' && (
            <CheckCircle2 size={18} className="ml-auto text-blue-500" />
          )}
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Security note */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <ShieldCheck size={14} className="text-green-400 shrink-0" />
        Giao dịch được mã hóa SSL 256-bit. Thông tin thanh toán của bạn được bảo mật tuyệt đối.
      </div>

      {/* CTA */}
      <button
        onClick={handlePayment}
        disabled={loading}
        className={cn(
          'w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all',
          'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30',
          loading && 'opacity-70 cursor-not-allowed'
        )}
      >
        {loading ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Đang xử lý...
          </>
        ) : (
          <>
            <CreditCard size={20} />
            Tiến hành thanh toán
          </>
        )}
      </button>
    </div>
  );
};

export default CheckoutPage;
