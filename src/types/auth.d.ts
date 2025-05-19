// src/types/auth.d.ts
export interface Session {
  id: string;
  userId: string;
  createdAt: number; // Unix timestamp in seconds
  expiresAt: number; // Unix timestamp in seconds
  data?: Record<string, unknown>; // For arbitrary session data
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role: string; // e.g., 'user', 'admin'
  createdAt: number; // Unix timestamp in seconds
  updatedAt: number; // Unix timestamp in seconds
  verifiedAt?: number; // Unix timestamp in seconds, if email is verified
  imageUrl?: string;
}
export interface AuthAccount {
  providerId: string;
  providerUserId: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
}

export interface VerificationToken {
  identifier: string;
  token: string;
  expiresAt: number;
  createdAt: number;
}

export interface ActivityLog {
  id?: number; // Assuming auto-increment in DB
  userId?: string;
  action: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}