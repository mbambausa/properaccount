// src/lib/auth/tenant-middleware.ts
/**
 * Middleware for ensuring tenant isolation in multi-tenant environment.
 * Validates that users only access data for entities they have permission to access.
 */

import type { CloudflareApiHandler } from '../../types/api';
import { getSession } from './session';
import { getEntityAccess } from '../services/entity-access-service';

/**
 * Error response for tenant isolation violations
 */
interface TenantError {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
  };
}

/**
 * Creates a tenant error response with the given message and status code
 */
function createTenantError(message: string, code: string, statusCode: number): Response {
  const error: TenantError = {
    success: false,
    error: {
      message,
      code,
      statusCode
    }
  };
  
  return new Response(JSON.stringify(error), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Gets the entity ID from the request (URL params, query string, or JSON body)
 */
async function getEntityIdFromRequest(request: Request, params?: Record<string, string>): Promise<string | null> {
  // Check URL params
  if (params?.entityId) {
    return params.entityId;
  }
  
  // Check query string
  const url = new URL(request.url);
  const queryEntityId = url.searchParams.get('entityId');
  if (queryEntityId) {
    return queryEntityId;
  }
  
  // Check JSON body for POST/PUT/PATCH requests
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    try {
      const clonedRequest = request.clone();
      const body = await clonedRequest.json();
      if (body && typeof body === 'object' && body.entityId) {
        return body.entityId;
      }
      if (body && typeof body === 'object' && body.entity_id) {
        return body.entity_id;
      }
    } catch (error) {
      // If body isn't valid JSON or doesn't have entityId, continue
    }
  }
  
  return null;
}

/**
 * Verifies if a user has access to the specified entity
 */
async function verifyEntityAccess(
  userId: string | undefined, 
  entityId: string, 
  env: Record<string, unknown>
): Promise<boolean> {
  if (!userId) {
    return false;
  }
  
  try {
    const access = await getEntityAccess(userId, entityId, env);
    return !!access; // If access exists, user has permission
  } catch (error) {
    console.error('Error verifying entity access:', error);
    return false;
  }
}

/**
 * Middleware that enforces tenant isolation.
 * Ensures the user only accesses data for entities they have permission to access.
 */
export function withTenantIsolation(handler: CloudflareApiHandler): CloudflareApiHandler {
  return async (context) => {
    const { request, env, cookies, params } = context;
    
    // Skip tenant validation for public endpoints or authentication endpoints
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/auth') || 
        url.pathname === '/api/status') {
      return handler(context);
    }
    
    // Get current user from session
    const session = await getSession(cookies, env);
    if (!session) {
      return createTenantError('Authentication required', 'AUTH_REQUIRED', 401);
    }
    
    // Get entity ID from request
    const entityId = await getEntityIdFromRequest(request, params);
    if (!entityId) {
      // If no entity ID is found, this might be a global operation or non-entity specific endpoint
      // For now, we'll allow it, but you might want to restrict based on endpoint
      return handler(context);
    }
    
    // Check if user has access to this entity
    const hasAccess = await verifyEntityAccess(session.userId, entityId, env);
    if (!hasAccess) {
      return createTenantError(
        'You do not have access to this entity', 
        'ENTITY_ACCESS_DENIED', 
        403
      );
    }
    
    // Pass entity context to handler
    context.locals = context.locals || {};
    context.locals.entityId = entityId;
    context.locals.userId = session.userId;
    
    // Log access for audit
    console.info(`User ${session.userId} accessing entity ${entityId}`);
    
    // Proceed with the handler
    return handler(context);
  };
}

/**
 * Middleware that checks for specific entity permissions
 */
export function withEntityPermission(permission: string, handler: CloudflareApiHandler): CloudflareApiHandler {
  return withTenantIsolation(async (context) => {
    const { env, locals } = context;
    
    if (!locals?.userId || !locals?.entityId) {
      return createTenantError('Authentication required', 'AUTH_REQUIRED', 401);
    }
    
    // Check if user has the specific permission for this entity
    const hasPermission = await checkEntityPermission(
      locals.userId, 
      locals.entityId, 
      permission,
      env
    );
    
    if (!hasPermission) {
      return createTenantError(
        `You don't have the required permission: ${permission}`,
        'PERMISSION_DENIED',
        403
      );
    }
    
    return handler(context);
  });
}

/**
 * Checks if a user has a specific permission for an entity
 */
async function checkEntityPermission(
  userId: string, 
  entityId: string, 
  permission: string,
  env: Record<string, unknown>
): Promise<boolean> {
  try {
    const access = await getEntityAccess(userId, entityId, env);
    if (!access) return false;
    
    return access.permissions.includes(permission);
  } catch (error) {
    console.error('Error checking entity permission:', error);
    return false;
  }
}