import React from 'react';
import { CreditCard, Save, Plus, Trash2, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Theme } from '../types';

interface PricingManagementProps {
  theme: Theme;
  t: any;
  plans: any[];
  setPlans: (plans: any[]) => void;
}

export const PricingManagement = ({ theme, t, plans, setPlans }: PricingManagementProps) => {
  const [editingPlanId, setEditingPlanId] = React.useState<string | null>(null);
  const [editPrice, setEditPrice] = React.useState('');

  const handleSave = async (planId: string) => {
    const updatedPlans = plans.map(p => 
      p.id === planId ? { ...p, price: editPrice } : p
    );

    try {
      const response = await fetch('/api/pricing/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans: updatedPlans }),
      });

      if (response.ok) {
        setEditingPlanId(null);
        // Socket.io will update other clients, but we update locally too
        setPlans(updatedPlans);
      }
    } catch (error) {
      console.error('Failed to update pricing:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className={cn("text-2xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.pricingManagement}</h2>
          <p className="text-slate-400">Edit service package prices and features.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-all">
          <Plus size={18} /> Add Plan
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className={cn("border p-6 rounded-xl transition-all flex flex-col", theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
            <div className="flex justify-between items-start mb-6">
              <div className="bg-blue-600/10 p-3 rounded-lg text-blue-500">
                <CreditCard size={24} />
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setEditingPlanId(plan.id);
                    setEditPrice(plan.price);
                  }}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 transition-colors"
                >
                  <Edit2 size={14} />
                </button>
                <button className="p-1.5 rounded hover:bg-rose-500/10 text-rose-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            
            <div className="space-y-4 flex-1">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Plan Name</label>
                <p className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{plan.name}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Price (VND)</label>
                <div className="flex items-center gap-2">
                  {editingPlanId === plan.id ? (
                    <input 
                      type="text"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className={cn(
                        "w-full rounded border px-2 py-1 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                        theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                      )}
                    />
                  ) : (
                    <p className={cn("text-2xl font-black", theme === 'dark' ? "text-white" : "text-slate-900")}>{plan.price}</p>
                  )}
                  {plan.price !== '0' && plan.price !== 'Custom' && <span className="text-slate-500 text-xs">{t.vnd}{t.perMonth}</span>}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Features</label>
                <ul className="space-y-2">
                  {plan.features.map((f, i) => (
                    <li key={i} className="text-xs text-slate-400 flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-blue-500"></div>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <button 
              onClick={() => handleSave(plan.id)}
              disabled={editingPlanId !== plan.id}
              className={cn(
                "mt-6 w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all",
                editingPlanId === plan.id 
                  ? "bg-blue-600 hover:bg-blue-500 text-white" 
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              )}
            >
              <Save size={16} /> Save Changes
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
