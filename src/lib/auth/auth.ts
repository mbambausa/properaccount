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
  // Unused type imports removed:
  // type RegisterUserInput,
  // type LoginInput,
  // type UpdateProfileInput,
  // type ChangePasswordInput,
  // type ResetPasswordConfirmInput,
  // type ResetPasswordRequestInput
} from '../validation/schemas/auth';
import { createSession, deleteSession, getSession, extendSession } from './session';
import type { User, Session } from '@/types/auth'; // Assuming types/auth.d.ts is at src/types/auth.d.ts
import * as d1Helpers from '../cloudflare/d1'; // Assuming this utility module exists
import type { CloudflareEnv } from '@/env'; // Assuming env.d.ts is at src/env.d.ts
import { hashPassword as argon2Hash, verifyPassword as argon2Verify } from './passwordUtils'; // Corrected path

// Interface for the raw user record from the database
interface DbUserRecord {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  role: string; // Should align with UserRole type
  created_at: number; // Unix timestamp (seconds)
  updated_at: number; // Unix timestamp (seconds)
  email_verified_at: number | null; // Renamed from verified_at to match User type
  image_url: string | null;
}

// Generate a secure random token (browser/worker compatible)
export function generateToken(length = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hashes a password using the utility from passwordUtils.
 * @param password The plaintext password to hash.
 * @returns A promise that resolves to the hashed password string.
 */
export async function hashPassword(password: string): Promise<string> {
  // passwordUtils.hashPassword already checks for empty password
  return argon2Hash(password);
}

/**
 * Verifies a plaintext password against a stored hash using the utility from passwordUtils.
 * @param password The plaintext password to verify.
 * @param storedHash The hash stored in the database.
 * @returns A promise that resolves to true if the password matches, false otherwise.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // passwordUtils.verifyPassword already checks for empty inputs
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

    const userToInsert: DbUserRecord = { // Use DbUserRecord for insertion
      id: userId,
      email: validatedData.email.toLowerCase(),
      name: validatedData.name,
      password_hash: passwordHash,
      role: 'user',
      created_at: now,
      updated_at: now,
      email_verified_at: null, // Email not verified initially
      image_url: null,
    };

    await d1Helpers.insert(db, 'users', userToInsert);

    const verificationTokenValue = generateToken(); // Renamed variable
    await d1Helpers.insert(db, 'verification_tokens', {
      identifier: validatedData.email.toLowerCase(),
      token: verificationTokenValue, // Use new variable name
      expires_at: now + (24 * 60 * 60),
      created_at: now,
      type: 'EMAIL_VERIFICATION', // Added type
    });

    console.log(`TODO: Send verification email to ${validatedData.email} with token: ${verificationTokenValue}`);

    const registeredUser: User = {
      id: userId,
      email: userToInsert.email,
      name: userToInsert.name ?? undefined,
      role: userToInsert.role as User['role'], // Cast if UserRole is more specific
      createdAt: userToInsert.created_at,
      updatedAt: userToInsert.updated_at,
      emailVerifiedAt: userToInsert.email_verified_at ?? undefined, // FIXED: Use emailVerifiedAt
      imageUrl: userToInsert.image_url ?? undefined,
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
  loginData: unknown
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
      'SELECT id, email, name, password_hash, role, created_at, updated_at, email_verified_at, image_url FROM users WHERE email = ?'
    ).bind(validatedData.email.toLowerCase()).first<DbUserRecord>();

    if (!userRecord || !userRecord.password_hash) {
      return { success: false, error: 'Invalid email or password' };
    }

    const passwordMatches = await verifyPassword(validatedData.password, userRecord.password_hash);
    if (!passwordMatches) {
      try {
        await d1Helpers.insert(db, 'activity_logs', {
          user_id: userRecord.id, action: 'login_failed', created_at: Math.floor(Date.now() / 1000),
        });
      } catch (logError) { console.error("Failed to log failed login attempt:", logError); }
      return { success: false, error: 'Invalid email or password' };
    }

    // if (!userRecord.email_verified_at) { // Use email_verified_at
    //   return { success: false, error: 'Please verify your email before logging in.' };
    // }

    const expiresInSeconds = validatedData.rememberMe ? (30 * 24 * 60 * 60) : (24 * 60 * 60);
    const session = await createSession(env, userRecord.id, expiresInSeconds, {
      ip: /* context.request.headers.get('CF-Connecting-IP') */ undefined,
      userAgent: /* context.request.headers.get('User-Agent') */ undefined
    });

    const userToReturn: User = {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name ?? undefined,
      role: userRecord.role as User['role'],
      createdAt: userRecord.created_at,
      updatedAt: userRecord.updated_at,
      emailVerifiedAt: userRecord.email_verified_at ?? undefined, // FIXED: Use emailVerifiedAt
      imageUrl: userRecord.image_url ?? undefined,
    };

    try {
        await d1Helpers.insert(db, 'activity_logs', {
          user_id: userRecord.id, action: 'login_success', created_at: Math.floor(Date.now() / 1000),
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
  userId?: string // Optional userId for logging
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteSession(env, sessionId); // deleteSession handles KV interaction
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
  const session = await getSession(env, sessionId); // getSession handles KV interaction
  if (session?.userId && env.DATABASE) {
    const dbUser = await d1Helpers.getById<DbUserRecord>(env.DATABASE, 'users', session.userId);
    if (dbUser) {
      return {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name ?? undefined,
        role: dbUser.role as User['role'],
        createdAt: dbUser.created_at,
        updatedAt: dbUser.updated_at,
        emailVerifiedAt: dbUser.email_verified_at ?? undefined, // FIXED: Use emailVerifiedAt
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
      "SELECT identifier FROM verification_tokens WHERE token = ? AND expires_at > ? AND type = 'EMAIL_VERIFICATION'" // Added type
    ).bind(token, now).first<{ identifier: string }>();

    if (!tokenRecord) {
      return { success: false, error: 'Invalid or expired verification token.' };
    }

    const userUpdateResult = await db.prepare(
      'UPDATE users SET email_verified_at = ?, updated_at = ? WHERE email = ? AND email_verified_at IS NULL' // Use email_verified_at
    ).bind(now, now, tokenRecord.identifier).run();

    // Check if any rows were actually updated
    if (!userUpdateResult.meta.changes || userUpdateResult.meta.changes === 0) {
      // If no changes, check if user was already verified
      const userCheck = await db.prepare('SELECT email_verified_at FROM users WHERE email = ?').bind(tokenRecord.identifier).first<{email_verified_at: number | null}>();
      if (userCheck?.email_verified_at) { // User already verified
        await db.prepare("DELETE FROM verification_tokens WHERE token = ? AND type = 'EMAIL_VERIFICATION'").bind(token).run(); // Delete used/checked token
        return { success: true, email: tokenRecord.identifier }; // Still success
      }
      return { success: false, error: 'Failed to verify email. User may not exist or already verified with no change.' };
    }

    await db.prepare("DELETE FROM verification_tokens WHERE token = ? AND type = 'EMAIL_VERIFICATION'").bind(token).run(); // Delete used token

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
      const tokenValue = generateToken(); // Renamed variable
      await d1Helpers.insert(db, 'verification_tokens', {
        identifier: email.toLowerCase(), token: tokenValue, expires_at: now + (60 * 60), created_at: now, type: 'PASSWORD_RESET', // Added type
      });
      console.log(`TODO: Send password reset email to ${email} with token: ${tokenValue}`);
      await d1Helpers.insert(db, 'activity_logs', { user_id: user.id, action: 'password_reset_requested', created_at: now });
    } else {
      console.log(`Password reset requested for non-existent email: ${email}`);
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50)); // Simulate delay
    }
    return { success: true }; // Always return success
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
      "SELECT identifier FROM verification_tokens WHERE token = ? AND expires_at > ? AND type = 'PASSWORD_RESET'" // Added type
    ).bind(token, now).first<{ identifier: string }>();

    if (!tokenRecord) { return { success: false, error: 'Invalid or expired password reset token.' }; }

    const user = await db.prepare('SELECT id FROM users WHERE email = ?').bind(tokenRecord.identifier).first<{ id: string }>();
    if (!user) { return { success: false, error: 'User associated with token not found.' }; }

    const passwordHash = await hashPassword(password);
    await db.prepare('UPDATE users SET password_hash = ?, updated_at = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?') // Also verify email if not already
      .bind(passwordHash, now, now, user.id).run(); // If email_verified_at is null, set it to now
    await db.prepare("DELETE FROM verification_tokens WHERE token = ? AND type = 'PASSWORD_RESET'").bind(token).run(); // Delete used token
    await d1Helpers.insert(db, 'activity_logs', { user_id: user.id, action: 'password_reset_completed', created_at: now });
    await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run(); // Invalidate all sessions
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

    const userRecord = await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(userId).first<{ password_hash: string }>();
    if (!userRecord) { return { success: false, error: 'User not found.' }; }
    if (!userRecord.password_hash) { return { success: false, error: 'Cannot change password, user may use OAuth.' }; }


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
      updates.email_verified_at = null; // Email changed, needs re-verification
      newEmailVerificationNeeded = true;
    }

    if (Object.keys(updates).length > 1) { // updated_at is always there
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
      emailVerifiedAt: updatedDbUserRecord.email_verified_at ?? undefined, // FIXED: Use emailVerifiedAt
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
        emailVerifiedAt: dbUser.email_verified_at ?? undefined, // FIXED: Use emailVerifiedAt
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
    // This now directly calls extendSession from session.ts
    return extendSession(env, sessionId, newExpiresInSeconds);
}