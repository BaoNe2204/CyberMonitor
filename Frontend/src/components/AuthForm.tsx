import React from 'react';
import { motion } from 'motion/react';
import { Shield } from 'lucide-react';
import { cn } from '../lib/utils';
import { Theme, Language, AuthMode } from '../types';

interface AuthFormProps {
  theme: Theme;
  language: Language;
  setLanguage: (lang: Language) => void;
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
  setShowAuth: (show: boolean) => void;
  handleLogin: (user: any) => void;
  t: any;
}

export const AuthForm = ({
  theme,
  language,
  setLanguage,
  authMode,
  setAuthMode,
  setShowAuth,
  handleLogin,
  t
}: AuthFormProps) => {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        handleLogin(data.user);
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("min-h-screen flex items-center justify-center p-4 transition-colors duration-300", theme === 'dark' ? "bg-[#020617]" : "bg-slate-50")}>
      <div className="absolute top-8 right-8 flex items-center gap-4">
        <button 
          onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')}
          className={cn("px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors", theme === 'dark' ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-white" : "bg-white border-slate-200 text-slate-600 hover:text-slate-900")}
        >
          {language === 'en' ? 'VI' : 'EN'}
        </button>
        <button 
          onClick={() => setShowAuth(false)}
          className={cn("px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors", theme === 'dark' ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-white" : "bg-white border-slate-200 text-slate-600 hover:text-slate-900")}
        >
          {language === 'en' ? 'Back' : 'Quay lại'}
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("w-full max-w-md p-8 rounded-2xl border shadow-2xl backdrop-blur-sm", theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200")}
      >
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-3 rounded-xl mb-4">
            <Shield className="text-white" size={32} />
          </div>
          <h1 className={cn("text-2xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>CyberGuard SOC</h1>
          <p className="text-slate-500 text-sm mt-1">Enterprise Security Management</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold text-center">
              {error}
            </div>
          )}
          {authMode === 'register' && (
            <>
              <div>
                <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>{t.fullName}</label>
                <input 
                  type="text" 
                  className={cn("w-full rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all", theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-100 border-slate-200 text-slate-900")}
                  placeholder="John Doe"
                />
              </div>
            </>
          )}
          <div>
            <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>{t.username}</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={cn("w-full rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all", theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-100 border-slate-200 text-slate-900")}
              placeholder="admin"
              required
            />
          </div>
          <div>
            <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>{t.password}</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn("w-full rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all", theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-100 border-slate-200 text-slate-900")}
              placeholder="••••••••"
              required
            />
          </div>
          {authMode === 'register' && (
            <div>
              <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>{t.confirmPassword}</label>
              <input 
                type="password" 
                className={cn("w-full rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all", theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-100 border-slate-200 text-slate-900")}
                placeholder="••••••••"
              />
            </div>
          )}
          {authMode === 'login' && (
            <div className="flex justify-end">
              <button type="button" className="text-xs text-blue-500 hover:underline">{t.forgotPassword}</button>
            </div>
          )}
          <button 
            type="submit"
            disabled={isLoading}
            className={cn(
              "w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-blue-900/20",
              isLoading && "opacity-50 cursor-not-allowed"
            )}
          >
            {isLoading ? '...' : (authMode === 'login' ? (t.login || 'Login') : (t.register || 'Register'))}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            className="text-sm text-slate-500 hover:text-blue-400 transition-colors"
          >
            {authMode === 'login' ? (t.noAccount || "Don't have an account? Register") : (t.hasAccount || "Already have an account? Login")}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
