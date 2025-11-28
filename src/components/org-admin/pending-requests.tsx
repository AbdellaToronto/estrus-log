"use client";

import { useState, useEffect, useTransition } from "react";
import { useOrganization } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Mail,
  MessageSquare,
  Loader2,
} from "lucide-react";
import {
  getPendingRequestsForOrg,
  approveJoinRequest,
  denyJoinRequest,
  type JoinRequest,
} from "@/app/actions";

export function PendingRequests() {
  const { organization } = useOrganization();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Deny modal state
  const [showDenyModal, setShowDenyModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<JoinRequest | null>(
    null
  );
  const [denyNote, setDenyNote] = useState("");

  useEffect(() => {
    if (organization?.id) {
      loadRequests();
    }
  }, [organization?.id]);

  const loadRequests = async () => {
    if (!organization?.id) return;

    setLoading(true);
    try {
      const data = await getPendingRequestsForOrg(organization.id);
      setRequests(data);
    } catch (error) {
      console.error("Error loading requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (request: JoinRequest) => {
    startTransition(async () => {
      try {
        await approveJoinRequest(request.id);
        // Remove from list
        setRequests((prev) => prev.filter((r) => r.id !== request.id));
      } catch (error) {
        console.error("Error approving request:", error);
        alert("Failed to approve request");
      }
    });
  };

  const handleDeny = () => {
    if (!selectedRequest) return;

    startTransition(async () => {
      try {
        await denyJoinRequest(selectedRequest.id, denyNote);
        setRequests((prev) =>
          prev.filter((r) => r.id !== selectedRequest.id)
        );
        setShowDenyModal(false);
        setSelectedRequest(null);
        setDenyNote("");
      } catch (error) {
        console.error("Error denying request:", error);
        alert("Failed to deny request");
      }
    });
  };

  const openDenyModal = (request: JoinRequest) => {
    setSelectedRequest(request);
    setDenyNote("");
    setShowDenyModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-2">
          No Pending Requests
        </h3>
        <p className="text-slate-500 max-w-sm mx-auto">
          When someone requests to join your lab, their request will appear
          here for you to review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Pending Requests
          </h2>
          <p className="text-sm text-slate-500">
            Review and respond to join requests
          </p>
        </div>
        <Badge variant="secondary" className="bg-amber-100 text-amber-700">
          {requests.length} pending
        </Badge>
      </div>

      <div className="space-y-3">
        {requests.map((request) => (
          <div
            key={request.id}
            className="bg-white border border-slate-200 rounded-xl p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-slate-500" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">
                    {request.user_name || "Unknown User"}
                  </h3>
                  <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3.5 h-3.5" />
                    {request.user_email}
                  </p>
                  {request.message && (
                    <div className="mt-3 bg-slate-50 rounded-lg p-3">
                      <p className="text-sm text-slate-600 flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
                        {request.message}
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Requested{" "}
                    {new Date(request.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openDenyModal(request)}
                  disabled={isPending}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Deny
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleApprove(request)}
                  disabled={isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Approve
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Deny Modal */}
      <Dialog open={showDenyModal} onOpenChange={setShowDenyModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deny Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to deny this join request from{" "}
              {selectedRequest?.user_name || selectedRequest?.user_email}?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Reason (optional, internal only)
            </label>
            <Textarea
              placeholder="Add a note for your records..."
              value={denyNote}
              onChange={(e) => setDenyNote(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDenyModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDeny}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isPending ? "Denying..." : "Deny Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

