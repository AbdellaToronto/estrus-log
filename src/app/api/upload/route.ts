import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Storage } from "@google-cloud/storage";

// Configure for larger uploads - Vercel allows up to 4.5MB for serverless, 
// but we can stream larger files
export const runtime = "nodejs";
export const maxDuration = 60; // 60 seconds timeout

function getGcs() {
  const projectId = process.env.GCP_PROJECT_ID;
  const bucketName = process.env.GCS_BUCKET_NAME;
  const credentials = process.env.GCP_SERVICE_ACCOUNT_KEY;

  if (!projectId || !bucketName || !credentials) {
    throw new Error("Missing GCS configuration");
  }

  const storage = new Storage({
    projectId,
    credentials: JSON.parse(credentials),
  });

  return { storage, bucket: storage.bucket(bucketName) };
}

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const cohortId = formData.get("cohortId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const { bucket } = getGcs();

    // Organize by Org/User -> Cohort -> Logs
    const rootPath = orgId ? `orgs/${orgId}` : `users/${userId}`;
    const subPath = cohortId ? `${cohortId}/logs` : "uploads";
    const path = `${rootPath}/${subPath}/${Date.now()}-${file.name}`;
    
    const gcsFile = bucket.file(path);

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to GCS
    await gcsFile.save(buffer, {
      contentType: file.type,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });

    // Make the file public
    await gcsFile.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${path}`;

    return NextResponse.json({ publicUrl, path });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}

