/**
 * Role-Based Access Control utilities for the IDP.
 * 
 * Normalized RBAC with separate permissions table for better scalability.
 */

import { getDb } from "@/lib/env";
import { roles, userRoles, permissions, rolePermissions } from "@/lib/db/schema";
import { eq, inArray, and } from "drizzle-orm";

// Permission types for the IDP itself
export type IdpPermission =
  | "use_authorize"
  | "use_token"
  | "use_userinfo"
  | "manage_clients"
  | "manage_users"
  | "view_stats"
  | "configure";

/** Permission constants */
export const PERMISSION = {
  AUTHORIZE: "use_authorize",
  TOKEN: "use_token",
  USERINFO: "use_userinfo",
  MANAGE_CLIENTS: "manage_clients",
  MANAGE_USERS: "manage_users",
  VIEW_STATS: "view_stats",
  CONFIGURE: "configure",
} as const;

// Roles defined in the system
export interface Role {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  permissions: Permission[];
  createdAt: number;
}

export interface Permission {
  id: string;
  name: string;
  description: string | null;
  createdAt: number;
}

/**
 * Check if a role has a specific permission.
 */
export async function roleHasPermission(
  roleName: string,
  permission: string,
): Promise<boolean> {
  // Admin role gets all permissions
  if (roleName === "admin") return true;
  
  const db = await getDb();
  
  // Get the role's permissions
  const result = await db
    .select({ permId: permissions.id })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
    .where(and(eq(roles.name, roleName), eq(permissions.id, permission)));
  
  return result.length > 0;
}

/**
 * Get all permissions for a role.
 */
export async function getRolePermissions(roleName: string): Promise<Permission[]> {
  const db = await getDb();
  
  // Admin has all permissions
  if (roleName === "admin") {
    const allPerms = await db.select().from(permissions);
    return allPerms.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.createdAt,
    }));
  }
  
  const result = await db
    .select({
      id: permissions.id,
      name: permissions.name,
      description: permissions.description,
      createdAt: permissions.createdAt,
    })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
    .where(eq(roles.name, roleName));
  
  return result;
}

/**
 * Check if a user has a specific permission by checking all their roles.
 */
export async function userHasPermission(
  userId: number,
  permission: IdpPermission,
): Promise<boolean> {
  const db = await getDb();

  // Get user's roles
  const userRoleRows = await db
    .select({ roleName: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  // Admin automatically has all permissions
  for (const row of userRoleRows) {
    if (row.roleName === "admin") return true;
  }

  // Check if any role has the permission
  const roleNames = userRoleRows.map((r) => r.roleName);
  if (roleNames.length === 0) return false;

  const result = await db
    .select({ hasPerm: rolePermissions.permissionId })
    .from(rolePermissions)
    .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(
      and(
        inArray(roles.name, roleNames),
        eq(permissions.id, permission)
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Synchronous permission check from session.
 * Used in route handlers where we already have the user's role and permissions.
 */
export function sessionHasPermission(
  userPermissions: string[] | undefined | null,
  requiredPermission: string,
): boolean {
  if (!userPermissions) return false;
  return userPermissions.includes(requiredPermission);
}

/**
 * Weight-based role check for hierarchy support.
 */
export function rbacHasRoleWeight(userRoleWeight: number | undefined | null, minimumWeight: number): boolean {
  if (userRoleWeight === undefined || userRoleWeight === null) return false;
  return userRoleWeight >= minimumWeight;
}

// Synchronous role check from session (role fetched from DB)
export function rbacHasRole(userRole: string | undefined | null, requiredRole: string): boolean {
  if (!userRole) return false;
  if (userRole === "admin") return true;
  if (requiredRole === "admin") return false;
  return userRole === requiredRole;
}

/**
 * Weight-based role check for hierarchy support.
 */
export function rbacHasRoleWithMinWeight(
  userRoleInfo: { name: string; weight: number } | undefined | null,
  minimumWeight: number,
): boolean {
  return rbacHasRoleWeight(userRoleInfo?.weight, minimumWeight);
}

// Assign role to user
export async function assignRole(userId: number, roleId: string): Promise<boolean> {
  const db = await getDb();
  const role = await db
    .select()
    .from(roles)
    .where(eq(roles.id, roleId))
    .then((r) => r[0]);
  if (!role) return false;

  await db.insert(userRoles).values({ userId, roleId });
  return true;
}

// Assign permission to role
export async function assignPermissionToRole(roleId: string, permissionId: string): Promise<boolean> {
  const db = await getDb();
  
  // Check if role and permission exist
  const [role, perm] = await Promise.all([
    db.select().from(roles).where(eq(roles.id, roleId)).then(r => r[0]),
    db.select().from(permissions).where(eq(permissions.id, permissionId)).then(r => r[0])
  ]);
  
  if (!role || !perm) return false;

  await db.insert(rolePermissions).values({ roleId, permissionId });
  return true;
}

// Get user's roles
export async function getUserRoles(userId: number): Promise<Role[]> {
  const db = await getDb();

  const roleRows = await db
    .select({
      id: roles.id,
      name: roles.name,
      description: roles.description,
      weight: roles.weight,
      createdAt: roles.createdAt,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  if (roleRows.length === 0) return [];

  // Get permissions for each role in parallel
  const permissionPromises = roleRows.map(async (row) => {
    const perms = await getRolePermissions(row.name);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      weight: row.weight,
      permissions: perms,
      createdAt: row.createdAt,
    };
  });

  return Promise.all(permissionPromises);
}

// Get all permissions
export async function getAllPermissions(): Promise<Permission[]> {
  const db = await getDb();
  const perms = await db.select().from(permissions);
  return perms;
}

// Get all roles with their permissions count
export async function getRolesWithPermissionCounts() {
  const db = await getDb();
  
  const rolesData = await db.select({
    id: roles.id,
    name: roles.name,
    description: roles.description,
    weight: roles.weight,
    createdAt: roles.createdAt,
  }).from(roles);
  
  // Get permission counts in parallel
  const countPromises = rolesData.map(async (r) => {
    const permCount = await db
      .select({ count: rolePermissions.permissionId })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, r.id))
      .then(rows => rows[0]?.count ?? 0);
    
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      weight: r.weight,
      permissionCount: permCount,
      createdAt: r.createdAt,
    };
  });
  
  return Promise.all(countPromises);
}