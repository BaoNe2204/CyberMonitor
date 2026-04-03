import React, { useState } from 'react';
import { Save, Plus, Trash2, Edit3, Shield, Code } from 'lucide-react';
import { cn } from '../lib/utils';
import { Theme } from '../types';

interface ApiManagementProps {
  theme: Theme;
  t: any;
  guide: any;
  setGuide: (guide: any) => void;
}

export const ApiManagement = ({ theme, t, guide, setGuide }: ApiManagementProps) => {
  const [editingGuide, setEditingGuide] = useState<any>(guide || { title: '', description: '', sections: [] });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/guide/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guide: editingGuide }),
      });
      if (response.ok) {
        setGuide(editingGuide);
      }
    } catch (error) {
      console.error('Failed to save guide:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const addSection = () => {
    setEditingGuide({
      ...editingGuide,
      sections: [
        ...editingGuide.sections,
        { id: `section-${Date.now()}`, title: 'New Section', content: 'Enter content here...' }
      ]
    });
  };

  const updateSection = (id: string, field: string, value: string) => {
    setEditingGuide({
      ...editingGuide,
      sections: editingGuide.sections.map((s: any) => 
        s.id === id ? { ...s, [field]: value } : s
      )
    });
  };

  const deleteSection = (id: string) => {
    setEditingGuide({
      ...editingGuide,
      sections: editingGuide.sections.filter((s: any) => s.id !== id)
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h2 className={cn("text-2xl font-black tracking-tight", theme === 'dark' ? "text-white" : "text-slate-900")}>
            {t.apiManagement}
          </h2>
          <p className="text-slate-400">Manage the API documentation and instructions for users.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20"
        >
          <Save size={18} />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className={cn(
        "p-8 rounded-3xl border space-y-6",
        theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"
      )}>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Guide Title</label>
            <input 
              type="text"
              value={editingGuide.title}
              onChange={(e) => setEditingGuide({ ...editingGuide, title: e.target.value })}
              className={cn(
                "w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-bold",
                theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              )}
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Description</label>
            <textarea 
              value={editingGuide.description}
              onChange={(e) => setEditingGuide({ ...editingGuide, description: e.target.value })}
              rows={3}
              className={cn(
                "w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              )}
            />
          </div>
        </div>

        <div className="space-y-6 pt-6 border-t border-slate-800">
          <div className="flex justify-between items-center">
            <h3 className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>Sections</h3>
            <button 
              onClick={addSection}
              className="text-blue-500 hover:text-blue-400 text-sm font-bold flex items-center gap-1 transition-colors"
            >
              <Plus size={16} /> Add Section
            </button>
          </div>

          <div className="space-y-4">
            {editingGuide.sections?.map((section: any) => (
              <div 
                key={section.id}
                className={cn(
                  "p-6 rounded-2xl border relative group",
                  theme === 'dark' ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200"
                )}
              >
                <button 
                  onClick={() => deleteSection(section.id)}
                  className="absolute top-4 right-4 text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={16} />
                </button>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Section Title</label>
                    <input 
                      type="text"
                      value={section.title}
                      onChange={(e) => updateSection(section.id, 'title', e.target.value)}
                      className={cn(
                        "w-full rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-bold",
                        theme === 'dark' ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                      )}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Content</label>
                    <textarea 
                      value={section.content}
                      onChange={(e) => updateSection(section.id, 'content', e.target.value)}
                      rows={4}
                      className={cn(
                        "w-full rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono",
                        theme === 'dark' ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-700"
                      )}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
