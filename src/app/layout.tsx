import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Estrus Log - AI-Powered Biological Image Classification",
  description: "Track and classify biological samples with AI. Upload images, get instant classification, and gain insights into your research data.",
};

import { ClerkProvider } from '@clerk/nextjs'
import { Sidebar } from "@/components/layout/sidebar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      afterSignOutUrl="/"
      signInFallbackRedirectUrl="/onboarding"
      signUpFallbackRedirectUrl="/onboarding"
    >
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
        >
          <Sidebar />
          <main className="pl-72 pr-4 py-4 min-h-screen">
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}
