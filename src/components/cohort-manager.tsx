'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

type Cohort = {
  id: string;
  name: string;
  description: string;
  color: string;
  type?: string;
};

// Renamed to CreateCohortButton to reflect its new single purpose
export function CreateCohortButton({ onAddCohort }: { onAddCohort: (c: Cohort) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('estrus_tracking');

  const handleAdd = () => {
    onAddCohort({
      id: Math.random().toString(36).substring(7),
      name,
      description,
      color: 'bg-blue-500', // Randomize later
      type
    });
    setOpen(false);
    setName('');
    setDescription('');
    setType('estrus_tracking');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full bg-white text-black hover:bg-white/90 font-semibold shadow-lg">
          <Plus className="mr-2 h-4 w-4" /> New Experiment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Experiment</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Experiment Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alcohol Study Group A" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="desc">Description</Label>
            <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="type">Experiment Template</Label>
            <select 
              id="type" 
              value={type} 
              onChange={(e) => setType(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="estrus_tracking">Mouse Estrus Cycle (Default)</option>
              <option value="general">General Observation</option>
            </select>
          </div>
          <Button onClick={handleAdd}>Create Experiment</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
