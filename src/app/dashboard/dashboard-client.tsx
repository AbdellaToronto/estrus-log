'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Users, ChevronRight, Activity } from "lucide-react";
import { CreateCohortButton } from "@/components/cohort-manager";
import { Badge } from "@/components/ui/badge";
import { createCohort } from "@/app/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function DashboardClient({ initialCohorts, initialSubjects }: { initialCohorts: any[], initialSubjects: any[] }) {
  const [cohorts, setCohorts] = useState(initialCohorts);
  const [search, setSearch] = useState('');

  async function handleAddCohort(newCohort: any) {
    // Optimistic update
    setCohorts([newCohort, ...cohorts]);
    const formData = new FormData();
    formData.append('name', newCohort.name);
    formData.append('description', newCohort.description);
    formData.append('type', newCohort.type || 'estrus_tracking');
    await createCohort(formData);
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Manage your active experiments and studies.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search experiments..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/5 border-white/10 rounded-full w-64 focus-visible:ring-primary/50 focus-visible:bg-white/10 transition-all"
            />
          </div>
          
          <CreateCohortButton onAddCohort={handleAddCohort} />
        </div>
      </div>

      {/* Active Experiments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {cohorts.map(cohort => {
             const subjectCount = initialSubjects.filter(m => m.cohort_id === cohort.id).length;
             return (
                <Link key={cohort.id} href={`/cohorts/${cohort.id}`} className="group block h-full">
                   <div className="glass-panel p-6 rounded-3xl h-full transition-all duration-300 hover:scale-[1.02] hover:bg-white/10 flex flex-col justify-between relative overflow-hidden border border-white/10 hover:border-white/20 shadow-xl shadow-black/5">
                      
                      {/* Decorative Gradient Blob */}
                      <div className={`absolute -top-20 -right-20 w-40 h-40 bg-${cohort.color?.replace('bg-', '') || 'blue-500'}/20 rounded-full blur-3xl group-hover:bg-${cohort.color?.replace('bg-', '') || 'blue-500'}/30 transition-colors`} />

                      <div className="space-y-4 relative z-10">
                         <div className="flex items-center justify-between">
                            <div className={`w-12 h-12 rounded-2xl ${cohort.color || 'bg-blue-500'} flex items-center justify-center text-white font-bold text-xl shadow-lg transform group-hover:rotate-6 transition-transform`}>
                               {cohort.name.substring(0, 2).toUpperCase()}
                            </div>
                            <Badge variant="outline" className="bg-black/20 border-0 text-white/90 backdrop-blur-md">
                               {cohort.type === 'estrus_tracking' ? 'Estrus Cycle' : 'General'}
                            </Badge>
                         </div>
                         
                         <div>
                            <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{cohort.name}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2">{cohort.description || "No description provided."}</p>
                         </div>
                      </div>
                      
                      <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between text-sm text-muted-foreground group-hover:text-foreground transition-colors relative z-10">
                         <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>{subjectCount} Subjects</span>
                         </div>
                         <div className="flex items-center gap-1 text-xs font-medium opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                            Open Workspace <ChevronRight className="w-3 h-3" />
                         </div>
                      </div>
                   </div>
                </Link>
             )
          })}
          
          {/* Empty State */}
          {cohorts.length === 0 && (
            <div className="col-span-full py-20 text-center">
               <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-8 h-8 text-muted-foreground" />
               </div>
               <h3 className="text-lg font-semibold text-foreground">No experiments found</h3>
               <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-2">
                 Get started by creating a new experiment to track your subjects and data.
               </p>
            </div>
          )}
       </div>
    </div>
  );
}
