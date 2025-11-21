import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database-types";

let client: SupabaseClient<Database> | null = null;

export function getServiceSupabase() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  client = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });

  return client;
}
