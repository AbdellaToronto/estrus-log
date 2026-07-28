import { notFound } from "next/navigation";
import { AssetStudioClient } from "./asset-studio-client";

export default function AssetStudioPage() {
  if (process.env.NODE_ENV === "production" && process.env.ESTRUS_ASSET_STUDIO !== "true") {
    notFound();
  }
  return <AssetStudioClient />;
}
