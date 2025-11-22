'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { CohortManager } from "@/components/cohort-manager";
import { Badge } from "@/components/ui/badge";
import { EstrusProgress } from "@/components/dashboard/estrus-progress";
import { RecentScans } from "@/components/dashboard/recent-scans";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createCohort, createSubject } from "@/app/actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export function DashboardClient({ initialCohorts, initialSubjects }: { initialCohorts: any[], initialSubjects: any[] }) {
  const [cohorts, setCohorts] = useState(initialCohorts);
  const [subjects, setSubjects] = useState(initialSubjects);
  const [search, setSearch] = useState('');
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);

  const filteredSubjects = subjects.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAddCohort(newCohort: any) {
    // Optimistic update
    setCohorts([newCohort, ...cohorts]);
    const formData = new FormData();
    formData.append('name', newCohort.name);
    formData.append('description', newCohort.description);
    await createCohort(formData);
  }

  async function handleAddSubject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const cohortId = formData.get('cohortId') as string;
    
    // Optimistic update (simplified)
    const newSubject = {
      id: Math.random().toString(), // Temp ID
      name,
      cohort_id: cohortId || null,
      created_at: new Date().toISOString(),
      status: 'Unknown',
      lastLog: 'Never'
    };
    setSubjects([newSubject, ...subjects]);
    setIsAddSubjectOpen(false);
    
    await createSubject(formData);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground/80">Mouse Estrus Tracker - Dashboard</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/40 border-white/20 rounded-full w-64 focus-visible:ring-0 focus-visible:bg-white/60 transition-all"
            />
          </div>
          <Avatar className="h-9 w-9 border-2 border-white/20">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>LW</AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Top Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EstrusProgress />
        <RecentScans />
      </div>

      {/* Main Content Area */}
      <div className="grid lg:grid-cols-[300px_1fr] gap-8">
        {/* Sidebar / Cohort List */}
        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-6">
             <CohortManager 
              cohorts={cohorts} 
              onAddCohort={handleAddCohort} 
            />
          </div>
        </div>

        {/* Subjects Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Data Library</h2>
            
            <Dialog open={isAddSubjectOpen} onOpenChange={setIsAddSubjectOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full bg-primary/80 hover:bg-primary backdrop-blur-sm">
                  <Plus className="mr-2 h-4 w-4" /> Add Mouse
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Mouse</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddSubject} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Mouse Name/ID</Label>
                    <Input id="name" name="name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cohortId">Cohort</Label>
                    <select id="cohortId" name="cohortId" className="w-full border rounded-md p-2 bg-background">
                      <option value="">Unassigned</option>
                      {cohorts.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <Button type="submit" className="w-full">Create Mouse</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Group by Cohort */}
          {[...cohorts, { id: null, name: 'Unassigned', color: 'bg-gray-300' }].map((cohort) => {
            const subjectsInCohort = filteredSubjects.filter(m => m.cohort_id === cohort.id || (cohort.id === null && !m.cohort_id));
            if (subjectsInCohort.length === 0) return null;

            return (
              <div key={cohort.id ?? 'unassigned'} className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{cohort.name}</h3>
                  <Badge variant="secondary" className="rounded-full bg-white/30">
                    {subjectsInCohort.length}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {subjectsInCohort.map((subject) => (
                    <Link key={subject.id} href={`/subjects/${subject.id}`}>
                      <div className="glass-card rounded-2xl p-4 flex flex-col gap-3 cursor-pointer group">
                        <div className="aspect-video rounded-xl bg-muted/50 relative overflow-hidden">
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50">
                            <span className="text-xs">No Image</span>
                          </div>
                          {/* Overlay Badge */}
                          <div className="absolute top-2 right-2">
                             <Badge className={`
                              backdrop-blur-md shadow-sm border-0
                              ${subject.status === 'Estrus' ? 'bg-red-500/80 hover:bg-red-500/90' : 
                                subject.status === 'Proestrus' ? 'bg-pink-400/80 hover:bg-pink-400/90' : 
                                'bg-slate-500/80 hover:bg-slate-500/90'}
                            `}>
                              {subject.status || 'Unknown'}
                            </Badge>
                          </div>
                        </div>
                        
                        <div>
                          <div className="font-semibold text-foreground/90 group-hover:text-primary transition-colors">{subject.name}</div>
                          <div className="text-xs text-muted-foreground">Last: {subject.lastLog || 'Never'}</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
