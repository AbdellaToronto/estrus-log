'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Settings as SettingsIcon, 
  ChevronLeft, 
  Activity, 
  Users, 
  FileText,
  FlaskConical,
  UploadCloud,
  Loader2,
  Play,
  LayoutGrid
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSubject, CohortInsights } from "@/app/actions";
import { motion } from "framer-motion";
import { CohortAnalysis } from "@/components/cohort-analysis";
import { CohortLibrary } from "@/components/cohort-library";

export function CohortClient({ 
  cohort, 
  initialSubjects, 
  activeSession, 
  insights,
  logs 
}: { 
  cohort: any, 
  initialSubjects: any[], 
  activeSession?: any, 
  insights: CohortInsights,
  logs: any[]
}) {
  const [subjects, setSubjects] = useState(initialSubjects);
  const [isAddOpen, setIsAddOpen] = useState(false);

  async function handleAddSubject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    formData.append('cohortId', cohort.id);
    
    // Optimistic update
    const newSubject = {
      id: Math.random().toString(),
      name: formData.get('name') as string,
      cohort_id: cohort.id,
      created_at: new Date().toISOString(),
      status: 'Unknown',
      lastLog: 'Never'
    };
    
    setSubjects([newSubject, ...subjects]);
    setIsAddOpen(false);
    
    await createSubject(formData);
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors w-fit">
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <div className={`w-3 h-12 rounded-full ${cohort.color || 'bg-blue-500'}`} />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-1">{cohort.name}</h1>
              <div className="flex items-center gap-3 text-slate-500">
                <Badge variant="secondary" className="bg-white border-slate-200 text-slate-700 font-medium shadow-sm">
                  {cohort.type === 'estrus_tracking' ? 'Estrus Cycle' : 'General'}
                </Badge>
                <span className="text-sm">{cohort.description}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             {activeSession ? (
               <Link href={`/cohorts/${cohort.id}/batch`}>
                  <Button className="rounded-full h-10 px-5 bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-200 shadow-sm transition-all font-medium animate-pulse">
                     <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Resume Batch Scan
                  </Button>
               </Link>
             ) : (
               <Link href={`/cohorts/${cohort.id}/batch`}>
                  <Button className="rounded-full h-10 px-5 bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all font-medium">
                     <UploadCloud className="w-4 h-4 mr-2 text-slate-500" /> Batch Scan
                  </Button>
               </Link>
             )}
             <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100 text-slate-500">
               <SettingsIcon className="w-5 h-5" />
             </Button>
          </div>
        </div>
      </div>

      {/* Resume Banner (Only if active session) */}
      {activeSession && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 p-4 rounded-2xl flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-3">
             <div className="bg-amber-100 p-2 rounded-full">
                <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
             </div>
             <div>
                <h3 className="font-semibold text-amber-900">Batch Scan In Progress</h3>
                <p className="text-sm text-amber-700">You have a pending scan session from {new Date(activeSession.created_at).toLocaleDateString()}.</p>
             </div>
          </div>
          <Link href={`/cohorts/${cohort.id}/batch`}>
             <Button variant="outline" className="bg-white border-amber-200 text-amber-900 hover:bg-amber-50 hover:border-amber-300">
                Resume <Play className="w-3 h-3 ml-2 fill-amber-900" />
             </Button>
          </Link>
        </motion.div>
      )}

      {/* Stats Row - Clean & Legible */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Subjects", value: subjects.length, sub: "Active in study" },
          { label: "Last Activity", value: "Today", sub: "2 mins ago" },
          { label: "Avg. Confidence", value: "94%", sub: "+2% vs last week" },
          { label: "Completion", value: "85%", sub: "On track" }
        ].map((stat) => (
          <div key={stat.label} className="bg-white/60 backdrop-blur-xl p-5 rounded-2xl border border-white/50 shadow-sm flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</span>
            <span className="text-2xl font-bold text-slate-900">{stat.value}</span>
            <span className="text-xs text-slate-400 font-medium">{stat.sub}</span>
          </div>
        ))}
      </div>

      {/* Main Workspace */}
      <Tabs defaultValue="analysis" className="space-y-8">
        {/* Pill-style Tabs */}
        <TabsList className="bg-slate-100/50 p-1 rounded-full inline-flex h-auto border border-slate-200/50">
          <TabsTrigger value="analysis" className="rounded-full px-5 py-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-500 font-medium transition-all">
            <Activity className="w-4 h-4 mr-2" /> Analysis
          </TabsTrigger>
          <TabsTrigger value="subjects" className="rounded-full px-5 py-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-500 font-medium transition-all">
            <Users className="w-4 h-4 mr-2" /> Subjects
          </TabsTrigger>
          <TabsTrigger value="library" className="rounded-full px-5 py-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-500 font-medium transition-all">
            <LayoutGrid className="w-4 h-4 mr-2" /> Library
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subjects" className="space-y-6 focus-visible:outline-none">
          <div className="flex justify-between items-center">
             <h3 className="text-lg font-semibold text-slate-800">Active Subjects</h3>
             
             <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
              <SheetTrigger asChild>
                <Button className="rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 font-medium px-6">
                  <Plus className="mr-2 h-4 w-4" /> Add Subject
                </Button>
              </SheetTrigger>
              <SheetContent className="border-l border-slate-100 bg-white/95 backdrop-blur-xl sm:max-w-md">
                <SheetHeader className="mb-8 mt-4">
                  <SheetTitle className="text-2xl font-bold">Add Subject</SheetTitle>
                  <SheetDescription>
                    Register a new subject to this cohort.
                  </SheetDescription>
                </SheetHeader>
                <form onSubmit={handleAddSubject} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-slate-700 font-medium">Subject ID</Label>
                    <Input id="name" name="name" required placeholder="e.g. 227A" className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-primary/20 focus-visible:border-primary" />
                  </div>
                  
                  {/* Flexible Fields */}
                  {cohort.subject_config?.fields?.map((field: string) => (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={field} className="capitalize text-slate-700 font-medium">{field.replace('_', ' ')}</Label>
                      <Input id={field} name={field} placeholder={`Enter ${field}`} className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-primary/20 focus-visible:border-primary" />
                    </div>
                  ))}
                  
                  <div className="pt-4">
                    <Button type="submit" className="w-full rounded-xl h-12 text-base font-medium shadow-lg shadow-primary/10">Create Subject</Button>
                  </div>
                </form>
              </SheetContent>
            </Sheet>
          </div>

          <motion.div 
            layout
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
          >
            {subjects.map((subject) => (
              <Link key={subject.id} href={`/subjects/${subject.id}`}>
                <motion.div 
                  whileHover={{ scale: 1.02, y: -2 }}
                  className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 flex flex-col gap-3 cursor-pointer group border border-white/50 shadow-sm hover:shadow-md hover:bg-white/80 transition-all"
                >
                  <div className="aspect-square rounded-xl bg-slate-100/50 relative overflow-hidden flex items-center justify-center border border-slate-100 group-hover:border-slate-200 transition-colors">
                    <span className="text-3xl font-bold text-slate-200 group-hover:text-slate-300 transition-colors">{subject.name.substring(0, 2)}</span>
                    
                    {/* Overlay Badge */}
                    <div className="absolute top-2 right-2">
                        <Badge className={`
                        backdrop-blur-md shadow-sm border-0 font-normal
                        ${subject.status === 'Estrus' ? 'bg-red-100 text-red-700' : 
                          subject.status === 'Proestrus' ? 'bg-pink-100 text-pink-700' : 
                          'bg-slate-100 text-slate-600'}
                      `}>
                        {subject.status || 'Unknown'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <div className="font-bold text-slate-800 group-hover:text-primary transition-colors">{subject.name}</div>
                    <div className="text-xs text-slate-500 flex justify-between items-center mt-1 font-medium">
                       <span>Last Scan</span>
                       <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{subject.lastLog || '-'}</span>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </motion.div>
        </TabsContent>

        <TabsContent value="analysis" className="focus-visible:outline-none">
          <CohortAnalysis insights={insights} />
        </TabsContent>

        <TabsContent value="library" className="focus-visible:outline-none">
          <CohortLibrary logs={logs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
