import { getServiceSupabase } from "./src/lib/supabase-admin";
import * as dotenv from 'dotenv';

// Load env vars from .env.local
dotenv.config({ path: '.env.local' });

async function main() {
  try {
    const supabase = getServiceSupabase();
    const cohortId = "e554c4f9-f43e-43c7-b741-698bc97586df";

    console.log("Checking data for cohort:", cohortId);

    // 1. Check Scan Sessions
    const { data: sessions, error: sessionError } = await supabase
      .from("scan_sessions")
      .select("*")
      .eq("cohort_id", cohortId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (sessionError) console.error("Session Error:", sessionError);
    console.log("Recent Sessions:", sessions);

    if (sessions && sessions.length > 0) {
      const lastSession = sessions[0];
      const { count: itemCount, error: itemError } = await supabase
          .from("scan_items")
          .select("*", { count: 'exact', head: true })
          .eq("session_id", lastSession.id);
      
      console.log(`Items in last session (${lastSession.id}):`, itemCount);
      
      const { data: items } = await supabase
          .from("scan_items")
          .select("status, ai_result")
          .eq("session_id", lastSession.id)
          .limit(3);
      // console.log("Sample items from last session:", JSON.stringify(items, null, 2));
    }

    // 2. Check Subjects
    const { data: subjects, error: subjectError } = await supabase
      .from("mice")
      .select("id, name")
      .eq("cohort_id", cohortId);

    if (subjectError) console.error("Subject Error:", subjectError);
    console.log("Subjects count:", subjects?.length);

    if (subjects && subjects.length > 0) {
        // 3. Check Logs
        const subjectIds = subjects.map(s => s.id);
        const { count: totalLogs } = await supabase
          .from("estrus_logs")
          .select("*", { count: 'exact', head: true })
          .in("mouse_id", subjectIds);
        console.log("Total Logs count for cohort:", totalLogs);
        
        const { data: recentLogs } = await supabase
            .from("estrus_logs")
            .select("id, created_at, stage")
            .in("mouse_id", subjectIds)
            .order("created_at", { ascending: false })
            .limit(5);
        console.log("Most recent logs:", recentLogs);
    }
  } catch (e) {
      console.error("Script error:", e);
  }
}

main();

