// ============================================================
// CyberMonitor - Core Types
// ============================================================

export type Theme = 'dark' | 'light';
export type Language = 'vi' | 'en';
export type AuthMode = 'login' | 'register';

// --- User & Auth - Import from api.ts to avoid duplication ---
// User, Alert, Ticket, Notification types are defined in api.ts

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
  tenantId: string;
  userId: string;
  title: string;
  message: string;
  type: 'Alert' | 'Warning' | 'Ticket' | 'Info';
  isRead: boolean;
  link?: string;
  createdAt: string;
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
  trafficData?: TrafficDataPoint[];
  attackTypes?: AttackType[];
  mitreData?: MitreItem[];
  aiStats?: AIStats;
  predictions?: Prediction[];
}

// --- AI Engine Stats ---
export interface AIStats {
  anomalyScore: number;
  threshold: number;
  totalAlerts: number;
  engine: string;
}

export interface Prediction {
  risk: 'Critical' | 'High' | 'Medium' | 'Low';
  confidence: number;
  message: string;
  description?: string;
}

export interface MitreItem {
  technique: string;
  name: string;
  count: number;
  risk: 'Critical' | 'High' | 'Medium' | 'Low';
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
