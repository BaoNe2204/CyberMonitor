import React from 'react';
import { Menu, Search, Bell, Globe, Zap, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Theme, Notification, Language } from '../types';

interface HeaderProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  showNotifications: boolean;
  setShowNotifications: (show: boolean) => void;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  setIsMobileMenuOpen: (show: boolean) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (show: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchPlaceholder: string;
  t: any;
}

export const Header = ({
  theme,
  setTheme,
  language,
  setLanguage,
  showNotifications,
  setShowNotifications,
  notifications,
  setNotifications,
  setIsMobileMenuOpen,
  isSidebarOpen,
  setIsSidebarOpen,
  activeTab,
  setActiveTab,
  searchPlaceholder,
  t
}: HeaderProps) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);

  const searchResults = searchQuery.length > 0 ? [
    { id: 1, title: 'Dashboard', tab: 'dashboard' },
    { id: 2, title: 'Agents', tab: 'agents' },
    { id: 3, title: 'Incidents', tab: 'incidents' },
    { id: 4, title: 'AI Engine', tab: 'ai' },
    { id: 5, title: 'Reports', tab: 'reports' },
    { id: 6, title: 'Settings', tab: 'settings' },
    { id: 7, title: 'Account', tab: 'account' },
  ].filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase())) : [];

  return (
    <header className={cn(
      "sticky top-0 z-30 backdrop-blur-md border-b px-4 lg:px-8 py-4 flex justify-between items-center transition-colors duration-300",
      theme === 'dark' ? "bg-[#020617]/80 border-slate-800" : "bg-white/80 border-slate-200"
    )}>
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className={cn("p-2 rounded-lg lg:hidden transition-colors", theme === 'dark' ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500")}
        >
          <Menu size={20} />
        </button>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={cn("p-2 rounded-lg hidden lg:block transition-colors", theme === 'dark' ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500")}
        >
          <Menu size={20} />
        </button>
        <h2 className={cn("text-lg font-semibold capitalize", theme === 'dark' ? "text-white" : "text-slate-900")}>{t[activeTab] || activeTab}</h2>
      </div>
      <div className="flex items-center gap-2 lg:gap-4">
        <div className="relative hidden xl:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input 
            type="text" 
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              setIsSearchFocused(true);
              setShowNotifications(false);
            }}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            className={cn(
              "border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-64 transition-all",
              theme === 'dark' ? "bg-slate-900 border-slate-800 text-white" : "bg-slate-100 border-slate-200 text-slate-900"
            )}
          />
          
          <AnimatePresence>
            {isSearchFocused && searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={cn(
                  "absolute top-full left-0 right-0 mt-2 rounded-xl border shadow-2xl z-[60] overflow-hidden",
                  theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                )}
              >
                <div className="p-2">
                  {searchResults.map(result => (
                    <button
                      key={result.id}
                      onClick={() => {
                        setActiveTab(result.tab);
                        setSearchQuery('');
                        setIsSearchFocused(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                        theme === 'dark' ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-600"
                      )}
                    >
                      {result.title}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={cn("p-2 rounded-lg relative transition-colors", theme === 'dark' ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-200 text-slate-600")}
          >
            <Bell size={20} />
            {notifications.some(n => !n.read) && (
              <span className={cn("absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2", theme === 'dark' ? "border-[#020617]" : "border-white")}></span>
            )}
          </button>
          
          <AnimatePresence>
            {showNotifications && (
              <>
                <div 
                  className="fixed inset-0 z-[55] lg:hidden" 
                  onClick={() => setShowNotifications(false)}
                />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className={cn(
                    "fixed lg:absolute top-20 lg:top-full right-4 lg:right-0 mt-2 w-[calc(100vw-2rem)] lg:w-80 rounded-xl border shadow-2xl z-[60] overflow-hidden transition-colors",
                    theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                  )}
                >
                  <div className={cn("p-4 border-b flex justify-between items-center", theme === 'dark' ? "border-slate-800" : "border-slate-100")}>
                    <h4 className={cn("font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.notifications}</h4>
                    <button onClick={() => setNotifications(n => n.map(i => ({...i, read: true})))} className="text-[10px] text-blue-400 hover:underline">Mark all read</button>
                  </div>
                  <div className="max-h-[60vh] lg:max-h-80 overflow-y-auto">
                    {notifications.map(n => (
                      <div key={n.id} className={cn(
                        "p-4 border-b transition-colors cursor-pointer", 
                        theme === 'dark' ? "border-slate-800/50 hover:bg-slate-800/30" : "border-slate-100 hover:bg-slate-50",
                        !n.read && (theme === 'dark' ? "bg-blue-500/5" : "bg-blue-50")
                      )}>
                        <p className={cn("text-sm font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{n.title}</p>
                        <p className="text-xs text-slate-500 mt-1">{n.desc}</p>
                        <p className="text-[10px] text-slate-600 mt-2">{n.time}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        <div className={cn("h-8 w-px mx-1 lg:mx-2", theme === 'dark' ? "bg-slate-800" : "bg-slate-200")}></div>
        <div className="flex items-center gap-2">
          <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-colors", theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-slate-100 border-slate-200")}>
            <Globe size={14} className="text-blue-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Global SOC</span>
          </div>
          <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-colors", theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-slate-100 border-slate-200")}>
            <Zap size={14} className="text-amber-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AI Active</span>
          </div>
        </div>
      </div>
    </header>
  );
};
