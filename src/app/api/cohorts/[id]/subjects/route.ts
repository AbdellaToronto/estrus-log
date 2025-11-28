import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, configFromEnv } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: cohortId } = await params;
    const token = await getToken();
    const supabase = createServerClient(configFromEnv(), token || undefined);

    const { data, error } = await supabase
      .from("mice")
      .select("id, name")
      .eq("cohort_id", cohortId)
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to fetch subjects:", error);
      return NextResponse.json(
        { error: "Failed to fetch subjects" },
        { status: 500 }
      );
    }

    return NextResponse.json({ subjects: data ?? [] });
  } catch (error) {
    console.error("Error in subjects API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

