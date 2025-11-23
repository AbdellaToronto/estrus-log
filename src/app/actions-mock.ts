"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createServerClient, configFromEnv } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function generateMockExperiment() {
  const { userId, orgId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken();
  const supabase = createServerClient(configFromEnv(), token || undefined);

  // 1. Create Experiment
  const { data: experiment, error: expError } = await supabase
    .from("experiments")
    .insert({
      user_id: userId,
      org_id: orgId || null,
      name: `Estrous Variability Study ${new Date().getFullYear()} (Mock)`,
      description:
        "Comprehensive mock dataset simulating a 30-day study on environmental stress effects. Includes cohorts, subjects, daily logs, and batch scan sessions.",
      status: "active",
      start_date: new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString(), // 30 days ago
      end_date: new Date().toISOString(),
    })
    .select()
    .single();

  if (expError) throw expError;

  // 2. Create Cohorts
  const cohortsData = [
    {
      name: "Control Group (Mock)",
      description: "Standard housing conditions, no stress.",
      color: "bg-blue-500",
    },
    {
      name: "Stress Group (Mock)",
      description: "Variable chronic stress protocol.",
      color: "bg-red-500",
    },
  ];

  const createdCohorts = [];

  for (const c of cohortsData) {
    const { data: cohort, error: cohortError } = await supabase
      .from("cohorts")
      .insert({
        user_id: userId,
        org_id: orgId || null,
        name: c.name,
        description: c.description,
        color: c.color,
        type: "estrus_tracking",
        subject_config: { fields: ["dob", "genotype", "cage_number"] },
        log_config: {
          stages: ["Proestrus", "Estrus", "Metestrus", "Diestrus"],
          features: ["swelling_score", "color_score", "moistness", "opening"],
        },
      })
      .select()
      .single();

    if (cohortError) throw cohortError;
    createdCohorts.push(cohort);

    // Link to Experiment
    await supabase.from("experiment_cohorts").insert({
      experiment_id: experiment.id,
      cohort_id: cohort.id,
    });
  }

  // 3. Create Subjects, Logs, and Scan Sessions
  const stages = ["Proestrus", "Estrus", "Metestrus", "Diestrus"];

  for (const cohort of createdCohorts) {
    // Create a few Scan Sessions for this cohort to simulate batch processing
    // We'll create one for "today" and one for "yesterday"
    const sessions = [];
    for (let d = 0; d < 2; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const { data: session } = await supabase
        .from("scan_sessions")
        .insert({
          cohort_id: cohort.id,
          user_id: userId,
          name: `Batch Scan - ${date.toLocaleDateString()}`,
          status: "completed",
          created_at: date.toISOString(),
        })
        .select()
        .single();
      if (session) sessions.push({ ...session, dateStr: date.toDateString() });
    }

    // Create 8 mice per cohort
    for (let i = 1; i <= 8; i++) {
      const mouseName = `${cohort.name.split(" ")[0]}-${i}`;
      const { data: mouse, error: mouseError } = await supabase
        .from("mice")
        .insert({
          user_id: userId,
          org_id: orgId || null,
          cohort_id: cohort.id,
          name: mouseName,
          status: "Active",
          metadata: {
            dob: "2023-06-15",
            genotype: i % 2 === 0 ? "WT" : "Het",
            cage_number: `C-${Math.ceil(i / 4)}`,
            treatment_start: "2023-09-01",
          },
        })
        .select()
        .single();

      if (mouseError) throw mouseError;

      // Generate 30 days of logs
      const logs = [];
      let currentStageIndex = Math.floor(Math.random() * 4); // Random start

      for (let d = 30; d >= 0; d--) {
        const date = new Date();
        date.setDate(date.getDate() - d);
        date.setHours(
          9 + Math.floor(Math.random() * 4),
          Math.floor(Math.random() * 60)
        );

        // Cycle logic
        const currentStage = stages[currentStageIndex];
        let advance = false;
        if (currentStage === "Estrus") {
          advance = Math.random() > 0.3;
        } else if (currentStage === "Diestrus") {
          advance = Math.random() > 0.7;
        } else {
          advance = Math.random() > 0.5;
        }
        if (advance) {
          currentStageIndex = (currentStageIndex + 1) % 4;
        }

        // Create Log
        const confidenceScore = 0.75 + Math.random() * 0.24;
        const swelling = Math.floor(Math.random() * 4);
        const color = Math.floor(Math.random() * 4);

        const logEntry = {
          mouse_id: mouse.id,
          cohort_id: cohort.id, // explicit linking
          stage: stages[currentStageIndex],
          confidence: {
            score: confidenceScore,
            verdict: confidenceScore > 0.9 ? "high" : "medium",
          },
          features: {
            swelling_score: swelling.toString(),
            color_score: color.toString(),
            moistness: Math.random() > 0.5 ? "wet" : "dry",
            opening: Math.random() > 0.5 ? "open" : "closed",
          },
          data: {
            weight_g: (20 + Math.random() * 5).toFixed(1),
            temperature_c: (36.5 + Math.random()).toFixed(1),
            handler: "Mock User",
          },
          image_url: null, // We'll link scan items for recent ones
          notes:
            d % 5 === 0 ? "Routine check." : d % 12 === 0 ? "Flagged for review" : "",
          created_at: date.toISOString(),
        };

        // Insert Log first
        const { data: insertedLog } = await supabase
          .from("estrus_logs")
          .insert(logEntry)
          .select()
          .single();

        if (insertedLog) {
          // If this log corresponds to one of our mock sessions (today/yesterday), create a scan item
          const matchingSession = sessions.find(
            (s) => s.dateStr === date.toDateString()
          );
          if (matchingSession) {
            await supabase.from("scan_items").insert({
              session_id: matchingSession.id,
              image_url: `https://placehold.co/400x400/png?text=${mouse.name}-${insertedLog.stage}`, // Mock image
              status: "completed",
              mouse_id: mouse.id,
              ai_result: {
                stage: insertedLog.stage,
                confidence: insertedLog.confidence,
                features: insertedLog.features,
              },
              created_at: date.toISOString(),
            });
            
            // Update log to have image url
            await supabase.from("estrus_logs").update({
                image_url: `https://placehold.co/400x400/png?text=${mouse.name}-${insertedLog.stage}`
            }).eq('id', insertedLog.id);
          }
        }
      }
    }
  }

  revalidatePath("/experiments");
  return { success: true, experimentId: experiment.id };
}
