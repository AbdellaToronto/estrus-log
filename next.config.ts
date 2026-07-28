import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // These native packages are used only by the local Asset Studio vector
  // exporter. Keep them in Node's module graph so optional platform bindings
  // (VTracer, resvg, sharp) resolve on the developer's machine.
  serverExternalPackages: ["@neplex/vectorizer", "@resvg/resvg-js", "sharp"],
  // The local rehearsal upload route is deliberately unavailable in deployed
  // environments. Turbopack can otherwise trace the repository's research
  // corpora through its development-only filesystem root and inflate the
  // serverless function by more than a gigabyte.
  outputFileTracingExcludes: {
    "/api/local-uploads/*": [
      "./dataset_*/**/*",
      "./MPP/**/*",
      "./python-service/**/*",
      "./research/**/*",
      "./sam3_endpoint_repo/**/*",
      "./tests/**/*",
      "./work/**/*",
      "./tmp/**/*",
      "./supabase/**/*",
      "./*.zip",
      "./tsconfig.tsbuildinfo",
    ],
  },
  devIndicators: false,
  // Playwright uses 127.0.0.1 while the local workflow server also answers on
  // localhost. Keep development resources available to that explicit test host.
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
