import { createClient, SupabaseClient } from "@supabase/supabase-js"

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
  
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
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
  
  const options: {
    auth: { persistSession: boolean; autoRefreshToken: boolean; detectSessionInUrl: boolean };
    global?: { headers: { Authorization: string } };
  } = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }

  if (accessToken) {
    options.global = {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  }

  return createClient(config.url, key, options)
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
