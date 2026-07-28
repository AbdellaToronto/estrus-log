import {
  auth as clerkAuth,
  currentUser as clerkCurrentUser,
} from "@clerk/nextjs/server"

export const LOCAL_REHEARSAL_USER_ID = "user_local_scientist"
export const LOCAL_REHEARSAL_ORG_ID = "org_local_estrus_lab"

export function isLocalRehearsal() {
  return (
    process.env.ESTRUS_LOCAL_DEVELOPMENT === "true" &&
    process.env.ESTRUS_LOCAL_TEST_IDENTITY === "true"
  )
}

/**
 * Clerk-compatible auth for the isolated local rehearsal stack.
 * The fixed identity is available only when both local-development flags are
 * explicitly enabled; deployed builds always use Clerk.
 */
export async function auth(): Promise<Awaited<ReturnType<typeof clerkAuth>>> {
  if (!isLocalRehearsal()) return clerkAuth()

  return {
    userId: LOCAL_REHEARSAL_USER_ID,
    orgId: LOCAL_REHEARSAL_ORG_ID,
    getToken: async () => "local-rehearsal-token",
  } as Awaited<ReturnType<typeof clerkAuth>>
}

export async function currentUser(): Promise<
  Awaited<ReturnType<typeof clerkCurrentUser>>
> {
  if (!isLocalRehearsal()) return clerkCurrentUser()

  return {
    id: LOCAL_REHEARSAL_USER_ID,
    firstName: "Local",
    lastName: "Scientist",
    fullName: "Local Scientist",
    imageUrl: "",
    emailAddresses: [{ emailAddress: "scientist@estrus.local" }],
  } as Awaited<ReturnType<typeof clerkCurrentUser>>
}

/**
 * Require authenticated user; throw if not signed in
 *
 * @returns Clerk auth object
 * @throws If user is not authenticated
 */
export async function requireUser(): Promise<{ userId: string; orgId: string | null }> {
  const authData = await auth()
  if (!authData.userId) {
    throw new Error("Unauthorized: user not signed in")
  }
  return { userId: authData.userId, orgId: authData.orgId ?? null }
}

/**
 * Get current user ID or null
 */
export async function getCurrentUserId(): Promise<string | null> {
  const authData = await auth()
  return authData.userId ?? null
}
