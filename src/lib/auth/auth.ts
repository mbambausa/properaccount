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
  type RegisterUserInput,
  type LoginInput,
  type UpdateProfileInput,
  type ChangePasswordInput,
  type ResetPasswordConfirmInput,
  type ResetPasswordRequestInput
} from '../validation/schemas/auth';
import { createSession, deleteSession, getSession, extendSession } from './session';
import type { User, Session } from '@/types/auth';
import * as d1Helpers from '../cloudflare/d1';
import type { CloudflareEnv } from '@/env';
import { hashPassword as argon2Hash, verifyPassword as argon2Verify } from '@/lib/auth/passwordUtils';

// Interface for the raw user record from the database
interface DbUserRecord {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  role: string;
  created_at: number;
  updated_at: number;
  verified_at: number | null;
  image_url: string | null;
}

// Generate a secure random token (browser/worker compatible)
export function generateToken(length = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hashes a password using Argon2id.
 * @param password The plaintext password to hash.
 * @returns A promise that resolves to the hashed password string.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password) {
    throw new Error("Password cannot be empty.");
  }
  
  try {
    // Use the Argon2id implementation from passwordUtils.ts
    return await argon2Hash(password);
  } catch (error) {
    console.error('Error hashing password:', error);
    throw new Error('Password hashing failed. Please try again later.');
  }
}

/**
 * Verifies a plaintext password against a stored hash.
 * @param password The plaintext password to verify.
 * @param storedHash The hash stored in the database.
 * @returns A promise that resolves to true if the password matches, false otherwise.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !password) {
    return false;
  }
  
  try {
    // Use the Argon2id verification from passwordUtils.ts
    return await argon2Verify(storedHash, password);
  } catch (error) {
    // Any error means verification failed
    return false;
  }
}

export async function registerUser(
  env: CloudflareEnv,
  userData: unknown
): Promise<{ success: boolean; user?: User; error?: string; errors?: z.ZodIssue[] }> {
  try {
    // Validate input using Zod schema
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

    const userToInsert: Omit<DbUserRecord, 'password_hash'> & { password_hash: string } = {
      id: userId,
      email: validatedData.email.toLowerCase(),
      name: validatedData.name,
      password_hash: passwordHash,
      role: 'user', // Default role
      created_at: now,
      updated_at: now,
      verified_at: null, // Email not verified initially
      image_url: null,
    };

    await d1Helpers.insert(db, 'users', userToInsert);

    // Create a verification token (optional, if you implement email verification)
    const verificationToken = generateToken();
    await d1Helpers.insert(db, 'verification_tokens', {
      identifier: validatedData.email.toLowerCase(),
      token: verificationToken,
      expires_at: now + (24 * 60 * 60), // Expires in 24 hours
      created_at: now,
    });
    
    // TODO: Send verification email with the token
    console.log(`TODO: Send verification email to ${validatedData.email} with token: ${verificationToken}`);

    const registeredUser: User = {
      id: userId,
      email: userToInsert.email,
      name: userToInsert.name ?? undefined,
      role: userToInsert.role as User['role'],
      createdAt: userToInsert.created_at,
      updatedAt: userToInsert.updated_at,
      // verifiedAt will be undefined until verified
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
      'SELECT id, email, name, password_hash, role, created_at, updated_at, verified_at, image_url FROM users WHERE email = ?'
    ).bind(validatedData.email.toLowerCase()).first<DbUserRecord>();

    if (!userRecord || !userRecord.password_hash) {
      return { success: false, error: 'Invalid email or password' };
    }

    const passwordMatches = await verifyPassword(validatedData.password, userRecord.password_hash);
    if (!passwordMatches) {
      // Log failed login attempt if you want to implement rate limiting
      try {
        await d1Helpers.insert(db, 'activity_logs', {
          user_id: userRecord.id,
          action: 'login_failed',
          created_at: Math.floor(Date.now() / 1000),
        });
      } catch (logError) {
        console.error("Failed to log failed login attempt:", logError);
      }
      
      return { success: false, error: 'Invalid email or password' };
    }

    // Optional: Check if email is verified if your system requires it for login
    // if (!userRecord.verified_at) {
    //   return { success: false, error: 'Please verify your email before logging in.' };
    // }

    // Create a session
    const expiresInSeconds = validatedData.rememberMe ? (30 * 24 * 60 * 60) : (24 * 60 * 60); // 30 days or 1 day
    const session = await createSession(env, userRecord.id, expiresInSeconds, { 
      // Include any additional session data you want to store
      ip: /* get IP if possible */ undefined,
      userAgent: /* get UA if possible */ undefined 
    });

    const userToReturn: User = {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name ?? undefined,
      role: userRecord.role as User['role'],
      createdAt: userRecord.created_at,
      updatedAt: userRecord.updated_at,
      verifiedAt: userRecord.verified_at ?? undefined,
      imageUrl: userRecord.image_url ?? undefined,
    };
    
    // Log successful login activity
    try {
        await d1Helpers.insert(db, 'activity_logs', {
          user_id: userRecord.id,
          action: 'login_success',
          // ip_address: request?.headers?.get('CF-Connecting-IP'),
          // user_agent: request?.headers?.get('User-Agent'),
          created_at: Math.floor(Date.now() / 1000),
        });
    } catch (logError) {
        console.error("Failed to log login activity:", logError);
    }

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
        user_id: userId, 
        action: 'logout', 
        created_at: Math.floor(Date.now() / 1000),
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
  const session = await getSession(env, sessionId);
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
        verifiedAt: dbUser.verified_at ?? undefined,
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
      'SELECT identifier FROM verification_tokens WHERE token = ? AND expires_at > ?'
    ).bind(token, now).first<{ identifier: string }>();

    if (!tokenRecord) {
      return { success: false, error: 'Invalid or expired verification token.' };
    }

    const userUpdateResult = await db.prepare(
      'UPDATE users SET verified_at = ?, updated_at = ? WHERE email = ? AND verified_at IS NULL'
    ).bind(now, now, tokenRecord.identifier).run();

    if (!userUpdateResult.meta.changes || userUpdateResult.meta.changes === 0) {
      const userCheck = await db.prepare('SELECT verified_at FROM users WHERE email = ?').bind(tokenRecord.identifier).first<{verified_at: number | null}>();
      if (userCheck?.verified_at) {
        await db.prepare('DELETE FROM verification_tokens WHERE token = ?').bind(token).run();
        return { success: true, email: tokenRecord.identifier };
      }
      return { success: false, error: 'Failed to verify email. User may already be verified or not found.' };
    }
    
    await db.prepare('DELETE FROM verification_tokens WHERE token = ?').bind(token).run();
    
    const user = await db.prepare('SELECT id FROM users WHERE email = ?').bind(tokenRecord.identifier).first<{id: string}>();
    if (user) {
      await d1Helpers.insert(db, 'activity_logs', {
        user_id: user.id, 
        action: 'email_verified', 
        created_at: now,
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

    // Important: This is a potential information disclosure vulnerability if our response time differs
    // depending on whether the email exists or not. To mitigate, we always return success
    // regardless of whether the email exists, and we also ensure our code execution time
    // is reasonably consistent.
    
    const user = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first<{ id: string }>();
    const now = Math.floor(Date.now() / 1000);
    
    if (user) {
      const token = generateToken();
      
      // Set token to expire in 1 hour
      await d1Helpers.insert(db, 'verification_tokens', {
        identifier: email.toLowerCase(), 
        token: token, 
        expires_at: now + (60 * 60), 
        created_at: now,
      });

      // TODO: Send actual password reset email
      console.log(`TODO: Send password reset email to ${email} with token: ${token}`);
      
      await d1Helpers.insert(db, 'activity_logs', { 
        user_id: user.id, 
        action: 'password_reset_requested', 
        created_at: now 
      });
    } else {
      // Log attempt on non-existent account for security monitoring
      console.log(`Password reset requested for non-existent email: ${email}`);
      
      // Simulate processing time to avoid timing attacks
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Always return success regardless of whether email exists
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
      'SELECT identifier FROM verification_tokens WHERE token = ? AND expires_at > ?'
    ).bind(token, now).first<{ identifier: string }>();

    if (!tokenRecord) {
      return { success: false, error: 'Invalid or expired password reset token.' };
    }

    const user = await db.prepare('SELECT id FROM users WHERE email = ?').bind(tokenRecord.identifier).first<{ id: string }>();
    if (!user) { return { success: false, error: 'User associated with token not found.' }; }

    const passwordHash = await hashPassword(password);

    // Update the password
    await db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .bind(passwordHash, now, user.id).run();
      
    // Delete the token so it can't be reused
    await db.prepare('DELETE FROM verification_tokens WHERE token = ?').bind(token).run();
    
    // Log the password reset activity
    await d1Helpers.insert(db, 'activity_logs', { 
      user_id: user.id, 
      action: 'password_reset_completed', 
      created_at: now 
    });
    
    // Also invalidate all existing sessions for this user for security
    await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();
    
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || 'Invalid data', errors: error.errors };
    }
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

    if (!await verifyPassword(currentPassword, userRecord.password_hash)) {
      return { success: false, error: 'Incorrect current password.' };
    }

    const newPasswordHash = await hashPassword(newPassword);
    const now = Math.floor(Date.now() / 1000);
    
    await db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .bind(newPasswordHash, now, userId).run();
    
    // Log the password change activity
    await d1Helpers.insert(db, 'activity_logs', { 
      user_id: userId, 
      action: 'password_changed', 
      created_at: now 
    });
    
    // Optionally invalidate all other sessions for security
    // await db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').bind(userId, currentSessionId).run();
    
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || 'Invalid data', errors: error.errors };
    }
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

    if (validatedData.email !== undefined && validatedData.email.toLowerCase() !== currentUser.email) {
      newEmailAddress = validatedData.email.toLowerCase();
      const existingUser = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').bind(newEmailAddress, userId).first<{ id: string }>();
      if (existingUser) {
        return { success: false, error: 'This email address is already in use.' };
      }
      updates.email = newEmailAddress;
      updates.verified_at = null;
      newEmailVerificationNeeded = true;
    }

    if (Object.keys(updates).length > 1) {
      await d1Helpers.update(db, 'users', userId, updates);
    }

    if (newEmailVerificationNeeded && newEmailAddress) {
      const verificationToken = generateToken();
      await d1Helpers.insert(db, 'verification_tokens', {
        identifier: newEmailAddress, 
        token: verificationToken, 
        expires_at: now + (24 * 60 * 60), 
        created_at: now,
      });
      console.log(`TODO: Send verification email to new address ${newEmailAddress} with token: ${verificationToken}`);
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
      verifiedAt: updatedDbUserRecord.verified_at ?? undefined,
      imageUrl: updatedDbUserRecord.image_url ?? undefined,
    };

    await d1Helpers.insert(db, 'activity_logs', { 
      user_id: userId, 
      action: 'profile_updated', 
      created_at: now 
    });
    
    return { success: true, user: userToReturn };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || 'Invalid data', errors: error.errors };
    }
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
        verifiedAt: dbUser.verified_at ?? undefined,
        imageUrl: dbUser.image_url ?? undefined,
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting user by ID:', error);
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