import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@xyflow/react/dist/style.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Estrus Log - Daily mouse cycle records",
  description: "Capture, review, and export scientist-confirmed mouse estrus-cycle observations.",
};

import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AppContent } from "@/components/layout/app-content";
import { RouteAwareClerkProvider } from "@/components/auth/route-aware-clerk-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <RouteAwareClerkProvider>
          <Sidebar />
          <MobileNav />
          <AppContent>{children}</AppContent>
        </RouteAwareClerkProvider>
      </body>
    </html>
  );
}
