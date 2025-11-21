import { auth as clerkAuth } from "@clerk/nextjs/server"

/**
 * Require authenticated user; throw if not signed in
 *
 * @returns Clerk auth object
 * @throws If user is not authenticated
 */
export async function requireUser(): Promise<{ userId: string; orgId: string | null }> {
  const authData = await clerkAuth()
  if (!authData.userId) {
    throw new Error("Unauthorized: user not signed in")
  }
  return { userId: authData.userId, orgId: authData.orgId ?? null }
}

/**
 * Get current user ID or null
 */
export async function getCurrentUserId(): Promise<string | null> {
  const authData = await clerkAuth()
  return authData.userId ?? null
}
