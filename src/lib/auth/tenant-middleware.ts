// src/lib/auth/tenant-middleware.ts
/**
 * Middleware for ensuring tenant isolation in multi-tenant environment.
 * Validates that users only access data for entities they have permission to access.
 */

import type { APIContext } from 'astro';
import type { AstroApiHandler } from '../../types/api';
import { getSessionFromRequest } from './session';
import type { CloudflareEnv } from '@/env';
// FIXED: Changed 'import type' to 'import' for Permission enum to use its values.
import { Permission } from '@/types/auth';
import type { UserRole } from '@/types/auth'; // UserRole can remain a type import if only used for types

// STUB: Placeholder for missing entity-access-service.
// TODO: Replace with actual import and implementation from '../services/entity-access-service'
interface EntityAccessStub {
  userId: string;
  entityId: string;
  role: UserRole; // Use UserRole type
  permissions: Permission[]; // Use Permission[] type
}

async function getEntityAccess(
    userId: string,
    entityId: string,
    _env: CloudflareEnv // Use _env if not used in stub
): Promise<EntityAccessStub | null> {
    console.warn(`STUB: getEntityAccess called for user ${userId}, entity ${entityId}. Replace with actual service.`);
    // Example stub logic:
    if (userId === 'test-user-id' && entityId === 'test-entity-id-accessible') {
        // FIXED: Using Permission enum members as values
        return { userId, entityId, role: 'owner', permissions: [Permission.ViewEntity, Permission.EditEntity] };
    }
    if (userId === 'test-user-id' && entityId === 'test-entity-id-noaccess') {
        return null;
    }
    return null;
}

async function checkEntityPermission(
    userId: string,
    entityId: string,
    permission: Permission, // Use Permission type
    _env: CloudflareEnv // Use _env if not used in stub
): Promise<boolean> {
    console.warn(`STUB: checkEntityPermission called for user ${userId}, entity ${entityId}, perm ${permission}. Replace with actual service.`);
    const access = await getEntityAccess(userId, entityId, _env);
    if (!access) return false;
    return access.permissions.includes(permission);
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
        '/api/entities/',
        '/api/accounts',
        '/api/transactions',
        '/api/reports',
        '/api/documents',
        '/api/loans',
    ];
    return entitySpecificPaths.some(p => pathname.startsWith(p));
}

async function getEntityIdFromRequest(request: Request, params?: Record<string, string | undefined>): Promise<string | null> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (params?.entityId) return params.entityId;
  if (params?.id && pathSuggestsEntityContext(pathname)) return params.id;

  const queryEntityId = url.searchParams.get('entityId') || url.searchParams.get('entity_id');
  if (queryEntityId) return queryEntityId;

  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const contentType = request.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        const clonedRequest = request.clone();
        const body = await clonedRequest.json() as Partial<{ entityId: string; entity_id: string; id: string }>;
        if (body && typeof body === 'object') {
          if (typeof body.entityId === 'string') return body.entityId;
          if (typeof body.entity_id === 'string') return body.entity_id;
          if (typeof body.id === 'string' && pathSuggestsEntityContext(pathname)) return body.id;
        }
      } catch (error) { /* Ignore */ }
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
    const publicOrAuthPaths = ['/api/auth', '/api/status', '/api/health', '/api/public'];
    if (publicOrAuthPaths.some(p => urlPath.startsWith(p))) {
      return handler(context);
    }

    const sessionInfo = await getSessionFromRequest(request, env);
    if (!sessionInfo || !sessionInfo.user) {
      return createTenantErrorResponse('Authentication required.', 'AUTH_REQUIRED', 401);
    }
    locals.user = sessionInfo.user;
    locals.sessionId = sessionInfo.sessionId;
    if (locals.session) locals.session = sessionInfo.session; // Assumes App.Locals.session is Session | undefined

    const entityId = await getEntityIdFromRequest(request, params as Record<string, string | undefined>);

    if (entityId) {
      const hasAccess = await getEntityAccess(sessionInfo.user.id, entityId, env);
      if (!hasAccess) {
        return createTenantErrorResponse('Access to this entity is denied.', 'ENTITY_ACCESS_DENIED', 403);
      }
      locals.currentEntityId = entityId; // Assumes App.Locals.currentEntityId is string | undefined
    } else if (pathSuggestsEntityContext(urlPath)) {
      // return createTenantErrorResponse('Entity identifier missing for this request.', 'ENTITY_ID_MISSING', 400);
    }
    return handler(context);
  };
}

export function withEntityPermission(
  permission: Permission // Use imported Permission enum value
): (handler: AstroApiHandler) => AstroApiHandler {
  return (handler: AstroApiHandler): AstroApiHandler => {
    const tenantIsolatedHandler = withTenantIsolation(async (context: APIContext): Promise<Response> => {
      const { locals, request } = context;
      const env = locals.runtime?.env as CloudflareEnv;

      if (!locals.user?.id) {
        return createTenantErrorResponse('User context not found.', 'AUTH_REQUIRED', 500);
      }
      if (!locals.currentEntityId) {
        console.warn(`PermissionCheck: No currentEntityId for permission '${permission}' at ${request.url}.`);
        return createTenantErrorResponse('Entity context required for this permission.', 'ENTITY_CONTEXT_MISSING', 400);
      }
      if (!env) {
        return createTenantErrorResponse('Server configuration error.', 'SERVER_CONFIG_ERROR', 500);
      }

      const hasPerm = await checkEntityPermission(
        locals.user.id,
        locals.currentEntityId,
        permission, // Pass Permission enum value directly
        env
      );

      if (!hasPerm) {
        return createTenantErrorResponse(`Permission denied. Requires: '${permission}'.`, 'PERMISSION_DENIED', 403);
      }
      return handler(context);
    });
    return tenantIsolatedHandler;
  };
}