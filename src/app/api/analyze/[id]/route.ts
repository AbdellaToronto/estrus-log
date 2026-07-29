/**
 * Retrieve a stored demo analysis so a result can be revisited or shared.
 *
 * Images are re-signed on every read rather than stored as public URLs, so a
 * shared link keeps working while the underlying objects stay private.
 */

import { NextRequest } from "next/server";
import { loadDemoAnalysis } from "@/lib/server/demo-analysis-store";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await loadDemoAnalysis<Record<string, unknown>>(id);

  if (!record) {
    return Response.json(
      { error: "That analysis is no longer available." },
      { status: 404 }
    );
  }

  return Response.json({
    ...record.result,
    id: record.id,
    original_url: record.originalUrl,
    cropped_image: record.segmentedUrl,
    created_at: record.createdAt,
  });
}
