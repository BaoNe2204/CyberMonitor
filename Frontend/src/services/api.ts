/**
 * CyberMonitor API Client - Enhanced v2
 * Kết nối tất cả API calls đến ASP.NET Backend
 * 
 * Tính năng:
 * - Smart cache với TTL
 * - Request deduplication (tránh gọi trùng)
 * - Parallel fetch với concurrency limit
 * - Automatic retry với exponential backoff
 */

import type { DashboardSummary } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ============================================================================
// ADVANCED CACHE - LRU Cache với TTL
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
  tags: string[]; // for cache invalidation
}

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize = 100, defaultTtl = 10000) {
    this.maxSize = maxSize;
    this.ttl = defaultTtl;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  set(key: string, data: T, ttl?: number, tags: string[] = []): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.ttl,
      tags,
    });
  }

  invalidate(pattern?: string, tags?: string[]): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) this.cache.delete(key);
      }
    }
    if (tags) {
      for (const [key, entry] of this.cache.entries()) {
        if (entry.tags.some(t => tags.includes(t))) {
          this.cache.delete(key);
        }
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// Named caches for different data types
const statsCache = new LRUCache<any>(100, 20000);  // 20s TTL
const alertsCache = new LRUCache<any>(100, 15000); // 15s TTL
const serversCache = new LRUCache<any>(100, 30000); // 30s TTL
const blockedIPsCache = new LRUCache<any>(100, 10000); // 10s TTL

export function invalidateCaches(tags?: string[]): void {
  statsCache.invalidate(undefined, tags);
  alertsCache.invalidate(undefined, tags);
  serversCache.invalidate(undefined, tags);
  blockedIPsCache.invalidate(undefined, tags);
}

// ============================================================================
// REQUEST DEDUPLICATION
// ============================================================================

const inFlightRequests = new Map<string, Promise<any>>();

function dedupeRequest<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) {
    console.debug(`[API] Reusing in-flight request: ${key}`);
    return existing as Promise<T>;
  }

  const promise = factory().finally(() => {
    inFlightRequests.delete(key);
  });

  inFlightRequests.set(key, promise);
  return promise as Promise<T>;
}

// ============================================================================
// ADVANCED FETCH - Retry + Backoff + Concurrency
// ============================================================================

async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  retries = 2,
  backoff = 300
): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let data: any = {};
    
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    return { ok: response.ok, status: response.status, data };
  } catch (error: any) {
    if (retries <= 0) {
      throw error;
    }
    await new Promise(r => setTimeout(r, backoff));
    return fetchWithRetry<T>(url, options, retries - 1, backoff * 2);
  }
}

// Fetch multiple endpoints with concurrency limit
async function parallelFetch(
  requests: Array<{ endpoint: string; method?: string; body?: any }>,
  concurrency = 4,
  token?: string
): Promise<Record<string, { ok: boolean; status: number; data: any }>> {
  const results: Record<string, { ok: boolean; status: number; data: any }> = {};
  const queue = [...requests];
  const executing: Promise<void>[] = [];

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };

  const runTask = async (req: typeof requests[0]): Promise<void> => {
    const url = `${API_BASE_URL}${req.endpoint}`;
    const options: RequestInit = {
      method: req.method || 'GET',
      headers: defaultHeaders,
      ...(req.body ? { body: JSON.stringify(req.body) } : {}),
    };

    try {
      const result = await fetchWithRetry(url, options);
      results[req.endpoint] = result;
    } catch (err: any) {
      results[req.endpoint] = {
        ok: false,
        status: 0,
        data: { message: err.message || 'Network error' },
      };
    }
  };

  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency);
    await Promise.allSettled(batch.map(task => runTask(task)));
  }

  return results;
}

// ============================================================================
// CACHED REQUEST HELPERS
// ============================================================================

async function cachedRequest<T>(
  key: string,
  endpoint: string,
  cache: LRUCache<T>,
  ttl?: number,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  // Check cache first
  const cached = cache.get(key);
  if (cached) {
    return { success: true, message: 'Cached', data: cached as T };
  }

  // Make request
  const result = await request<T>(endpoint, undefined, options);

  // Cache successful response
  if (result.success && result.data) {
    cache.set(key, result.data, ttl);
  }

  return result;
}

// ============================================================================
// ENHANCED API FUNCTIONS
// ============================================================================

/**
 * Fetch dashboard data from multiple endpoints in parallel
 * Uses Web Worker for non-blocking fetch
 */
export async function fetchDashboardParallel(
  token?: string,
  useWorker = true
): Promise<{
  dashboard: any;
  alerts: any[];
  servers: any[];
  blockedIPs: any[];
  errors: Record<string, any>;
}> {
  const results = await parallelFetch([
    { endpoint: '/api/dashboard' },
    { endpoint: '/api/alerts?page=1&pageSize=20' },
    { endpoint: '/api/servers?page=1&pageSize=50' },
    { endpoint: '/api/defense/blocked-ips?page=1&pageSize=20&active=true' },
  ], 4, token);

  const errors: Record<string, any> = {};
  for (const [endpoint, result] of Object.entries(results)) {
    if (!result.ok) {
      errors[endpoint] = result.data?.message || `HTTP ${result.status}`;
    }
  }

  const dashboardData = results['/api/dashboard']?.data?.data || {};
  const alerts = results['/api/alerts']?.data?.data?.items || [];
  const servers = results['/api/servers']?.data?.data?.items || [];
  const blockedIPs = results['/api/defense/blocked-ips']?.data?.data?.items || [];

  return {
    dashboard: dashboardData,
    alerts,
    servers,
    blockedIPs,
    errors,
  };
}

/**
 * Preload critical data in background
 */
export function preloadDashboardData(token?: string): void {
  // Non-blocking preload - data will be fetched but we don't wait
  fetchDashboardParallel(token).catch(err => {
    console.warn('[Preload] Dashboard fetch failed:', err);
  });
}

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
  sessionTimeoutEnabled?: boolean;
  sessionTimeoutMinutes?: number;
  emailAlertsEnabled?: boolean;
  telegramAlertsEnabled?: boolean;
  pushNotificationsEnabled?: boolean;
  telegramChatId?: string | null;
  alertSeverityThreshold?: string;
  alertDigestMode?: string;
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

export interface ServerAlertEmail {
  id: string;
  serverId: string;
  email: string;
  isActive: boolean;
  createdAt: string;
}

export interface ServerTelegramRecipient {
  id: string;
  serverId: string;
  chatId: string;
  displayName: string | null;
  isActive: boolean;
  createdAt: string;
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
// HTTP CLIENT - Enhanced v2
// ============================================================================

async function request<T>(
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

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      method: options.method || (body ? 'POST' : 'GET'),
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
      ...options,
    });

    // Auto-logout on 401 — token expired or invalid
    if (response.status === 401) {
      clearAuth();
      window.dispatchEvent(new CustomEvent('cm:auth:expired'));
      return {
        success: false,
        message: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.',
        data: null,
      };
    }

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
    console.error(`API Error [${options.method || 'GET'} ${endpoint}]:`, error);
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
    const res = await request<AuthResponse>('/api/auth/login', { email, password }, { method: 'POST' });
    if (res.success && res.data) {
      setToken(res.data.token);
      setStoredUser(res.data.user);
    }
    return res;
  },

  register: async (companyName: string, email: string, password: string): Promise<ApiResponse<AuthResponse>> => {
    const res = await request<AuthResponse>('/api/auth/register', {
      companyName,
      email,
      password,
    }, { method: 'POST' });
    if (res.success && res.data) {
      setToken(res.data.token);
      setStoredUser(res.data.user);
    }
    return res;
  },

  getMe: async (): Promise<ApiResponse<User>> => {
    return request<User>('/api/auth/me');
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    return request('/api/auth/change-password', { currentPassword, newPassword }, { method: 'POST' });
  },

  updateProfile: async (userId: string, data: { fullName?: string }) => {
    const res = await request<User>(`/api/auth/users/${userId}`, data, { method: 'PUT' });
    if (res.success && res.data) {
      setStoredUser(res.data);
    }
    return res;
  },

  updateNotificationSettings: async (data: {
    emailAlertsEnabled: boolean;
    telegramAlertsEnabled: boolean;
    pushNotificationsEnabled: boolean;
    telegramChatId?: string | null;
    alertSeverityThreshold?: string;
    alertDigestMode?: string;
  }): Promise<ApiResponse<User>> => {
    const userId = getStoredUser()?.id;
    const res = await request<User>(`/api/users/${userId}/notification-settings`, data, { method: 'PUT' });
    if (res.success && res.data) {
      setStoredUser(res.data);
    }
    return res;
  },

  updateSecuritySettings: async (data: {
    twoFactorEnabled: boolean;
    sessionTimeoutEnabled: boolean;
    sessionTimeoutMinutes: number;
  }): Promise<ApiResponse<User>> => {
    const userId = getStoredUser()?.id;
    const res = await request<User>(`/api/users/${userId}/security-settings`, data, { method: 'PUT' });
    if (res.success && res.data) {
      setStoredUser(res.data);
    }
    return res;
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
    return request<PagedResult<Server>>(`/api/servers?${params}`);
  },

  getOne: async (id: string): Promise<ApiResponse<Server>> => {
    return request<Server>(`/api/servers/${id}`);
  },

  add: async (name: string, ipAddress: string, tenantId: string | null | undefined, createdBy: string) => {
    const body: Record<string, unknown> = { name, ipAddress, createdBy };
    if (tenantId && tenantId.trim() !== '') body.tenantId = tenantId;
    return request<ApiKeyGenerated>('/api/servers/add', body, { method: 'POST' });
  },

  update: async (id: string, data: { name?: string; status?: string }, updatedBy: string) => {
    return request(`/api/servers/${id}`, { ...data, updatedBy }, { method: 'PUT' });
  },

  delete: async (id: string) => {
    return request(`/api/servers/${id}`, undefined, { method: 'DELETE' });
  },

  regenerateKey: async (id: string): Promise<ApiResponse<ApiKeyGenerated>> => {
    return request<ApiKeyGenerated>(`/api/servers/${id}/regenerate-key`, undefined, { method: 'POST' });
  },

  getServerKey: async (serverId: string) => {
    return request<ServerKeyLookup>(`/api/servers/${serverId}/key`);
  },

  // Alert Email Management
  getAlertEmails: async (serverId: string) => {
    return request<ServerAlertEmail[]>(`/api/servers/${serverId}/alert-emails`);
  },

  addAlertEmail: async (serverId: string, email: string) => {
    return request<ServerAlertEmail>(`/api/servers/${serverId}/alert-emails`, { email }, { method: 'POST' });
  },

  deleteAlertEmail: async (serverId: string, emailId: string) => {
    return request(`/api/servers/${serverId}/alert-emails/${emailId}`, undefined, { method: 'DELETE' });
  },

  toggleAlertEmail: async (serverId: string, emailId: string) => {
    return request<ServerAlertEmail>(`/api/servers/${serverId}/alert-emails/${emailId}/toggle`, undefined, { method: 'PUT' });
  },

  // Telegram recipient management
  getTelegramRecipients: async (serverId: string) => {
    return request<ServerTelegramRecipient[]>(`/api/servers/${serverId}/telegram-recipients`);
  },

  addTelegramRecipient: async (serverId: string, chatId: string, displayName?: string) => {
    return request<ServerTelegramRecipient>(
      `/api/servers/${serverId}/telegram-recipients`,
      { chatId, displayName },
      { method: 'POST' }
    );
  },

  deleteTelegramRecipient: async (serverId: string, recipientId: string) => {
    return request(`/api/servers/${serverId}/telegram-recipients/${recipientId}`, undefined, { method: 'DELETE' });
  },

  toggleTelegramRecipient: async (serverId: string, recipientId: string) => {
    return request<ServerTelegramRecipient>(
      `/api/servers/${serverId}/telegram-recipients/${recipientId}/toggle`,
      undefined,
      { method: 'PUT' }
    );
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
    return request<PagedResult<Alert>>(`/api/alerts?${params}`);
  },

  getOne: async (id: string): Promise<ApiResponse<Alert>> => {
    return request<Alert>(`/api/alerts/${id}`);
  },

  updateStatus: async (id: string, status: string, updatedBy?: string) => {
    return request(`/api/alerts/${id}/status`, { alertId: id, status, updatedBy }, { method: 'PUT' });
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
    return request<PagedResult<Ticket>>(`/api/tickets?${params}`);
  },

  getOne: async (id: string): Promise<ApiResponse<Ticket>> => {
    return request<Ticket>(`/api/tickets/${id}`);
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
    return request<Ticket>('/api/tickets', data, { method: 'POST' });
  },

  updateStatus: async (id: string, status: string, updatedBy: string, comment?: string) => {
    return request<Ticket>(`/api/tickets/${id}/status`, {
      ticketId: id,
      status,
      updatedBy,
      comment,
    }, { method: 'PUT' });
  },

  assign: async (id: string, assignedTo: string | null, assignedBy: string, comment?: string) => {
    return request<Ticket>(`/api/tickets/${id}/assign`, {
      ticketId: id,
      assignedTo,
      assignedBy,
      comment,
    }, { method: 'PUT' });
  },

  addComment: async (id: string, userId: string, content: string, isInternal = false) => {
    return request<TicketComment>(`/api/tickets/${id}/comments`, {
      ticketId: id,
      userId,
      content,
      isInternal,
    }, { method: 'POST' });
  },
};

// ============================================================================
// SUBSCRIPTIONS API
// ============================================================================

export const SubscriptionsApi = {
  get: async (): Promise<ApiResponse<Subscription>> => {
    return request<Subscription>('/api/subscriptions');
  },

  getHistory: async () => {
    return request<Subscription[]>('/api/subscriptions/history');
  },

  createTrial: async () => {
    return request<Subscription>('/api/subscriptions/trial', undefined, { method: 'POST' });
  },

  createPayment: async (tenantId: string, planName: string, amount: number) => {
    return request<{ orderId: string; paymentUrl: string }>('/api/subscriptions/create-payment', {
      tenantId,
      planName,
      amount,
    }, { method: 'POST' });
  },
};

// ============================================================================
// PRICING PLANS API
// ============================================================================

interface PricingPlanLimits {
  servers: number | 'unlimited';
  users: number | 'unlimited';
  storage: string;
  bandwidth: string;
  apiCalls: number | 'unlimited';
  dailyAlerts: number | 'unlimited';
  retention: string;
  concurrentConnections: number;
}

interface PricingPlanCapabilities {
  realTimeMonitoring: boolean;
  threatIntelligence: boolean;
  autoResponse: boolean;
  customRules: boolean;
  whiteLabel: boolean;
  prioritySupport: boolean;
  sla: string;
  backupFrequency: string;
  teamManagement: boolean;
  auditLogs: boolean;
  apiAccess: boolean;
  sso: boolean;
  customIntegrations: boolean;
  dedicatedSupport: boolean;
  slaCredits: boolean;
}

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  price: string;
  originalPrice: string;
  billingPeriod: string;
  isActive: boolean;
  isPopular: boolean;
  isEnterprise: boolean;
  isTrial: boolean;
  features: string[];
  limits: PricingPlanLimits;
  capabilities: PricingPlanCapabilities;
}

interface CreatePricingPlanDto {
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  billingPeriod: string;
  isActive: boolean;
  isPopular: boolean;
  isEnterprise: boolean;
  isTrial: boolean;
  features: string[];
  limits: {
    servers: number | 'unlimited';
    users: number | 'unlimited';
    storage: string;
    bandwidth: string;
    apiCalls: number | 'unlimited';
    dailyAlerts: number | 'unlimited';
    retention: string;
    concurrentConnections: number;
  };
  capabilities: PricingPlanCapabilities;
}

export const PricingPlansApi = {
  getAll: async (): Promise<ApiResponse<PricingPlan[]>> => {
    return request<PricingPlan[]>('/api/pricing-plans');
  },

  getById: async (id: string): Promise<ApiResponse<PricingPlan>> => {
    return request<PricingPlan>(`/api/pricing-plans/${id}`);
  },

  create: async (data: CreatePricingPlanDto): Promise<ApiResponse<PricingPlan>> => {
    return request<PricingPlan>('/api/pricing-plans', data, { method: 'POST' });
  },

  update: async (id: string, data: CreatePricingPlanDto): Promise<ApiResponse<PricingPlan>> => {
    return request<PricingPlan>(`/api/pricing-plans/${id}`, data, { method: 'PUT' });
  },

  delete: async (id: string): Promise<ApiResponse<null>> => {
    return request<null>(`/api/pricing-plans/${id}`, {}, { method: 'DELETE' });
  },

  duplicate: async (id: string): Promise<ApiResponse<PricingPlan>> => {
    return request<PricingPlan>(`/api/pricing-plans/${id}/duplicate`, {}, { method: 'POST' });
  },

  toggleActive: async (id: string): Promise<ApiResponse<PricingPlan>> => {
    return request<PricingPlan>(`/api/pricing-plans/${id}/toggle-active`, {}, { method: 'PUT' });
  },

  togglePopular: async (id: string): Promise<ApiResponse<PricingPlan>> => {
    return request<PricingPlan>(`/api/pricing-plans/${id}/toggle-popular`, {}, { method: 'PUT' });
  },
};

// ============================================================================
// PAYMENT API
// ============================================================================

export const PaymentApi = {
  createUrl: async (tenantId: string, planName: string, amount: number) => {
    return request<{ orderId: string; paymentUrl: string }>('/api/payment/create-url', {
      tenantId,
      planName,
      amount,
    }, { method: 'POST' });
  },

  getHistory: async () => {
    return request('/api/payment/history');
  },
};

// ============================================================================
// REPORTS API
// ============================================================================

export const ReportsApi = {
  getDashboard: async (): Promise<ApiResponse<DashboardSummary>> => {
    return request<DashboardSummary>('/api/dashboard');
  },

  getSubscription: async (): Promise<ApiResponse<Subscription>> => {
    return request<Subscription>('/api/subscriptions');
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
    return request<PagedResult<Notification>>(`/api/notifications?${params}`);
  },

  markNotificationRead: async (id: string) => {
    return request(`/api/notifications/${id}/read`, undefined, { method: 'PUT' });
  },

  getAuditLogs: async (page = 1, pageSize = 50, action?: string) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (action) params.append('action', action);
    return request(`/api/audit-logs?${params}`);
  },
};

// ============================================================================
// DASHBOARD API
// ============================================================================

export const DashboardApi = {
  getStats: async (): Promise<ApiResponse<DashboardSummary>> => {
    return request<DashboardSummary>('/api/dashboard');
  },

  getAlertStats: async (days = 7, serverId?: string) => {
    const params = new URLSearchParams({ days: String(days) });
    if (serverId) params.append('serverId', serverId);
    return request(`/api/dashboard/alert-stats?${params}`);
  },

  getTicketStats: async (days = 7) => {
    const params = new URLSearchParams({ days: String(days) });
    return request(`/api/dashboard/ticket-stats?${params}`);
  },

  getTopAttackers: async (top = 10, days = 30) => {
    const params = new URLSearchParams({ top: String(top), days: String(days) });
    return request(`/api/dashboard/top-attackers?${params}`);
  },
};

// ============================================================================
// USERS API (Admin)
// ============================================================================

export const UsersApi = {
  getAll: async (page = 1, pageSize = 20, search?: string) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) params.append('search', search);
    return request<PagedResult<User>>(`/api/users?${params}`);
  },

  create: async (data: {
    email: string;
    password: string;
    fullName: string;
    role: string;
    tenantId?: string;
  }): Promise<ApiResponse<User>> => {
    return request<User>('/api/users', data, { method: 'POST' });
  },

  update: async (id: string, data: {
    fullName?: string;
    role?: string;
    isActive?: boolean;
    updatedBy?: string;
  }): Promise<ApiResponse<User>> => {
    return request<User>(`/api/users/${id}`, data, { method: 'PUT' });
  },

  delete: async (id: string) => {
    return request(`/api/users/${id}`, undefined, { method: 'DELETE' });
  },

  changePassword: async (id: string, newPassword: string): Promise<ApiResponse<any>> => {
    return request(`/api/users/${id}/password`, { newPassword }, { method: 'PUT' });
  },

  toggleStatus: async (id: string, isActive: boolean): Promise<ApiResponse<User>> => {
    return request<User>(`/api/users/${id}`, { isActive }, { method: 'PUT' });
  },
};

// ============================================================================
// AUDIT LOGS API
// ============================================================================

export const AuditLogsApi = {
  getAll: async (page = 1, pageSize = 50, filters?: {
    action?: string;
    entityType?: string;
    userId?: string;
    fromDate?: string;
    toDate?: string;
  }) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (filters?.action) params.append('action', filters.action);
    if (filters?.entityType) params.append('entityType', filters.entityType);
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.fromDate) params.append('fromDate', filters.fromDate);
    if (filters?.toDate) params.append('toDate', filters.toDate);
    return request(`/api/audit-logs?${params}`);
  },

  getStats: async (days = 30) => {
    return request(`/api/audit-logs/stats?days=${days}`);
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
  onServerStatusChanged?: (serverId: string, status: string, cpu?: number, ram?: number, disk?: number) => void;
  onNotification?: (notification: Notification) => void;
  onBlockedIpChanged?: (blockedIp: BlockedIP) => void;
};

export function createSignalRConnection(callbacks: SignalRCallbacks): { connect: () => void; disconnect: () => void } {
  let connection: signalR.HubConnection | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let startPromise: Promise<void> | null = null;
  let isConnecting = false;
  let isActive = false;

  // Helper: safely check if connection is in a state where stop() is safe
  const isConnectedOrConnecting = () =>
    connection !== null &&
    (connection.state === signalR.HubConnectionState.Connected ||
     connection.state === signalR.HubConnectionState.Connecting ||
     connection.state === signalR.HubConnectionState.Reconnecting);

  const connect = () => {
    const token = getToken();
    if (!token) {
      console.warn('[SignalR] No token, skipping connection');
      return;
    }

    if (isConnecting || (connection && isConnectedOrConnecting())) {
      console.log('[SignalR] Already connecting or connected, skipping...');
      return;
    }

    try {
      isConnecting = true;
      isActive = true;
      connection = new signalR.HubConnectionBuilder()
        .withUrl(`${API_BASE_URL}/hubs/alerts?access_token=${token}`, {
          skipNegotiation: true,
          transport: signalR.HttpTransportType.WebSockets,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      connection.onclose = () => {
        console.log('[SignalR] Connection closed');
      };

      connection.onreconnecting = (err) => {
        console.warn('[SignalR] Reconnecting...', err);
      };

      connection.onreconnected = (connectionId) => {
        console.log('[SignalR] Reconnected:', connectionId);
        const user = getStoredUser();
        if (user?.tenantId) {
          connection?.invoke('JoinTenantGroup', user.tenantId).catch(console.error);
        }
      };

      // Register all event handlers BEFORE starting
      connection.on('ReceiveAlert', (alertDto: any) => {
        const alert: Alert = {
          id: alertDto.id, tenantId: alertDto.tenantId, serverId: alertDto.serverId,
          serverName: alertDto.serverName, severity: alertDto.severity as Alert['severity'],
          alertType: alertDto.alertType, title: alertDto.title, description: alertDto.description,
          sourceIp: alertDto.sourceIp, targetAsset: alertDto.targetAsset,
          mitreTactic: alertDto.mitreTactic, mitreTechnique: alertDto.mitreTechnique,
          status: alertDto.status as Alert['status'], anomalyScore: alertDto.anomalyScore,
          recommendedAction: alertDto.recommendedAction, createdAt: alertDto.createdAt,
          acknowledgedAt: alertDto.acknowledgedAt, resolvedAt: alertDto.resolvedAt,
          acknowledgedByName: alertDto.acknowledgedByName, resolvedByName: alertDto.resolvedByName,
        };
        console.log('[SignalR] ReceiveAlert:', alert.title);
        callbacks.onAlert?.(alert);
      });

      connection.on('AlertStatusChanged', (alertDto: any) => {
        const alert: Alert = {
          id: alertDto.id, tenantId: alertDto.tenantId, serverId: alertDto.serverId,
          serverName: alertDto.serverName, severity: alertDto.severity as Alert['severity'],
          alertType: alertDto.alertType, title: alertDto.title, description: alertDto.description,
          sourceIp: alertDto.sourceIp, targetAsset: alertDto.targetAsset,
          mitreTactic: alertDto.mitreTactic, mitreTechnique: alertDto.mitreTechnique,
          status: alertDto.status as Alert['status'], anomalyScore: alertDto.anomalyScore,
          recommendedAction: alertDto.recommendedAction, createdAt: alertDto.createdAt,
          acknowledgedAt: alertDto.acknowledgedAt, resolvedAt: alertDto.resolvedAt,
          acknowledgedByName: alertDto.acknowledgedByName, resolvedByName: alertDto.resolvedByName,
        };
        console.log('[SignalR] AlertStatusChanged:', alert.title);
        callbacks.onAlertStatusChanged?.(alert);
      });

      connection.on('TicketCreated', (ticketDto: any) => {
        const ticket: Ticket = {
          id: ticketDto.id, tenantId: ticketDto.tenantId, alertId: ticketDto.alertId,
          ticketNumber: ticketDto.ticketNumber, title: ticketDto.title, description: ticketDto.description,
          priority: ticketDto.priority as Ticket['priority'], status: ticketDto.status as Ticket['status'],
          category: ticketDto.category, assignedToName: ticketDto.assignedToName,
          createdByName: ticketDto.createdByName, createdAt: ticketDto.createdAt,
          updatedAt: ticketDto.updatedAt, dueDate: ticketDto.dueDate,
          resolvedAt: ticketDto.resolvedAt, closedAt: ticketDto.closedAt, comments: ticketDto.comments,
        };
        console.log('[SignalR] TicketCreated:', ticket.ticketNumber);
        callbacks.onTicketCreated?.(ticket);
      });

      connection.on('TicketUpdated', (ticketDto: any) => {
        const ticket: Ticket = {
          id: ticketDto.id, tenantId: ticketDto.tenantId, alertId: ticketDto.alertId,
          ticketNumber: ticketDto.ticketNumber, title: ticketDto.title, description: ticketDto.description,
          priority: ticketDto.priority as Ticket['priority'], status: ticketDto.status as Ticket['status'],
          category: ticketDto.category, assignedToName: ticketDto.assignedToName,
          createdByName: ticketDto.createdByName, createdAt: ticketDto.createdAt,
          updatedAt: ticketDto.updatedAt, dueDate: ticketDto.dueDate,
          resolvedAt: ticketDto.resolvedAt, closedAt: ticketDto.closedAt, comments: ticketDto.comments,
        };
        console.log('[SignalR] TicketUpdated:', ticket.ticketNumber);
        callbacks.onTicketUpdated?.(ticket);
      });

      connection.on('ServerStatusChanged', (serverId: string, status: string, cpu?: number, ram?: number, disk?: number) => {
        console.log('[SignalR] ServerStatusChanged:', serverId, status, cpu, ram);
        callbacks.onServerStatusChanged?.(serverId, status, cpu, ram, disk);
      });

      connection.on('NotificationReceived', (notifDto: any) => {
        const notification: Notification = {
          id: notifDto.id, title: notifDto.title, message: notifDto.message,
          type: notifDto.type, isRead: notifDto.isRead, link: notifDto.link, createdAt: notifDto.createdAt,
        };
        console.log('[SignalR] NotificationReceived:', notification.title);
        callbacks.onNotification?.(notification);
      });

      // Store the start promise so disconnect() can await it
      startPromise = connection.start()
        .then(() => {
          isConnecting = false;
          if (!isActive) {
            connection?.stop().catch(() => {});
            return;
          }
          console.log('[SignalR] Connected to CyberMonitor Hub');
          const user = getStoredUser();
          if (user?.tenantId) {
            connection?.invoke('JoinTenantGroup', user.tenantId).catch(console.error);
          }
        })
        .catch((err) => {
          isConnecting = false;
          // Ignore "connection stopped" errors when intentionally disconnected
          if (!isActive) return;
          const msg = err?.message || String(err);
          if (msg.includes('stop()') || msg.includes(' aborted')) {
            console.log('[SignalR] Connection intentionally stopped');
            return;
          }
          console.warn('[SignalR] Failed to connect:', msg);
          if (isActive) {
            reconnectTimer = setTimeout(connect, 5000);
          }
        });
    } catch (e) {
      isConnecting = false;
      isActive = false;
      console.error('[SignalR] Init error:', e);
    }
  };

  const disconnect = () => {
    isActive = false;
    isConnecting = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (!connection) return;

    const conn = connection;
    connection = null;

    // Wait for any in-flight start() to settle before stopping.
    // This prevents "Failed to start before stop() was called".
    Promise.resolve(startPromise)
      .catch(() => {})
      .then(() => {
        // Only stop if still in a state that makes sense to stop
        if (conn.state === signalR.HubConnectionState.Disconnected) {
          conn.stop().catch(() => {});
        } else {
          conn.stop().catch(() => {});
        }
      });
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
  anomalyScore?: number | null;
  serverId?: string | null;
  serverName?: string | null;
}

export const DefenseApi = {
  // GET /api/defense/blocked-ips
  getBlockedIPs: async (page = 1, pageSize = 20, activeOnly = true) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      activeOnly: String(activeOnly),
    });
    return request<PagedResult<BlockedIP>>(`/api/defense/blocked-ips?${params}`);
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
    return request('/api/defense/block-ip', data, { method: 'POST' });
  },

  // POST /api/defense/unblock-ip
  unblockIP: async (ip: string, unblockedBy?: string) => {
    return request('/api/defense/unblock-ip', { ip, unblockedBy }, { method: 'POST' });
  },

  // POST /api/defense/manual-block
  manualBlock: async (data: {
    ip: string;
    reason?: string;
    severity?: string;
    durationMinutes?: number;
    serverId?: string | null;  // If specified, block only on this server. If null/undefined, block on all servers
  }) => {
    return request('/api/defense/manual-block', data, { method: 'POST' });
  },

  // GET /api/defense/check/{ip}
  checkIP: async (ip: string) => {
    return request<{ ipAddress: string; isBlocked: boolean; blockedAt: string | null; expiresAt: string | null; reason: string | null; attackType: string | null }>(
      `/api/defense/check/${encodeURIComponent(ip)}`
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
    }>('/api/defense/rate-limit-status');
  },
};

// ============================================================================
// NOTIFICATIONS API
// ============================================================================

export interface NotificationPage {
  items: Notification[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const NotificationsApi = {
  // GET /api/notifications
  getNotifications: async (page = 1, pageSize = 20, isRead?: boolean, type?: string) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (isRead !== undefined) params.set('isRead', String(isRead));
    if (type) params.set('type', type);

    const res = await request<NotificationPage>(`/api/notifications?${params}`);
    return res.success ? res.data : null;
  },

  // GET /api/notifications/unread-count
  getUnreadCount: async (): Promise<number> => {
    const res = await request<{ count: number }>('/api/notifications/unread-count');
    return res.success ? (res.data?.count ?? 0) : 0;
  },

  // PUT /api/notifications/{id}/read
  markAsRead: async (id: string): Promise<void> => {
    await request(`/api/notifications/${id}/read`, undefined, { method: 'PUT' });
  },

  // PUT /api/notifications/read-all
  markAllAsRead: async (): Promise<void> => {
    await request('/api/notifications/read-all', undefined, { method: 'PUT' });
  },

  // DELETE /api/notifications/{id}
  deleteNotification: async (id: string): Promise<void> => {
    await request(`/api/notifications/${id}`, undefined, { method: 'DELETE' });
  },

  // DELETE /api/notifications/clear-read
  clearRead: async (): Promise<void> => {
    await request('/api/notifications/clear-read', undefined, { method: 'DELETE' });
  },
};
