"use client";

import { OrganizationProfile } from "@clerk/nextjs";
import { PendingRequests } from "@/components/org-admin/pending-requests";
import { UserPlus, Settings, Users } from "lucide-react";

// Custom icon component for the pending requests page
const PendingIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    <circle cx="19" cy="11" r="1" fill="currentColor" />
  </svg>
);

export default function OrganizationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <OrganizationProfile
          routing="path"
          path="/organization"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-lg rounded-2xl",
            },
          }}
        >
          {/* Custom Pending Requests Page */}
          <OrganizationProfile.Page
            label="Join Requests"
            labelIcon={<PendingIcon />}
            url="requests"
          >
            <PendingRequests />
          </OrganizationProfile.Page>

          {/* Reorder default pages */}
          <OrganizationProfile.Page label="members" />
          <OrganizationProfile.Page label="general" />
        </OrganizationProfile>
      </div>
    </div>
  );
}

