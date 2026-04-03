import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircle, QrCode, CheckCircle2, Plus, Copy, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Theme, ApiKey } from '../types';

interface ModalsProps {
  theme: Theme;
  t: any;
  showAddServerModal: boolean;
  setShowAddServerModal: (show: boolean) => void;
  show2FAModal: boolean;
  setShow2FAModal: (show: boolean) => void;
  is2FAEnabled: boolean;
  setIs2FAEnabled: (enabled: boolean) => void;
  showAPIKeyModal: boolean;
  setShowAPIKeyModal: (show: boolean) => void;
  apiKeys: ApiKey[];
  generateApiKey: () => void;
  deleteApiKey: (id: number) => void;
  selectedDetail: { type: string, data: any } | null;
  setSelectedDetail: (detail: { type: string, data: any } | null) => void;
}

export const Modals = ({
  theme,
  t,
  showAddServerModal,
  setShowAddServerModal,
  show2FAModal,
  setShow2FAModal,
  is2FAEnabled,
  setIs2FAEnabled,
  showAPIKeyModal,
  setShowAPIKeyModal,
  apiKeys,
  generateApiKey,
  deleteApiKey,
  selectedDetail,
  setSelectedDetail
}: ModalsProps) => {
  return (
    <AnimatePresence>
      {showAddServerModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={cn("w-full max-w-md p-6 rounded-2xl border shadow-2xl transition-colors", theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}
          >
            <h3 className={cn("text-xl font-bold mb-4", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.addServer}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t.serverName}</label>
                <input type="text" className={cn("w-full rounded-lg px-4 py-2 text-sm focus:outline-none border transition-colors", theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900")} placeholder="e.g. Web-Node-01" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t.ipAddress}</label>
                <input type="text" className={cn("w-full rounded-lg px-4 py-2 text-sm focus:outline-none border transition-colors", theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900")} placeholder="e.g. 192.168.1.100" />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowAddServerModal(false)} className={cn("flex-1 py-2 rounded-lg border transition-colors", theme === 'dark' ? "border-slate-700 text-slate-400 hover:bg-slate-800" : "border-slate-200 text-slate-500 hover:bg-slate-100")}>{t.cancel}</button>
              <button onClick={() => setShowAddServerModal(false)} className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20">{t.confirm}</button>
            </div>
          </motion.div>
        </div>
      )}

      {show2FAModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={cn("w-full max-w-md p-6 rounded-2xl border shadow-2xl transition-colors", theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className={cn("text-xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.twoFactorSetup}</h3>
              <button onClick={() => setShow2FAModal(false)} className="text-slate-500 hover:text-rose-500 transition-colors"><XCircle size={24} /></button>
            </div>
            
            {!is2FAEnabled ? (
              <div className="space-y-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className={cn("p-4 rounded-2xl", theme === 'dark' ? "bg-slate-950" : "bg-slate-50")}>
                    <QrCode size={160} className={theme === 'dark' ? "text-white" : "text-slate-900"} />
                  </div>
                  <p className={cn("text-sm", theme === 'dark' ? "text-slate-400" : "text-slate-600")}>
                    {t.scanQr}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase">{t.verifyCode}</label>
                  <input 
                    type="text" 
                    maxLength={6}
                    className={cn("w-full text-center text-2xl tracking-[1em] font-mono rounded-lg px-4 py-3 focus:outline-none border transition-colors", theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900")}
                    placeholder="000000"
                  />
                </div>
                
                <button 
                  onClick={() => { setIs2FAEnabled(true); setShow2FAModal(false); }}
                  className="w-full py-3 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20"
                >
                  {t.enable2FA}
                </button>
              </div>
            ) : (
              <div className="space-y-6 text-center">
                <div className="flex justify-center">
                  <div className="bg-emerald-500/20 p-4 rounded-full">
                    <CheckCircle2 size={48} className="text-emerald-500" />
                  </div>
                </div>
                <p className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>2FA is active</p>
                <p className="text-sm text-slate-500">Your account is protected with two-factor authentication.</p>
                <button 
                  onClick={() => { setIs2FAEnabled(false); setShow2FAModal(false); }}
                  className="w-full py-3 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-500 transition-colors"
                >
                  {t.disable2FA}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {showAPIKeyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={cn("w-full max-w-2xl p-6 rounded-2xl border shadow-2xl transition-colors", theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className={cn("text-xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.apiKeyManagement}</h3>
              <button onClick={() => setShowAPIKeyModal(false)} className="text-slate-500 hover:text-rose-500 transition-colors"><XCircle size={24} /></button>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">Use these keys to authenticate your agents and API requests.</p>
                <button 
                  onClick={generateApiKey}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition-colors"
                >
                  <Plus size={16} />
                  {t.generateNewKey}
                </button>
              </div>

              <div className={cn("rounded-xl border overflow-hidden", theme === 'dark' ? "border-slate-800" : "border-slate-200")}>
                <table className="w-full text-left text-sm">
                  <thead className={theme === 'dark' ? "bg-slate-950 text-slate-400" : "bg-slate-50 text-slate-500"}>
                    <tr>
                      <th className="px-4 py-3 font-bold uppercase text-[10px]">{t.keyName}</th>
                      <th className="px-4 py-3 font-bold uppercase text-[10px]">Key</th>
                      <th className="px-4 py-3 font-bold uppercase text-[10px]">{t.createdDate}</th>
                      <th className="px-4 py-3 font-bold uppercase text-[10px] text-right">{t.action}</th>
                    </tr>
                  </thead>
                  <tbody className={cn("divide-y", theme === 'dark' ? "divide-slate-800" : "divide-slate-100")}>
                    {apiKeys.map(key => (
                      <tr key={key.id} className={cn("transition-colors", theme === 'dark' ? "hover:bg-slate-800/50" : "hover:bg-slate-50")}>
                        <td className="px-4 py-3 font-medium">{key.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{key.key}</td>
                        <td className="px-4 py-3 text-slate-500">{key.created}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button className="p-1.5 rounded hover:bg-slate-700 text-slate-400 transition-colors" title={t.copyKey}>
                              <Copy size={14} />
                            </button>
                            <button 
                              onClick={() => deleteApiKey(key.id)}
                              className="p-1.5 rounded hover:bg-rose-500/20 text-rose-500 transition-colors" 
                              title={t.deleteKey}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {selectedDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={cn("w-full max-w-2xl p-6 rounded-2xl border shadow-2xl transition-colors", theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className={cn("text-xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.details} - {selectedDetail.data.name || selectedDetail.data.message}</h3>
              <button onClick={() => setSelectedDetail(null)} className="text-slate-500 hover:text-rose-500 transition-colors"><XCircle size={24} /></button>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {Object.entries(selectedDetail.data).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">{key}</p>
                  <p className={cn("text-sm font-mono p-2 rounded transition-colors", theme === 'dark' ? "bg-slate-950 text-slate-200" : "bg-slate-50 text-slate-700")}>{String(value)}</p>
                </div>
              ))}
            </div>
            <div className={cn("mt-8 pt-6 border-t flex justify-end transition-colors", theme === 'dark' ? "border-slate-800" : "border-slate-100")}>
              <button onClick={() => setSelectedDetail(null)} className={cn("px-6 py-2 rounded-lg font-bold transition-colors", theme === 'dark' ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-slate-100 text-slate-900 hover:bg-slate-200")}>{t.cancel}</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
