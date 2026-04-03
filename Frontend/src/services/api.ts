/**
 * CyberMonitor API Client
 * Kết nối tất cả API calls đến ASP.NET Backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthResponse {
  token: string;
  user: User;
}

export interface User {
  id: string;
  tenantId: string | null;
  tenantName: string | null;
  email: string;
  fullName: string;
  role: 'SuperAdmin' | 'Admin' | 'User';
  lastLoginAt: string | null;
  twoFactorEnabled: boolean;
}

export interface Server {
  id: string;
  name: string;
  ipAddress: string;
  status: 'Online' | 'Offline' | 'Warning';
  os: string | null;
  cpuUsage: number;
  ramUsage: number;
  diskUsage: number;
  lastSeenAt: string | null;
  createdAt: string;
  apiKeys?: ApiKey[];
}

export interface ApiKey {
  id: string;
  serverId: string;
  name: string;
  keyPrefix: string;
  permissions: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ApiKeyGenerated {
  id: string;
  plainApiKey: string;
  name: string;
  createdAt: string;
}

/** GET /api/servers/{id}/key — backend chỉ trả prefix; plainApiKey luôn null */
export interface ServerKeyLookup {
  plainApiKey: string | null;
  keyPrefix: string;
  serverId: string;
  serverName: string;
  name?: string;
  createdAt?: string;
  lastUsedAt?: string | null;
}

export interface Alert {
  id: string;
  tenantId: string;
  serverId: string | null;
  serverName: string | null;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  alertType: string;
  title: string;
  description: string | null;
  sourceIp: string | null;
  targetAsset: string | null;
  mitreTactic: string | null;
  mitreTechnique: string | null;
  status: 'Open' | 'Acknowledged' | 'Investigating' | 'Resolved' | 'FalsePositive';
  anomalyScore: number | null;
  recommendedAction: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  acknowledgedByName: string | null;
  resolvedByName: string | null;
}

export interface Ticket {
  id: string;
  tenantId: string;
  alertId: string | null;
  ticketNumber: string;
  title: string;
  description: string | null;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'OPEN' | 'IN_PROGRESS' | 'PENDING' | 'RESOLVED' | 'CLOSED';
  category: string | null;
  assignedToName: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  dueDate: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  comments?: TicketComment[];
}

export interface TicketComment {
  id: string;
  ticketId: string;
  userId: string;
  userName: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
}

export interface DashboardSummary {
  totalServers: number;
  onlineServers: number;
  offlineServers: number;
  totalAlerts: number;
  openAlerts: number;
  criticalAlerts: number;
  totalTickets: number;
  openTickets: number;
  closedTicketsToday: number;
  currentBandwidthIn: number;
  currentBandwidthOut: number;
  serverHealth: ServerHealth[];
  recentAlerts: Alert[];
}

export interface ServerHealth {
  id: string;
  name: string;
  ipAddress: string;
  status: string;
  cpuUsage: number;
  ramUsage: number;
  diskUsage: number;
  lastSeenAt: string | null;
}

export interface Subscription {
  id: string;
  tenantId: string;
  planName: string;
  planPrice: number;
  maxServers: number;
  usedServers: number;
  status: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

const TOKEN_KEY = 'cm_token';
const USER_KEY = 'cm_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setStoredUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

async function request<T>(
  method: string,
  endpoint: string,
  body?: unknown,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
      ...options,
    });

    const text = await response.text();
    if (!text) {
      return {
        success: response.ok,
        message: response.ok ? 'OK' : `HTTP ${response.status}`,
        data: null,
      };
    }
    try {
      return JSON.parse(text) as ApiResponse<T>;
    } catch {
      return {
        success: false,
        message: `Phản hồi không phải JSON (HTTP ${response.status}). Kiểm tra Backend có chạy tại ${API_BASE_URL} không.`,
        data: null,
      };
    }
  } catch (error) {
    console.error(`API Error [${method} ${endpoint}]:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Network error',
      data: null,
    };
  }
}

// ============================================================================
// AUTH API
// ============================================================================

export const AuthApi = {
  login: async (email: string, password: string): Promise<ApiResponse<AuthResponse>> => {
    const res = await request<AuthResponse>('POST', '/api/auth/login', { email, password });
    if (res.success && res.data) {
      setToken(res.data.token);
      setStoredUser(res.data.user);
    }
    return res;
  },

  register: async (companyName: string, email: string, password: string): Promise<ApiResponse<AuthResponse>> => {
    const res = await request<AuthResponse>('POST', '/api/auth/register', {
      companyName,
      email,
      password,
    });
    if (res.success && res.data) {
      setToken(res.data.token);
      setStoredUser(res.data.user);
    }
    return res;
  },

  getMe: async (): Promise<ApiResponse<User>> => {
    return request<User>('GET', '/api/auth/me');
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    return request('POST', '/api/auth/change-password', { currentPassword, newPassword });
  },

  logout: () => {
    clearAuth();
  },
};

// ============================================================================
// SERVERS API
// ============================================================================

export const ServersApi = {
  getAll: async (page = 1, pageSize = 20, search?: string, status?: string) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    return request<PagedResult<Server>>('GET', `/api/servers?${params}`);
  },

  getOne: async (id: string): Promise<ApiResponse<Server>> => {
    return request<Server>('GET', `/api/servers/${id}`);
  },

  add: async (name: string, ipAddress: string, tenantId: string | null | undefined, createdBy: string) => {
    const body: Record<string, unknown> = { name, ipAddress, createdBy };
    if (tenantId && tenantId.trim() !== '') body.tenantId = tenantId;
    return request<ApiKeyGenerated>('POST', '/api/servers/add', body);
  },

  update: async (id: string, data: { name?: string; status?: string }, updatedBy: string) => {
    return request('PUT', `/api/servers/${id}`, { ...data, updatedBy });
  },

  delete: async (id: string) => {
    return request('DELETE', `/api/servers/${id}`);
  },

  regenerateKey: async (id: string): Promise<ApiResponse<ApiKeyGenerated>> => {
    return request<ApiKeyGenerated>('POST', `/api/servers/${id}/regenerate-key`);
  },

  getServerKey: async (serverId: string) => {
    return request<ServerKeyLookup>('GET', `/api/servers/${serverId}/key`);
  },
};

// ============================================================================
// ALERTS API
// ============================================================================

export const AlertsApi = {
  getAll: async (page = 1, pageSize = 20, filters?: {
    severity?: string;
    status?: string;
    alertType?: string;
    fromDate?: string;
    toDate?: string;
  }) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (filters?.severity) params.append('severity', filters.severity);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.alertType) params.append('alertType', filters.alertType);
    if (filters?.fromDate) params.append('fromDate', filters.fromDate);
    if (filters?.toDate) params.append('toDate', filters.toDate);
    return request<PagedResult<Alert>>('GET', `/api/alerts?${params}`);
  },

  getOne: async (id: string): Promise<ApiResponse<Alert>> => {
    return request<Alert>('GET', `/api/alerts/${id}`);
  },

  updateStatus: async (id: string, status: string, updatedBy?: string) => {
    return request('PUT', `/api/alerts/${id}/status`, { alertId: id, status, updatedBy });
  },
};

// ============================================================================
// TICKETS API
// ============================================================================

export const TicketsApi = {
  getAll: async (page = 1, pageSize = 20, filters?: {
    status?: string;
    priority?: string;
    category?: string;
    assignedTo?: string;
  }) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.assignedTo) params.append('assignedTo', filters.assignedTo);
    return request<PagedResult<Ticket>>('GET', `/api/tickets?${params}`);
  },

  getOne: async (id: string): Promise<ApiResponse<Ticket>> => {
    return request<Ticket>('GET', `/api/tickets/${id}`);
  },

  create: async (data: {
    tenantId: string;
    alertId?: string;
    title: string;
    description?: string;
    priority: string;
    category?: string;
    assignedTo?: string;
    createdBy: string;
  }): Promise<ApiResponse<Ticket>> => {
    return request<Ticket>('POST', '/api/tickets', data);
  },

  updateStatus: async (id: string, status: string, updatedBy: string, comment?: string) => {
    return request<Ticket>('PUT', `/api/tickets/${id}/status`, {
      ticketId: id,
      status,
      updatedBy,
      comment,
    });
  },

  assign: async (id: string, assignedTo: string | null, assignedBy: string, comment?: string) => {
    return request<Ticket>('PUT', `/api/tickets/${id}/assign`, {
      ticketId: id,
      assignedTo,
      assignedBy,
      comment,
    });
  },

  addComment: async (id: string, userId: string, content: string, isInternal = false) => {
    return request<TicketComment>('POST', `/api/tickets/${id}/comments`, {
      ticketId: id,
      userId,
      content,
      isInternal,
    });
  },
};

// ============================================================================
// PAYMENT API
// ============================================================================

export const PaymentApi = {
  createUrl: async (tenantId: string, planName: string, amount: number) => {
    return request<{ orderId: string; paymentUrl: string }>('POST', '/api/payment/create-url', {
      tenantId,
      planName,
      amount,
    });
  },

  getHistory: async () => {
    return request('GET', '/api/payment/history');
  },
};

// ============================================================================
// REPORTS API
// ============================================================================

export const ReportsApi = {
  getDashboard: async (): Promise<ApiResponse<DashboardSummary>> => {
    return request<DashboardSummary>('GET', '/api/reports/dashboard');
  },

  getSubscription: async (): Promise<ApiResponse<Subscription>> => {
    return request<Subscription>('GET', '/api/reports/subscription');
  },

  exportExcel: (startDate?: string, endDate?: string, tenantId?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (tenantId) params.append('tenantId', tenantId);

    const token = getToken();
    const url = `${API_BASE_URL}/api/reports/export-excel?${params}`;

    // Open in new tab for download
    window.open(url, '_blank');
  },

  getNotifications: async (page = 1, pageSize = 20) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    return request<PagedResult<Notification>>('GET', `/api/notifications?${params}`);
  },

  markNotificationRead: async (id: string) => {
    return request('PUT', `/api/notifications/${id}/read`);
  },

  getAuditLogs: async (page = 1, pageSize = 50, action?: string) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (action) params.append('action', action);
    return request('GET', `/api/reports/audit-logs?${params}`);
  },
};

// ============================================================================
// USERS API (Admin)
// ============================================================================

export const UsersApi = {
  getAll: async (page = 1, pageSize = 20, search?: string) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) params.append('search', search);
    return request<PagedResult<User>>('GET', `/api/auth/users?${params}`);
  },

  create: async (data: {
    email: string;
    password: string;
    fullName: string;
    role: string;
    tenantId?: string;
  }): Promise<ApiResponse<User>> => {
    return request<User>('POST', '/api/auth/users', data);
  },

  update: async (id: string, data: {
    fullName?: string;
    role?: string;
    isActive?: boolean;
    updatedBy?: string;
  }): Promise<ApiResponse<User>> => {
    return request<User>('PUT', `/api/auth/users/${id}`, data);
  },

  delete: async (id: string) => {
    return request('DELETE', `/api/auth/users/${id}`);
  },
};

// ============================================================================
// SIGNALR CONNECTION (Proper @microsoft/signalr client)
// ============================================================================

import * as signalR from '@microsoft/signalr';

export type SignalRCallbacks = {
  onAlert?: (alert: Alert) => void;
  onAlertStatusChanged?: (alert: Alert) => void;
  onTicketCreated?: (ticket: Ticket) => void;
  onTicketUpdated?: (ticket: Ticket) => void;
  onServerStatusChanged?: (serverId: string, status: string) => void;
  onNotification?: (notification: Notification) => void;
  onBlockedIpChanged?: (blockedIp: BlockedIP) => void;
};

export function createSignalRConnection(callbacks: SignalRCallbacks): { connect: () => void; disconnect: () => void } {
  let connection: signalR.HubConnection | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    const token = getToken();
    if (!token) {
      console.warn('[SignalR] No token, skipping connection');
      return;
    }

    try {
      connection = new signalR.HubConnectionBuilder()
        .withUrl(`${API_BASE_URL}/hubs/alerts`, {
          accessTokenFactory: () => token,
          withCredentials: false,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000]) // retry intervals
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      // ── ReceiveAlert ──────────────────────────────────────────────
      connection.on('ReceiveAlert', (alertDto: any) => {
        const alert: Alert = {
          id: alertDto.id,
          tenantId: alertDto.tenantId,
          serverId: alertDto.serverId,
          serverName: alertDto.serverName,
          severity: alertDto.severity as Alert['severity'],
          alertType: alertDto.alertType,
          title: alertDto.title,
          description: alertDto.description,
          sourceIp: alertDto.sourceIp,
          targetAsset: alertDto.targetAsset,
          mitreTactic: alertDto.mitreTactic,
          mitreTechnique: alertDto.mitreTechnique,
          status: alertDto.status as Alert['status'],
          anomalyScore: alertDto.anomalyScore,
          recommendedAction: alertDto.recommendedAction,
          createdAt: alertDto.createdAt,
          acknowledgedAt: alertDto.acknowledgedAt,
          resolvedAt: alertDto.resolvedAt,
          acknowledgedByName: alertDto.acknowledgedByName,
          resolvedByName: alertDto.resolvedByName,
        };
        console.log('[SignalR] 🚨 ReceiveAlert:', alert.title);
        callbacks.onAlert?.(alert);
      });

      // ── AlertStatusChanged ──────────────────────────────────────────
      connection.on('AlertStatusChanged', (alertDto: any) => {
        const alert: Alert = {
          id: alertDto.id,
          tenantId: alertDto.tenantId,
          serverId: alertDto.serverId,
          serverName: alertDto.serverName,
          severity: alertDto.severity as Alert['severity'],
          alertType: alertDto.alertType,
          title: alertDto.title,
          description: alertDto.description,
          sourceIp: alertDto.sourceIp,
          targetAsset: alertDto.targetAsset,
          mitreTactic: alertDto.mitreTactic,
          mitreTechnique: alertDto.mitreTechnique,
          status: alertDto.status as Alert['status'],
          anomalyScore: alertDto.anomalyScore,
          recommendedAction: alertDto.recommendedAction,
          createdAt: alertDto.createdAt,
          acknowledgedAt: alertDto.acknowledgedAt,
          resolvedAt: alertDto.resolvedAt,
          acknowledgedByName: alertDto.acknowledgedByName,
          resolvedByName: alertDto.resolvedByName,
        };
        console.log('[SignalR] AlertStatusChanged:', alert.title);
        callbacks.onAlertStatusChanged?.(alert);
      });

      // ── TicketCreated ──────────────────────────────────────────────
      connection.on('TicketCreated', (ticketDto: any) => {
        const ticket: Ticket = {
          id: ticketDto.id,
          tenantId: ticketDto.tenantId,
          alertId: ticketDto.alertId,
          ticketNumber: ticketDto.ticketNumber,
          title: ticketDto.title,
          description: ticketDto.description,
          priority: ticketDto.priority as Ticket['priority'],
          status: ticketDto.status as Ticket['status'],
          category: ticketDto.category,
          assignedToName: ticketDto.assignedToName,
          createdByName: ticketDto.createdByName,
          createdAt: ticketDto.createdAt,
          updatedAt: ticketDto.updatedAt,
          dueDate: ticketDto.dueDate,
          resolvedAt: ticketDto.resolvedAt,
          closedAt: ticketDto.closedAt,
          comments: ticketDto.comments,
        };
        console.log('[SignalR] TicketCreated:', ticket.ticketNumber);
        callbacks.onTicketCreated?.(ticket);
      });

      // ── TicketUpdated ───────────────────────────────────────────────
      connection.on('TicketUpdated', (ticketDto: any) => {
        const ticket: Ticket = {
          id: ticketDto.id,
          tenantId: ticketDto.tenantId,
          alertId: ticketDto.alertId,
          ticketNumber: ticketDto.ticketNumber,
          title: ticketDto.title,
          description: ticketDto.description,
          priority: ticketDto.priority as Ticket['priority'],
          status: ticketDto.status as Ticket['status'],
          category: ticketDto.category,
          assignedToName: ticketDto.assignedToName,
          createdByName: ticketDto.createdByName,
          createdAt: ticketDto.createdAt,
          updatedAt: ticketDto.updatedAt,
          dueDate: ticketDto.dueDate,
          resolvedAt: ticketDto.resolvedAt,
          closedAt: ticketDto.closedAt,
          comments: ticketDto.comments,
        };
        console.log('[SignalR] TicketUpdated:', ticket.ticketNumber);
        callbacks.onTicketUpdated?.(ticket);
      });

      // ── ServerStatusChanged ────────────────────────────────────────
      connection.on('ServerStatusChanged', (serverId: string, status: string) => {
        console.log('[SignalR] ServerStatusChanged:', serverId, status);
        callbacks.onServerStatusChanged?.(serverId, status);
      });

      // ── NotificationReceived ───────────────────────────────────────
      connection.on('NotificationReceived', (notifDto: any) => {
        const notification: Notification = {
          id: notifDto.id,
          title: notifDto.title,
          message: notifDto.message,
          type: notifDto.type,
          isRead: notifDto.isRead,
          link: notifDto.link,
          createdAt: notifDto.createdAt,
        };
        console.log('[SignalR] NotificationReceived:', notification.title);
        callbacks.onNotification?.(notification);
      });

      // ── Start connection ──────────────────────────────────────────
      connection.onclose = () => {
        console.log('[SignalR] Connection closed, will auto-reconnect...');
      };

      connection.onreconnecting = (err) => {
        console.warn('[SignalR] Reconnecting...', err);
      };

      connection.onreconnected = (connectionId) => {
        console.log('[SignalR] Reconnected:', connectionId);
        // Re-join tenant group after reconnect
        const user = getStoredUser();
        if (user?.tenantId) {
          connection?.invoke('JoinTenantGroup', user.tenantId).catch(console.error);
        }
      };

      connection.start()
        .then(() => {
          console.log('[SignalR] ✅ Connected to CyberMonitor Hub');
          // Join tenant group so we receive tenant-specific events
          const user = getStoredUser();
          if (user?.tenantId) {
            connection?.invoke('JoinTenantGroup', user.tenantId).catch(console.error);
          }
        })
        .catch((err) => {
          console.error('[SignalR] ❌ Failed to connect:', err);
          // Retry after 5s
          reconnectTimer = setTimeout(connect, 5000);
        });

    } catch (e) {
      console.error('[SignalR] Init error:', e);
    }
  };

  const disconnect = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (connection) {
      connection.stop().catch(console.error);
      connection = null;
    }
  };

  return { connect, disconnect };
}

// ============================================================================
// DEFENSE API (IP Blocking Management)
// ============================================================================

export interface BlockedIP {
  id: string;
  ipAddress: string;
  attackType: string;
  severity: string;
  reason: string;
  blockedBy: string;
  blockedAt: string;
  expiresAt: string | null;
  isActive: boolean;
  unblockedAt: string | null;
  unblockedBy: string | null;
}

export const DefenseApi = {
  // GET /api/defense/blocked-ips
  getBlockedIPs: async (page = 1, pageSize = 20, activeOnly = true) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      activeOnly: String(activeOnly),
    });
    return request<PagedResult<BlockedIP>>('GET', `/api/defense/blocked-ips?${params}`);
  },

  // POST /api/defense/block-ip
  blockIP: async (data: {
    ip: string;
    attackType?: string;
    severity?: string;
    reason?: string;
    blockedBy?: string;
    targetAsset?: string;
    blockDurationMinutes?: number;
  }) => {
    return request('POST', '/api/defense/block-ip', data);
  },

  // POST /api/defense/unblock-ip
  unblockIP: async (ip: string, unblockedBy?: string) => {
    return request('POST', '/api/defense/unblock-ip', { ip, unblockedBy });
  },

  // POST /api/defense/manual-block
  manualBlock: async (data: {
    ip: string;
    reason?: string;
    severity?: string;
    durationMinutes?: number;
  }) => {
    return request('POST', '/api/defense/manual-block', data);
  },

  // GET /api/defense/check/{ip}
  checkIP: async (ip: string) => {
    return request<{ ipAddress: string; isBlocked: boolean; blockedAt: string | null; expiresAt: string | null; reason: string | null; attackType: string | null }>(
      'GET', `/api/defense/check/${encodeURIComponent(ip)}`
    );
  },

  // GET /api/defense/rate-limit-status
  getRateLimitStatus: async () => {
    return request<{
      blocksLastMinute: number;
      blocksLastHour: number;
      activeBlocks: number;
      minuteLimit: number;
      hourlyLimit: number;
    }>('GET', '/api/defense/rate-limit-status');
  },
};
