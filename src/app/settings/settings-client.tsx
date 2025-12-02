"use client";

import {
  OrganizationProfile,
  UserProfile,
  useOrganization,
  CreateOrganization,
} from "@clerk/nextjs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  PlusCircle,
  Building2,
  Users,
  Clock,
  Check,
  X,
  Loader2,
  Eye,
  EyeOff,
  FlaskConical,
  FolderKanban,
  Database,
  AlertTriangle,
} from "lucide-react";
import { useState, useEffect, useTransition } from "react";
import {
  getPendingRequestsForOrg,
  approveJoinRequest,
  denyJoinRequest,
  getOrganizationProfile,
  updateOrganizationProfile,
  getUserDataSummary,
  type JoinRequest,
} from "@/app/actions";

type DataSummary = {
  totalCohorts: number;
  totalMice: number;
  totalLogs: number;
  byOrg: Array<{
    orgId: string | null;
    orgName: string;
    institution: string | null;
    cohortCount: number;
    isOrphaned: boolean;
  }>;
};

export function SettingsClient() {
  const { organization, isLoaded, membership } = useOrganization();
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Org profile state
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [institution, setInstitution] = useState("");
  const [description, setDescription] = useState("");

  // Join requests
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);

  // Data summary
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);

  const isAdmin = membership?.role === "org:admin";

  const loadOrgData = async () => {
    if (!organization?.id) return;

    const profile = await getOrganizationProfile(organization.id);
    if (profile) {
      setIsDiscoverable(profile.is_discoverable);
      setInstitution(profile.institution || "");
      setDescription(profile.description || "");
    }

    if (isAdmin) {
      const requests = await getPendingRequestsForOrg(organization.id);
      setPendingRequests(requests);
    }
  };

  const loadDataSummary = async () => {
    const summary = await getUserDataSummary();
    setDataSummary(summary);
  };

  // Load org profile and pending requests
  useEffect(() => {
    if (organization?.id) {
      loadOrgData();
    }
    loadDataSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  const handleSaveOrgSettings = () => {
    if (!organization?.id) return;

    startTransition(async () => {
      try {
        await updateOrganizationProfile(organization.id, {
          isDiscoverable,
          institution: institution || undefined,
          description: description || undefined,
        });
        await loadOrgData();
      } catch (error) {
        console.error("Error saving settings:", error);
      }
    });
  };

  const handleApproveRequest = (requestId: string) => {
    startTransition(async () => {
      try {
        await approveJoinRequest(requestId);
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      } catch (error) {
        console.error("Error approving request:", error);
      }
    });
  };

  const handleDenyRequest = (requestId: string) => {
    startTransition(async () => {
      try {
        await denyJoinRequest(requestId);
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      } catch (error) {
        console.error("Error denying request:", error);
      }
    });
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="organization" className="w-full">
      <TabsList className="w-full max-w-[500px] grid grid-cols-3 h-10 sm:h-11">
        <TabsTrigger value="organization" className="text-sm sm:text-base">
          Lab
        </TabsTrigger>
        <TabsTrigger value="profile" className="text-sm sm:text-base">
          Profile
        </TabsTrigger>
        <TabsTrigger value="data" className="text-sm sm:text-base">
          My Data
        </TabsTrigger>
      </TabsList>

      {/* Organization/Lab Settings Tab */}
      <TabsContent value="organization" className="mt-4 sm:mt-6 space-y-6">
        {showCreateOrg ? (
          <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex justify-center items-center min-h-[400px] sm:min-h-[600px]">
            <div className="w-full max-w-[480px]">
              <div className="mb-4">
                <Button
                  variant="ghost"
                  onClick={() => setShowCreateOrg(false)}
                  className="text-sm"
                >
                  ← Back to Settings
                </Button>
              </div>
              <CreateOrganization afterCreateOrganizationUrl="/settings" />
            </div>
          </div>
        ) : !organization ? (
          <Card className="glass-panel border-0 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                No Lab Selected
              </CardTitle>
              <CardDescription>
                You are currently working without a lab. Create or join a lab to
                collaborate with your team.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="p-4 rounded-full bg-primary/10 text-primary mb-2">
                <FlaskConical className="w-12 h-12" />
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setShowCreateOrg(true)}>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Create New Lab
                </Button>
                <Button variant="outline" asChild>
                  <a href="/discover">Find a Lab</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Lab Discovery Settings */}
            <Card className="glass-panel border-0 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Lab Discovery Settings
                </CardTitle>
                <CardDescription>
                  Control how your lab appears to other researchers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50">
                  <div className="flex items-center gap-3">
                    {isDiscoverable ? (
                      <Eye className="w-5 h-5 text-green-600" />
                    ) : (
                      <EyeOff className="w-5 h-5 text-slate-400" />
                    )}
                    <div>
                      <p className="font-medium">Lab Visibility</p>
                      <p className="text-sm text-muted-foreground">
                        {isDiscoverable
                          ? "Visible to other researchers"
                          : "Private - invite only"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={isDiscoverable ? "default" : "outline"}
                    onClick={() => setIsDiscoverable(!isDiscoverable)}
                    disabled={!isAdmin}
                  >
                    {isDiscoverable ? "Public" : "Private"}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Institution</Label>
                  <Input
                    placeholder="e.g., UC Davis, Stanford University"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    disabled={!isAdmin}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Describe your lab's research focus..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    disabled={!isAdmin}
                  />
                </div>

                {isAdmin && (
                  <Button
                    onClick={handleSaveOrgSettings}
                    disabled={isPending}
                    className="w-full sm:w-auto"
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Save Changes
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Pending Join Requests (Admin only) */}
            {isAdmin && pendingRequests.length > 0 && (
              <Card className="glass-panel border-0 shadow-none border-l-4 border-l-amber-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    Pending Join Requests
                    <Badge variant="secondary" className="ml-2">
                      {pendingRequests.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Review requests from researchers who want to join your lab
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-slate-50"
                    >
                      <div>
                        <p className="font-medium">
                          {request.user_name || "Unknown"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {request.user_email}
                        </p>
                        {request.message && (
                          <p className="text-sm text-slate-600 mt-1 italic">
                            &ldquo;{request.message}&rdquo;
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDenyRequest(request.id)}
                          disabled={isPending}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApproveRequest(request.id)}
                          disabled={isPending}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Clerk Organization Profile */}
            <Card className="glass-panel border-0 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Members & Invitations
                </CardTitle>
                <CardDescription>
                  Manage lab members and send invitations
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <OrganizationProfile
                  routing="hash"
                  appearance={{
                    elements: {
                      rootBox: "w-full",
                      card: "shadow-none border-0 bg-transparent",
                      scrollBox: "shadow-none border-0 bg-transparent",
                      navbar: "hidden",
                      pageScrollBox: "p-0",
                    },
                  }}
                />
              </CardContent>
            </Card>
          </>
        )}
      </TabsContent>

      {/* User Profile Tab */}
      <TabsContent value="profile" className="mt-4 sm:mt-6">
        <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 min-h-[400px] sm:min-h-[600px] flex justify-center overflow-x-auto">
          <UserProfile
            routing="hash"
            appearance={{
              elements: {
                rootBox: "w-full h-full max-w-full",
                card: "shadow-none border-0 bg-transparent w-full h-full",
                scrollBox: "shadow-none border-0 bg-transparent w-full h-full",
                navbar: "hidden md:flex",
              },
            }}
          />
        </div>
      </TabsContent>

      {/* Data Summary Tab */}
      <TabsContent value="data" className="mt-4 sm:mt-6">
        <Card className="glass-panel border-0 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Your Research Data
            </CardTitle>
            <CardDescription>
              Overview of all data you&apos;ve created across labs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-xl bg-slate-50">
                <p className="text-3xl font-bold text-slate-900">
                  {dataSummary?.totalCohorts || 0}
                </p>
                <p className="text-sm text-muted-foreground">Cohorts</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-slate-50">
                <p className="text-3xl font-bold text-slate-900">
                  {dataSummary?.totalMice || 0}
                </p>
                <p className="text-sm text-muted-foreground">Subjects</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-slate-50">
                <p className="text-3xl font-bold text-slate-900">
                  {dataSummary?.totalLogs || 0}
                </p>
                <p className="text-sm text-muted-foreground">Logs</p>
              </div>
            </div>

            {/* By Organization */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Data by Lab
              </h3>
              {dataSummary?.byOrg.map((org) => (
                <div
                  key={org.orgId || "personal"}
                  className={`flex items-center justify-between p-4 rounded-xl ${
                    org.isOrphaned
                      ? "bg-amber-50 border border-amber-200"
                      : "bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {org.isOrphaned ? (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    ) : (
                      <FolderKanban className="w-5 h-5 text-slate-400" />
                    )}
                    <div>
                      <p className="font-medium">
                        {org.orgName}
                        {org.isOrphaned && (
                          <Badge
                            variant="outline"
                            className="ml-2 text-amber-600 border-amber-300"
                          >
                            Deleted Lab
                          </Badge>
                        )}
                      </p>
                      {org.institution && (
                        <p className="text-sm text-muted-foreground">
                          {org.institution}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {org.cohortCount} cohort{org.cohortCount !== 1 ? "s" : ""}
                  </Badge>
                </div>
              ))}

              {(!dataSummary?.byOrg || dataSummary.byOrg.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  No data yet. Create your first cohort to get started!
                </p>
              )}
            </div>

            {/* Orphaned Data Notice */}
            {dataSummary?.byOrg.some((o) => o.isOrphaned) && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">
                      You have data in deleted labs
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      Some of your data belongs to labs that no longer exist.
                      This data is still visible to you, but not to other lab
                      members. You can continue using it or create a new lab to
                      organize future work.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
