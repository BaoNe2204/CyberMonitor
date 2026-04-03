import React from 'react';
import { Download, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import { Theme } from '../types';

interface ReportsProps {
  theme: Theme;
  t: any;
  handleExport: () => void;
}

export const Reports = ({ theme, t, handleExport }: ReportsProps) => {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className={cn("text-2xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>Security Reports</h2>
          <p className="text-slate-400">Generate and export compliance & security audit reports.</p>
        </div>
        <button 
          onClick={handleExport}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-blue-900/20"
        >
          <Download size={18} /> {t.exportAll}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: 'Monthly Security Audit', date: 'March 2026', type: 'Full Audit', status: 'Ready' },
          { title: 'Incident Response Log', date: 'Last 7 Days', type: 'Technical', status: 'Ready' },
          { title: 'Compliance Report (ISO 27001)', date: 'Q1 2026', type: 'Compliance', status: 'Generating...' },
        ].map((report, i) => (
          <div key={i} className={cn("border p-6 rounded-xl transition-all group", theme === 'dark' ? "bg-slate-900/50 border-slate-800 hover:border-blue-500/50" : "bg-white border-slate-200 hover:border-blue-500 shadow-sm")}>
            <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-colors", theme === 'dark' ? "bg-slate-800 group-hover:bg-blue-600/20 group-hover:text-blue-400" : "bg-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600")}>
              <FileText size={24} />
            </div>
            <h4 className={cn("font-bold mb-1", theme === 'dark' ? "text-white" : "text-slate-900")}>{report.title}</h4>
            <p className="text-xs text-slate-500 mb-4">{report.date} • {report.type}</p>
            <div className="flex justify-between items-center">
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", report.status === 'Ready' ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500 animate-pulse")}>
                {report.status}
              </span>
              {report.status === 'Ready' && (
                <button onClick={handleExport} className="text-blue-400 hover:text-blue-300">
                  <Download size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={cn("border rounded-xl p-8 transition-colors", theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
        <h3 className={cn("font-bold mb-6", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.customReport}</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Date Range</label>
            <select className={cn("w-full border rounded-lg px-4 py-2 text-sm transition-colors", theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900")}>
              <option>Last 24 Hours</option>
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>Custom Range</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Target Assets</label>
            <select className={cn("w-full border rounded-lg px-4 py-2 text-sm transition-colors", theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900")}>
              <option>All Servers</option>
              <option>Web Tier</option>
              <option>Database Tier</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Data Points</label>
            <div className="flex flex-wrap gap-2">
              <span className={cn("border text-[10px] px-2 py-1 rounded transition-colors", theme === 'dark' ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600")}>Traffic</span>
              <span className={cn("border text-[10px] px-2 py-1 rounded transition-colors", theme === 'dark' ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600")}>Attacks</span>
              <span className={cn("text-[10px] px-2 py-1 rounded cursor-pointer transition-colors", theme === 'dark' ? "bg-slate-800 text-slate-400 hover:bg-blue-500/20 hover:text-blue-400" : "bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600")}>+ Add</span>
            </div>
          </div>
          <div className="flex items-end">
            <button className={cn("w-full font-bold py-2 rounded-lg transition-colors", theme === 'dark' ? "bg-slate-800 hover:bg-slate-700 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-900")}>
              Generate Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
