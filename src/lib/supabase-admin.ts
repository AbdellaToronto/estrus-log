import { createClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database-types";

let client: ReturnType<typeof createClient<Database>> | null = null;

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
