import React from 'react';
import { 
  Globe, 
  Shield, 
  Server, 
  Zap, 
  Activity, 
  BarChart3, 
  AlertTriangle, 
  CheckCircle2 
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { Theme, Agent, Alert } from '../types';
import { StatCard } from './common/StatCard';

interface DashboardProps {
  theme: Theme;
  t: any;
  isAlertVisible: boolean;
  setIsAlertVisible: (val: boolean) => void;
  trafficData: any[];
  attackTypes: any[];
  recentAlerts: Alert[];
  agents: Agent[];
  setSelectedDetail: (detail: { type: string, data: any } | null) => void;
  setShowAddServerModal: (show: boolean) => void;
  setActiveTab: (tab: string) => void;
}

export const Dashboard = ({ 
  theme, 
  t, 
  isAlertVisible,
  setIsAlertVisible,
  trafficData, 
  attackTypes, 
  recentAlerts, 
  agents,
  setSelectedDetail,
  setShowAddServerModal,
  setActiveTab 
}: DashboardProps) => {
  return (
    <div className="space-y-8">
      {/* Real-time Alert Popup */}
      <AnimatePresence>
        {isAlertVisible && (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className={cn(
              "fixed bottom-8 right-8 z-50 p-6 rounded-2xl border shadow-2xl flex items-center gap-6 max-w-md transition-colors",
              theme === 'dark' ? "bg-slate-900 border-rose-500/50" : "bg-white border-rose-200"
            )}
          >
            <div className="bg-rose-500 p-3 rounded-xl animate-pulse">
              <AlertTriangle className="text-white" size={24} />
            </div>
            <div className="flex-1">
              <h4 className={cn("font-bold text-rose-500 uppercase tracking-widest text-xs mb-1")}>{t.criticalThreat}</h4>
              <p className={cn("text-sm font-medium", theme === 'dark' ? "text-white" : "text-slate-900")}>SQL Injection attempt detected on DB-Node-Primary</p>
              <div className="flex gap-3 mt-4">
                <button className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold px-4 py-2 rounded-lg transition-colors">
                  {t.activateSoar}
                </button>
                <button onClick={() => setIsAlertVisible(false)} className={cn("text-[10px] font-bold px-4 py-2 rounded-lg border transition-colors", theme === 'dark' ? "border-slate-800 text-slate-400 hover:bg-slate-800" : "border-slate-200 text-slate-500 hover:bg-slate-100")}>
                  {t.cancel}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label={t.totalRequests} value="1,284,092" icon={Globe} trend="+12.5%" color="bg-blue-600" theme={theme} />
        <StatCard label={t.threatsBlocked} value="4,291" icon={Shield} trend="+5.2%" color="bg-emerald-600" theme={theme} />
        <StatCard label={t.activeAgents} value={`${agents.filter(a => a.status === 'online').length} / ${agents.length}`} icon={Server} trend="-2" color="bg-indigo-600" theme={theme} />
        <StatCard label={t.avgResponse} value="12ms" icon={Zap} trend="-4ms" color="bg-amber-600" theme={theme} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={cn("lg:col-span-2 border p-6 rounded-xl transition-colors", theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
          <div className="flex justify-between items-center mb-6">
            <h3 className={cn("font-bold flex items-center gap-2", theme === 'dark' ? "text-white" : "text-slate-900")}>
              <Activity size={18} className="text-blue-400" />
              {t.networkTraffic}
            </h3>
            <select className={cn("border rounded px-2 py-1 text-xs transition-colors", theme === 'dark' ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-600")}>
              <option>Last 24 Hours</option>
              <option>Last 7 Days</option>
            </select>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData}>
                <defs>
                  <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAtk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? "#1e293b" : "#e2e8f0"} vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', 
                    border: theme === 'dark' ? '1px solid #1e293b' : '1px solid #e2e8f0', 
                    borderRadius: '8px',
                    color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
                  }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="requests" stroke="#3b82f6" fillOpacity={1} fill="url(#colorReq)" strokeWidth={2} />
                <Area type="monotone" dataKey="attacks" stroke="#ef4444" fillOpacity={1} fill="url(#colorAtk)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={cn("border p-6 rounded-xl transition-colors", theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
          <h3 className={cn("font-bold mb-6 flex items-center gap-2", theme === 'dark' ? "text-white" : "text-slate-900")}>
            <BarChart3 size={18} className="text-purple-400" />
            {t.attackDist}
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={attackTypes}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {attackTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', 
                    border: theme === 'dark' ? '1px solid #1e293b' : '1px solid #e2e8f0', 
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {attackTypes.map((type) => (
              <div key={type.name} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: type.color }}></div>
                  <span className="text-slate-400">{type.name}</span>
                </div>
                <span className={cn("font-medium", theme === 'dark' ? "text-white" : "text-slate-900")}>{type.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Alerts Table */}
        <div className={cn("border rounded-xl overflow-hidden transition-colors", theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
          <div className={cn("p-6 border-b flex justify-between items-center", theme === 'dark' ? "border-slate-800" : "border-slate-100")}>
            <h3 className={cn("font-bold flex items-center gap-2", theme === 'dark' ? "text-white" : "text-slate-900")}>
              <AlertTriangle size={18} className="text-amber-400" />
              {t.liveAlerts}
            </h3>
            <button onClick={() => setActiveTab('incidents')} className="text-xs text-blue-400 hover:underline">{t.viewAll}</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={cn("text-[10px] uppercase tracking-wider text-slate-500", theme === 'dark' ? "bg-slate-950/50" : "bg-slate-50")}>
                  <th className="px-6 py-3 font-medium">{t.severity}</th>
                  <th className="px-6 py-3 font-medium">{t.message}</th>
                  <th className="px-6 py-3 font-medium">{t.target}</th>
                  <th className="px-6 py-3 font-medium">MITRE</th>
                  <th className="px-6 py-3 font-medium">{t.time}</th>
                </tr>
              </thead>
              <tbody className={cn("divide-y", theme === 'dark' ? "divide-slate-800" : "divide-slate-100")}>
                {recentAlerts.map((alert) => (
                  <tr key={alert.id} className={cn("transition-colors", theme === 'dark' ? "hover:bg-slate-800/30" : "hover:bg-slate-50")}>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Asset Health List */}
        <div className={cn("border rounded-xl overflow-hidden transition-colors", theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
          <div className={cn("p-6 border-b flex justify-between items-center", theme === 'dark' ? "border-slate-800" : "border-slate-100")}>
            <h3 className={cn("font-bold flex items-center gap-2", theme === 'dark' ? "text-white" : "text-slate-900")}>
              <Server size={18} className="text-indigo-400" />
              {t.assetHealth}
            </h3>
            <button onClick={() => setActiveTab('agents')} className="text-xs text-blue-400 hover:underline">{t.viewAll}</button>
          </div>
          <div className="p-6 space-y-4">
            {agents.map((agent) => (
              <div key={agent.id} className={cn("flex items-center justify-between p-3 rounded-lg transition-colors", theme === 'dark' ? "bg-slate-800/50" : "bg-slate-50")}>
                <div className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full", agent.status === 'online' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-500")}></div>
                  <div>
                    <p className={cn("text-sm font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{agent.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{agent.ip}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">CPU</p>
                    <p className={cn("text-xs font-mono", agent.cpu > 80 ? "text-rose-500" : "text-slate-400")}>{agent.cpu}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">RAM</p>
                    <p className={cn("text-xs font-mono", agent.ram > 80 ? "text-rose-500" : "text-slate-400")}>{agent.ram}%</p>
                  </div>
                  {agent.status === 'online' ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertTriangle size={16} className="text-rose-500" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
