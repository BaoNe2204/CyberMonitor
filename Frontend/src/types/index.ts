export type Theme = 'dark' | 'light';
export type Language = 'en' | 'vi';
export type AuthMode = 'login' | 'register';
export type UserRole = 'user' | 'superAdmin';

export interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: UserRole;
}

export interface Agent {
  id: string;
  name: string;
  ip: string;
  status: 'online' | 'offline';
  cpu: number;
  ram: number;
  lastSeen: string;
}

export interface Alert {
  id: number;
  type: string;
  message: string;
  target: string;
  time: string;
  mitre: string;
}

export interface Notification {
  id: number;
  title: string;
  desc: string;
  time: string;
  read: boolean;
}

export interface ApiKey {
  id: number;
  name: string;
  key: string;
  created: string;
}
