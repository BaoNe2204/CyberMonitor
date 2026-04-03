import { Agent, Alert, Notification, ApiKey } from '../types';

export const trafficData = [
  { time: '00:00', requests: 45, attacks: 2 },
  { time: '04:00', requests: 30, attacks: 1 },
  { time: '08:00', requests: 120, attacks: 5 },
  { time: '12:00', requests: 250, attacks: 12 },
  { time: '16:00', requests: 180, attacks: 8 },
  { time: '20:00', requests: 90, attacks: 3 },
  { time: '23:59', requests: 60, attacks: 2 },
];

export const attackTypes = [
  { name: 'SQL Injection', value: 40, color: '#ef4444' },
  { name: 'XSS', value: 25, color: '#f97316' },
  { name: 'DDoS', value: 20, color: '#3b82f6' },
  { name: 'Brute Force', value: 15, color: '#8b5cf6' },
];

export const agents: Agent[] = [
  { id: 'srv-001', name: 'Web-Server-Alpha', ip: '192.168.1.10', status: 'online', cpu: 45, ram: 62, lastSeen: '2s ago' },
  { id: 'srv-002', name: 'DB-Node-Primary', ip: '192.168.1.20', status: 'online', cpu: 12, ram: 85, lastSeen: '5s ago' },
  { id: 'srv-003', name: 'API-Gateway-01', ip: '10.0.0.5', status: 'offline', cpu: 0, ram: 0, lastSeen: '15m ago' },
];

export const recentAlerts: Alert[] = [
  { id: 1, type: 'CRITICAL', message: 'SQL Injection Attempt Detected', target: 'srv-001', time: '2m ago', mitre: 'T1190' },
  { id: 2, type: 'WARNING', message: 'High CPU Usage on DB Node', target: 'srv-002', time: '5m ago', mitre: 'N/A' },
  { id: 3, type: 'INFO', message: 'New Agent Connected', target: 'srv-004', time: '12m ago', mitre: 'N/A' },
  { id: 4, type: 'CRITICAL', message: 'DDoS Anomaly Detected (AI)', target: 'srv-001', time: '15m ago', mitre: 'T1498' },
];

export const initialNotifications: Notification[] = [
  { id: 1, title: 'New Threat Blocked', desc: 'SQL Injection attempt from 192.168.1.50', time: '2m ago', read: false },
  { id: 2, title: 'System Update', desc: 'Security patches applied to Node-Alpha', time: '1h ago', read: true },
  { id: 3, title: 'Agent Offline', desc: 'API-Gateway-01 lost connection', time: '3h ago', read: false },
];

export const initialApiKeys: ApiKey[] = [
  { id: 1, name: 'Production API', key: 'cg_live_********************4a2b', created: '2024-03-15' },
  { id: 2, name: 'Development Key', key: 'cg_test_********************9f1e', created: '2024-03-20' },
];
