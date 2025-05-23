// src/lib/auth/session.ts
/**
 * Session Management Service
 *
 * Handles creation, retrieval, and deletion of user sessions,
 * typically stored in Cloudflare KV.
 */
import type { Session, User } from '@/types/auth';
import { generateToken } from './auth'; // generateToken is in auth.ts
import { sessionDataSchema } from '../validation/schemas/auth';
import type { CloudflareEnv } from '@/env';

const SESSION_PREFIX = 'session:';
const USER_SESSIONS_PREFIX = 'user_sessions:';
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24; // 1 day
const MAX_SESSIONS_PER_USER = 5; // Max active sessions per user

function getSessionKey(sessionId: string): string {
  return `${SESSION_PREFIX}${sessionId}`;
}

function getUserSessionsKey(userId: string): string {
  return `${USER_SESSIONS_PREFIX}${userId}`;
}

export async function createSession(
  env: CloudflareEnv,
  userId: string,
  expiresInSeconds: number = DEFAULT_SESSION_TTL_SECONDS,
  sessionDetails: Partial<Exclude<Session['data'], undefined>> = {}
): Promise<Session> {
  if (!userId) throw new Error("User ID is required to create a session.");
  if (expiresInSeconds <= 0 || expiresInSeconds > 60 * 60 * 24 * 90) { // Max 90 days
    throw new Error("Invalid session expiration time (must be > 0 and <= 90 days).");
  }

  const sessionId = generateToken(32);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = nowSeconds + expiresInSeconds;

  const sessionDataPayload: Exclude<Session['data'], undefined> = {
    ip: sessionDetails?.ip || 'unknown',
    userAgent: sessionDetails?.userAgent || 'unknown',
    lastActivityAt: sessionDetails?.lastActivityAt || nowSeconds,
    currentEntityId: sessionDetails?.currentEntityId === null ? undefined : sessionDetails?.currentEntityId,
    isMfaVerified: sessionDetails?.isMfaVerified || false,
    createdAt: sessionDetails?.createdAt || nowSeconds,
    ...(sessionDetails.customData && { customData: sessionDetails.customData }),
  };

  const dataValidationResult = sessionDataSchema.safeParse(sessionDataPayload);
  if(!dataValidationResult.success) {
    console.error("Session data payload failed validation:", dataValidationResult.error.flatten().fieldErrors);
    throw new Error(`Invalid session data payload: ${dataValidationResult.error.errors[0]?.message}`);
  }

  const sessionRecordToStore: Session = {
    id: sessionId,
    userId,
    createdAt: nowSeconds,
    expiresAt: expiresAtSeconds,
    data: dataValidationResult.data as Exclude<Session['data'], undefined>,
  };

  const kv = env.SESSION_KV;
  if (!kv) throw new Error("SESSION_KV binding not found in environment.");

  try {
    await kv.put(getSessionKey(sessionId), JSON.stringify(sessionRecordToStore), {
      expiration: expiresAtSeconds,
    });

    const userSessionsKey = getUserSessionsKey(userId);
    let userActiveSessions: string[] = [];
    const existingSessionsJson = await kv.get(userSessionsKey);
    if (existingSessionsJson) {
      try {
        userActiveSessions = JSON.parse(existingSessionsJson);
        if (!Array.isArray(userActiveSessions)) userActiveSessions = [];
      } catch (e) { console.warn(`Corrupted session list for user ${userId}, resetting.`); userActiveSessions = []; }
    }
    userActiveSessions.push(sessionId);

    if (userActiveSessions.length > MAX_SESSIONS_PER_USER) {
      const sessionsToRemove = userActiveSessions.splice(0, userActiveSessions.length - MAX_SESSIONS_PER_USER);
      const deletePromises = sessionsToRemove.map(oldId => kv.delete(getSessionKey(oldId)));
      await Promise.allSettled(deletePromises);
    }
    
    const allSessionPromises = userActiveSessions.map(id => kv.get(getSessionKey(id)));
    const allSessionStrings = await Promise.all(allSessionPromises);
    let furthestExpiryForList = nowSeconds + (7 * 24 * 60 * 60); 
    
    const validUserSessions = allSessionStrings
        .filter((s): s is string => s !== null) // FIXED: Filter out null strings first
        .map(s => JSON.parse(s) as Session)
        .filter(s => s && typeof s.expiresAt === 'number' && s.expiresAt > nowSeconds);

    if (validUserSessions.length > 0) {
        furthestExpiryForList = Math.max(...validUserSessions.map(s => s.expiresAt)) + (7 * 24 * 60 * 60);
    } else if (userActiveSessions.length === 0) { 
        await kv.delete(userSessionsKey);
        return sessionRecordToStore;
    }

    await kv.put(userSessionsKey, JSON.stringify(userActiveSessions), {
        expiration: furthestExpiryForList
    });
    return sessionRecordToStore;
  } catch (error) {
    console.error("Error creating session in KV:", error);
    throw new Error("Failed to create session due to a storage error.");
  }
}

export async function getSession(
  env: CloudflareEnv,
  sessionId: string
): Promise<Session | null> {
  if (!sessionId) return null;
  const kv = env.SESSION_KV;
  if (!kv) { console.error("SESSION_KV binding not found."); return null; }

  const sessionJSON = await kv.get(getSessionKey(sessionId));
  if (!sessionJSON) return null;

  try {
    const parsedData = JSON.parse(sessionJSON) as Session;
    if (!parsedData || typeof parsedData.id !== 'string' || parsedData.id !== sessionId || typeof parsedData.userId !== 'string' || typeof parsedData.expiresAt !== 'number') {
        console.warn(`Invalid session structure for ${sessionId}. Cleaning up.`);
        await kv.delete(getSessionKey(sessionId));
        return null;
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (parsedData.expiresAt <= nowSeconds) {
      console.info(`Session ${sessionId} has expired. Cleaning up.`);
      await kv.delete(getSessionKey(sessionId));
      const userSessionsKey = getUserSessionsKey(parsedData.userId);
      const existingSessionsJson = await kv.get(userSessionsKey);
      if(existingSessionsJson) {
          let userActiveSessions : string[] = JSON.parse(existingSessionsJson);
          if (Array.isArray(userActiveSessions)) { // Ensure it's an array before filtering
            userActiveSessions = userActiveSessions.filter(id => id !== sessionId);
            if(userActiveSessions.length > 0) await kv.put(userSessionsKey, JSON.stringify(userActiveSessions));
            else await kv.delete(userSessionsKey);
          }
      }
      return null;
    }

    if (parsedData.data) {
        const dataToValidate = {
            ...parsedData.data,
            currentEntityId: parsedData.data.currentEntityId === null ? undefined : parsedData.data.currentEntityId,
        };
        const dataValidation = sessionDataSchema.safeParse(dataToValidate);
        if (!dataValidation.success) {
            console.warn(`Session data payload for ${sessionId} failed validation. Proceeding without data.`, dataValidation.error.flatten().fieldErrors);
            parsedData.data = undefined; 
        } else {
            parsedData.data = dataValidation.data as Exclude<Session['data'], undefined>;
        }
    }

    if (parsedData.data) {
      parsedData.data.lastActivityAt = nowSeconds;
      kv.put(getSessionKey(sessionId), JSON.stringify(parsedData), {
        expiration: parsedData.expiresAt
      }).catch(err => console.warn("Failed to update session lastActivityAt:", err));
    }
    return parsedData;
  } catch (error) {
    console.error('Error parsing session data from KV:', error);
    await kv.delete(getSessionKey(sessionId));
    return null;
  }
}

export async function getSessionFromRequest(
  request: Request,
  env: CloudflareEnv
): Promise<{ session: Session; user: User; sessionId: string } | null> {
  try {
    const cookies = parseCookies(request.headers.get('Cookie') || '');
    const sessionId = cookies['session-token'];
    if (!sessionId) return null;

    const session = await getSession(env, sessionId);
    if (!session || !session.userId) return null;

    const authModule = await import('./auth');
    const user = await authModule.getUserById(env, session.userId);

    if (!user) {
      await deleteSession(env, sessionId);
      return null;
    }
    return { session, user, sessionId };
  } catch (error) {
    console.error('Error getting session from request:', error);
    return null;
  }
}

export async function deleteSession(
  env: CloudflareEnv,
  sessionId: string
): Promise<void> {
  if (!sessionId) return;
  const kv = env.SESSION_KV;
  if (!kv) { console.error("SESSION_KV binding not found."); return; }

  const sessionKey = getSessionKey(sessionId);
  try {
    const sessionJSON = await kv.get(sessionKey);
    await kv.delete(sessionKey); 

    if (sessionJSON) {
      const parsedSession = JSON.parse(sessionJSON) as Partial<Session>; 
      if (parsedSession && parsedSession.userId) {
        const userSessionsKey = getUserSessionsKey(parsedSession.userId);
        const existingSessionsJson = await kv.get(userSessionsKey);
        if (existingSessionsJson) {
          try {
            let userActiveSessions: string[] = JSON.parse(existingSessionsJson);
            if (Array.isArray(userActiveSessions)) {
              userActiveSessions = userActiveSessions.filter(id => id !== sessionId);
              if (userActiveSessions.length > 0) {
                const allSessionPromises = userActiveSessions.map(id => kv.get(getSessionKey(id)));
                const allSessionStrings = await Promise.all(allSessionPromises);
                let furthestExpiryForList = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
                                
                const validUserSessions = allSessionStrings
                    .filter((s): s is string => s !== null) // FIXED: Filter out null strings first
                    .map(s => JSON.parse(s) as Session)
                    .filter(s => s && typeof s.expiresAt === 'number' && s.expiresAt > Math.floor(Date.now() / 1000));
                
                if (validUserSessions.length > 0) {
                     furthestExpiryForList = Math.max(...validUserSessions.map(s => s.expiresAt)) + (7 * 24 * 60 * 60);
                }

                await kv.put(userSessionsKey, JSON.stringify(userActiveSessions), {
                    expiration: furthestExpiryForList
                });
              } else {
                await kv.delete(userSessionsKey);
              }
            }
          } catch (e) { console.error(`Error updating user session list for ${parsedSession.userId}:`, e); }
        }
      }
    }
  } catch(error) { console.error(`Error during session deletion for ${sessionId}:`, error); }
}

export async function deleteAllUserSessions(
  env: CloudflareEnv,
  userId: string
): Promise<void> {
  if (!userId) return;
  const kv = env.SESSION_KV;
  if (!kv) { console.error("SESSION_KV binding not found."); return; }

  const userSessionsKey = getUserSessionsKey(userId);
  try {
    const existingSessionsJSON = await kv.get(userSessionsKey);
    if (existingSessionsJSON) {
      try {
        const userActiveSessions: string[] = JSON.parse(existingSessionsJSON);
        if (Array.isArray(userActiveSessions)) {
          const deletePromises = userActiveSessions.map(id => kv.delete(getSessionKey(id)));
          await Promise.allSettled(deletePromises);
        }
      } catch (e) { console.error(`Corrupted session list for user ${userId} during deleteAll:`, e); }
    }
    await kv.delete(userSessionsKey);
  } catch (error) {
    console.error(`Error deleting all sessions for user ${userId}:`, error);
  }
}

export async function extendSession(
  env: CloudflareEnv,
  sessionId: string,
  newExpiresInSeconds: number = DEFAULT_SESSION_TTL_SECONDS
): Promise<Session | null> {
  if (!sessionId) return null;
  const kv = env.SESSION_KV;
  if (!kv) { console.error("SESSION_KV binding not found."); return null; }

  if (newExpiresInSeconds <= 0 || newExpiresInSeconds > 60 * 60 * 24 * 90) {
    console.error("Invalid session extension time provided:", newExpiresInSeconds);
    return null;
  }

  const sessionKey = getSessionKey(sessionId);
  try {
    const sessionJSON = await kv.get(sessionKey);
    if (!sessionJSON) return null;

    const parsedSession = JSON.parse(sessionJSON) as Session;
     if (!parsedSession || typeof parsedSession.id !== 'string' || typeof parsedSession.userId !== 'string' || typeof parsedSession.expiresAt !== 'number') {
        console.warn(`Invalid session structure for ${sessionId} during extend. Cleaning up.`);
        await kv.delete(sessionKey);
        return null;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (parsedSession.expiresAt <= nowSeconds) {
      console.info(`Cannot extend session ${sessionId} - already expired.`);
      await deleteSession(env, sessionId);
      return null;
    }

    const updatedSessionRecord: Session = { ...parsedSession };
    updatedSessionRecord.expiresAt = nowSeconds + newExpiresInSeconds;

    const currentData = updatedSessionRecord.data || {};
    const dataPayloadToValidate: Exclude<Session['data'], undefined> = {
        ...currentData,
        lastActivityAt: nowSeconds,
        extended: true,
        extensionCount: (currentData.extensionCount || 0) + 1,
        currentEntityId: currentData.currentEntityId === null ? undefined : currentData.currentEntityId,
    };
    
    const dataValidation = sessionDataSchema.safeParse(dataPayloadToValidate);
    if (!dataValidation.success) {
        console.error("Extended session data payload failed validation:", dataValidation.error.flatten().fieldErrors);
        updatedSessionRecord.data = dataPayloadToValidate; 
    } else {
      updatedSessionRecord.data = dataValidation.data as Exclude<Session['data'], undefined>;
    }

    await kv.put(sessionKey, JSON.stringify(updatedSessionRecord), {
      expiration: updatedSessionRecord.expiresAt,
    });

    if (updatedSessionRecord.userId) {
        const userSessionsKey = getUserSessionsKey(updatedSessionRecord.userId);
        const existingUserSessionsMeta = await kv.getWithMetadata(userSessionsKey);
        if (existingUserSessionsMeta.value) { 
             const newExpirationForListKey = updatedSessionRecord.expiresAt + (7 * 24 * 60 * 60); 
             const currentListExpiration = (existingUserSessionsMeta.metadata as {expiration?: number} | null)?.expiration;
             if (!currentListExpiration || newExpirationForListKey > currentListExpiration) {
                await kv.put(userSessionsKey, existingUserSessionsMeta.value, { 
                    expiration: newExpirationForListKey
                });
             }
        }
    }
    return updatedSessionRecord;
  } catch (error) {
    console.error(`Error extending session ${sessionId}:`, error);
    return null;
  }
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      cookies[name] = parts.join('=').trim();
    }
  });
  return cookies;
}