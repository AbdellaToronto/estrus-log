import { createClient } from "@supabase/supabase-js"

export type SupabaseConfig = {
  url: string
  anonKey: string
  serviceRoleKey?: string
}

/**
 * Create a Supabase client for server-side usage with service role key
 *
 * @param config Supabase configuration
 * @returns Supabase client with admin privileges
 */
export function createServerClient(config: SupabaseConfig, accessToken?: string) {
  const key = accessToken ? config.anonKey : (config.serviceRoleKey ?? config.anonKey)
  
  const options: any = {
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
