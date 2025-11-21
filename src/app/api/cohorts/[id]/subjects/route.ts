import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerClient, configFromEnv } from "@/lib/supabase";

type RouteParams = Promise<{ id: string }>;

export async function GET(_req: Request, context: { params: RouteParams }) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: "Missing cohort id" },
        { status: 400 }
      );
    }

    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = await getToken();
    const supabase = createServerClient(configFromEnv(), token || undefined);

    const { data, error } = await supabase
      .from("mice")
      .select("id, name, created_at")
      .eq("cohort_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[subjects-api] failed to load subjects", error);
      return NextResponse.json(
        { error: "Failed to fetch subjects" },
        { status: 500 }
      );
    }

    return NextResponse.json({ subjects: data ?? [] });
  } catch (err) {
    console.error("[subjects-api] unexpected error", err);
    return NextResponse.json(
      { error: "Failed to fetch subjects" },
      { status: 500 }
    );
  }
}

