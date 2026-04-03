/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/utils';

// Types & Data
import { Theme, Language, AuthMode, ApiKey, Alert, Agent } from './types';
import { trafficData, attackTypes, agents, recentAlerts } from './data/mockData';
import { translations } from './i18n/translations';

// Components
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { AuthForm } from './components/AuthForm';
import { Dashboard } from './components/Dashboard';
import { Agents } from './components/Agents';
import { AIEngine } from './components/AIEngine';
import { Incidents } from './components/Incidents';
import { Reports } from './components/Reports';
import { Billing } from './components/Billing';
import { Settings } from './components/Settings';
import { Modals } from './components/Modals';
import { Account } from './components/Account';
import { UserManagement } from './components/UserManagement';
import { PricingManagement } from './components/PricingManagement';
import { SystemLogs } from './components/SystemLogs';
import { ApiGuide } from './components/ApiGuide';
import { ApiManagement } from './components/ApiManagement';
import { User } from './types';
import { io, Socket } from 'socket.io-client';

let socket: Socket;

export default function App() {
  // --- State ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAlertVisible, setIsAlertVisible] = useState(false);
  const [language, setLanguage] = useState<Language>('vi');
  const [theme, setTheme] = useState<Theme>('dark');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAddServerModal, setShowAddServerModal] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showAPIKeyModal, setShowAPIKeyModal] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    { id: 1, name: 'Production API', key: 'cg_live_********************4a2b', created: '2024-03-15' },
    { id: 2, name: 'Development Key', key: 'cg_test_********************9f1e', created: '2024-03-20' },
  ]);
  const [selectedDetail, setSelectedDetail] = useState<{ type: string, data: any } | null>(null);
  const [pricingPlans, setPricingPlans] = useState<any[]>([]);
  const [apiGuide, setApiGuide] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'New Threat Blocked', desc: 'SQL Injection attempt from 192.168.1.50', time: '2m ago', read: false },
    { id: 2, title: 'System Update', desc: 'Security patches applied to Node-Alpha', time: '1h ago', read: true },
    { id: 3, title: 'Agent Offline', desc: 'API-Gateway-01 lost connection', time: '3h ago', read: false },
  ]);

  const t = translations[language];

  // --- Socket.io & Data Fetching ---
  useEffect(() => {
    // Always fetch initial pricing
    fetch('/api/pricing')
      .then(res => res.json())
      .then(data => setPricingPlans(data));

    fetch('/api/guide')
      .then(res => res.json())
      .then(data => setApiGuide(data));

    if (isLoggedIn) {
      socket = io();
      
      socket.on('pricing_updated', (updatedPlans) => {
        setPricingPlans(updatedPlans);
      });

      socket.on('users_updated', (updatedUsers) => {
        setUsers(updatedUsers);
      });

      socket.on('guide_updated', (updatedGuide) => {
        setApiGuide(updatedGuide);
      });

      // Initial fetch
      fetch('/api/users')
        .then(res => res.json())
        .then(data => setUsers(data));

      return () => {
        if (socket) socket.disconnect();
      };
    }
  }, [isLoggedIn]);

  // --- Handlers ---
  const handleLogin = (userData: User) => {
    setIsLoggedIn(true);
    setUser(userData);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
    setShowAuth(false);
    setActiveTab('dashboard');
  };

  const handleExport = () => {
    const content = "CyberGuard SOC Report\nGenerated on: " + new Date().toLocaleString() + "\n\nSummary:\nTotal Requests: 1,284,092\nThreats Blocked: 4,291\nActive Agents: 42";
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CyberGuard_Report_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateApiKey = () => {
    const newKey: ApiKey = {
      id: Date.now(),
      name: `New Key ${apiKeys.length + 1}`,
      key: `cg_${Math.random().toString(36).substring(2, 15)}****************`,
      created: new Date().toISOString().split('T')[0]
    };
    setApiKeys([...apiKeys, newKey]);
  };

  const deleteApiKey = (id: number) => {
    setApiKeys(apiKeys.filter(k => k.id !== id));
  };

  // Simulate SignalR Real-time Alert
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAlertVisible(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // --- Rendering ---
  if (!isLoggedIn) {
    if (showAuth) {
      return (
        <AuthForm 
          theme={theme}
          language={language}
          setLanguage={setLanguage}
          setShowAuth={setShowAuth}
          authMode={authMode}
          setAuthMode={setAuthMode}
          handleLogin={handleLogin}
          t={t}
        />
      );
    }

    return (
      <LandingPage 
        theme={theme}
        language={language}
        setLanguage={setLanguage}
        setShowAuth={setShowAuth}
        setAuthMode={setAuthMode}
        t={t}
        plans={pricingPlans}
      />
    );
  }

  return (
    <div className={cn("min-h-screen transition-colors duration-300", theme === 'dark' ? "bg-[#020617] text-slate-200" : "bg-slate-50 text-slate-800", "font-sans selection:bg-blue-500/30")}>
      <Modals 
        theme={theme}
        t={t}
        showAddServerModal={showAddServerModal}
        setShowAddServerModal={setShowAddServerModal}
        show2FAModal={show2FAModal}
        setShow2FAModal={setShow2FAModal}
        is2FAEnabled={is2FAEnabled}
        setIs2FAEnabled={setIs2FAEnabled}
        showAPIKeyModal={showAPIKeyModal}
        setShowAPIKeyModal={setShowAPIKeyModal}
        apiKeys={apiKeys}
        generateApiKey={generateApiKey}
        deleteApiKey={deleteApiKey}
        selectedDetail={selectedDetail}
        setSelectedDetail={setSelectedDetail}
      />

      <div className="flex">
        <Sidebar 
          theme={theme}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          handleLogout={handleLogout}
          user={user}
          t={t}
        />

        <main className="flex-1 min-w-0 min-h-screen transition-all duration-300">
          <Header 
            theme={theme}
            setTheme={setTheme}
            language={language}
            setLanguage={setLanguage}
            showNotifications={showNotifications}
            setShowNotifications={setShowNotifications}
            notifications={notifications}
            setNotifications={setNotifications}
            setIsMobileMenuOpen={setIsMobileMenuOpen}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            searchPlaceholder={t.searchPlaceholder}
            t={t}
          />

          <div className="p-4 lg:p-8 max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'dashboard' && (
                  <Dashboard 
                    theme={theme}
                    t={t}
                    isAlertVisible={isAlertVisible}
                    setIsAlertVisible={setIsAlertVisible}
                    trafficData={trafficData}
                    attackTypes={attackTypes}
                    recentAlerts={recentAlerts}
                    agents={agents}
                    setSelectedDetail={setSelectedDetail}
                    setShowAddServerModal={setShowAddServerModal}
                    setActiveTab={setActiveTab}
                  />
                )}

                {activeTab === 'agents' && (
                  <Agents 
                    theme={theme}
                    t={t}
                    agents={agents}
                    setShowAddServerModal={setShowAddServerModal}
                  />
                )}

                {activeTab === 'incidents' && (
                  <Incidents 
                    theme={theme}
                    t={t}
                    recentAlerts={recentAlerts}
                    setSelectedDetail={setSelectedDetail}
                  />
                )}

                {activeTab === 'ai' && (
                  <AIEngine 
                    theme={theme}
                    t={t}
                  />
                )}

                {activeTab === 'reports' && (
                  <Reports 
                    theme={theme}
                    t={t}
                    handleExport={handleExport}
                  />
                )}

                {activeTab === 'billing' && (
                  <Billing 
                    theme={theme}
                    t={t}
                    plans={pricingPlans}
                  />
                )}

                {activeTab === 'apiGuide' && (
                  <ApiGuide 
                    theme={theme}
                    t={t}
                    guide={apiGuide}
                  />
                )}

                {activeTab === 'settings' && (
                  <Settings 
                    theme={theme}
                    setTheme={setTheme}
                    language={language}
                    setLanguage={setLanguage}
                    t={t}
                    is2FAEnabled={is2FAEnabled}
                    setShow2FAModal={setShow2FAModal}
                    setShowAPIKeyModal={setShowAPIKeyModal}
                  />
                )}

                {activeTab === 'account' && (
                  <Account 
                    theme={theme}
                    t={t}
                  />
                )}

                {activeTab === 'userManagement' && (
                  <UserManagement 
                    theme={theme}
                    t={t}
                    users={users}
                    setUsers={setUsers}
                  />
                )}

                {activeTab === 'pricingManagement' && (
                  <PricingManagement 
                    theme={theme}
                    t={t}
                    plans={pricingPlans}
                    setPlans={setPricingPlans}
                  />
                )}

                {activeTab === 'apiManagement' && (
                  <ApiManagement 
                    theme={theme}
                    t={t}
                    guide={apiGuide}
                    setGuide={setApiGuide}
                  />
                )}

                {activeTab === 'systemLogs' && (
                  <SystemLogs 
                    theme={theme}
                    t={t}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
