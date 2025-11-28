"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, useOrganizationList } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Building2,
  Users,
  Globe,
  FlaskConical,
  ArrowRight,
  Loader2,
  Plus,
  CheckCircle2,
  Clock,
  ExternalLink,
} from "lucide-react";
import { searchOrganizations, requestToJoinOrganization, getMyJoinRequests } from "@/app/actions";
import { cn } from "@/lib/utils";

type Organization = {
  id: string;
  clerk_org_id: string;
  institution: string | null;
  department: string | null;
  description: string | null;
  website_url: string | null;
  member_count: number | null;
};

type JoinRequest = {
  id: string;
  organization_id: string;
  status: string;
};

export default function DiscoverPage() {
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();
  const { userMemberships, isLoaded: membershipsLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [myRequests, setMyRequests] = useState<JoinRequest[]>([]);
  const [requestingOrgId, setRequestingOrgId] = useState<string | null>(null);

  // Get user's current org memberships
  const memberOrgIds = new Set(
    userMemberships?.data?.map((m) => m.organization.id) || []
  );

  // Get pending request org IDs
  const pendingRequestOrgIds = new Set(
    myRequests.filter((r) => r.status === "pending").map((r) => r.organization_id)
  );

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsSearching(true);
      try {
        const [orgs, requests] = await Promise.all([
          searchOrganizations(""),
          user ? getMyJoinRequests() : Promise.resolve([]),
        ]);
        setOrganizations(orgs);
        setMyRequests(requests);
      } catch (e) {
        console.error("Failed to load data", e);
      } finally {
        setIsSearching(false);
      }
    };
    if (userLoaded) {
      loadData();
    }
  }, [userLoaded, user]);

  // Search handler
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setIsSearching(true);
    try {
      const results = await searchOrganizations(query);
      setOrganizations(results);
    } catch (e) {
      console.error("Search failed", e);
    } finally {
      setIsSearching(false);
    }
  };

  // Request to join handler
  const handleRequestJoin = async (org: Organization) => {
    if (!user) {
      router.push("/sign-in");
      return;
    }

    setRequestingOrgId(org.id);
    try {
      await requestToJoinOrganization(org.id, "I'd like to join your lab.");
      // Refresh requests
      const requests = await getMyJoinRequests();
      setMyRequests(requests);
    } catch (e) {
      console.error("Failed to request join", e);
      alert("Failed to send join request. Please try again.");
    } finally {
      setRequestingOrgId(null);
    }
  };

  const getOrgStatus = (org: Organization) => {
    if (memberOrgIds.has(org.clerk_org_id)) {
      return "member";
    }
    if (pendingRequestOrgIds.has(org.id)) {
      return "pending";
    }
    return "none";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="max-w-5xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100/80 text-blue-700 text-sm font-medium mb-6">
            <Building2 className="w-4 h-4" />
            Discover Labs
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Find Your Research Community
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Browse research labs and institutions. Request to join teams working on 
            projects that interest you, or create your own lab.
          </p>
        </div>

        {/* Search */}
        <div className="max-w-2xl mx-auto mb-10">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search labs by name, institution, or research area..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-12 h-14 text-lg rounded-2xl border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-blue-500/20"
            />
            {isSearching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 animate-spin" />
            )}
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {organizations.length === 0 && !isSearching ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FlaskConical className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No labs found
              </h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                {searchQuery
                  ? "Try a different search term or browse all labs"
                  : "Be the first to create a lab and start collaborating!"}
              </p>
              {user && (
                <Button
                  onClick={() => router.push("/onboarding")}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create a Lab
                </Button>
              )}
            </div>
          ) : (
            organizations.map((org) => {
              const status = getOrgStatus(org);
              return (
                <div
                  key={org.id}
                  className={cn(
                    "bg-white rounded-2xl border p-6 transition-all hover:shadow-lg",
                    status === "member"
                      ? "border-green-200 bg-green-50/30"
                      : status === "pending"
                      ? "border-amber-200 bg-amber-50/30"
                      : "border-slate-200 hover:border-blue-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                          {org.institution?.[0] || "L"}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-slate-900">
                            {org.institution || "Research Lab"}
                          </h3>
                          {org.department && (
                            <p className="text-sm text-slate-500">{org.department}</p>
                          )}
                        </div>
                      </div>

                      {org.description && (
                        <p className="text-slate-600 mb-4 line-clamp-2">
                          {org.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {org.member_count || 1} member{(org.member_count || 1) !== 1 ? "s" : ""}
                        </span>
                        {org.website_url && (
                          <a
                            href={org.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <Globe className="w-4 h-4" />
                            Website
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {status === "member" ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Member
                        </Badge>
                      ) : status === "pending" ? (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                          <Clock className="w-3 h-3 mr-1" />
                          Pending
                        </Badge>
                      ) : (
                        <Button
                          onClick={() => handleRequestJoin(org)}
                          disabled={requestingOrgId === org.id}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {requestingOrgId === org.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <ArrowRight className="w-4 h-4 mr-2" />
                          )}
                          Request to Join
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Create Lab CTA */}
        {user && (
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-2 text-slate-500 mb-4">
              <div className="w-12 h-px bg-slate-200" />
              <span className="text-sm">or</span>
              <div className="w-12 h-px bg-slate-200" />
            </div>
            <div>
              <Button
                variant="outline"
                onClick={() => router.push("/onboarding")}
                className="rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your Own Lab
              </Button>
            </div>
          </div>
        )}

        {/* Sign in prompt for non-authenticated users */}
        {!user && userLoaded && (
          <div className="mt-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-8 text-center text-white">
            <h3 className="text-xl font-bold mb-2">Ready to join?</h3>
            <p className="text-blue-100 mb-6">
              Sign in to request access to labs or create your own research team.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button
                onClick={() => router.push("/sign-in")}
                className="bg-white text-blue-600 hover:bg-blue-50"
              >
                Sign In
              </Button>
              <Button
                onClick={() => router.push("/sign-up")}
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
              >
                Create Account
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

