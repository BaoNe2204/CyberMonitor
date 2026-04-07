import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Shield, 
  Activity, 
  Bot, 
  Zap, 
  ShieldCheck, 
  Cloud, 
  Network, 
  Lock, 
  User, 
  Server, 
  Check 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Theme, Language } from '../types';
import { PricingPlansApi } from '../services/api';

interface LandingPageProps {
  theme: Theme;
  language: Language;
  setLanguage: (lang: Language) => void;
  setShowAuth: (show: boolean) => void;
  setAuthMode: (mode: 'login' | 'register') => void;
  t: any;
  plans: any[];
}

export const LandingPage = ({ theme, language, setLanguage, setShowAuth, setAuthMode, t, plans }: LandingPageProps) => {
  const [fetchedPlans, setFetchedPlans] = useState<any[]>([]);

  // Fetch plans từ API khi load landing page (không cần đăng nhập)
  useEffect(() => {
    PricingPlansApi.getAll().then(res => {
      if (res.success && res.data && res.data.length > 0) {
        setFetchedPlans(res.data.filter((p: any) => p.isActive !== false));
      }
    }).catch(() => {}); // silent fail — dùng fallback
  }, []);

  // Ưu tiên: plans từ App (đã đăng nhập) → plans fetch từ API → fallback hardcode
  const sourcePlans = plans.length > 0 ? plans : fetchedPlans;

  // Helper: parse price về số
  const parseNum = (v: any): number => {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    return parseInt(String(v).replace(/\D/g, ''), 10) || 0;
  };

  const displayPlans = sourcePlans.length > 0 ? sourcePlans.map((p: any) => ({
    name: p.name,
    priceNum: parseNum(p.price ?? p.planPrice ?? 0),
    features: Array.isArray(p.features)
      ? (typeof p.features[0] === 'string' ? p.features : p.features.map((f: any) => f.label ?? f))
      : [t.activeAgents, t.liveAlerts, t.ai],
    popular: p.isPopular ?? p.popular ?? false,
    billingPeriod: p.billingPeriod ?? 'monthly',
    isEnterprise: p.isEnterprise ?? false,
  })) : [
    { name: t.planStarter,    priceNum: 0,        features: [t.activeAgents, t.liveAlerts, t.ai],                       popular: false, billingPeriod: 'monthly', isEnterprise: false },
    { name: t.planPro,        priceNum: 2500000,   features: [t.unlimitedAgents, t.customReports, t.aiSupport],          popular: true,  billingPeriod: 'monthly', isEnterprise: false },
    { name: t.planEnterprise, priceNum: 0,         features: [t.dedicatedManager, t.mitreMapping, t.predictiveAnalysis], popular: false, billingPeriod: 'monthly', isEnterprise: true  },
  ];

  return (
    <div className={cn("min-h-screen transition-colors duration-300", theme === 'dark' ? "bg-[#020617] text-slate-200" : "bg-slate-50 text-slate-800")}>
      {/* Landing Navbar */}
      <nav className={cn("fixed top-0 w-full z-50 backdrop-blur-md border-b transition-colors", theme === 'dark' ? "bg-[#020617]/80 border-slate-800" : "bg-white/80 border-slate-200")}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Shield className="text-white" size={24} />
            </div>
            <span className={cn("text-xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>CyberGuard</span>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')}
              className="text-sm font-bold hover:text-blue-500 transition-colors"
            >
              {language === 'en' ? 'VI' : 'EN'}
            </button>
            <button 
              onClick={() => setShowAuth(true)}
              className="text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg transition-all shadow-lg shadow-blue-600/20"
            >
              {t.login}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className={cn("text-5xl lg:text-7xl font-bold tracking-tight mb-6", theme === 'dark' ? "text-white" : "text-slate-900")}>
              {t.landingTitle}
            </h1>
            <p className="text-xl text-slate-500 max-w-3xl mx-auto mb-10">
              {t.landingSub}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={() => setShowAuth(true)}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white text-lg font-bold px-10 py-4 rounded-xl transition-all shadow-xl shadow-blue-600/20"
              >
                {t.getStarted}
              </button>
              <button className={cn("w-full sm:w-auto border text-lg font-bold px-10 py-4 rounded-xl transition-all", theme === 'dark' ? "border-slate-800 hover:bg-slate-900" : "border-slate-200 hover:bg-slate-100")}>
                {t.learnMore}
              </button>
            </div>
          </motion.div>

          {/* Dashboard Preview */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-20 relative max-w-5xl mx-auto"
          >
            <div className={cn("rounded-2xl border p-2 shadow-2xl overflow-hidden", theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
              <img 
                src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=1200&h=600" 
                alt="Security Operations Center" 
                className="rounded-xl w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-blue-600/20 blur-[120px] rounded-full" />
          </motion.div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="py-12 border-y border-slate-800/50 bg-slate-950/20">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-sm font-bold text-slate-500 uppercase tracking-widest mb-8">{t.trustedBy}</p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all">
            {['Microsoft', 'Amazon', 'Google', 'Netflix', 'Tesla'].map((brand) => (
              <span key={brand} className="text-2xl font-black text-slate-400">{brand}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={cn("py-20 px-6 transition-colors", theme === 'dark' ? "bg-slate-950/50" : "bg-slate-100/50")}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Activity, title: t.feature1Title, desc: t.feature1Desc, color: 'text-blue-500' },
              { icon: Bot, title: t.feature2Title, desc: t.feature2Desc, color: 'text-emerald-500' },
              { icon: Zap, title: t.feature3Title, desc: t.feature3Desc, color: 'text-amber-500' }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={cn("p-8 rounded-2xl border transition-all hover:scale-105", theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm")}
              >
                <feature.icon className={cn("mb-6", feature.color)} size={40} />
                <h3 className={cn("text-xl font-bold mb-4", theme === 'dark' ? "text-white" : "text-slate-900")}>{feature.title}</h3>
                <p className="text-slate-500 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section className={cn("py-24 px-6 transition-colors", theme === 'dark' ? "bg-slate-950" : "bg-white")}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className={cn("text-3xl lg:text-5xl font-bold mb-6", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.solutionsTitle}</h2>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto">{t.solutionsSub}</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-12">
              {[
                { title: t.solution1Title, desc: t.solution1Desc, icon: ShieldCheck },
                { title: t.solution2Title, desc: t.solution2Desc, icon: Cloud },
                { title: t.solution3Title, desc: t.solution3Desc, icon: Network }
              ].map((sol, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-6"
                >
                  <div className="bg-blue-600/10 p-4 rounded-2xl h-fit">
                    <sol.icon className="text-blue-500" size={32} />
                  </div>
                  <div>
                    <h3 className={cn("text-xl font-bold mb-2", theme === 'dark' ? "text-white" : "text-slate-900")}>{sol.title}</h3>
                    <p className="text-slate-500 leading-relaxed">{sol.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative"
            >
              <img 
                src="https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&q=80&w=800&h=600" 
                alt="Security Solutions" 
                className="rounded-3xl shadow-2xl border border-slate-800/50"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-6 -right-6 bg-blue-600 p-8 rounded-3xl shadow-xl hidden md:block">
                <Lock className="text-white" size={48} />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How to Use Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className={cn("text-3xl lg:text-4xl font-bold mb-4", theme === 'dark' ? "text-white" : "text-slate-900")}>
              {t.howToUse}
            </h2>
            <div className="w-20 h-1.5 bg-blue-600 mx-auto rounded-full" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            {/* Connection Line (Desktop) */}
            <div className={cn("hidden md:block absolute top-8 left-0 w-full h-0.5 -z-10", theme === 'dark' ? "bg-slate-800" : "bg-slate-200")} />
            
            {[
              { step: "01", title: t.step1Title, desc: t.step1Desc, icon: User },
              { step: "02", title: t.step2Title, desc: t.step2Desc, icon: Server },
              { step: "03", title: t.step3Title, desc: t.step3Desc, icon: Activity }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="flex flex-col items-center text-center"
              >
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center mb-6 border-4 relative z-10 transition-colors",
                  theme === 'dark' ? "bg-slate-900 border-slate-800 text-blue-400" : "bg-white border-slate-100 text-blue-600 shadow-lg"
                )}>
                  <item.icon size={28} />
                  <span className={cn(
                    "absolute -top-2 -right-2 text-white text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center border-2",
                    "bg-blue-600",
                    theme === 'dark' ? "border-slate-900" : "border-white"
                  )}>
                    {item.step}
                  </span>
                </div>
                <h3 className={cn("text-lg font-bold mb-2", theme === 'dark' ? "text-white" : "text-slate-900")}>{item.title}</h3>
                <p className="text-sm text-slate-500 max-w-[200px]">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className={cn("py-24 px-6 transition-colors", theme === 'dark' ? "bg-slate-950/50" : "bg-slate-100/50")}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className={cn("text-3xl lg:text-5xl font-bold mb-6", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.pricingTitle}</h2>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto">{t.pricingSub}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {displayPlans.map((plan, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={cn(
                  "p-8 rounded-3xl border relative flex flex-col",
                  plan.popular ? "bg-blue-600 border-blue-500 text-white scale-105 z-10 shadow-2xl shadow-blue-600/20" : 
                  (theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")
                )}
              >
                {plan.popular && <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 text-xs font-black px-4 py-1 rounded-full uppercase tracking-widest">Most Popular</span>}
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-8">
                  {plan.isEnterprise ? (
                    <span className="text-4xl font-black">Custom</span>
                  ) : plan.priceNum === 0 ? (
                    <span className="text-4xl font-black">Miễn phí</span>
                  ) : (
                    <>
                      <span className="text-4xl font-black">
                        {plan.priceNum.toLocaleString('vi-VN')}
                      </span>
                      <span className="text-sm opacity-70 ml-1">
                        {t.vnd}/{plan.billingPeriod === 'yearly' ? 'năm' : 'tháng'}
                      </span>
                    </>
                  )}
                </div>
                <ul className="space-y-4 mb-10 flex-1">
                  {plan.features.map((feat: string, j: number) => (
                    <li key={j} className="flex items-center gap-3 text-sm font-medium">
                      <Check size={18} className={plan.popular ? "text-white" : "text-blue-500"} />
                      {feat}
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={() => setShowAuth(true)}
                  className={cn(
                    "w-full py-4 rounded-xl font-bold transition-all",
                    plan.popular ? "bg-white text-blue-600 hover:bg-slate-100" : "bg-blue-600 text-white hover:bg-blue-500"
                  )}
                >
                  {t.getStarted}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            {[
              { label: t.statsRequests, value: '1.2B+' },
              { label: t.statsThreats, value: '50M+' },
              { label: t.statsUptime, value: '99.99%' }
            ].map((stat, i) => (
              <div key={i}>
                <h2 className={cn("text-4xl lg:text-5xl font-bold mb-2", theme === 'dark' ? "text-white" : "text-slate-900")}>{stat.value}</h2>
                <p className="text-slate-500 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={cn("py-12 px-6 border-t transition-colors", theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200")}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Shield className="text-white" size={24} />
            </div>
            <span className={cn("text-xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>CyberGuard SOC</span>
          </div>
          <p className="text-slate-500 text-sm">© 2026 CyberGuard Security. All rights reserved.</p>
          <div className="flex gap-6">
            <button className="text-slate-500 hover:text-blue-500 transition-colors">Privacy Policy</button>
            <button className="text-slate-500 hover:text-blue-500 transition-colors">Terms of Service</button>
          </div>
        </div>
      </footer>
    </div>
  );
};
