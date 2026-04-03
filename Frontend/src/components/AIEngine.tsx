import React from 'react';
import { Bot, Zap, Lock } from 'lucide-react';
import { cn } from '../lib/utils';
import { Theme } from '../types';

interface AIEngineProps {
  theme: Theme;
  t: any;
}

export const AIEngine = ({ theme, t }: AIEngineProps) => {
  return (
    <div className="space-y-8">
      <div className={cn("border p-8 rounded-2xl relative overflow-hidden transition-colors", theme === 'dark' ? "bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-blue-500/30" : "bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200 shadow-sm")}>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-600 p-3 rounded-xl">
              <Bot className="text-white" size={32} />
            </div>
            <div>
              <h2 className={cn("text-2xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>CyberGuard Heuristic Engine</h2>
              <p className={cn(theme === 'dark' ? "text-blue-200/70" : "text-blue-600/70")}>Advanced Pattern Matching & Manual Rule Analysis</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className={cn("p-4 rounded-xl border transition-colors", theme === 'dark' ? "bg-slate-950/50 border-blue-500/20" : "bg-white border-blue-100 shadow-sm")}>
              <p className="text-xs text-blue-400 font-bold uppercase mb-2">Current Engine</p>
              <p className={cn("text-lg font-mono", theme === 'dark' ? "text-white" : "text-slate-900")}>Heuristic-Core v4.0</p>
            </div>
            <div className={cn("p-4 rounded-xl border transition-colors", theme === 'dark' ? "bg-slate-950/50 border-blue-500/20" : "bg-white border-blue-100 shadow-sm")}>
              <p className="text-xs text-blue-400 font-bold uppercase mb-2">Rule Coverage</p>
              <p className={cn("text-lg font-mono", theme === 'dark' ? "text-white" : "text-slate-900")}>98.5% (Manual)</p>
            </div>
            <div className={cn("p-4 rounded-xl border transition-colors", theme === 'dark' ? "bg-slate-950/50 border-blue-500/20" : "bg-white border-blue-100 shadow-sm")}>
              <p className="text-xs text-blue-400 font-bold uppercase mb-2">Signature DB</p>
              <p className={cn("text-lg font-mono", theme === 'dark' ? "text-white" : "text-slate-900")}>2.5M Signatures</p>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={cn("border p-6 rounded-xl transition-colors", theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
          <h3 className={cn("font-bold mb-6 flex items-center gap-2", theme === 'dark' ? "text-white" : "text-slate-900")}>
            <Zap size={18} className="text-amber-400" />
            {t.predictiveAnalysis}
          </h3>
          <div className="space-y-6">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-amber-500 uppercase">Traffic Forecast</span>
                <span className="text-[10px] text-amber-400/70">Confidence: 94%</span>
              </div>
              <p className={cn("text-sm", theme === 'dark' ? "text-amber-200" : "text-amber-900")}>
                Based on current trends, <span className="font-bold">srv-001</span> is predicted to reach 95% CPU capacity in the next <span className="font-bold">12 minutes</span> due to rising inbound traffic.
              </p>
              <button className="mt-4 w-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold py-2 rounded transition-colors">
                PRE-EMPTIVE SCALING
              </button>
            </div>
            
            <div className={cn("p-4 border rounded-lg transition-colors", theme === 'dark' ? "bg-blue-500/10 border-blue-500/20" : "bg-blue-50 border-blue-100")}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-blue-500 uppercase">Anomaly Score</span>
                <span className="text-[10px] text-blue-400/70">Z-Score Analysis</span>
              </div>
              <div className="flex items-end gap-1 h-12">
                {[20, 35, 25, 40, 85, 30, 25, 20, 15, 10].map((h, i) => (
                  <div key={i} className={cn("flex-1 rounded-t", i === 4 ? "bg-rose-500" : "bg-blue-500/50")} style={{ height: `${h}%` }}></div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3 italic">
                * Spike at 14:22 detected as non-human behavior (Botnet pattern).
              </p>
            </div>
          </div>
        </div>

        <div className={cn("border p-6 rounded-xl transition-colors", theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
          <h3 className={cn("font-bold mb-6 flex items-center gap-2", theme === 'dark' ? "text-white" : "text-slate-900")}>
            <Lock size={18} className="text-emerald-400" />
            {t.mitreMapping}
          </h3>
          <div className="space-y-4">
            {[
              { technique: 'T1190', name: 'Exploit Public-Facing App', count: 12, risk: 'High' },
              { technique: 'T1110', name: 'Brute Force', count: 45, risk: 'Medium' },
              { technique: 'T1498', name: 'Network Denial of Service', count: 3, risk: 'Critical' },
              { technique: 'T1059', name: 'Command & Scripting Interpreter', count: 8, risk: 'High' },
            ].map((item) => (
              <div key={item.technique} className={cn("flex items-center justify-between p-3 rounded-lg border transition-colors", theme === 'dark' ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200")}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-blue-400">{item.technique}</span>
                  <span className={cn("text-sm", theme === 'dark' ? "text-slate-300" : "text-slate-700")}>{item.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-500">{item.count} hits</span>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded",
                    item.risk === 'Critical' ? "bg-rose-500/10 text-rose-500" :
                    item.risk === 'High' ? "bg-amber-500/10 text-amber-500" :
                    "bg-blue-500/10 text-blue-500"
                  )}>
                    {item.risk}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
