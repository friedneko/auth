/**
 * Role-Based Access Control utilities for the IDP.
 */

import { getDb } from "@/lib/env";
import { roles, userRoles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { inArray } from "drizzle-orm";

// Permission types for the IDP itself
export type IdpPermission =
  | "use_authorize"
  | "use_token"
  | "use_userinfo"
  | "manage_clients"
  | "manage_users"
  | "configure";

// Roles defined in the system
export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: Record<string, unknown>;
  createdAt: number;
}

// Check if a user has a specific permission
export async function userHasPermission(
  userId: number,
  permission: IdpPermission,
): Promise<boolean> {
  const db = await getDb();

  // Get all roles
  const allRoles = await db.select().from(roles);

  // Get user's roles
  const results = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  const userRoleIds = results.map((ur) => ur.roleId);

  // Check for admin role
  for (const role of allRoles) {
    if (role.name === "admin" && userRoleIds.includes(role.id)) {
      return true;
    }
  }

  // Check specific permissions
  for (const role of allRoles) {
    if (userRoleIds.includes(role.id)) {
      const perms = JSON.parse(role.permissions || "{}");
      if (perms["*"] === true || perms[permission] === true) {
        return true;
      }
    }
  }

  return false;
}

// Synchronous role check from session JWT (for performance)
// Since role is in the JWT, we can check it without DB lookup
export function rbacHasRole(userRole: string | undefined | null, requiredRole: string): boolean {
  if (!userRole) return false;
  if (userRole === "admin") return true;
  if (requiredRole === "admin") return false;
  return userRole === requiredRole;
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

// Get user's roles
export async function getUserRoles(userId: number): Promise<Role[]> {
  const db = await getDb();

  // Get user role mappings
  const results = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  const roleIds = results.map((ur) => ur.roleId);

  if (roleIds.length === 0) return [];

  // Get role details
  const roleRows = await db.select().from(roles).where(inArray(roles.id, roleIds));

  return roleRows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    permissions: JSON.parse(r.permissions || "{}"),
    createdAt: r.createdAt,
  }));
}
