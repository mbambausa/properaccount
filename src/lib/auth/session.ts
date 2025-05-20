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
import type { CloudflareEnv } from '@/env';

// Constants for session management
const SESSION_PREFIX = 'session:';
const USER_SESSIONS_PREFIX = 'user_sessions:';
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24; // 1 day
const MAX_SESSIONS_PER_USER = 5; // Limit the number of concurrent sessions per user

/**
 * Gets the full key for a session in KV storage
 * @param sessionId The unique session identifier
 * @returns The prefixed KV key for the session
 */
function getSessionKey(sessionId: string): string {
  return `${SESSION_PREFIX}${sessionId}`;
}

/**
 * Gets the full key for tracking a user's sessions in KV storage
 * @param userId The unique user identifier
 * @returns The prefixed KV key for user sessions tracking
 */
function getUserSessionsKey(userId: string): string {
  return `${USER_SESSIONS_PREFIX}${userId}`;
}

/**
 * Creates a new session for a user
 * @param env Cloudflare environment bindings
 * @param userId The ID of the user to create a session for
 * @param expiresInSeconds Session duration in seconds (default: 1 day)
 * @param sessionDetails Additional metadata to store with the session
 * @returns The newly created session object
 */
export async function createSession(
  env: CloudflareEnv,
  userId: string,
  expiresInSeconds: number = DEFAULT_SESSION_TTL_SECONDS,
  sessionDetails: Record<string, any> = {}
): Promise<Session> {
  if (!userId) {
    throw new Error("User ID is required to create a session");
  }

  // Validate expiration time
  if (expiresInSeconds <= 0 || expiresInSeconds > 60 * 60 * 24 * 90) { // Max 90 days
    throw new Error("Invalid session expiration time");
  }

  const sessionId = generateToken(32); // 32 bytes for session ID
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + expiresInSeconds;

  // Add useful metadata to the session
  const sessionToStore: Session = {
    id: sessionId,
    userId,
    createdAt: now,
    expiresAt,
    data: { 
      ...sessionDetails,
      createdAt: now,
      lastActivity: now,
      userAgent: sessionDetails.userAgent || 'unknown',
      ip: sessionDetails.ip || 'unknown' 
    }
  };

  // Validate session data structure
  const validationResult = sessionSchema.safeParse(sessionToStore);
  if (!validationResult.success) {
    console.error("Session data failed validation:", validationResult.error.flatten().fieldErrors);
    throw new Error(`Invalid session data for creation: ${validationResult.error.errors[0]?.message}`);
  }

  const kv = env.SESSION_KV;
  if (!kv) throw new Error("SESSION_KV binding not found in environment.");

  try {
    // Store the session with proper expiration
    await kv.put(getSessionKey(sessionId), JSON.stringify(validationResult.data), {
      expiration: expiresAt,
    });

    // Track this session for the user to manage concurrent sessions
    const userSessionsKey = getUserSessionsKey(userId);
    let userSessions: string[] = [];
    
    try {
      const existingSessionsJSON = await kv.get(userSessionsKey);
      if (existingSessionsJSON) {
        userSessions = JSON.parse(existingSessionsJSON);
        // Ensure userSessions is an array
        if (!Array.isArray(userSessions)) {
          userSessions = [];
          console.warn(`Invalid user sessions data for user ${userId}. Resetting.`);
        }
      }
    } catch (error) {
      console.error(`Error retrieving user sessions for ${userId}:`, error);
      // Continue with an empty array
    }
    
    // Add the new session ID
    userSessions.push(sessionId);
    
    // Enforce the session limit per user
    if (userSessions.length > MAX_SESSIONS_PER_USER) {
      // Remove the oldest sessions (first in the array)
      const oldestSessionIds = userSessions.splice(0, userSessions.length - MAX_SESSIONS_PER_USER);
      
      // Delete the oldest sessions in a batch operation
      const deletePromises = oldestSessionIds.map(oldId => kv.delete(getSessionKey(oldId)));
      await Promise.allSettled(deletePromises);
    }
    
    // Store the updated list of sessions for this user
    await kv.put(userSessionsKey, JSON.stringify(userSessions), { 
      // Set expiration to the furthest future session expiry (add a buffer of 7 days)
      expiration: expiresAt + (7 * 24 * 60 * 60)
    });

    return validationResult.data;
  } catch (error) {
    console.error("Error creating session:", error);
    throw new Error("Failed to create session. Please try again.");
  }
}

/**
 * Retrieves a session by ID
 * @param env Cloudflare environment bindings
 * @param sessionId The unique session identifier
 * @returns The session object if found and valid, null otherwise
 */
export async function getSession(
  env: CloudflareEnv,
  sessionId: string
): Promise<Session | null> {
  if (!sessionId) return null;
  
  const kv = env.SESSION_KV;
  if (!kv) { 
    console.error("SESSION_KV binding not found."); 
    return null; 
  }

  // Get session from KV store
  const sessionJSON = await kv.get(getSessionKey(sessionId));
  if (!sessionJSON) return null;

  try {
    const parsedData = JSON.parse(sessionJSON);
    const validationResult = sessionSchema.safeParse(parsedData);
    
    if (validationResult.success) {
      // Check if session is expired
      const now = Math.floor(Date.now() / 1000);
      if (validationResult.data.expiresAt <= now) {
        console.info(`Session ${sessionId} has expired. Cleaning up.`);
        await kv.delete(getSessionKey(sessionId));
        return null;
      }
      
      // Update last activity time if session is retrieved successfully
      // We'll do this in a non-blocking way to avoid slowing down the request
      try {
        const sessionData = validationResult.data;
        if (sessionData.data) {
          sessionData.data.lastActivity = now;
          kv.put(getSessionKey(sessionId), JSON.stringify(sessionData), {
            expiration: sessionData.expiresAt
          }).catch(err => {
            console.warn("Failed to update session last activity:", err);
          });
        }
      } catch (updateError) {
        // Don't fail the session retrieval if activity update fails
        console.warn("Error updating session activity:", updateError);
      }
      
      return validationResult.data;
    }
    
    console.warn('Session data from KV failed validation:', validationResult.error.flatten().fieldErrors);
    // Attempt to clean up invalid session data
    await kv.delete(getSessionKey(sessionId));
    return null;
  } catch (error) {
    console.error('Error parsing session data from KV:', error);
    // Clean up corrupted session data
    await kv.delete(getSessionKey(sessionId));
    return null;
  }
}

/**
 * Retrieves session and user data from a request
 * @param request The incoming request object
 * @param env Cloudflare environment bindings
 * @returns Session and user data if available
 */
export async function getSessionFromRequest(
  request: Request,
  env: CloudflareEnv
): Promise<{ session: Session; user: any; sessionId: string } | null> {
  try {
    // Extract session ID from cookies
    const cookies = parseCookies(request.headers.get('Cookie') || '');
    const sessionId = cookies['session-token'];
    
    if (!sessionId) {
      return null;
    }
    
    // Get session data
    const session = await getSession(env, sessionId);
    if (!session || !session.userId) {
      return null;
    }
    
    // Get user data (imported from auth)
    const { getUserById } = await import('./auth');
    const user = await getUserById(env, session.userId);
    
    if (!user) {
      return null;
    }
    
    return {
      session,
      user,
      sessionId
    };
  } catch (error) {
    console.error('Error getting session from request:', error);
    return null;
  }
}

/**
 * Deletes a session by ID
 * @param env Cloudflare environment bindings
 * @param sessionId The unique session identifier
 */
export async function deleteSession(
  env: CloudflareEnv,
  sessionId: string
): Promise<void> {
  if (!sessionId) return;
  
  const kv = env.SESSION_KV;
  if (!kv) { 
    console.error("SESSION_KV binding not found."); 
    return; 
  }

  const sessionKey = getSessionKey(sessionId);

  try {
    // Get the session to find the userId
    const sessionJSON = await kv.get(sessionKey);
    
    if (sessionJSON) {
      const parsedSession = JSON.parse(sessionJSON);
      const validationResult = sessionSchema.safeParse(parsedSession); 
      
      if (validationResult.success && validationResult.data.userId) {
        const userId = validationResult.data.userId;
        
        // Get the user's sessions list
        const userSessionsKey = getUserSessionsKey(userId);
        const existingSessionsJSON = await kv.get(userSessionsKey);
        
        if (existingSessionsJSON) {
          try {
            let userSessions: string[] = JSON.parse(existingSessionsJSON);
            
            // Remove this session ID from the list
            userSessions = userSessions.filter(id => id !== sessionId);
            
            // Update the user sessions list
            if (userSessions.length > 0) {
              await kv.put(userSessionsKey, JSON.stringify(userSessions), {
                // Keep the same expiration that was set when creating
                expiration: validationResult.data.expiresAt + (7 * 24 * 60 * 60)
              });
            } else {
              // No more sessions for this user, remove the tracking key
              await kv.delete(userSessionsKey);
            }
          } catch(parseError) {
            console.error("Error parsing user sessions list:", parseError);
          }
        }
      }
    }
    
    // Delete the session itself
    await kv.delete(sessionKey);
  } catch(error) {
    console.error("Error during session deletion:", error);
  }
}

/**
 * Deletes all sessions for a user
 * @param env Cloudflare environment bindings
 * @param userId The unique user identifier
 */
export async function deleteAllUserSessions(
  env: CloudflareEnv,
  userId: string
): Promise<void> {
  if (!userId) return;
  
  const kv = env.SESSION_KV;
  if (!kv) { 
    console.error("SESSION_KV binding not found."); 
    return; 
  }

  const userSessionsKey = getUserSessionsKey(userId);
  
  try {
    const existingSessionsJSON = await kv.get(userSessionsKey);
    
    if (existingSessionsJSON) {
      try {
        const userSessions: string[] = JSON.parse(existingSessionsJSON);
        
        // Delete all session records in parallel
        const deletePromises = userSessions.map(id => kv.delete(getSessionKey(id)));
        await Promise.allSettled(deletePromises);
      } catch (parseError) {
        console.error("Error parsing user's session list for multi-deletion:", parseError);
      }
    }
    
    // Delete the tracking key
    await kv.delete(userSessionsKey);
  } catch (error) {
    console.error("Error deleting all user sessions:", error);
    throw new Error("Failed to delete all sessions");
  }
}

/**
 * Extends a session's expiration time
 * @param env Cloudflare environment bindings
 * @param sessionId The unique session identifier
 * @param newExpiresInSeconds New session duration in seconds (default: 1 day)
 * @returns The updated session object if successful, null otherwise
 */
export async function extendSession(
  env: CloudflareEnv,
  sessionId: string,
  newExpiresInSeconds: number = DEFAULT_SESSION_TTL_SECONDS
): Promise<Session | null> {
  if (!sessionId) return null;
  
  const kv = env.SESSION_KV;
  if (!kv) { 
    console.error("SESSION_KV binding not found."); 
    return null; 
  }

  // Validate the extension time
  if (newExpiresInSeconds <= 0 || newExpiresInSeconds > 60 * 60 * 24 * 90) { // Max 90 days
    console.error("Invalid session extension time:", newExpiresInSeconds);
    return null;
  }

  const sessionKey = getSessionKey(sessionId);
  
  try {
    // Get the current session
    const sessionJSON = await kv.get(sessionKey);
    if (!sessionJSON) return null;

    const parsedSession = JSON.parse(sessionJSON);
    let validationResult = sessionSchema.safeParse(parsedSession);
    
    if (!validationResult.success) {
      console.warn('Invalid session data found during extend:', validationResult.error.flatten().fieldErrors);
      await kv.delete(sessionKey);
      return null;
    }
    
    const sessionData = validationResult.data;
    const now = Math.floor(Date.now() / 1000);
    
    // Check if session is already expired
    if (sessionData.expiresAt <= now) {
      console.info(`Cannot extend session ${sessionId} - already expired.`);
      await kv.delete(sessionKey);
      return null;
    }
    
    // Set new expiration time
    sessionData.expiresAt = now + newExpiresInSeconds;
    
    // Update last activity time
    if (sessionData.data) {
      sessionData.data.lastActivity = now;
      sessionData.data.extended = true;
      sessionData.data.extensionCount = (sessionData.data.extensionCount || 0) + 1;
    }

    // Validate the updated session
    validationResult = sessionSchema.safeParse(sessionData); 
    if (!validationResult.success) {
      console.error("Extended session data failed validation:", validationResult.error.flatten().fieldErrors);
      throw new Error("Invalid session data for extension.");
    }
    
    const updatedSessionData = validationResult.data;

    // Store the updated session
    await kv.put(sessionKey, JSON.stringify(updatedSessionData), {
      expiration: updatedSessionData.expiresAt,
    });

    // Update the user sessions tracking if needed
    if (updatedSessionData.userId) {
      const userSessionsKey = getUserSessionsKey(updatedSessionData.userId);
      const existingUserSessions = await kv.get(userSessionsKey); 
      
      if (existingUserSessions) {
        // Update the expiration time of the user sessions list
        await kv.put(userSessionsKey, existingUserSessions, { 
          expiration: updatedSessionData.expiresAt + (7 * 24 * 60 * 60) 
        });
      }
    }
    
    return updatedSessionData;
  } catch (error) {
    console.error('Error extending session:', error);
    return null;
  }
}

/**
 * Helper function to parse cookies from a cookie header string
 * @param cookieHeader Cookie header string
 * @returns Object with cookie name-value pairs
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value !== undefined) {
      cookies[name] = value;
    }
  });
  
  return cookies;
}