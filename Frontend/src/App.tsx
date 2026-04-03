/**
 * CyberMonitor SOC Platform - Main Application
 * Kết nối với ASP.NET Backend + SignalR Real-time
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/utils';

// Types & Data
import { Theme, Language, AuthMode, ApiKey, Alert, Agent, User, ServerKeyModalState } from './types';
import { translations } from './i18n/translations';

// API Client
import {
  AuthApi,
  ServersApi,
  AlertsApi,
  TicketsApi,
  ReportsApi,
  UsersApi,
  PaymentApi,
  DefenseApi,
  type BlockedIP,
  createSignalRConnection,
  type SignalRCallbacks,
  getStoredUser,
  isAuthenticated,
  clearAuth,
} from './services/api';

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
import { Defense } from './components/Defense';
import { loadStoredPricingPlans } from './data/defaultPricingPlans';

export default function App() {
  // --- State ---
  const [isLoggedIn, setIsLoggedIn] = useState(() => isAuthenticated());
  const [user, setUser] = useState<User | null>(() => getStoredUser());
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
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<{ type: string; data: any } | null>(null);
  const [pricingPlans, setPricingPlans] = useState<any[]>(() => loadStoredPricingPlans());
  const [apiGuide, setApiGuide] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  // Server API key vừa xem (dùng cho modal hiện key)
  const [serverKeyToView, setServerKeyToView] = useState<ServerKeyModalState | null>(null);

  // Real data from API
  const [servers, setServers] = useState<Agent[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  // Traffic & attack data from API
  const [trafficData, setTrafficData] = useState<any[]>([]);
  const [attackTypes, setAttackTypes] = useState<any[]>([]);
  const [mitreData, setMitreData] = useState<any[]>([]);
  // Blocked IPs (Defense)
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  // Tickets (real-time)
  const [tickets, setTickets] = useState<any[]>([]);

  const t = translations[language];

  // --- SignalR Connection - Real-time Updates ---
  useEffect(() => {
    if (!isLoggedIn) return;

    const callbacks: SignalRCallbacks = {
      onAlert: (alert) => {
        setIsAlertVisible(true);
        setAlerts(prev => {
          const exists = prev.find(a => a.id === alert.id);
          if (exists) return prev.map(a => a.id === alert.id ? alert : a);
          return [alert, ...prev].slice(0, 50);
        });
        // Refresh dashboard stats
        fetchDashboardStats();
        // Play alert sound for Critical/High
        if (alert.severity === 'Critical' || alert.severity === 'High') {
          try {
            const audio = new Audio('/alert-sound.mp3');
            audio.volume = 0.6;
            audio.play().catch(() => {});
          } catch {}
        }
      },
      onAlertStatusChanged: (alert) => {
        setAlerts(prev => prev.map(a => a.id === alert.id ? alert : a));
      },
      onTicketCreated: (ticket) => {
        setTickets(prev => {
          const exists = prev.find(t => t.id === ticket.id);
          if (exists) return prev.map(t => t.id === ticket.id ? ticket : t);
          return [ticket, ...prev].slice(0, 100);
        });
        // Refresh dashboard stats
        fetchDashboardStats();
        setNotifications(prev => [{
          id: ticket.id,
          title: `🎫 Ticket mới: ${ticket.ticketNumber}`,
          message: ticket.title,
          type: 'Info',
          isRead: false,
          link: `/incidents?ticket=${ticket.id}`,
          createdAt: ticket.createdAt,
        }, ...prev].slice(0, 50));
      },
      onTicketUpdated: (ticket) => {
        setTickets(prev => prev.map(t => t.id === ticket.id ? ticket : t));
        fetchDashboardStats();
      },
      onNotification: (notification) => {
        setNotifications(prev => [notification, ...prev].slice(0, 50));
      },
    };

    const { connect, disconnect } = createSignalRConnection(callbacks);
    connect();

    return () => disconnect();
  }, [isLoggedIn]);

  // --- Auto-fetch servers list on login + poll CPU/RAM every 30s ---
  useEffect(() => {
    if (!isLoggedIn) return;

    const fetchServers = async () => {
      const res = await ServersApi.getAll(1, 50);
      if (res.success && res.data) {
        setServers(res.data.items.map((s: any) => ({
          id: s.id,
          name: s.name,
          ip: s.ipAddress,
          status: s.status?.toLowerCase() || 'offline',
          cpu: s.cpuUsage ?? 0,
          ram: s.ramUsage ?? 0,
          lastSeen: s.lastSeenAt || '',
          os: s.os || '',
          diskUsage: s.diskUsage ?? 0,
        })));
      }
    };

    fetchServers();
    const pollInterval = setInterval(fetchServers, 30_000);
    return () => clearInterval(pollInterval);
  }, [isLoggedIn]);

  // --- Fetch Dashboard Stats (used by SignalR to refresh) ---
  const fetchDashboardStats = useCallback(async () => {
    const dashRes = await ReportsApi.getDashboard();
    if (dashRes.success && dashRes.data) {
      const d = dashRes.data;
      setDashboardData({
        stats: {
          totalRequests: (d.currentBandwidthIn || 0) + (d.currentBandwidthOut || 0),
          threatsBlocked: d.totalAlerts || 0,
          avgResponse: d.closedTicketsToday || 0,
          totalAlerts: d.totalAlerts,
          openAlerts: d.openAlerts,
          criticalAlerts: d.criticalAlerts,
          totalTickets: d.totalTickets,
          openTickets: d.openTickets,
          closedTicketsToday: d.closedTicketsToday,
          currentBandwidthIn: d.currentBandwidthIn,
          currentBandwidthOut: d.currentBandwidthOut,
        },
        recentAlerts: d.recentAlerts || [],
        serverHealth: d.serverHealth || [],
      });
      // Update alerts from dashboard
      setAlerts(prev => {
        const merged = [...prev];
        for (const a of (d.recentAlerts || [])) {
          const idx = merged.findIndex(m => m.id === a.id);
          if (idx >= 0) merged[idx] = a; else merged.unshift(a);
        }
        return merged.slice(0, 50);
      });
    }
  }, []);

  // --- Fetch Blocked IPs ---
  const fetchBlockedIPs = useCallback(async () => {
    const res = await DefenseApi.getBlockedIPs(1, 50, true);
    if (res.success && res.data) {
      setBlockedIPs(res.data.items);
    }
  }, []);

  // --- Fetch Tickets ---
  const fetchTickets = useCallback(async () => {
    const res = await TicketsApi.getAll(1, 30);
    if (res.success && res.data) {
      setTickets(res.data.items);
    }
  }, []);

  // --- Initial Data Fetch ---
  useEffect(() => {
    if (!isLoggedIn) return;

    const fetchInitialData = async () => {
      // Use shared fetchDashboardStats
      await fetchDashboardStats();

      // Fetch users
      const usersRes = await UsersApi.getAll(1, 50);
      if (usersRes.success && usersRes.data) {
        setUsers(usersRes.data.items.map((u: any) => ({
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          role: u.role,
          status: u.isActive ? 'active' : 'inactive',
          createdAt: u.createdAt,
        })));
      }

      // Fetch notifications
      const notifRes = await ReportsApi.getNotifications(1, 20);
      if (notifRes.success && notifRes.data) {
        setNotifications(notifRes.data.items.map((n: any) => ({
          id: n.id,
          title: n.title,
          desc: n.message,
          time: n.createdAt,
          read: n.isRead,
          type: n.type,
          link: n.link,
        })));
      }
    };

    fetchInitialData();

    // Refresh dashboard stats every 30 seconds
    const interval = setInterval(fetchDashboardStats, 30000);
    return () => clearInterval(interval);
  }, [isLoggedIn, fetchDashboardStats]);

  // --- Initial Blocked IPs & Tickets Fetch ---
  useEffect(() => {
    if (!isLoggedIn) return;
    fetchBlockedIPs();
    fetchTickets();
    // Refresh blocked IPs every 60s
    const ipInterval = setInterval(fetchBlockedIPs, 60000);
    return () => clearInterval(ipInterval);
  }, [isLoggedIn, fetchBlockedIPs, fetchTickets]);

  // --- Handlers ---
  const handleLogin = useCallback(async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    const res = await AuthApi.login(email, password);
    if (res.success && res.data) {
      setUser(res.data.user);
      setIsLoggedIn(true);
      return { success: true, message: 'Đăng nhập thành công!' };
    }
    return { success: false, message: res.message || 'Đăng nhập thất bại' };
  }, []);

  const handleRegister = useCallback(async (companyName: string, email: string, password: string): Promise<{ success: boolean; message: string }> => {
    const res = await AuthApi.register(companyName, email, password);
    if (res.success && res.data) {
      setUser(res.data.user);
      setIsLoggedIn(true);
      return { success: true, message: 'Đăng ký thành công! Workspace đã được tạo.' };
    }
    return { success: false, message: res.message || 'Đăng ký thất bại' };
  }, []);

  const handleLogout = useCallback(() => {
    AuthApi.logout();
    setIsLoggedIn(false);
    setUser(null);
    setShowAuth(false);
    setActiveTab('dashboard');
    setDashboardData(null);
    setServers([]);
    setAlerts([]);
  }, []);

  const handleExport = useCallback(async (startDate?: string, endDate?: string) => {
    const token = localStorage.getItem('cm_token');
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const url = `${apiUrl}/api/reports/export-excel?${params}`;

    try {
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const blob = await res.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `CyberMonitor_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      } else {
        alert('Không thể tải báo cáo. Vui lòng thử lại.');
      }
    } catch (e) {
      console.error('Export failed:', e);
      alert('Export failed. Please try again.');
    }
  }, []);

  const generateApiKey = useCallback(async (serverId: string) => {
    const res = await ServersApi.regenerateKey(serverId);
    if (res.success && res.data) {
      setApiKeys(prev => [...prev, {
        id: res.data!.id,
        name: res.data!.name,
        key: res.data!.plainApiKey,
        created: res.data!.createdAt,
        plainApiKey: res.data!.plainApiKey,
      }]);
      return res.data.plainApiKey;
    }
    return null;
  }, []);

  const deleteApiKey = useCallback((id: string) => {
    setApiKeys(prev => prev.filter(k => k.id !== id));
  }, []);

  const refreshServersList = useCallback(async () => {
    const serversRes = await ServersApi.getAll(1, 50);
    if (serversRes.success && serversRes.data) {
      setServers(serversRes.data.items.map((s: any) => ({
        id: s.id,
        name: s.name,
        ip: s.ipAddress,
        status: s.status?.toLowerCase() || 'offline',
        cpu: s.cpuUsage || 0,
        ram: s.ramUsage || 0,
        lastSeen: s.lastSeenAt || '',
        os: s.os || '',
        diskUsage: s.diskUsage || 0,
      })));
    }
  }, []);

  const handleAddServer = useCallback(
    async (
      name: string,
      ip: string
    ): Promise<{ success: boolean; plainApiKey?: string; serverName?: string; serverId?: string; message?: string }> => {
      const res = await ServersApi.add(name, ip, user?.tenantId ?? undefined, user?.id || '');
      if (res.success && res.data?.plainApiKey) {
        await refreshServersList();
        return {
          success: true,
          plainApiKey: res.data.plainApiKey,
          serverName: name,
          serverId: res.data.id,
        };
      }
      if (res.success) {
        await refreshServersList();
        return { success: true };
      }
      return { success: false, message: res.message || 'Thêm server thất bại.' };
    },
    [user, refreshServersList]
  );

  const handleDeleteServer = useCallback(
    async (id: string) => {
      const res = await ServersApi.delete(id);
      if (res.success) await refreshServersList();
      else alert(res.message || 'Xóa máy chủ thất bại.');
    },
    [refreshServersList]
  );

  // ── Blocked IPs Handlers ──────────────────────────────
  const handleUnblockIP = useCallback(
    async (ip: string): Promise<boolean> => {
      const res = await DefenseApi.unblockIP(ip);
      if (res.success) {
        setBlockedIPs(prev => prev.filter(b => b.ipAddress !== ip));
        return true;
      }
      alert(res.message || 'Unblock thất bại.');
      return false;
    },
    []
  );

  const handleManualBlock = useCallback(
    async (ip: string, reason?: string, severity = 'Medium', durationMinutes?: number): Promise<boolean> => {
      const res = await DefenseApi.manualBlock({ ip, reason, severity, durationMinutes });
      if (res.success) {
        await fetchBlockedIPs();
        return true;
      }
      alert(res.message || 'Block thất bại.');
      return false;
    },
    [fetchBlockedIPs]
  );

  const handleViewServerKey = useCallback(async (serverId: string, serverName: string) => {
    try {
      const res = await ServersApi.getServerKey(serverId);
      if (res.success && res.data) {
        const d = res.data;
        setServerKeyToView({
          serverId: d.serverId || serverId,
          serverName: d.serverName || serverName,
          plainApiKey: d.plainApiKey ?? null,
          keyPrefix: d.keyPrefix,
        });
      } else {
        alert(res.message || 'Không lấy được thông tin key. Có thể chưa có key active.');
      }
    } catch {
      alert('Lỗi kết nối khi lấy API Key.');
    }
  }, []);

  const handleRegenerateServerKey = useCallback(
    async (serverId: string) => {
      const res = await ServersApi.regenerateKey(serverId);
      if (res.success && res.data?.plainApiKey) {
        setServerKeyToView((prev) =>
          prev && prev.serverId === serverId
            ? { ...prev, plainApiKey: res.data!.plainApiKey }
            : {
                serverId,
                serverName: res.data!.name || 'Server',
                plainApiKey: res.data!.plainApiKey,
              }
        );
        await refreshServersList();
        return true;
      }
      alert(res.message || 'Tái tạo API Key thất bại.');
      return false;
    },
    [refreshServersList]
  );

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
          handleRegister={handleRegister}
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
        onAddServer={handleAddServer}
        onRegenerateServerKey={handleRegenerateServerKey}
        serverKeyToView={serverKeyToView}
        setServerKeyToView={setServerKeyToView}
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
                    recentAlerts={alerts}
                    agents={servers}
                    dashboardData={dashboardData}
                    setSelectedDetail={setSelectedDetail}
                    setShowAddServerModal={setShowAddServerModal}
                    setActiveTab={setActiveTab}
                  />
                )}

                {activeTab === 'agents' && (
                  <Agents
                    theme={theme}
                    t={t}
                    agents={servers}
                    setShowAddServerModal={setShowAddServerModal}
                    canManageServers={user?.role === 'SuperAdmin' || user?.role === 'Admin'}
                    onDeleteServer={handleDeleteServer}
                    onViewServerKey={handleViewServerKey}
                  />
                )}

                {activeTab === 'incidents' && (
                  <Incidents
                    theme={theme}
                    t={t}
                    recentAlerts={alerts}
                    setSelectedDetail={setSelectedDetail}
                  />
                )}

                {activeTab === 'ai' && (
                  <AIEngine theme={theme} t={t} mitreData={mitreData} dashboardData={dashboardData} />
                )}

                {activeTab === 'defense' && (
                  <Defense
                    theme={theme}
                    t={t}
                    blockedIPs={blockedIPs}
                    onRefresh={fetchBlockedIPs}
                    onUnblock={handleUnblockIP}
                    onManualBlock={handleManualBlock}
                    onCheckIP={async (ip) => {
                      const res = await DefenseApi.checkIP(ip);
                      return res.data || null;
                    }}
                    userRole={user?.role}
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
                  <Billing theme={theme} t={t} plans={pricingPlans} />
                )}

                {activeTab === 'apiGuide' && (
                  <ApiGuide theme={theme} t={t} guide={apiGuide} />
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
                  <Account theme={theme} t={t} />
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
                  <SystemLogs theme={theme} t={t} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
