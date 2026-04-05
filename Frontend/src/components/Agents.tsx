import React from 'react';
import { Cpu, Plus, Server, Activity, Database, AlertTriangle, CheckCircle2, Trash2, KeyRound, Mail, Send } from 'lucide-react';
import { cn } from '../lib/utils';
import { Theme, Agent } from '../types';

interface AgentsProps {
  theme: Theme;
  t: any;
  agents: Agent[];
  setShowAddServerModal: (show: boolean) => void;
  canManageServers?: boolean;
  onDeleteServer?: (id: string) => Promise<void>;
  onViewServerKey?: (id: string, name: string) => void;
  onManageEmails?: (id: string, name: string) => void;
  onManageTelegram?: (id: string, name: string) => void;
}

export const Agents = ({
  theme,
  t,
  agents,
  setShowAddServerModal,
  canManageServers,
  onDeleteServer,
  onViewServerKey,
  onManageEmails,
  onManageTelegram,
}: AgentsProps) => {
  return (
    <div className="space-y-8">
      <div className={cn("border rounded-xl overflow-hidden transition-colors", theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
        <div className={cn("p-6 border-b flex justify-between items-center", theme === 'dark' ? "border-slate-800" : "border-slate-100")}>
          <h3 className={cn("font-bold flex items-center gap-2", theme === 'dark' ? "text-white" : "text-slate-900")}>
            <Cpu size={18} className="text-indigo-400" />
            {t.assetHealth}
          </h3>
          <button 
            onClick={() => setShowAddServerModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={14} /> {t.addServer}
          </button>
        </div>
        <div className="p-6 space-y-6">
          {agents.map((agent) => (
            <div key={agent.id} className="flex items-center gap-4">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center border",
                agent.status === 'online' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : (theme === 'dark' ? "bg-slate-800 border-slate-700 text-slate-500" : "bg-slate-100 border-slate-200 text-slate-400")
              )}>
                <Server size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h4 className={cn("text-sm font-bold truncate", theme === 'dark' ? "text-white" : "text-slate-900")}>{agent.name}</h4>
                  <span className="text-[10px] text-slate-500">{agent.lastSeen}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="font-mono">{agent.ip}</span>
                  <div className="flex items-center gap-1">
                    <Activity size={12} className="text-blue-400" />
                    <span>CPU: {agent.cpu}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Database size={12} className="text-purple-400" />
                    <span>RAM: {agent.ram}%</span>
                  </div>
                </div>
                <div className={cn("mt-2 w-full h-1 rounded-full overflow-hidden", theme === 'dark' ? "bg-slate-800" : "bg-slate-100")}>
                  <div 
                    className={cn("h-full transition-all duration-500", agent.cpu > 80 ? "bg-rose-500" : "bg-blue-500")} 
                    style={{ width: `${agent.cpu}%` }}
                  ></div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onManageEmails && canManageServers && (
                  <button
                    type="button"
                    title="Quản lý email nhận thông báo"
                    onClick={() => onManageEmails(agent.id, agent.name)}
                    className={cn(
                      'p-2 rounded-lg border transition-colors',
                      theme === 'dark'
                        ? 'border-slate-700 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/30'
                        : 'border-slate-200 text-purple-600 hover:bg-purple-50 hover:border-purple-200'
                    )}
                  >
                    <Mail size={16} />
                  </button>
                )}
                {onManageTelegram && canManageServers && (
                  <button
                    type="button"
                    title="Quản lý Telegram nhận thông báo"
                    onClick={() => onManageTelegram(agent.id, agent.name)}
                    className={cn(
                      'p-2 rounded-lg border transition-colors',
                      theme === 'dark'
                        ? 'border-slate-700 text-sky-400 hover:bg-sky-500/10 hover:border-sky-500/30'
                        : 'border-slate-200 text-sky-600 hover:bg-sky-50 hover:border-sky-200'
                    )}
                  >
                    <Send size={16} />
                  </button>
                )}
                {onViewServerKey && (
                  <button
                    type="button"
                    title="Xem API Key"
                    onClick={() => onViewServerKey(agent.id, agent.name)}
                    className={cn(
                      'p-2 rounded-lg border transition-colors',
                      theme === 'dark'
                        ? 'border-slate-700 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30'
                        : 'border-slate-200 text-blue-600 hover:bg-blue-50 hover:border-blue-200'
                    )}
                  >
                    <KeyRound size={16} />
                  </button>
                )}
                {canManageServers && onDeleteServer && (
                  <button
                    type="button"
                    title="Xóa máy chủ"
                    onClick={async () => {
                      if (!window.confirm(`Xóa máy chủ "${agent.name}"? Thao tác không thể hoàn tác.`)) return;
                      await onDeleteServer(agent.id);
                    }}
                    className={cn(
                      'p-2 rounded-lg border transition-colors',
                      theme === 'dark'
                        ? 'border-slate-700 text-slate-400 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-400'
                        : 'border-slate-200 text-slate-500 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600'
                    )}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                {agent.status === 'online' ? <CheckCircle2 size={18} className="text-emerald-500" /> : <AlertTriangle size={18} className="text-rose-500" />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
