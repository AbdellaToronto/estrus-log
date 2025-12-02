import { getScanSessionDetail } from "@/app/actions";
import { ScanReceiptClient } from "./scan-receipt-client";
import { notFound } from "next/navigation";

export default async function ScanReceiptPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  
  const session = await getScanSessionDetail(sessionId);

  if (!session) {
    notFound();
  }

  return <ScanReceiptClient session={session} />;
}

