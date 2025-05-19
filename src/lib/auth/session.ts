// src/lib/auth/session.ts
/**
 * Session Management Service
 *
 * Handles creation, retrieval, and deletion of user sessions,
 * typically stored in Cloudflare KV.
 */
import type { Session } from '@/types/auth';
import { generateToken } from './auth';
import { sessionSchema } from '../validation/schemas/auth';
import type { CloudflareEnv } from '@/env'; // Import CloudflareEnv

const SESSION_PREFIX = 'session:';
const USER_SESSIONS_PREFIX = 'user_sessions:';
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24; // 1 day
const MAX_SESSIONS_PER_USER = 5;

function getSessionKey(sessionId: string): string {
  // ... (implementation remains the same)
  return `${SESSION_PREFIX}${sessionId}`;
}

function getUserSessionsKey(userId: string): string {
  // ... (implementation remains the same)
  return `${USER_SESSIONS_PREFIX}${userId}`;
}

export async function createSession(
  env: CloudflareEnv, // This now refers to the imported CloudflareEnv
  userId: string,
  expiresInSeconds: number = DEFAULT_SESSION_TTL_SECONDS,
  sessionDetails: Record<string, any> = {}
): Promise<Session> {
  // ... (implementation remains the same)
  const sessionId = generateToken(32);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + expiresInSeconds;

  const sessionToStore: Session = {
    id: sessionId,
    userId,
    createdAt: now,
    expiresAt,
    data: { ...sessionDetails },
  };

  const validationResult = sessionSchema.safeParse(sessionToStore);
  if (!validationResult.success) {
    console.error("Session data failed validation:", validationResult.error.flatten().fieldErrors);
    throw new Error(`Invalid session data for creation: ${validationResult.error.errors[0]?.message}`);
  }

  const kv = env.SESSION_KV;
  if (!kv) throw new Error("SESSION_KV binding not found in environment.");

  await kv.put(getSessionKey(sessionId), JSON.stringify(validationResult.data), {
    expiration: expiresAt,
  });

  const userSessionsKey = getUserSessionsKey(userId);
  const existingSessionsJSON = await kv.get(userSessionsKey);
  let userSessions: string[] = [];
  if (existingSessionsJSON) {
    try { userSessions = JSON.parse(existingSessionsJSON); } catch (e) { /* ignore */ }
  }
  userSessions.push(sessionId);
  if (userSessions.length > MAX_SESSIONS_PER_USER) {
    const oldestSessionId = userSessions.shift();
    if (oldestSessionId) await kv.delete(getSessionKey(oldestSessionId));
  }
  await kv.put(userSessionsKey, JSON.stringify(userSessions), { expiration: expiresAt });

  return validationResult.data;
}

export async function getSession(
  env: CloudflareEnv,
  sessionId: string
): Promise<Session | null> {
  // ... (implementation remains the same)
  const kv = env.SESSION_KV;
  if (!kv) { console.error("SESSION_KV binding not found."); return null; }

  const sessionJSON = await kv.get(getSessionKey(sessionId));
  if (!sessionJSON) return null;

  try {
    const parsedData = JSON.parse(sessionJSON);
    const validationResult = sessionSchema.safeParse(parsedData);
    if (validationResult.success) return validationResult.data;
    
    console.warn('Session data from KV failed validation:', validationResult.error.flatten().fieldErrors);
    return null;
  } catch (error) {
    console.error('Error parsing session data from KV:', error);
    await kv.delete(getSessionKey(sessionId));
    return null;
  }
}

export async function deleteSession(
  env: CloudflareEnv,
  sessionId: string
): Promise<void> {
  // ... (implementation remains the same)
  const kv = env.SESSION_KV;
  if (!kv) { console.error("SESSION_KV binding not found."); return; }
  const sessionKey = getSessionKey(sessionId);

  const sessionJSON = await kv.get(sessionKey);
  if (sessionJSON) {
    try {
      const parsedSession = JSON.parse(sessionJSON);
      const validationResult = sessionSchema.safeParse(parsedSession); 
      if (validationResult.success && validationResult.data.userId) {
        const userSessionsKey = getUserSessionsKey(validationResult.data.userId);
        const existingSessionsJSON = await kv.get(userSessionsKey);
        if (existingSessionsJSON) {
          let userSessions: string[] = JSON.parse(existingSessionsJSON);
          userSessions = userSessions.filter(id => id !== sessionId);
          if (userSessions.length > 0) {
            await kv.put(userSessionsKey, JSON.stringify(userSessions), {expiration: validationResult.data.expiresAt });
          } else {
            await kv.delete(userSessionsKey);
          }
        }
      }
    } catch(e) { console.error("Error during session cleanup for user list:", e); }
  }
  await kv.delete(sessionKey);
}

export async function deleteAllUserSessions(
  env: CloudflareEnv,
  userId: string
): Promise<void> {
  // ... (implementation remains the same)
  const kv = env.SESSION_KV;
  if (!kv) { console.error("SESSION_KV binding not found."); return; }
  const userSessionsKey = getUserSessionsKey(userId);
  const existingSessionsJSON = await kv.get(userSessionsKey);
  if (existingSessionsJSON) {
    try {
      const userSessions: string[] = JSON.parse(existingSessionsJSON);
      const deletePromises = userSessions.map(id => kv.delete(getSessionKey(id)));
      await Promise.all(deletePromises);
    } catch (e) { console.error("Error parsing user's session list for multi-deletion:", e); }
  }
  await kv.delete(userSessionsKey);
}

export async function extendSession(
  env: CloudflareEnv,
  sessionId: string,
  newExpiresInSeconds: number = DEFAULT_SESSION_TTL_SECONDS
): Promise<Session | null> {
  // ... (implementation remains the same)
  const kv = env.SESSION_KV;
  if (!kv) { console.error("SESSION_KV binding not found."); return null; }
  const sessionKey = getSessionKey(sessionId);
  const sessionJSON = await kv.get(sessionKey);
  if (!sessionJSON) return null;

  try {
    const parsedSession = JSON.parse(sessionJSON);
    let validationResult = sessionSchema.safeParse(parsedSession);
    if (!validationResult.success) {
        console.warn('Invalid session data found during extend:', validationResult.error.flatten().fieldErrors);
        await kv.delete(sessionKey); return null;
    }
    const sessionData = validationResult.data;
    const now = Math.floor(Date.now() / 1000);
    sessionData.expiresAt = now + newExpiresInSeconds;

    validationResult = sessionSchema.safeParse(sessionData); 
    if (!validationResult.success) {
      console.error("Extended session data failed validation:", validationResult.error.flatten().fieldErrors);
      throw new Error("Invalid session data for extension.");
    }
    const updatedSessionData = validationResult.data;

    await kv.put(sessionKey, JSON.stringify(updatedSessionData), {
      expiration: updatedSessionData.expiresAt,
    });

    if (updatedSessionData.userId) {
        const userSessionsKey = getUserSessionsKey(updatedSessionData.userId);
        const existingUserSessions = await kv.get(userSessionsKey); 
        if (existingUserSessions) {
             await kv.put(userSessionsKey, existingUserSessions, { expiration: updatedSessionData.expiresAt });
        }
    }
    return updatedSessionData;
  } catch (error) {
    console.error('Error extending session:', error);
    await kv.delete(sessionKey);
    return null;
  }
}