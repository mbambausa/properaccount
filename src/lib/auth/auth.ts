// src/lib/auth/auth.ts
/**
 * Authentication Service
 * This module provides core authentication functionality for user management,
 * including registration, login, password management, and session handling.
 */

import { z } from 'zod';
import {
  registerUserSchema,
  loginSchema,
  resetPasswordRequestSchema,
  resetPasswordConfirmSchema,
  changePasswordSchema,
  updateProfileSchema,
} from '../validation/schemas/auth';
import { createSession, deleteSession, getSession, extendSession } from './session';
import type { User, Session } // Assuming types/auth.d.ts is at src/types/auth.d.ts
// Removed UserRole import as it's not directly used here, User type has it.
  from '@/types/auth';
import * as d1Helpers from '../cloudflare/d1';
import type { CloudflareEnv } from '@/env';
import { hashPassword as argon2Hash, verifyPassword as argon2Verify } from './passwordUtils';

// Interface for the raw user record directly from the database
// Should mirror DbUser from cloudflare/d1/schema.ts which mirrors SQL
interface DbUserRecord {
  id: string;
  email: string;
  name: string | null;
  password_hash: string | null; // Matches SQL 'password_hash TEXT' (nullable)
  role: string;
  created_at: number; // Unix timestamp (seconds)
  updated_at: number; // Unix timestamp (seconds)
  verified_at: number | null; // Matches SQL 'verified_at INTEGER' (nullable)
  image_url: string | null;
}

// Generate a secure random token (browser/worker compatible)
export function generateToken(length = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string): Promise<string> {
  return argon2Hash(password);
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return argon2Verify(storedHash, password);
}

export async function registerUser(
  env: CloudflareEnv,
  userData: unknown
): Promise<{ success: boolean; user?: User; error?: string; errors?: z.ZodIssue[] }> {
  try {
    const validationResult = registerUserSchema.safeParse(userData);
    if (!validationResult.success) {
      return { success: false, error: "Validation failed", errors: validationResult.error.errors };
    }
    const validatedData = validationResult.data;

    const db = env.DATABASE;
    if (!db) throw new Error("DATABASE binding not found in environment.");

    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?')
      .bind(validatedData.email.toLowerCase())
      .first<{ id: string }>();

    if (existingUser) {
      return { success: false, error: 'A user with this email already exists' };
    }

    const passwordHash = await hashPassword(validatedData.password);
    const userId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    const userToInsert: Omit<DbUserRecord, 'id' | 'created_at' | 'updated_at' | 'verified_at' | 'image_url' | 'role'> & Partial<DbUserRecord> = {
      email: validatedData.email.toLowerCase(),
      name: validatedData.name,
      password_hash: passwordHash,
    };
    // D1 insert helper likely handles id, created_at, updated_at, defaults.
    // Or be explicit:
    const fullUserToInsert: DbUserRecord = {
        id: userId,
        email: validatedData.email.toLowerCase(),
        name: validatedData.name,
        password_hash: passwordHash,
        role: 'user', // Default role
        created_at: now,
        updated_at: now,
        verified_at: null,
        image_url: null,
    };

    await d1Helpers.insert(db, 'users', fullUserToInsert);

    const verificationTokenValue = generateToken();
    await d1Helpers.insert(db, 'verification_tokens', {
      identifier: validatedData.email.toLowerCase(),
      token: verificationTokenValue,
      expires_at: now + (24 * 60 * 60), // 24 hours
      created_at: now,
      type: 'EMAIL_VERIFICATION', // Requires 'type' column in verification_tokens table
    });

    console.log(`TODO: Send verification email to ${validatedData.email} with token: ${verificationTokenValue}`);

    const registeredUser: User = {
      id: userId,
      email: fullUserToInsert.email,
      name: fullUserToInsert.name ?? undefined,
      role: fullUserToInsert.role as User['role'],
      createdAt: fullUserToInsert.created_at,
      updatedAt: fullUserToInsert.updated_at,
      emailVerifiedAt: fullUserToInsert.verified_at ?? undefined,
      imageUrl: fullUserToInsert.image_url ?? undefined,
    };

    return { success: true, user: registeredUser };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid data provided.", errors: error.errors };
    }
    console.error('Error registering user:', error);
    return { success: false, error: 'An unexpected error occurred during registration.' };
  }
}

export async function loginUser(
  env: CloudflareEnv,
  loginData: unknown,
  // Optional request context for IP/UserAgent, if available and desired
  requestInfo?: { ip?: string; userAgent?: string; }
): Promise<{ success: boolean; user?: User; sessionId?: string; error?: string; errors?: z.ZodIssue[] }> {
  try {
    const validationResult = loginSchema.safeParse(loginData);
    if (!validationResult.success) {
      return { success: false, error: "Validation failed", errors: validationResult.error.errors };
    }
    const validatedData = validationResult.data;

    const db = env.DATABASE;
    if (!db) throw new Error("DATABASE binding not found in environment.");

    const userRecord = await db.prepare(
      'SELECT id, email, name, password_hash, role, created_at, updated_at, verified_at, image_url FROM users WHERE email = ?'
    ).bind(validatedData.email.toLowerCase()).first<DbUserRecord>();

    if (!userRecord || !userRecord.password_hash) { // Check password_hash specifically for password logins
      return { success: false, error: 'Invalid email or password' };
    }

    const passwordMatches = await verifyPassword(validatedData.password, userRecord.password_hash);
    if (!passwordMatches) {
      try {
        await d1Helpers.insert(db, 'activity_logs', {
          user_id: userRecord.id, action: 'login_failed', created_at: Math.floor(Date.now() / 1000),
          // Consider adding ip_address and user_agent if available from requestInfo
        });
      } catch (logError) { console.error("Failed to log failed login attempt:", logError); }
      return { success: false, error: 'Invalid email or password' };
    }

    // Optional: Enforce email verification before login
    // if (!userRecord.verified_at) {
    //   return { success: false, error: 'Please verify your email before logging in.' };
    // }

    const expiresInSeconds = validatedData.rememberMe ? (30 * 24 * 60 * 60) : (24 * 60 * 60); // 30 days or 1 day
    const session = await createSession(env, userRecord.id, expiresInSeconds, {
      ip: requestInfo?.ip,
      userAgent: requestInfo?.userAgent
    });

    const userToReturn: User = {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name ?? undefined,
      role: userRecord.role as User['role'],
      createdAt: userRecord.created_at,
      updatedAt: userRecord.updated_at,
      emailVerifiedAt: userRecord.verified_at ?? undefined,
      imageUrl: userRecord.image_url ?? undefined,
    };

    try {
        await d1Helpers.insert(db, 'activity_logs', {
          user_id: userRecord.id, action: 'login_success', created_at: Math.floor(Date.now() / 1000),
          // Consider adding ip_address and user_agent if available from requestInfo
        });
    } catch (logError) { console.error("Failed to log login activity:", logError); }

    return { success: true, user: userToReturn, sessionId: session.id };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid login data.", errors: error.errors };
    }
    console.error('Error logging in user:', error);
    return { success: false, error: 'An unexpected error occurred during login.' };
  }
}

export async function logoutUser(
  env: CloudflareEnv,
  sessionId: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteSession(env, sessionId);
    if (userId && env.DATABASE) {
      await d1Helpers.insert(env.DATABASE, 'activity_logs', {
        user_id: userId, action: 'logout', created_at: Math.floor(Date.now() / 1000),
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Error logging out user:', error);
    return { success: false, error: 'Logout failed.' };
  }
}

export async function getUserBySessionId(
  env: CloudflareEnv,
  sessionId: string
): Promise<User | null> {
  const sessionData = await getSession(env, sessionId);
  if (sessionData?.userId && env.DATABASE) {
    const dbUser = await d1Helpers.getById<DbUserRecord>(env.DATABASE, 'users', sessionData.userId);
    if (dbUser) {
      return {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name ?? undefined,
        role: dbUser.role as User['role'],
        createdAt: dbUser.created_at,
        updatedAt: dbUser.updated_at,
        emailVerifiedAt: dbUser.verified_at ?? undefined,
        imageUrl: dbUser.image_url ?? undefined,
      };
    }
  }
  return null;
}

export async function verifyEmailToken(
  env: CloudflareEnv,
  token: string
): Promise<{ success: boolean; email?: string; error?: string }> {
  try {
    const db = env.DATABASE;
    if (!db) throw new Error("DATABASE binding not found in environment.");
    const now = Math.floor(Date.now() / 1000);

    const tokenRecord = await db.prepare(
      "SELECT identifier FROM verification_tokens WHERE token = ? AND expires_at > ? AND type = 'EMAIL_VERIFICATION'"
    ).bind(token, now).first<{ identifier: string }>();

    if (!tokenRecord) {
      return { success: false, error: 'Invalid or expired verification token.' };
    }

    // Use `verified_at` for the SQL column name
    const userUpdateResult = await db.prepare(
      'UPDATE users SET verified_at = ?, updated_at = ? WHERE email = ? AND verified_at IS NULL'
    ).bind(now, now, tokenRecord.identifier).run();

    if (!userUpdateResult.meta.changes || userUpdateResult.meta.changes === 0) {
      const userCheck = await db.prepare('SELECT verified_at FROM users WHERE email = ?').bind(tokenRecord.identifier).first<{ verified_at: number | null }>();
      if (userCheck?.verified_at) {
        await db.prepare("DELETE FROM verification_tokens WHERE token = ? AND type = 'EMAIL_VERIFICATION'").bind(token).run();
        return { success: true, email: tokenRecord.identifier };
      }
      return { success: false, error: 'Failed to verify email. User may not exist or already verified with no change.' };
    }

    await db.prepare("DELETE FROM verification_tokens WHERE token = ? AND type = 'EMAIL_VERIFICATION'").bind(token).run();

    const user = await db.prepare('SELECT id FROM users WHERE email = ?').bind(tokenRecord.identifier).first<{id: string}>();
    if (user) {
      await d1Helpers.insert(db, 'activity_logs', {
        user_id: user.id, action: 'email_verified', created_at: now,
      });
    }
    return { success: true, email: tokenRecord.identifier };
  } catch (error) {
    console.error('Error verifying email token:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function requestPasswordReset(
  env: CloudflareEnv,
  input: unknown
): Promise<{ success: boolean; error?: string; errors?: z.ZodIssue[] }> {
  try {
    const validationResult = resetPasswordRequestSchema.safeParse(input);
    if (!validationResult.success) {
      return { success: false, error: validationResult.error.errors[0]?.message, errors: validationResult.error.errors };
    }
    const { email } = validationResult.data;
    const db = env.DATABASE;
    if (!db) throw new Error("DATABASE binding not found in environment.");

    const user = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first<{ id: string }>();
    const now = Math.floor(Date.now() / 1000);

    if (user) {
      const tokenValue = generateToken();
      await d1Helpers.insert(db, 'verification_tokens', {
        identifier: email.toLowerCase(), token: tokenValue, expires_at: now + (60 * 60), created_at: now, type: 'PASSWORD_RESET',
      });
      console.log(`TODO: Send password reset email to ${email} with token: ${tokenValue}`);
      await d1Helpers.insert(db, 'activity_logs', { user_id: user.id, action: 'password_reset_requested', created_at: now });
    } else {
      console.log(`Password reset requested for non-existent email: ${email}`);
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));
    }
    return { success: true };
  } catch (error) {
     if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || 'Invalid email', errors: error.errors };
    }
    console.error('Error requesting password reset:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function resetPasswordWithToken(
  env: CloudflareEnv,
  input: unknown
): Promise<{ success: boolean; error?: string; errors?: z.ZodIssue[] }> {
   try {
    const validationResult = resetPasswordConfirmSchema.safeParse(input);
    if (!validationResult.success) {
      return { success: false, error: validationResult.error.errors[0]?.message, errors: validationResult.error.errors };
    }
    const { token, password } = validationResult.data;
    const db = env.DATABASE;
    if (!db) throw new Error("DATABASE binding not found in environment.");
    const now = Math.floor(Date.now() / 1000);

    const tokenRecord = await db.prepare(
      "SELECT identifier FROM verification_tokens WHERE token = ? AND expires_at > ? AND type = 'PASSWORD_RESET'"
    ).bind(token, now).first<{ identifier: string }>();

    if (!tokenRecord) { return { success: false, error: 'Invalid or expired password reset token.' }; }

    const user = await db.prepare('SELECT id FROM users WHERE email = ?').bind(tokenRecord.identifier).first<{ id: string }>();
    if (!user) { return { success: false, error: 'User associated with token not found.' }; }

    const passwordHash = await hashPassword(password);
    // Use `verified_at` for the SQL column name
    await db.prepare('UPDATE users SET password_hash = ?, updated_at = ?, verified_at = COALESCE(verified_at, ?) WHERE id = ?')
      .bind(passwordHash, now, now, user.id).run();
    await db.prepare("DELETE FROM verification_tokens WHERE token = ? AND type = 'PASSWORD_RESET'").bind(token).run();
    await d1Helpers.insert(db, 'activity_logs', { user_id: user.id, action: 'password_reset_completed', created_at: now });
    await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) { return { success: false, error: error.errors[0]?.message || 'Invalid data', errors: error.errors }; }
    console.error('Error resetting password:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function changePassword(
  env: CloudflareEnv,
  userId: string,
  input: unknown
): Promise<{ success: boolean; error?: string; errors?: z.ZodIssue[] }> {
  try {
    const validationResult = changePasswordSchema.safeParse(input);
    if (!validationResult.success) {
      return { success: false, error: validationResult.error.errors[0]?.message, errors: validationResult.error.errors };
    }
    const { currentPassword, newPassword } = validationResult.data;
    const db = env.DATABASE;
    if (!db) throw new Error("DATABASE binding not found in environment.");

    const userRecord = await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(userId).first<{ password_hash: string | null }>(); // Ensure password_hash can be null
    if (!userRecord) { return { success: false, error: 'User not found.' }; }
    // If password_hash is null (e.g. OAuth user), they shouldn't be able to change password this way.
    if (!userRecord.password_hash) { return { success: false, error: 'Password change not available for this account.' }; }


    if (!await verifyPassword(currentPassword, userRecord.password_hash)) {
      return { success: false, error: 'Incorrect current password.' };
    }

    const newPasswordHash = await hashPassword(newPassword);
    const now = Math.floor(Date.now() / 1000);
    await db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').bind(newPasswordHash, now, userId).run();
    await d1Helpers.insert(db, 'activity_logs', { user_id: userId, action: 'password_changed', created_at: now });
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) { return { success: false, error: error.errors[0]?.message || 'Invalid data', errors: error.errors }; }
    console.error('Error changing password:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function updateProfile(
  env: CloudflareEnv,
  userId: string,
  input: unknown
): Promise<{ success: boolean; user?: User; error?: string; errors?: z.ZodIssue[] }> {
  try {
    const validationResult = updateProfileSchema.safeParse(input);
    if (!validationResult.success) {
      return { success: false, error: validationResult.error.errors[0]?.message, errors: validationResult.error.errors };
    }
    const validatedData = validationResult.data;

    if (Object.keys(validatedData).length === 0) {
      return { success: false, error: 'No information provided for update.' };
    }

    const db = env.DATABASE;
    if (!db) throw new Error("DATABASE binding not found in environment.");
    const now = Math.floor(Date.now() / 1000);
    const updates: Record<string, any> = { updated_at: now };
    let newEmailVerificationNeeded = false;
    let newEmailAddress: string | undefined;

    const currentUser = await d1Helpers.getById<DbUserRecord>(db, 'users', userId);
    if (!currentUser) { return { success: false, error: 'User not found.' }; }

    if (validatedData.name !== undefined && validatedData.name !== currentUser.name) {
      updates.name = validatedData.name;
    }
    if (validatedData.imageUrl !== undefined && validatedData.imageUrl !== currentUser.image_url) {
        updates.image_url = validatedData.imageUrl;
    }

    if (validatedData.email && validatedData.email.toLowerCase() !== currentUser.email) {
      newEmailAddress = validatedData.email.toLowerCase();
      const existingUser = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').bind(newEmailAddress, userId).first<{ id: string }>();
      if (existingUser) { return { success: false, error: 'This email address is already in use.' }; }
      updates.email = newEmailAddress;
      updates.verified_at = null; // Email changed, needs re-verification (SQL column name)
      newEmailVerificationNeeded = true;
    }

    if (Object.keys(updates).length > 1) {
      await d1Helpers.update(db, 'users', userId, updates);
    }

    if (newEmailVerificationNeeded && newEmailAddress) {
      const verificationTokenValue = generateToken();
      await d1Helpers.insert(db, 'verification_tokens', {
        identifier: newEmailAddress, token: verificationTokenValue, expires_at: now + (24 * 60 * 60), created_at: now, type: 'EMAIL_VERIFICATION',
      });
      console.log(`TODO: Send verification email to new address ${newEmailAddress} with token: ${verificationTokenValue}`);
    }

    const updatedDbUserRecord = await d1Helpers.getById<DbUserRecord>(db, 'users', userId);
    if (!updatedDbUserRecord) { return {success: false, error: "Failed to fetch updated user profile."}; }

    const userToReturn: User = {
      id: updatedDbUserRecord.id,
      email: updatedDbUserRecord.email,
      name: updatedDbUserRecord.name ?? undefined,
      role: updatedDbUserRecord.role as User['role'],
      createdAt: updatedDbUserRecord.created_at,
      updatedAt: updatedDbUserRecord.updated_at,
      emailVerifiedAt: updatedDbUserRecord.verified_at ?? undefined, // Map from verified_at
      imageUrl: updatedDbUserRecord.image_url ?? undefined,
    };

    await d1Helpers.insert(db, 'activity_logs', { user_id: userId, action: 'profile_updated', created_at: now });
    return { success: true, user: userToReturn };
  } catch (error) {
    if (error instanceof z.ZodError) { return { success: false, error: error.errors[0]?.message || 'Invalid data', errors: error.errors }; }
    console.error('Error updating profile:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function getUserById(
  env: CloudflareEnv,
  userId: string
): Promise<User | null> {
  try {
    const db = env.DATABASE;
    if (!db) throw new Error("DATABASE binding not found in environment.");

    const dbUser = await d1Helpers.getById<DbUserRecord>(db, 'users', userId);
    if (dbUser) {
      return {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name ?? undefined,
        role: dbUser.role as User['role'],
        createdAt: dbUser.created_at,
        updatedAt: dbUser.updated_at,
        emailVerifiedAt: dbUser.verified_at ?? undefined, // Map from verified_at
        imageUrl: dbUser.image_url ?? undefined,
      };
    }
    return null;
  } catch (error) {
    console.error(`Error getting user by ID (${userId}):`, error);
    return null;
  }
}

export async function extendUserSession(
  env: CloudflareEnv,
  sessionId: string,
  newExpiresInSeconds?: number
): Promise<Session | null> {
    return extendSession(env, sessionId, newExpiresInSeconds);
}