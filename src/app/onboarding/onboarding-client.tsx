"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Building2,
  Users,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  FlaskConical,
  Mail,
  ArrowRight,
} from "lucide-react";
import { CreateOrganization } from "@clerk/nextjs";
import {
  searchOrganizations,
  requestToJoinOrganization,
  cancelJoinRequest,
  type DiscoverableOrg,
  type JoinRequest,
} from "@/app/actions";

// Workaround for framer-motion + React 19
const MotionDiv = motion.div as any;

interface OnboardingClientProps {
  initialOrganizations: DiscoverableOrg[];
  institutions: string[];
  myRequests: (JoinRequest & { organization: DiscoverableOrg | null })[];
}

export function OnboardingClient({
  initialOrganizations,
  institutions,
  myRequests,
}: OnboardingClientProps) {
  const [organizations, setOrganizations] =
    useState<DiscoverableOrg[]>(initialOrganizations);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  // Modal states
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showJoinRequest, setShowJoinRequest] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<DiscoverableOrg | null>(null);
  const [joinMessage, setJoinMessage] = useState("");

  // Pending requests
  const pendingRequests = myRequests.filter((r) => r.status === "pending");

  const handleSearch = () => {
    startTransition(async () => {
      const results = await searchOrganizations(
        searchQuery || undefined,
        selectedInstitution === "all" ? undefined : selectedInstitution
      );
      setOrganizations(results);
    });
  };

  const handleRequestJoin = (org: DiscoverableOrg) => {
    setSelectedOrg(org);
    setJoinMessage("");
    setShowJoinRequest(true);
  };

  const submitJoinRequest = () => {
    if (!selectedOrg) return;

    startTransition(async () => {
      try {
        await requestToJoinOrganization(selectedOrg.id, joinMessage);
        setShowJoinRequest(false);
        setSelectedOrg(null);
        // Refresh the page to update pending requests
        window.location.reload();
      } catch (error) {
        console.error("Error submitting join request:", error);
        alert("Failed to submit request. You may already have a pending request.");
      }
    });
  };

  const handleCancelRequest = (requestId: string) => {
    startTransition(async () => {
      try {
        await cancelJoinRequest(requestId);
        window.location.reload();
      } catch (error) {
        console.error("Error cancelling request:", error);
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-rose-200/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-amber-200/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <MotionDiv
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-100/80 text-rose-700 text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Welcome to Estrus Log
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Join Your Research Lab
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Find your lab or department to start collaborating with your team.
            Don&apos;t see your lab? Create a new one.
          </p>
        </MotionDiv>

        {/* Pending Requests Banner */}
        <AnimatePresence>
          {pendingRequests.length > 0 && (
            <MotionDiv
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8"
            >
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-amber-100 rounded-xl">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900 mb-2">
                      Pending Requests
                    </h3>
                    <div className="space-y-3">
                      {pendingRequests.map((request) => (
                        <div
                          key={request.id}
                          className="flex items-center justify-between bg-white/60 rounded-xl p-4"
                        >
                          <div>
                            <p className="font-medium text-slate-900">
                              {request.organization?.name || "Unknown Lab"}
                            </p>
                            <p className="text-sm text-slate-500">
                              {request.organization?.institution || ""}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelRequest(request.id)}
                            disabled={isPending}
                          >
                            Cancel
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Search Section */}
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/50 shadow-xl shadow-slate-200/50 p-8 mb-8"
        >
          <div className="flex items-center gap-2 mb-6">
            <FlaskConical className="w-5 h-5 text-rose-500" />
            <h2 className="text-lg font-semibold text-slate-900">
              Find Your Lab
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by lab name, department, or institution..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-12 h-12 rounded-xl border-slate-200 bg-slate-50/50"
              />
            </div>
            <Select
              value={selectedInstitution}
              onValueChange={setSelectedInstitution}
            >
              <SelectTrigger className="w-full sm:w-[200px] h-12 rounded-xl border-slate-200 bg-slate-50/50">
                <Building2 className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Institution" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Institutions</SelectItem>
                {institutions.map((inst) => (
                  <SelectItem key={inst} value={inst}>
                    {inst}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleSearch}
              disabled={isPending}
              className="h-12 px-6 rounded-xl bg-slate-900 hover:bg-slate-800"
            >
              Search
            </Button>
          </div>
        </MotionDiv>

        {/* Results */}
        <MotionDiv
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-4 mb-8"
        >
          {organizations.length === 0 ? (
            <div className="text-center py-12 bg-white/60 rounded-3xl border border-slate-100">
              <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-2">No labs found</p>
              <p className="text-sm text-slate-400">
                Try a different search or create a new lab
              </p>
            </div>
          ) : (
            organizations.map((org, index) => {
              const hasPendingRequest = pendingRequests.some(
                (r) => r.organization?.id === org.id
              );

              return (
                <MotionDiv
                  key={org.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="group bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 p-6 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-100 to-rose-50 flex items-center justify-center flex-shrink-0">
                        {org.logo_url ? (
                          <img
                            src={org.logo_url}
                            alt={org.name}
                            className="w-10 h-10 rounded-xl object-cover"
                          />
                        ) : (
                          <FlaskConical className="w-6 h-6 text-rose-500" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 text-lg group-hover:text-rose-600 transition-colors">
                          {org.name}
                        </h3>
                        {org.institution && (
                          <p className="text-slate-500 flex items-center gap-1.5 mt-1">
                            <Building2 className="w-4 h-4" />
                            {org.institution}
                          </p>
                        )}
                        {org.description && (
                          <p className="text-slate-600 mt-2 text-sm line-clamp-2">
                            {org.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-3">
                          <Badge
                            variant="secondary"
                            className="bg-slate-100 text-slate-600"
                          >
                            <Users className="w-3 h-3 mr-1" />
                            {org.member_count} member
                            {org.member_count !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div>
                      {hasPendingRequest ? (
                        <Badge
                          variant="secondary"
                          className="bg-amber-100 text-amber-700"
                        >
                          <Clock className="w-3 h-3 mr-1" />
                          Pending
                        </Badge>
                      ) : (
                        <Button
                          onClick={() => handleRequestJoin(org)}
                          disabled={isPending}
                          className="rounded-xl bg-rose-500 hover:bg-rose-600 text-white"
                        >
                          Request to Join
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  </div>
                </MotionDiv>
              );
            })
          )}
        </MotionDiv>

        {/* Create New Lab Section */}
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white"
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">
                Don&apos;t see your lab?
              </h3>
              <p className="text-slate-300">
                Create a new lab and invite your team members to collaborate.
              </p>
            </div>
            <Button
              onClick={() => setShowCreateOrg(true)}
              size="lg"
              className="rounded-xl bg-white text-slate-900 hover:bg-slate-100 whitespace-nowrap"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create New Lab
            </Button>
          </div>
        </MotionDiv>

        {/* Alternative: Have an invite */}
        <MotionDiv
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-8"
        >
          <p className="text-slate-500">
            Already have an invite?{" "}
            <button className="text-rose-600 hover:text-rose-700 font-medium inline-flex items-center gap-1">
              <Mail className="w-4 h-4" />
              Check your email
            </button>
          </p>
        </MotionDiv>
      </div>

      {/* Create Organization Modal */}
      <Dialog open={showCreateOrg} onOpenChange={setShowCreateOrg}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Your Lab</DialogTitle>
            <DialogDescription>
              Set up your research lab and invite team members.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <CreateOrganization
              afterCreateOrganizationUrl="/dashboard"
              skipInvitationScreen={false}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Request Modal */}
      <Dialog open={showJoinRequest} onOpenChange={setShowJoinRequest}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request to Join</DialogTitle>
            <DialogDescription>
              Send a request to join {selectedOrg?.name}. The lab admin will
              review your request.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                  <FlaskConical className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">
                    {selectedOrg?.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {selectedOrg?.institution}
                  </p>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Message (optional)
              </label>
              <Textarea
                placeholder="Introduce yourself or explain why you'd like to join..."
                value={joinMessage}
                onChange={(e) => setJoinMessage(e.target.value)}
                rows={3}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowJoinRequest(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={submitJoinRequest}
              disabled={isPending}
              className="rounded-xl bg-rose-500 hover:bg-rose-600"
            >
              {isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

