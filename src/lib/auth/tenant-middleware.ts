// src/lib/auth/tenant-middleware.ts
/**
 * Middleware for ensuring tenant isolation in multi-tenant environment.
 * Validates that users only access data for entities they have permission to access.
 */

import type { APIContext } from 'astro';
import type { AstroApiHandler } from '../../types/api';
import { getSessionFromRequest } from './session';
import type { CloudflareEnv } from '@/env';
import { Permission } from '@/types/auth'; // Enum values are needed
import type { UserRole, Session, User } from '@/types/auth';

// STUB: Placeholder for actual entity-access-service.
// TODO: Replace with actual import and implementation from '../services/entity-access-service'
// This service would typically interact with a D1 table storing entity access records.
interface EntityAccessStub {
  userId: string;
  entityId: string;
  role: UserRole;
  permissions: Permission[];
}

async function getEntityAccess(
    userId: string,
    entityId: string,
    _env: CloudflareEnv // _env indicates it might not be used in this stub
): Promise<EntityAccessStub | null> {
    console.warn(`STUB: getEntityAccess called for user ${userId}, entity ${entityId}. Needs actual implementation.`);
    // Example stub logic (replace with database lookup):
    if (userId === 'stub-user-full-access' && entityId === 'stub-entity-1') {
        return { userId, entityId, role: 'owner', permissions: Object.values(Permission) };
    }
    if (userId === 'stub-user-view-only' && entityId === 'stub-entity-1') {
        return { userId, entityId, role: 'viewer', permissions: [Permission.ViewEntity, Permission.ViewAccounts] };
    }
    return null; // Default to no access
}

async function checkEntityPermission(
    userId: string,
    entityId: string,
    permissionToCheck: Permission,
    _env: CloudflareEnv // _env indicates it might not be used in this stub
): Promise<boolean> {
    console.warn(`STUB: checkEntityPermission called for user ${userId}, entity ${entityId}, perm ${permissionToCheck}. Needs actual implementation.`);
    const access = await getEntityAccess(userId, entityId, _env);
    if (!access) return false;
    return access.permissions.includes(permissionToCheck);
}
// END STUB

interface TenantErrorResponse {
  success: false;
  error: { message: string; code: string; statusCode: number; };
}

function createTenantErrorResponse(message: string, code: string, statusCode: number): Response {
  const errorBody: TenantErrorResponse = {
    success: false,
    error: { message, code, statusCode }
  };
  return new Response(JSON.stringify(errorBody), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' }
  });
}

function pathSuggestsEntityContext(pathname: string): boolean {
    const entitySpecificPaths = [
        '/api/entities/', // Note: /api/entities itself might be to list/create (no ID yet)
        '/api/accounts',
        '/api/transactions',
        '/api/reports',
        '/api/documents',
        '/api/loans',
        // Add other paths that are always entity-specific
    ];
    // More precise check: if the path segment after /api/entities/ is an ID, or if other paths always imply entity context.
    if (pathname.match(/^\/api\/entities\/[^/]+(\/|$)/)) return true; // e.g., /api/entities/{id}/*
    return entitySpecificPaths.some(p => pathname.startsWith(p) && pathname !== p && pathname !== `${p}/`); // Avoids matching base path like /api/accounts if it's for listing all accessible
}

async function getEntityIdFromRequest(request: Request, params?: Record<string, string | undefined>): Promise<string | null> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 1. From path parameters (e.g., /api/entities/:entityId/details)
  if (params?.entityId) return params.entityId;
  // For generic :id in path, check if context suggests it's an entityId
  if (params?.id && pathSuggestsEntityContext(pathname)) return params.id;


  // 2. From query parameters
  const queryEntityId = url.searchParams.get('entityId') || url.searchParams.get('entity_id');
  if (queryEntityId) return queryEntityId;

  // 3. From JSON body for state-changing requests
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const contentType = request.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        // Clone request to read body, as it can only be read once
        const clonedRequest = request.clone();
        const body = await clonedRequest.json() as Partial<{ entityId: string; entity_id: string; id: string; [key:string]: any }>; // More generic body type
        
        if (body && typeof body === 'object') {
          if (typeof body.entityId === 'string') return body.entityId;
          if (typeof body.entity_id === 'string') return body.entity_id;
          // If 'id' is in body, only consider it if path suggests entity context
          if (typeof body.id === 'string' && pathSuggestsEntityContext(pathname)) return body.id;
        }
      } catch (error) {
        console.warn('Could not parse JSON body for entityId extraction:', error);
        // Ignore error, proceed as if entityId wasn't in body
      }
    }
  }
  return null;
}

export function withTenantIsolation(handler: AstroApiHandler): AstroApiHandler {
  return async (context: APIContext): Promise<Response> => {
    const { request, locals, params } = context;
    const env = locals.runtime?.env as CloudflareEnv | undefined;

    if (!env) {
      console.error("withTenantIsolation: CloudflareEnv not found in locals.");
      return createTenantErrorResponse('Server configuration error.', 'SERVER_CONFIG_ERROR', 500);
    }

    const urlPath = new URL(request.url).pathname;
    // Paths that do not require user authentication or entity context
    const publicOrAuthPaths = ['/api/auth', '/api/status', '/api/health', '/api/public'];
    if (publicOrAuthPaths.some(p => urlPath.startsWith(p))) {
      return handler(context);
    }

    const sessionInfo = await getSessionFromRequest(request, env);
    if (!sessionInfo || !sessionInfo.user) {
      return createTenantErrorResponse('Authentication required.', 'AUTH_REQUIRED', 401);
    }
    // Populate locals with authenticated user and session info
    locals.user = sessionInfo.user as User; // Cast if User from types/auth is more specific
    locals.sessionId = sessionInfo.sessionId;
    locals.session = sessionInfo.session as Session; // Cast if Session from types/auth is more specific

    const entityId = await getEntityIdFromRequest(request, params as Record<string, string | undefined>);

    if (entityId) {
      const hasAccess = await getEntityAccess(sessionInfo.user.id, entityId, env);
      if (!hasAccess) {
        return createTenantErrorResponse(`Access to entity '${entityId}' is denied.`, 'ENTITY_ACCESS_DENIED', 403);
      }
      // User has access to this entity, set it in locals
      locals.currentEntityId = entityId;
      // Potentially store the user's role/permissions for this entity in locals if needed by subsequent handlers
      // locals.currentEntityRole = hasAccess.role;
      // locals.currentEntityPermissions = hasAccess.permissions;
    } else if (pathSuggestsEntityContext(urlPath) && !urlPath.endsWith('/entities')) {
      // If the path suggests an entity context is needed (and it's not a general listing/creation path for entities themselves),
      // but no entityId was found, this is an issue.
      // This is a design decision: either error, or proceed if the handler can operate without
      // an explicit entityId (e.g., by using a default from session, or if it's listing entities user has access to).
      // For now, if an entityId is strictly required by a handler wrapped with this, that handler should check locals.currentEntityId.
      // console.warn(`TenantIsolation: Entity identifier missing for path ${urlPath}, but path suggests entity context.`);
      // return createTenantErrorResponse('Entity identifier missing for this request.', 'ENTITY_ID_MISSING', 400);
    }
    
    // If no specific entityId is in the request, but user has a 'currentEntityId' in their session data,
    // you might want to populate locals.currentEntityId from there as a default.
    // This depends on your application flow.
    if (!locals.currentEntityId && locals.session?.data?.currentEntityId) {
        // Before assigning, re-verify access to this session-defaulted entityId if it wasn't from the current request.
        const hasAccessToSessionDefaultEntity = await getEntityAccess(sessionInfo.user.id, locals.session.data.currentEntityId, env);
        if (hasAccessToSessionDefaultEntity) {
            locals.currentEntityId = locals.session.data.currentEntityId;
        } else {
            console.warn(`User ${sessionInfo.user.id} session currentEntityId ${locals.session.data.currentEntityId} is no longer valid or accessible.`);
            // Clear it from session data to avoid reuse? Or let session update handle it.
        }
    }


    return handler(context);
  };
}

export function withEntityPermission(
  permissionToCheck: Permission
): (handler: AstroApiHandler) => AstroApiHandler {
  return (handler: AstroApiHandler): AstroApiHandler => {
    // First, apply tenant isolation to ensure user and entity context (if any) are set up.
    const tenantIsolatedHandler = withTenantIsolation(async (context: APIContext): Promise<Response> => {
      const { locals, request } = context;
      const env = locals.runtime?.env as CloudflareEnv; // Already checked in withTenantIsolation

      // User should always be populated by withTenantIsolation if we reach here for a permissioned route
      if (!locals.user?.id) {
        // This case should ideally be caught by withTenantIsolation already
        return createTenantErrorResponse('User context not found. Authentication may have failed or is missing.', 'INTERNAL_AUTH_ERROR', 500);
      }
      // For an entity-specific permission, currentEntityId must be established
      if (!locals.currentEntityId) {
        console.warn(`PermissionCheck: No currentEntityId set for permission '${permissionToCheck}' at ${request.url}. Path might require entity context not provided or determinable.`);
        return createTenantErrorResponse('Entity context required for this permission.', 'ENTITY_CONTEXT_MISSING', 400);
      }
      if (!env) { // Should have been caught earlier
        return createTenantErrorResponse('Server configuration error.', 'SERVER_CONFIG_ERROR', 500);
      }

      const hasPerm = await checkEntityPermission(
        locals.user.id,
        locals.currentEntityId,
        permissionToCheck,
        env
      );

      if (!hasPerm) {
        return createTenantErrorResponse(`Permission denied. Action requires: '${permissionToCheck}'.`, 'PERMISSION_DENIED', 403);
      }
      return handler(context);
    });
    return tenantIsolatedHandler;
  };
}