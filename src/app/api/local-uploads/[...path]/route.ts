import { readFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { isLocalRehearsal } from "@/lib/auth";

export const runtime = "nodejs";

// Rehearsal uploads are intentionally temporary and never deployed. Keeping
// them under the OS temp root also prevents production file tracing from
// treating the repository's research datasets as function dependencies.
const ROOT = join(tmpdir(), "estrus-rehearsal-uploads");
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
};

const localPath = (parts: string[]) => {
  if (
    parts.length !== 2 ||
    !parts.every((part) => /^[a-zA-Z0-9._-]+$/.test(part))
  ) {
    return null;
  }
  const target = resolve(join(ROOT, ...parts));
  return target.startsWith(`${ROOT}/`) ? target : null;
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (!isLocalRehearsal()) return new NextResponse("Not found", { status: 404 });
  const target = localPath((await params).path);
  if (!target) return new NextResponse("Invalid upload path", { status: 400 });

  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) {
    return new NextResponse("Image must be between 1 byte and 10 MB", { status: 400 });
  }
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    return new NextResponse("Only images can be uploaded", { status: 415 });
  }

  await mkdir(/* turbopackIgnore: true */ resolve(target, ".."), {
    recursive: true,
  });
  await writeFile(/* turbopackIgnore: true */ target, bytes, { flag: "wx" });
  return new NextResponse(null, { status: 201 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (!isLocalRehearsal()) return new NextResponse("Not found", { status: 404 });
  const target = localPath((await params).path);
  if (!target) return new NextResponse("Invalid upload path", { status: 400 });

  try {
    const bytes = await readFile(/* turbopackIgnore: true */ target);
    return new NextResponse(bytes, {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "Content-Type": MIME_BY_EXTENSION[extname(target).toLowerCase()] || "application/octet-stream",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
