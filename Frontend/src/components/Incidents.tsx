import React from 'react';
import { cn } from '../lib/utils';
import { Theme, Alert } from '../types';

interface IncidentsProps {
  theme: Theme;
  t: any;
  recentAlerts: Alert[];
  setSelectedDetail: (detail: { type: string, data: any } | null) => void;
}

export const Incidents = ({ theme, t, recentAlerts, setSelectedDetail }: IncidentsProps) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className={cn("text-2xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.incidents}</h2>
          <p className="text-slate-400">Review and respond to security incidents.</p>
        </div>
        <div className="flex gap-2">
          <button className={cn("px-4 py-2 rounded-lg text-sm transition-colors", theme === 'dark' ? "bg-slate-800 hover:bg-slate-700 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-900")}>
            Filter
          </button>
          <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">
            Export Logs
          </button>
        </div>
      </div>
      <div className={cn("border rounded-xl overflow-hidden transition-colors", theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={cn("text-[10px] uppercase tracking-wider text-slate-500", theme === 'dark' ? "bg-slate-950/50" : "bg-slate-50")}>
                <th className="px-6 py-4 font-medium">ID</th>
                <th className="px-6 py-4 font-medium">{t.severity}</th>
                <th className="px-6 py-4 font-medium">{t.message}</th>
                <th className="px-6 py-4 font-medium">{t.target}</th>
                <th className="px-6 py-4 font-medium">MITRE</th>
                <th className="px-6 py-4 font-medium">{t.time}</th>
                <th className="px-6 py-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", theme === 'dark' ? "divide-slate-800" : "divide-slate-100")}>
              {recentAlerts.map((alert) => (
                <tr key={alert.id} className={cn("transition-colors", theme === 'dark' ? "hover:bg-slate-800/30" : "hover:bg-slate-50")}>
                  <td className="px-6 py-4 text-xs text-slate-500">#INC-{1000 + Number(alert.id)}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded",
                      alert.type === 'CRITICAL' ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" :
                      alert.type === 'WARNING' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                      "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                    )}>
                      {alert.type}
                    </span>
                  </td>
                  <td className={cn("px-6 py-4 text-sm", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>{alert.message}</td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-400">{alert.target}</td>
                  <td className="px-6 py-4">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-mono", theme === 'dark' ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500")}>{alert.mitre}</span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">{alert.time}</td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => setSelectedDetail({ type: 'incident', data: alert })}
                      className="text-blue-400 hover:underline text-xs"
                    >
                      {t.details}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
