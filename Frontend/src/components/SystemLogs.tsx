import React from 'react';
import { Terminal, Search, Download, Filter, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { Theme } from '../types';

interface SystemLogsProps {
  theme: Theme;
  t: any;
}

export const SystemLogs = ({ theme, t }: SystemLogsProps) => {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/logs')
      .then(res => res.json())
      .then(data => {
        setLogs(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch logs:', err);
        setLoading(false);
      });
  }, []);

  const handleExport = () => {
    if (logs.length === 0) return;

    const headers = ['ID', 'Type', 'Message', 'User', 'Time', 'IP'];
    const csvContent = [
      headers.join(','),
      ...logs.map(log => [
        log.id,
        log.type,
        `"${log.message}"`,
        log.user,
        log.time,
        log.ip
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `system_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className={cn("text-2xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.systemLogs}</h2>
          <p className="text-slate-400">Monitor global system activity and audit logs.</p>
        </div>
        <button 
          onClick={handleExport}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-all"
        >
          <Download size={18} /> Export Logs
        </button>
      </div>

      <div className={cn("border rounded-xl overflow-hidden transition-colors", theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
        <div className="p-4 border-b border-slate-800 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Search logs..."
              className={cn(
                "w-full border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              )}
            />
          </div>
          <button className={cn("p-2 rounded-lg border transition-colors", theme === 'dark' ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-600")}>
            <Filter size={18} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={cn("text-[10px] uppercase tracking-wider text-slate-500", theme === 'dark' ? "bg-slate-950/50" : "bg-slate-50")}>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Message</th>
                <th className="px-6 py-4 font-medium">User</th>
                <th className="px-6 py-4 font-medium">IP Address</th>
                <th className="px-6 py-4 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", theme === 'dark' ? "divide-slate-800" : "divide-slate-100")}>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500">Loading logs...</td>
                </tr>
              ) : logs.map((log) => (
                <tr key={log.id} className={cn("transition-colors", theme === 'dark' ? "hover:bg-slate-800/30" : "hover:bg-slate-50")}>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded",
                      log.type === 'ERROR' ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" :
                      log.type === 'WARNING' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                      "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                    )}>
                      {log.type}
                    </span>
                  </td>
                  <td className={cn("px-6 py-4 text-sm", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>{log.message}</td>
                  <td className="px-6 py-4 text-xs font-bold text-blue-500">{log.user}</td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-400">{log.ip}</td>
                  <td className="px-6 py-4 text-xs text-slate-500 flex items-center gap-1">
                    <Clock size={10} />
                    {log.time}
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
