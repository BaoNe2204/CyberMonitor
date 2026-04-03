// ============================================================
// CyberMonitor - Core Types
// ============================================================

export type Theme = 'dark' | 'light';
export type Language = 'vi' | 'en';
export type AuthMode = 'login' | 'register';

// --- User & Auth ---
export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'superAdmin' | 'admin' | 'user';
  tenantId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
  avatar?: string;
  phone?: string;
  companyName?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  expiresAt: string;
}

// --- Agent / Server ---
export interface Agent {
  id: string;
  name: string;
  ip: string;
  status: 'online' | 'offline' | 'warning';
  cpu: number;
  ram: number;
  diskUsage: number;
  os: string;
  lastSeen: string;
  version?: string;
  tenantId?: string;
  apiKey?: string;
}

// --- Alert / Incident ---
export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Warning' | 'Low' | 'Info';
  alertType: string;
  sourceIp: string;
  targetAsset: string;
  serverName?: string;
  mitreTechnique?: string;
  mitreTactic?: string;
  status: 'open' | 'acknowledged' | 'resolved' | 'closed';
  isRead: boolean;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  assignee?: string;
  notes?: string;
  tenantId?: string;
}

// --- Ticket ---
export interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'open' | 'inProgress' | 'resolved' | 'closed';
  category: string;
  createdBy: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  tenantId?: string;
}

// --- API Key ---
export interface ApiKey {
  id: string;
  name: string;
  key: string;
  plainApiKey?: string;
  created: string;
  expiresAt?: string;
  lastUsed?: string;
  tenantId?: string;
}

/** Modal hiển thị API key (tạo mới / xem / tái tạo) */
export interface ServerKeyModalState {
  serverId: string;
  serverName: string;
  plainApiKey: string | null;
  keyPrefix?: string;
}

// --- Notification ---
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  isRead: boolean;
  createdAt: string;
  link?: string;
}

// --- Report ---
export interface Report {
  id: string;
  title: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  format: 'pdf' | 'excel' | 'csv';
  status: 'generating' | 'ready' | 'failed';
  downloadUrl?: string;
  createdAt: string;
  tenantId?: string;
}

// --- Dashboard Summary ---
export interface DashboardSummary {
  totalRequests: number;
  threatsBlocked: number;
  activeAgents: number;
  avgResponse: string;
  totalAlerts: number;
  openAlerts: number;
  criticalAlerts: number;
  totalTickets: number;
  openTickets: number;
  closedTicketsToday: number;
  currentBandwidthIn: number;
  currentBandwidthOut: number;
  recentAlerts: Alert[];
  serverHealth: Agent[];
}

// --- Traffic Data Point ---
export interface TrafficDataPoint {
  time: string;
  requests: number;
  attacks: number;
}

// --- Attack Type (for pie chart) ---
export interface AttackType {
  name: string;
  value: number;
  color: string;
}

// --- Pricing Plan ---
export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  features: string[];
  agentLimit: number;
  isPopular?: boolean;
  stripePriceId?: string;
}

// --- MITRE ATT&CK ---
export interface MitreTechnique {
  id: string;
  name: string;
  tactic: string;
  description: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  killChainPhase: string;
  indicators?: string[];
 Mitigations?: string[];
  examples?: string[];
}
