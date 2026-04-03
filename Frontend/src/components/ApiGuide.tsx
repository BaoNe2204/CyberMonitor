import React from 'react';
import { Book, Code, Shield, Terminal, Copy } from 'lucide-react';
import { cn } from '../lib/utils';
import { Theme } from '../types';

interface ApiGuideProps {
  theme: Theme;
  t: any;
  guide: any;
}

export const ApiGuide = ({ theme, t, guide }: ApiGuideProps) => {
  if (!guide) return <div className="p-8 text-center text-slate-500">Loading guide...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-4">
        <h2 className={cn("text-3xl font-black tracking-tight", theme === 'dark' ? "text-white" : "text-slate-900")}>
          {guide.title || t.apiGuide}
        </h2>
        <p className="text-lg text-slate-400">
          {guide.description}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {guide.sections?.map((section: any) => (
          <div 
            key={section.id}
            className={cn(
              "p-6 rounded-2xl border transition-all",
              theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            )}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-600/10 text-blue-500">
                {section.id === 'auth' ? <Shield size={20} /> : <Code size={20} />}
              </div>
              <h3 className={cn("text-xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>
                {section.title}
              </h3>
            </div>
            
            <div className={cn(
              "p-4 rounded-xl font-mono text-sm whitespace-pre-wrap leading-relaxed",
              theme === 'dark' ? "bg-slate-950 text-slate-300" : "bg-slate-50 text-slate-700"
            )}>
              {section.content}
            </div>
          </div>
        ))}
      </div>

      <div className={cn(
        "p-8 rounded-3xl border text-center space-y-4",
        theme === 'dark' ? "bg-blue-600/5 border-blue-500/20" : "bg-blue-50 border-blue-100"
      )}>
        <Terminal className="mx-auto text-blue-500" size={32} />
        <h3 className={cn("text-xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>Need more help?</h3>
        <p className="text-slate-400 max-w-md mx-auto">
          Our developer support team is available 24/7 to help you with your integration.
        </p>
        <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-full font-bold transition-all">
          Contact Developer Support
        </button>
      </div>
    </div>
  );
};
