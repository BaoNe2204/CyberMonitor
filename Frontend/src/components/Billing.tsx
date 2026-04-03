import React from 'react';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { Theme } from '../types';

interface BillingProps {
  theme: Theme;
  t: any;
  plans: any[];
}

function planDisplayName(plan: { name: string }, t: any): string {
  const m: Record<string, string> = {
    Starter: t.planStarter,
    Pro: t.planPro,
    Enterprise: t.planEnterprise,
    Professional: t.planPro,
  };
  return m[plan.name] || plan.name;
}

export const Billing = ({ theme, t, plans }: BillingProps) => {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="text-center space-y-4 mb-12">
        <h2 className={cn("text-3xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.choosePlan}</h2>
        <p className="text-slate-400">Scalable SOC solutions for businesses of all sizes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <div key={plan.id || plan.name} className={cn(
            "relative p-8 rounded-2xl border transition-all duration-300",
            plan.popular 
              ? (theme === 'dark' ? "bg-slate-900 border-blue-500 shadow-2xl shadow-blue-900/20 scale-105 z-10" : "bg-white border-blue-500 shadow-2xl shadow-blue-100 scale-105 z-10")
              : (theme === 'dark' ? "bg-slate-900/50 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 hover:border-blue-200 shadow-sm")
          )}>
            {plan.popular && (
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-widest">
                {t.mostPopular}
              </span>
            )}
            <h4 className={cn("text-xl font-bold mb-2", theme === 'dark' ? "text-white" : "text-slate-900")}>{planDisplayName(plan, t)}</h4>
            <div className="flex items-baseline gap-1 mb-6">
              <span className={cn("text-4xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{plan.price}</span>
              {plan.price !== 'Free' && plan.price !== 'Custom' && <span className="text-slate-500 text-sm">{t.vnd}{t.perMonth}</span>}
            </div>
            <ul className="space-y-4 mb-8">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-slate-400">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  {f}
                </li>
              ))}
            </ul>
            <button className={cn(
              "w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2",
              plan.popular ? "bg-blue-600 hover:bg-blue-500 text-white" : (theme === 'dark' ? "bg-slate-800 hover:bg-slate-700 text-slate-200" : "bg-slate-100 hover:bg-slate-200 text-slate-900")
            )}>
              {plan.name === 'Enterprise' || plan.name === 'Doanh nghiệp' ? t.contactSales : t.upgradeNow}
              <ChevronRight size={18} />
            </button>
          </div>
        ))}
      </div>

      <div className={cn("mt-12 border p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6 transition-colors", theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
        <div className="flex items-center gap-4">
          <div className="bg-white p-2 rounded-lg border border-slate-200">
            <img src="https://picsum.photos/seed/vnpay/100/40" alt="VNPay" className="h-6" referrerPolicy="no-referrer" />
          </div>
          <div>
            <h4 className={cn("font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.securePayment}</h4>
            <p className="text-xs text-slate-500">{t.instantActivation}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className={cn("w-10 h-6 rounded border transition-colors", theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-200")}></div>
          <div className={cn("w-10 h-6 rounded border transition-colors", theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-200")}></div>
          <div className={cn("w-10 h-6 rounded border transition-colors", theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-200")}></div>
        </div>
      </div>
    </div>
  );
};
