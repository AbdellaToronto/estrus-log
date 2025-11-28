"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser, useOrganizationList } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Building2,
  Users,
  FlaskConical,
  ArrowRight,
  Loader2,
  Plus,
  CheckCircle2,
  Clock,
  Crown,
  Shield,
} from "lucide-react";
import { searchOrganizations, requestToJoinOrganization, getMyJoinRequests, type DiscoverableOrg, type JoinRequest } from "@/app/actions";
import { cn } from "@/lib/utils";

// Extended type for display that includes user's role
type DisplayOrg = DiscoverableOrg & {
  userRole?: string;
  isFromClerk?: boolean;
};

export default function DiscoverPage() {
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();
  const { userMemberships, isLoaded: membershipsLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [discoveredOrgs, setDiscoveredOrgs] = useState<DiscoverableOrg[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [myRequests, setMyRequests] = useState<(JoinRequest & { organization: DiscoverableOrg | null })[]>([]);
  const [requestingOrgId, setRequestingOrgId] = useState<string | null>(null);

  // Get user's current org memberships as a map for quick lookup
  const membershipMap = useMemo(() => {
    const map = new Map<string, { role: string; name: string; imageUrl?: string }>();
    userMemberships?.data?.forEach((m) => {
      map.set(m.organization.id, {
        role: m.role,
        name: m.organization.name,
        imageUrl: m.organization.imageUrl,
      });
    });
    return map;
  }, [userMemberships?.data]);

  // Combine discovered orgs with user's own orgs (from Clerk)
  const organizations: DisplayOrg[] = useMemo(() => {
    // Start with user's own orgs from Clerk (these always show)
    const myOrgs: DisplayOrg[] = (userMemberships?.data || []).map((m) => ({
      id: m.organization.id, // Use Clerk org ID
      clerk_org_id: m.organization.id,
      name: m.organization.name,
      institution: null,
      department: m.organization.name,
      description: null,
      logo_url: m.organization.imageUrl || null,
      member_count: m.organization.membersCount || 1,
      created_at: m.organization.createdAt?.toISOString() || new Date().toISOString(),
      userRole: m.role,
      isFromClerk: true,
    }));

    // Add discovered orgs that aren't already in user's orgs
    const myOrgClerkIds = new Set(myOrgs.map((o) => o.clerk_org_id));
    const otherOrgs: DisplayOrg[] = discoveredOrgs
      .filter((o) => !myOrgClerkIds.has(o.clerk_org_id))
      .map((o) => ({
        ...o,
        userRole: membershipMap.get(o.clerk_org_id)?.role,
        isFromClerk: false,
      }));

    // Filter by search query
    const allOrgs = [...myOrgs, ...otherOrgs];
    if (!searchQuery.trim()) return allOrgs;

    const query = searchQuery.toLowerCase();
    return allOrgs.filter(
      (o) =>
        o.name?.toLowerCase().includes(query) ||
        o.institution?.toLowerCase().includes(query) ||
        o.department?.toLowerCase().includes(query) ||
        o.description?.toLowerCase().includes(query)
    );
  }, [userMemberships?.data, discoveredOrgs, membershipMap, searchQuery]);

  // Get pending request org IDs (using clerk_org_id from the organization)
  const pendingRequestOrgIds = new Set(
    myRequests.filter((r) => r.status === "pending").map((r) => r.organization?.clerk_org_id).filter(Boolean)
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
        setDiscoveredOrgs(orgs);
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

  // Search handler - just update local filter, don't re-fetch
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Request to join handler
  const handleRequestJoin = async (org: DisplayOrg) => {
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

  const getOrgStatus = (org: DisplayOrg): { status: string; role?: string } => {
    // If user has a role, they're a member
    if (org.userRole) {
      return { status: "member", role: org.userRole };
    }
    if (pendingRequestOrgIds.has(org.clerk_org_id)) {
      return { status: "pending" };
    }
    return { status: "none" };
  };

  const getRoleBadge = (role: string) => {
    switch (role.toLowerCase()) {
      case "org:admin":
      case "admin":
        return (
          <Badge className="bg-purple-100 text-purple-700 border-purple-200">
            <Shield className="w-3 h-3 mr-1" />
            Admin
          </Badge>
        );
      case "org:owner":
      case "owner":
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
            <Crown className="w-3 h-3 mr-1" />
            Owner
          </Badge>
        );
      default:
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Member
          </Badge>
        );
    }
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
              const { status, role } = getOrgStatus(org);
              return (
                <div
                  key={org.clerk_org_id}
                  className={cn(
                    "bg-white rounded-2xl border p-6 transition-all hover:shadow-lg",
                    status === "member"
                      ? role?.toLowerCase().includes("owner")
                        ? "border-amber-200 bg-amber-50/30"
                        : role?.toLowerCase().includes("admin")
                        ? "border-purple-200 bg-purple-50/30"
                        : "border-green-200 bg-green-50/30"
                      : status === "pending"
                      ? "border-amber-200 bg-amber-50/30"
                      : "border-slate-200 hover:border-blue-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        {org.logo_url ? (
                          <img
                            src={org.logo_url}
                            alt={org.name}
                            className="w-12 h-12 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                            {org.name?.[0] || org.institution?.[0] || "L"}
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-lg text-slate-900">
                            {org.name || org.institution || "Research Lab"}
                          </h3>
                          {org.institution && org.name !== org.institution && (
                            <p className="text-sm text-slate-500">{org.institution}</p>
                          )}
                          {org.department && org.name !== org.department && (
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
                      </div>
                    </div>

                    <div className="shrink-0">
                      {status === "member" && role ? (
                        getRoleBadge(role)
                      ) : status === "pending" ? (
                        <Badge className="bg-slate-100 text-slate-700 border-slate-200">
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

