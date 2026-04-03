import React from 'react';
import { Globe, Activity, Bell, Lock, Smartphone, Key, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { Theme, Language } from '../types';
import { Toggle } from './common/Toggle';

interface SettingsProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: any;
  is2FAEnabled: boolean;
  setShow2FAModal: (show: boolean) => void;
  setShowAPIKeyModal: (show: boolean) => void;
}

export const Settings = ({
  theme,
  setTheme,
  language,
  setLanguage,
  t,
  is2FAEnabled,
  setShow2FAModal,
  setShowAPIKeyModal
}: SettingsProps) => {
  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className={cn("text-2xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.settings}</h2>
        <p className="text-slate-400">Configure your platform preferences and security.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Language Settings */}
        <div className={cn("border p-6 rounded-xl space-y-6 transition-colors", theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
          <div className="flex items-center gap-3 mb-2">
            <Globe className="text-blue-400" size={20} />
            <h3 className={cn("font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.language}</h3>
          </div>
          <p className="text-xs text-slate-500">{t.selectLanguage}</p>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setLanguage('en')}
              className={cn(
                "flex items-center justify-center gap-3 p-4 rounded-xl border transition-all",
                language === 'en' ? "bg-blue-600/20 border-blue-500 text-white" : (theme === 'dark' ? "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700" : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300")
              )}
            >
              <span className="text-2xl">🇺🇸</span>
              <span className="font-medium">{t.english}</span>
            </button>
            <button 
              onClick={() => setLanguage('vi')}
              className={cn(
                "flex items-center justify-center gap-3 p-4 rounded-xl border transition-all",
                language === 'vi' ? "bg-blue-600/20 border-blue-500 text-white" : (theme === 'dark' ? "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700" : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300")
              )}
            >
              <span className="text-2xl">🇻🇳</span>
              <span className="font-medium">{t.vietnamese}</span>
            </button>
          </div>
        </div>

        {/* Theme Settings */}
        <div className={cn("border p-6 rounded-xl space-y-6 transition-colors", theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
          <div className="flex items-center gap-3 mb-2">
            <Activity className="text-purple-400" size={20} />
            <h3 className={cn("font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.theme}</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setTheme('dark')}
              className={cn(
                "flex items-center justify-center gap-3 p-4 rounded-xl border transition-all",
                theme === 'dark' ? "bg-blue-600/20 border-blue-500 text-white" : "bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300"
              )}
            >
              <div className="w-4 h-4 rounded-full bg-[#020617] border border-slate-700"></div>
              <span className="font-medium">{t.darkMode}</span>
            </button>
            <button 
              onClick={() => setTheme('light')}
              className={cn(
                "flex items-center justify-center gap-3 p-4 rounded-xl border transition-all",
                theme === 'light' ? "bg-blue-600/20 border-blue-500 text-blue-600" : "bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300"
              )}
            >
              <div className="w-4 h-4 rounded-full bg-white border border-slate-300 shadow-sm"></div>
              <span className="font-medium">{t.lightMode}</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-500 italic">CyberGuard is optimized for low-light SOC environments.</p>
        </div>

        {/* Notification Settings */}
        <div className={cn("border p-6 rounded-xl space-y-4 transition-colors", theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
          <div className="flex items-center gap-3 mb-2">
            <Bell className="text-amber-400" size={20} />
            <h3 className={cn("font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.notifications}</h3>
          </div>
          <Toggle label={t.emailAlerts} enabled={true} onChange={() => {}} theme={theme} />
          <Toggle label={t.telegramAlerts} enabled={false} onChange={() => {}} theme={theme} />
          <Toggle label="Push Notifications" enabled={true} onChange={() => {}} theme={theme} />
        </div>

        {/* Security Settings */}
        <div className={cn("border p-6 rounded-xl space-y-4 transition-colors", theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
          <div className="flex items-center gap-3 mb-2">
            <Lock className="text-emerald-400" size={20} />
            <h3 className={cn("font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.security}</h3>
          </div>
          <button 
            onClick={() => setShow2FAModal(true)}
            className={cn("w-full flex items-center justify-between p-3 border rounded-lg text-sm transition-colors", theme === 'dark' ? "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100")}
          >
            <div className="flex items-center gap-3">
              <Smartphone size={16} className="text-emerald-500" />
              <span>{t.twoFactor}</span>
            </div>
            <div className="flex items-center gap-2">
              {is2FAEnabled && <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded font-bold uppercase">Active</span>}
              <ChevronRight size={16} className="text-slate-500" />
            </div>
          </button>
          <button 
            onClick={() => setShowAPIKeyModal(true)}
            className={cn("w-full flex items-center justify-between p-3 border rounded-lg text-sm transition-colors", theme === 'dark' ? "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100")}
          >
            <div className="flex items-center gap-3">
              <Key size={16} className="text-blue-500" />
              <span>{t.apiKey}</span>
            </div>
            <ChevronRight size={16} className="text-slate-500" />
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button className={cn("px-8 py-3 rounded-xl font-bold transition-all shadow-lg", theme === 'dark' ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20" : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-100")}>
          {t.saveChanges}
        </button>
      </div>
    </div>
  );
};
