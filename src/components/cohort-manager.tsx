'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import Link from "next/link";

type Cohort = {
  id: string;
  name: string;
  description: string | null;
  color: string;
};

export type NewCohort = {
  name: string;
  description: string;
};

export function CohortManager({ cohorts, onAddCohort }: { cohorts: Cohort[], onAddCohort: (c: NewCohort) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleAdd = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setIsCreating(true);
    try {
      await onAddCohort({ name: trimmedName, description: description.trim() });
      setOpen(false);
      setName('');
      setDescription('');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Your cohorts</h2>
          <p className="mt-1 text-sm text-muted-foreground">Open a cohort to add subjects, upload images, or review its activity.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" /> New Cohort
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Cohort</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Control Group A" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="desc">Description</Label>
                <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
              </div>
              <Button onClick={handleAdd} disabled={!name.trim() || isCreating}>
                {isCreating ? 'Creating…' : 'Create Cohort'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-2">
        {cohorts.map((cohort) => (
          <div key={cohort.id} className="group flex items-center justify-between rounded-xl border border-border/80 bg-background p-3 transition-colors hover:border-primary/30 hover:bg-primary/[0.02]">
            <Link href={`/cohorts/${cohort.id}`} className="flex items-center gap-3 flex-1">
              <div className={`w-3 h-3 rounded-full ${cohort.color}`} />
              <div>
                <div className="font-medium text-sm group-hover:text-primary transition-colors">{cohort.name}</div>
                <div className="text-xs text-muted-foreground">{cohort.description}</div>
              </div>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem>Edit Cohort</DropdownMenuItem>
                <DropdownMenuItem>Manage Mice</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    </div>
  );
}
