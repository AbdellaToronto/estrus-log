"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, TestTube, Calendar, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { createExperiment, deleteExperiment } from "@/app/actions";
import { generateMockExperiment } from "@/app/actions-mock";
import { useRouter } from "next/navigation";

type Experiment = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

export function ExperimentsClient({
  initialExperiments,
}: {
  initialExperiments: Experiment[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    await createExperiment(formData);
    setLoading(false);
    setOpen(false);
  };

  const handleGenerateMock = async () => {
    if (
      !confirm(
        "Generate a sample experiment with mock data? This may take a few seconds."
      )
    )
      return;
    setGenerating(true);
    try {
      await generateMockExperiment();
    } catch (error) {
      console.error(error);
      alert("Failed to generate mock data");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); // Prevent Link navigation
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this experiment?")) return;
    
    try {
        await deleteExperiment(id);
        router.refresh();
    } catch(error) {
        console.error(error);
        alert("Failed to delete experiment");
    }
  };

  return (
    <div className="container py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Experiments</h1>
          <p className="text-muted-foreground mt-2">
            Manage and track your research experiments.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleGenerateMock}
            disabled={generating}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {generating ? "Generating..." : "Mock Data"}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New Experiment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Experiment</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g. Drug Trial Phase 1"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Optional description of the experiment design..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input id="start_date" name="start_date" type="date" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="end_date">End Date</Label>
                    <Input id="end_date" name="end_date" type="date" />
                  </div>
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating..." : "Create Experiment"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {initialExperiments.map((experiment) => (
          <Link
            key={experiment.id}
            href={`/experiments/${experiment.id}`}
            className="group block relative space-y-3 p-5 rounded-xl border bg-card text-card-foreground hover:border-primary/50 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <TestTube className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    experiment.status === "active"
                      ? "bg-green-500/10 text-green-500 border-green-500/20"
                      : experiment.status === "completed"
                      ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      : "bg-muted text-muted-foreground border-muted-foreground/20"
                  }`}
                >
                  {experiment.status || "Planned"}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive z-10"
                  onClick={(e) => handleDelete(e, experiment.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <h3 className="font-semibold leading-none tracking-tight group-hover:text-primary transition-colors">
                {experiment.name}
              </h3>
              {experiment.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                  {experiment.description}
                </p>
              )}
            </div>

            {(experiment.start_date || experiment.end_date) && (
              <div className="flex items-center text-xs text-muted-foreground mt-4 pt-4 border-t">
                <Calendar className="mr-2 h-3 w-3" />
                <span>
                  {experiment.start_date
                    ? new Date(experiment.start_date).toLocaleDateString()
                    : "TBD"}
                  {" - "}
                  {experiment.end_date
                    ? new Date(experiment.end_date).toLocaleDateString()
                    : "TBD"}
                </span>
              </div>
            )}
          </Link>
        ))}

        {initialExperiments.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-xl bg-muted/20">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <TestTube className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No experiments yet</h3>
            <p className="text-muted-foreground mt-1 mb-4">
              Create your first experiment to start tracking cohorts.
            </p>
            <Button onClick={() => setOpen(true)} variant="outline">
              Create Experiment
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
