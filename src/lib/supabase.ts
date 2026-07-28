import { createClient, SupabaseClient } from "@supabase/supabase-js"
import "server-only"

export type SupabaseConfig = {
  url: string
  anonKey: string
  serviceRoleKey?: string
}

/**
 * Create a Supabase client with RLS enabled using the user's Clerk JWT token.
 * This should be used for all user-facing queries where RLS policies apply.
 *
 * @param accessToken - The Clerk JWT token (from getToken())
 * @returns Supabase client with RLS enabled
 */
export function createAuthClient(accessToken: string): SupabaseClient {
  const config = configFromEnv()
  const localDevelopment = process.env.ESTRUS_LOCAL_DEVELOPMENT === "true"

  // Clerk's development JWT is intentionally not signed by local Supabase.
  // For the private local stack, server actions keep Clerk as the identity
  // provider and use the local service key solely to avoid a fake RLS setup.
  // This flag is set only by scripts/dev-local.sh, never by deployed builds.
  if (localDevelopment) {
    if (!config.serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for local development")
    }

    return createClient(config.url, config.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }
  
  return createClient(config.url, config.anonKey, {
    // Supabase's first-class Clerk integration expects the current session
    // token through accessToken so every Data API request is authenticated
    // against the configured Clerk OIDC issuer.
    accessToken: async () => accessToken,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

/**
 * Create a Supabase client with service role key (bypasses RLS).
 * Use this ONLY for:
 * - Webhooks (server-to-server, no user context)
 * - Admin operations that explicitly need to bypass RLS
 * - Public data queries (like org discovery)
 *
 * @returns Supabase client with admin privileges
 */
export function createAdminClient(): SupabaseClient {
  const config = configFromEnv()
  
  if (!config.serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin client")
  }
  
  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

/**
 * @deprecated Use createAuthClient(token) for RLS or createAdminClient() for admin operations
 */
export function createServerClient(config: SupabaseConfig, accessToken?: string) {
  const key = accessToken ? config.anonKey : (config.serviceRoleKey ?? config.anonKey)

  return createClient(config.url, key, {
    ...(accessToken ? { accessToken: async () => accessToken } : {}),
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

/**
 * Resolve Supabase config from environment variables
 */
export function configFromEnv(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase config: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY required"
    )
  }

  return { url, anonKey, serviceRoleKey }
}
