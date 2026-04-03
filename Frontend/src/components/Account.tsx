import React from 'react';
import { User, Mail, Shield, Bell, Lock, CreditCard, ExternalLink, Camera } from 'lucide-react';
import { cn } from '../lib/utils';
import { Theme } from '../types';

interface AccountProps {
  theme: Theme;
  t: any;
}

export const Account = ({ theme, t }: AccountProps) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Profile Card */}
        <div className={cn(
          "w-full md:w-80 border rounded-2xl p-6 transition-colors",
          theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"
        )}>
          <div className="flex flex-col items-center text-center">
            <div className="relative group">
              <div className={cn(
                "w-32 h-32 rounded-full flex items-center justify-center border-4",
                theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-white shadow-lg"
              )}>
                <User size={64} className="text-slate-400" />
              </div>
              <button className="absolute bottom-0 right-0 bg-blue-600 p-2 rounded-full text-white shadow-lg hover:bg-blue-500 transition-colors">
                <Camera size={16} />
              </button>
            </div>
            <h3 className={cn("mt-4 text-xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>Tuandevil Admin</h3>
            <p className="text-slate-500 text-sm">Security Architect</p>
            
            <div className="mt-6 w-full space-y-2">
              <div className={cn("flex items-center justify-between p-3 rounded-xl", theme === 'dark' ? "bg-slate-800/50" : "bg-slate-50")}>
                <span className="text-xs text-slate-500">Status</span>
                <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Active
                </span>
              </div>
              <div className={cn("flex items-center justify-between p-3 rounded-xl", theme === 'dark' ? "bg-slate-800/50" : "bg-slate-50")}>
                <span className="text-xs text-slate-500">Role</span>
                <span className={cn("text-xs font-bold", theme === 'dark' ? "text-blue-400" : "text-blue-600")}>Administrator</span>
              </div>
            </div>
          </div>
        </div>

        {/* Account Details */}
        <div className="flex-1 space-y-6">
          <div className={cn(
            "border rounded-2xl p-6 transition-colors",
            theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"
          )}>
            <h4 className={cn("text-lg font-bold mb-6", theme === 'dark' ? "text-white" : "text-slate-900")}>Personal Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                <input 
                  type="text" 
                  defaultValue="Tuandevil Admin"
                  className={cn(
                    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                    theme === 'dark' ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                  )}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
                <input 
                  type="email" 
                  defaultValue="tuandevil@cyberguard.com"
                  className={cn(
                    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                    theme === 'dark' ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                  )}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Phone Number</label>
                <input 
                  type="text" 
                  defaultValue="+84 123 456 789"
                  className={cn(
                    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                    theme === 'dark' ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                  )}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Location</label>
                <input 
                  type="text" 
                  defaultValue="Ho Chi Minh City, Vietnam"
                  className={cn(
                    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                    theme === 'dark' ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                  )}
                />
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold transition-colors">
                Save Changes
              </button>
            </div>
          </div>

          {/* Security & Preferences */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={cn(
              "border rounded-2xl p-6 transition-colors",
              theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            )}>
              <div className="flex items-center gap-3 mb-6">
                <Shield className="text-blue-500" size={20} />
                <h4 className={cn("font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>Security</h4>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn("text-sm font-medium", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Two-Factor Auth</p>
                    <p className="text-xs text-slate-500">Secure your account with 2FA</p>
                  </div>
                  <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                    <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn("text-sm font-medium", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Session Timeout</p>
                    <p className="text-xs text-slate-500">Auto logout after 30 mins</p>
                  </div>
                  <div className="w-10 h-5 bg-slate-700 rounded-full relative cursor-pointer">
                    <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            <div className={cn(
              "border rounded-2xl p-6 transition-colors",
              theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            )}>
              <div className="flex items-center gap-3 mb-6">
                <Bell className="text-amber-500" size={20} />
                <h4 className={cn("font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>Notifications</h4>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn("text-sm font-medium", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Email Alerts</p>
                    <p className="text-xs text-slate-500">Critical threat notifications</p>
                  </div>
                  <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                    <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn("text-sm font-medium", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Browser Push</p>
                    <p className="text-xs text-slate-500">Real-time desktop alerts</p>
                  </div>
                  <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                    <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
